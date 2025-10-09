const storage = {
  get(key, fallback = null) {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`Failed to parse localStorage key "${key}". Resetting value.`, error);
      localStorage.removeItem(key);
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem(key);
  },
};

const byId = (id) => document.getElementById(id);
const $all = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const EQUINOX_RARITY_CLASS = "equinoxBgImg";
let equinoxPulseActive = false;
let pendingEquinoxPulseState = null;

const REDUCED_ANIMATIONS_KEY = "reducedAnimationsEnabled";
let reducedAnimationsEnabled = Boolean(storage.get(REDUCED_ANIMATIONS_KEY, false));
let pendingReducedAnimationsState = reducedAnimationsEnabled ? true : null;

function syncReducedAnimationsOnBody(active) {
  const body = document.body;
  if (!body) {
    pendingReducedAnimationsState = Boolean(active);
    return;
  }

  body.classList.toggle("reduced-motion", Boolean(active));
  pendingReducedAnimationsState = null;
}

function isReducedAnimationsEnabled() {
  return reducedAnimationsEnabled;
}

function setReducedAnimationsEnabled(enabled) {
  const next = Boolean(enabled);
  if (next === reducedAnimationsEnabled && pendingReducedAnimationsState === null) {
    if (document.body) {
      document.body.classList.toggle("reduced-motion", next);
    }
    return;
  }

  reducedAnimationsEnabled = next;

  if (reducedAnimationsEnabled) {
    storage.set(REDUCED_ANIMATIONS_KEY, true);
  } else {
    storage.remove(REDUCED_ANIMATIONS_KEY);
  }

  syncReducedAnimationsOnBody(reducedAnimationsEnabled);

  if (reducedAnimationsEnabled) {
    setEquinoxPulseActive(false);
    stopFireworksAnimation();
  } else {
    startFireworksAnimation();
  }
}

if (reducedAnimationsEnabled) {
  syncReducedAnimationsOnBody(true);
}

function isEquinoxRarityClass(value) {
  return typeof value === "string" && value === EQUINOX_RARITY_CLASS;
}

function isEquinoxRecord(record) {
  return Boolean(record && isEquinoxRarityClass(record.rarityClass));
}

function syncEquinoxPulseOnBody(active) {
  const body = document.body;
  if (!body) {
    pendingEquinoxPulseState = active;
    return;
  }
  body.classList.toggle("equinox-pulse-active", Boolean(active));
  pendingEquinoxPulseState = null;
}

function setEquinoxPulseActive(active) {
  const shouldActivate = Boolean(active) && !isReducedAnimationsEnabled();
  if (shouldActivate === equinoxPulseActive && pendingEquinoxPulseState === null) {
    if (shouldActivate && document.body && !document.body.classList.contains("equinox-pulse-active")) {
      document.body.classList.add("equinox-pulse-active");
    }
    return;
  }

  equinoxPulseActive = shouldActivate;
  syncEquinoxPulseOnBody(shouldActivate);
}

let inventory = [];
let currentPage = 1;
const itemsPerPage = 10;
let rollCount = parseInt(localStorage.getItem("rollCount")) || 0;
let rollCount1 = parseInt(localStorage.getItem("rollCount1")) || 0;
const BASE_COOLDOWN_TIME = 500;
let cooldownTime = BASE_COOLDOWN_TIME;
let equippedItem = normalizeEquippedItemRecord(storage.get("equippedItem", null));
let currentAudio = null;
let isChangeEnabled = true;
let autoRollInterval = null;
const AUTO_ROLL_UNLOCK_ROLLS = 1000;
let audioVolume = 1;
let rollAudioVolume = 1;
let cutsceneAudioVolume = 1;
let titleAudioVolume = 1;
let menuAudioVolume = 1;
let isMuted = false;
let previousVolume = audioVolume;
let refreshTimeout;
let skipCutscene1K = true;
let skipCutscene10K = true;
let skipCutscene100K = true;
let skipCutscene1M = true;
let skipCutsceneTranscendent = true;
let cooldownBuffActive = cooldownTime < BASE_COOLDOWN_TIME;
const COOLDOWN_BUFF_REDUCE_TO_KEY = "cooldownBuffReduceTo";
const COOLDOWN_BUFF_EXPIRES_AT_KEY = "cooldownBuffExpiresAt";
let cooldownBuffTimeoutId = null;
let cooldownEffectIntervalId = null;
let rollDisplayHiddenByUser = false;
let cutsceneHidRollDisplay = false;
let cutsceneActive = false;
let cutsceneFailsafeTimeout = null;
// Keep the safeguard comfortably longer than any scripted cutscene
// so extended sequences aren't aborted before their own cleanup runs.
const CUTSCENE_FAILSAFE_DURATION_MS = 120000;
let lastRollPersisted = true;
let lastRollAutoDeleted = false;
let lastRollRarityClass = null;
let allowForcedAudioPlayback = false;
let pinnedAudioId = null;
let pausedEquippedAudioState = null;
let resumeEquippedAudioAfterCutscene = false;
let pendingCutsceneRarity = null;
let pendingAutoEquipRecord = null;
const rolledRarityBuckets = new Set(storage.get("rolledRarityBuckets", []));

const ROLL_AUDIO_IDS = new Set([
  "click",
  "suspenseAudio",
  "geezerSuspenceAudio",
  "polarrSuspenceAudio",
  "scareSuspenceAudio",
  "scareSuspenceLofiAudio",
  "bigSuspenceAudio",
  "hugeSuspenceAudio",
]);

const MENU_AUDIO_IDS = new Set(["mainAudio"]);

const MIN_ROLL_BUTTON_PROGRESS_DURATION = 320;
const CUTSCENE_PROGRESS_DURATION_FALLBACK = 5000;
const rollCooldownDurationMap = new Map();
let rollButtonDisableTimestamp = null;
let rollButtonCooldownContext = "default";
let rollButtonProgressArmed = false;

function recordRollCooldownDuration(context, duration) {
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    return;
  }

  const key = context || "default";
  const normalized = Math.max(duration, MIN_ROLL_BUTTON_PROGRESS_DURATION);
  rollCooldownDurationMap.set(key, normalized);

  if (key === "default") {
    rollCooldownDurationMap.set("buffed", normalized);
  }
}

function determineRollCooldownContext() {
  if (pendingCutsceneRarity && pendingCutsceneRarity.type) {
    return `cutscene:${pendingCutsceneRarity.type}`;
  }

  if (cutsceneActive) {
    return "cutscene:active";
  }

  if (cooldownBuffActive && cooldownTime < BASE_COOLDOWN_TIME) {
    return "buffed";
  }

  return "default";
}

function getRollCooldownDurationEstimate(context) {
  const stored = rollCooldownDurationMap.get(context);
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    return stored;
  }

  let fallback = cooldownTime;
  if (context.startsWith("cutscene:")) {
    fallback = Math.max(fallback, CUTSCENE_PROGRESS_DURATION_FALLBACK);
  }

  if (typeof fallback !== "number" || !Number.isFinite(fallback) || fallback <= 0) {
    const defaultStored = rollCooldownDurationMap.get("default");
    fallback = typeof defaultStored === "number" && Number.isFinite(defaultStored) && defaultStored > 0
      ? defaultStored
      : BASE_COOLDOWN_TIME;
  }

  return Math.max(fallback, MIN_ROLL_BUTTON_PROGRESS_DURATION);
}

function startRollButtonCooldownAnimation(button, duration) {
  if (!button) {
    return;
  }

  const progress = button.querySelector(".rollButton-progress");
  if (!progress) {
    return;
  }

  if (isReducedAnimationsEnabled()) {
    button.classList.remove("is-cooling");
    progress.style.transition = "none";
    progress.style.transform = "translateX(-100%)";
    return;
  }

  button.classList.add("is-cooling");
  progress.style.transition = "none";
  progress.style.transform = "translateX(0)";
  progress.offsetWidth; // reflow to restart transition
  progress.style.transition = `transform ${Math.max(duration, MIN_ROLL_BUTTON_PROGRESS_DURATION)}ms linear`;
  progress.style.transform = "translateX(-100%)";
}

function stopRollButtonCooldownAnimation(button) {
  if (!button) {
    return;
  }

  const progress = button.querySelector(".rollButton-progress");
  if (!progress) {
    return;
  }

  button.classList.remove("is-cooling");
  if (isReducedAnimationsEnabled()) {
    progress.style.transition = "none";
    progress.style.transform = "translateX(-100%)";
    return;
  }

  progress.style.transition = "none";
  progress.style.transform = "translateX(-100%)";
  progress.offsetWidth;
  progress.style.transition = "";
}

function handleRollButtonDisabled(button) {
  if (!button || !rollButtonProgressArmed) {
    return;
  }

  rollButtonCooldownContext = determineRollCooldownContext();
  rollButtonDisableTimestamp = performance.now();

  const estimate = getRollCooldownDurationEstimate(rollButtonCooldownContext);
  startRollButtonCooldownAnimation(button, estimate);
}

function handleRollButtonEnabled(button) {
  if (!button) {
    return;
  }

  if (!rollButtonProgressArmed) {
    rollButtonProgressArmed = true;
  }

  if (rollButtonDisableTimestamp !== null) {
    const elapsed = performance.now() - rollButtonDisableTimestamp;
    if (elapsed > 0 && Number.isFinite(elapsed)) {
      recordRollCooldownDuration(rollButtonCooldownContext, elapsed);
    }
  }

  rollButtonDisableTimestamp = null;
  rollButtonCooldownContext = "default";
  stopRollButtonCooldownAnimation(button);
}

function setupRollButtonProgress(button) {
  if (!button || button.dataset.rollProgressAttached === "true") {
    return;
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "attributes" || mutation.attributeName !== "disabled") {
        continue;
      }

      if (button.disabled) {
        handleRollButtonDisabled(button);
      } else {
        handleRollButtonEnabled(button);
      }
    }
  });

  observer.observe(button, { attributes: true, attributeFilter: ["disabled"] });

  if (!button.disabled) {
    rollButtonProgressArmed = true;
    stopRollButtonCooldownAnimation(button);
  } else {
    rollButtonProgressArmed = false;
    stopRollButtonCooldownAnimation(button);
  }

  button.dataset.rollProgressAttached = "true";
}

recordRollCooldownDuration("default", cooldownTime);

let postStartInitialized = false;
let audioSliderElement = null;
let audioSliderValueLabelElement = null;
let rollAudioSliderElement = null;
let rollAudioSliderValueLabelElement = null;
let cutsceneAudioSliderElement = null;
let cutsceneAudioSliderValueLabelElement = null;
let titleAudioSliderElement = null;
let titleAudioSliderValueLabelElement = null;
let menuAudioSliderElement = null;
let menuAudioSliderValueLabelElement = null;
let muteButtonElement = null;
let heartContainerElement = null;
let heartIntervalId = null;
let playTimeIntervalId = null;
let playTimeSeconds = parseInt(localStorage.getItem("playTime"), 10) || 0;

function normalizePlayTime(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return 0;
}

function formatPlayTimeDisplay(seconds) {
  const normalized = normalizePlayTime(seconds);
  const hrs = Math.floor(normalized / 3600);
  const mins = Math.floor((normalized % 3600) / 60);
  const secs = normalized % 60;

  return [
    hrs.toString().padStart(2, "0"),
    mins.toString().padStart(2, "0"),
    secs.toString().padStart(2, "0"),
  ].join(":");
}

function updatePlayTimeDisplay(seconds) {
  const timerDisplay = document.getElementById("timer");
  if (!timerDisplay) {
    return;
  }

  timerDisplay.textContent = formatPlayTimeDisplay(seconds);
}

function stopPlayTimeTracker() {
  if (!playTimeIntervalId) {
    return;
  }

  clearInterval(playTimeIntervalId);
  playTimeIntervalId = null;
}

function setPlayTimeSeconds(seconds, { persist = true, updateDisplay = true } = {}) {
  const normalized = normalizePlayTime(seconds);
  playTimeSeconds = normalized;

  if (persist) {
    localStorage.setItem("playTime", normalized);
  }

  if (updateDisplay) {
    updatePlayTimeDisplay(normalized);
  }

  return normalized;
}

function collectLocalStorageSnapshot() {
  const snapshot = {};

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) {
      continue;
    }

    snapshot[key] = localStorage.getItem(key);
  }

  return snapshot;
}
let autoRollButtonElement = null;

const STOPPABLE_AUDIO_IDS = [
  "suspenseAudio",
  "expOpeningAudio",
  "geezerSuspenceAudio",
  "polarrSuspenceAudio",
  "scareSuspenceAudio",
  "scareSuspenceLofiAudio",
  "waveAudio",
  "scorchingAudio",
  "beachAudio",
  "tidalwaveAudio",
  "gingerAudio",
  "x1staAudio",
  "lightAudio",
  "astblaAudio",
  "heartAudio",
  "tuonAudio",
  "blindAudio",
  "iriAudio",
  "aboAudio",
  "shaAudio",
  "lubjubAudio",
  "demsoAudio",
  "fircraAudio",
  "plabreAudio",
  "harvAudio",
  "norstaAudio",
  "sanclaAudio",
  "silnigAudio",
  "reidasAudio",
  "frogarAudio",
  "cancansymAudio",
  "ginharAudio",
  "jolbelAudio",
  "eniAudio",
  "darAudio",
  "nighAudio",
  "specAudio",
  "twiligAudio",
  "silAudio",
  "isekaiAudio",
  "equinoxAudio",
  "emerAudio",
  "samuraiAudio",
  "contAudio",
  "unstoppableAudio",
  "gargantuaAudio",
  "spectralAudio",
  "starfallAudio",
  "memAudio",
  "oblAudio",
  "phaAudio",
  "frightAudio",
  "unnamedAudio",
  "overtureAudio",
  "impeachedAudio",
  "eonbreakAudio",
  "celAudio",
  "silcarAudio",
  "gregAudio",
  "mintllieAudio",
  "geezerAudio",
  "polarrAudio",
  "oppAudio",
  "serAudio",
  "arcAudio",
  "ethAudio",
  "curAudio",
  "hellAudio",
  "wanspiAudio",
  "mysAudio",
  "voiAudio",
  "endAudio",
  "shadAudio",
  "froAudio",
  "forgAudio",
  "curartAudio",
  "ghoAudio",
  "abysAudio",
  "ethpulAudio",
  "griAudio",
  "celdawAudio",
  "fatreAudio",
  "fearAudio",
  "hauAudio",
  "foundsAudio",
  "lostsAudio",
  "hauntAudio",
  "devilAudio",
  "pumpkinAudio",
  "h1diAudio",
  "bigSuspenceAudio",
  "hugeSuspenceAudio",
  "expAudio",
  "veilAudio",
  "msfuAudio",
  "blodAudio",
  "orbAudio",
  "astredAudio",
  "crazeAudio",
  "shenviiAudio",
  "qbearAudio",
  "estbunAudio",
  "esteggAudio",
  "isekailofiAudio",
  "hypernovaAudio",
  "astraldAudio",
  "nebulaAudio",
  "glitchedAudio",
  "mastermindAudio",
  "mythicwallAudio",
  "thescarecrowssigilAudio",
  "pumpkinhollowAudio",
  "hollowhillmanorAudio",
  "thevoidsveilAudio",
  "thephantommoonAudio",
  "wailingshadeAudio"
];

const STOPPABLE_AUDIO_SET = new Set(STOPPABLE_AUDIO_IDS);
const CUTSCENE_AUDIO_IDS = STOPPABLE_AUDIO_IDS.filter(
  (id) => !ROLL_AUDIO_IDS.has(id) && !MENU_AUDIO_IDS.has(id)
);
const CUTSCENE_AUDIO_SET = new Set(CUTSCENE_AUDIO_IDS);
const CUTSCENE_VOLUME_AUDIO_IDS = new Set([
  "geezerSuspenceAudio",
  "polarrSuspenceAudio",
  "scareSuspenceAudio",
  "scareSuspenceLofiAudio",
  "bigSuspenceAudio",
  "hugeSuspenceAudio",
  "expOpeningAudio",
]);
const CUTSCENE_AUDIO_PLAYBACK_DELAY_MS = 100;

const RARITY_BUCKET_LABELS = {
  under100: "Basic",
  under1k: "Decent",
  under10k: "Grand",
  under100k: "Mastery",
  under1m: "Supreme",
  transcendent: "Transcendent",
  special: "Special"
};

// Update this set with the active event buckets (e.g., 'eventTitle') when seasonal events are running.
const ACTIVE_EVENT_BUCKETS = new Set([]);

function isEventBucketActive(bucket) {
  return typeof bucket === "string" && ACTIVE_EVENT_BUCKETS.has(bucket);
}

const originalAudioPlay = HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play = function (...args) {
  if (this instanceof HTMLAudioElement) {
    if (
      STOPPABLE_AUDIO_SET.has(this.id) &&
      !lastRollPersisted &&
      !allowForcedAudioPlayback
    ) {
      return Promise.resolve();
    }

    if (
      CUTSCENE_AUDIO_SET.has(this.id) &&
      (cutsceneActive || pendingCutsceneRarity) &&
      !allowForcedAudioPlayback
    ) {
      try {
        if (typeof this.pause === "function") {
          this.pause();
        }
      } catch (error) {
        /* no-op */
      }

      if (this.id) {
        resetAudioState(this, this.id);
      }

      return new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            const result = originalAudioPlay.apply(this, args);
            if (result && typeof result.then === "function") {
              result.then(resolve).catch(reject);
            } else {
              resolve(result);
            }
          } catch (error) {
            reject(error);
          }
        }, CUTSCENE_AUDIO_PLAYBACK_DELAY_MS);
      });
    }
  }

  return originalAudioPlay.apply(this, args);
};

function setRollButtonEnabled(enabled) {
  const button = document.getElementById("rollButton");
  if (button) {
    button.disabled = !enabled;
  }
}

function restoreRollDisplayAfterCutscene() {
  if (!cutsceneHidRollDisplay) {
    return;
  }

  const rollDisplay = document.querySelector(".container");
  if (!rollDisplay || rollDisplayHiddenByUser) {
    cutsceneHidRollDisplay = false;
    return;
  }

  rollDisplay.style.visibility = "visible";

  const toggleBtn = document.getElementById("toggleRollDisplayBtn");
  if (toggleBtn) {
    toggleBtn.textContent = "Hide Roll & Display";
  }

  cutsceneHidRollDisplay = false;
}

function scheduleCutsceneFailsafe() {
  clearTimeout(cutsceneFailsafeTimeout);
  cutsceneFailsafeTimeout = setTimeout(() => {
    if (!cutsceneActive) {
      return;
    }

    console.warn("Cutscene safeguard triggered after timeout; restoring roll display state.");
    isChangeEnabled = true;
    finalizeCutsceneState();
    setRollButtonEnabled(true);
  }, CUTSCENE_FAILSAFE_DURATION_MS);
}

function finalizeCutsceneState() {
  clearTimeout(cutsceneFailsafeTimeout);
  cutsceneFailsafeTimeout = null;
  cutsceneActive = false;
  updateEquipToggleButtonsDisabled(false);
  updateInventoryDeleteButtonsDisabled(false);
  ensureBgStack();
  if (__bgStack) {
    __bgStack.classList.remove("is-hidden");
  }
  restoreRollDisplayAfterCutscene();
  resumePausedEquippedAudio();
}

function restartClass(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function startFlash() {
  restartClass(document.body, 'flashing');
}

function hideRollDisplayForCutscene(container) {
  if (!container) {
    return;
  }

  const wasVisible = container.style.visibility !== "hidden";
  cutsceneHidRollDisplay = !rollDisplayHiddenByUser && wasVisible;

  container.style.visibility = "hidden";
}

const rarityCategories = {
  under100: [
    "commonBgImg",
    "rareBgImg",
    "epicBgImg",
    "legendaryBgImg",
    "impossibleBgImg",
    "poweredBgImg",
    "toxBgImg",
    "flickerBgImg",
    "solarpowerBgImg",
    "belivBgImg",
    "plabreBgImg",
  ],
  under1k: [
    "unstoppableBgImg",
    "spectralBgImg",
    "starfallBgImg",
    "gargBgImg",
    "memBgImg",
    "oblBgImg",
    "phaBgImg",
    "isekaiBgImg",
    "emerBgImg",
    "samuraiBgImg",
    "contBgImg",
    "wanspiBgImg",
    "froBgImg",
    "mysBgImg",
    "forgBgImg",
    "curartBgImg",
    "specBgImg",
  ],
  under10k: [
    "ethershiftBgImg",
    "hellBgImg",
    "frightBgImg",
    "seraphwingBgImg",
    "shadBgImg",
    "shaBgImg",
    "nighBgImg",
    "voiBgImg",
    "silBgImg",
    "ghoBgImg",
    "endBgImg",
    "abysBgImg",
    "darBgImg",
    "twiligBgImg",
    "ethpulBgImg",
    "eniBgImg",
    "griBgImg",
    "fearBgImg",
    "hauntBgImg",
    "foundsBgImg",
    "lostsBgImg",
    "hauBgImg",
    "lubjubBgImg",
    "radBgImg",
    "demsoBgImg",
    "astredBgImg",
    "isekailofiBgImg",
  ],
  under100k: [
    "celdawBgImg",
    "fatreBgImg",
    "unnamedBgImg",
    "eonbreakBgImg",
    "overtureBgImg",
    "arcanepulseBgImg",
    "harvBgImg",
    "devilBgImg",
    "cursedmirageBgImg",
    "tuonBgImg",
    "astblaBgImg",
    "qbearBgImg",
    "lightBgImg",
    "blodBgImg",
    "nebulaBgImg",
    "hypernovaBgImg",
    "mythicwallBgImg"
  ],
  under1m: [
    "impeachedBgImg",
    "celestialchorusBgImg",
    "x1staBgImg",
    "gregBgImg",
    "mintllieBgImg",
    "geezerBgGif",
    "polarrBgImg",
    "astraldBgImg",
    "mastermindBgImg",
  ],
  transcendent: [
    "silcarBgImg",
    "gingerBgImg",
    "h1diBgImg",
    "equinoxBgImg",
  ],
  special: [
    "iriBgImg",
    "veilBgImg",
    "expBgImg",
    "aboBgImg",
    "blindBgImg",
    "msfuBgImg",
    "orbBgImg",
    "crazeBgImg",
    "shenviiBgImg",
    "glitchedBgImg",
  ],
};

const RARITY_CLASS_BUCKET_MAP = Object.freeze(
  Object.entries(rarityCategories).reduce((acc, [bucket, classes]) => {
    classes.forEach((cls) => {
      acc[cls] = bucket;
    });
    return acc;
  }, {})
);

const RARITY_LABEL_CLASS_MAP = {
  silcarBgImg: "transcendent",
  gingerBgImg: "transcendent",
  h1diBgImg: ["transcendent", "h1di-flash"],
  equinoxBgImg: ["transcendent", "equinox-flash"],
  waveBgImg: "eventS25",
  beachBgImg: "eventS25",
  tidalwaveBgImg: "eventS25",
  scorchingBgImg: "eventS25",
  heartBgImg: "eventV25",
  esteggBgImg: "eventE25",
  estbunBgImg: "eventE25",
  fircraBgImg: "eventTitleNew25",
  pumpkinBgImg: "eventTitleHalloween24",
  norstaBgImg: "eventTitleXmas24",
  sanclaBgImg: "eventTitleXmas24",
  silnigBgImg: "eventTitleXmas24",
  reidasBgImg: "eventTitleXmas24",
  frogarBgImg: "eventTitleXmas24",
  cancansymBgImg: "eventTitleXmas24",
  ginharBgImg: "eventTitleXmas24",
  jolbelBgImg: "eventTitleXmas24",
  jolbeBgImg: "eventTitleXmas24",
  holcheBgImg: "eventTitleXmas24",
  cristoBgImg: "eventTitleXmas24",
  hollowhillmanorBgImg: "eventTitleHalloween25",
  pumpkinhollowBgImg: "eventTitleHalloween25",
  thephantommoonBgImg: "eventTitleHalloween25",
  thescarecrowssigilBgImg: "eventTitleHalloween25",
  thevoidsveilBgImg: "eventTitleHalloween25",
  wailingshadeBgImg: "eventTitleHalloween25",
};

const AUDIO_RESET_OVERRIDES = {
  gargantuaAudio: 14.5,
  eonbreakAudio: 2,
  mintllieAudio: 37
};

const audioElementCache = new Map();
const pendingAudioResetHandlers = new WeakMap();

const LOADING_SEQUENCE = [
  {
    message: "Obtaining saves...",
    action: () => {
      const savedInventory = storage.get("inventory", []);
      const { records: normalizedInventory, mutated } = normalizeInventoryRecords(savedInventory);
      inventory = normalizedInventory;
      if (mutated) {
        storage.set("inventory", normalizedInventory);
      }
      rollCount = parseInt(localStorage.getItem("rollCount")) || 0;
      rollCount1 = parseInt(localStorage.getItem("rollCount1")) || 0;
    },
  },
  {
    message: "Loading assets...",
    action: () => {
      musicLoad();
    },
  },
  {
    message: "Polishing titles...",
    action: () => {
      renderInventory();
      applyEquippedItemOnStartup();
    },
  },
  {
    message: "Cleaning the UI...",
    action: () => {
      loadToggledStates();
      updateRollCount(0);
      checkAchievements();
      updateAchievementsList();
      loadCutsceneSkip();
    },
  },
];

const LOADING_STEP_MIN_DURATION = 200;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 16);
    }
  });
}

async function runInitialLoadSequence(onProgress) {
  const report = typeof onProgress === "function" ? onProgress : () => {};

  for (const { message, action } of LOADING_SEQUENCE) {
    report(message);
    await nextFrame();

    const start = typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();

    await action();

    const end = typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();

    const elapsed = end - start;
    if (elapsed < LOADING_STEP_MIN_DURATION) {
      await wait(LOADING_STEP_MIN_DURATION - elapsed);
    }
  }

  report("Ready!");
  await wait(180);
}

function initializeAfterStart() {
  if (postStartInitialized) {
    return;
  }

  postStartInitialized = true;

  registerRollButtonHandler();
  registerCutsceneToggleButtons();
  registerDeleteAllButton();
  registerInterfaceToggleButtons();
  registerMenuButtons();
  registerResponsiveHandlers();
  setupInventoryTabs();
  registerMenuDragHandlers();
  enhanceInventoryDeleteButtons();
  setupAudioControls();
  initializeAutoRollControls();
  if (typeof initializeHeartEffect === "function") {
    initializeHeartEffect();
  }
  registerDataPersistenceButtons();
  initializePlayTimeTracker();
  registerRarityDeletionButtons();
  initializeCooldownBuffState();
  scheduleAllCooldownButtons();
  updateAchievementsList();
  processAchievementToastQueue();
}

const CUTSCENE_SKIP_SETTINGS = [
  {
    key: "skipCutscene1K",
    labelId: "1KTxt",
    label: "Skip Decent Cutscenes",
    buttonId: "toggleCutscene1K",
  },
  {
    key: "skipCutscene10K",
    labelId: "10KTxt",
    label: "Skip Grand Cutscenes",
    buttonId: "toggleCutscene10K",
  },
  {
    key: "skipCutscene100K",
    labelId: "100KTxt",
    label: "Skip Mastery Cutscenes",
    buttonId: "toggleCutscene100K",
  },
  {
    key: "skipCutscene1M",
    labelId: "1MTxt",
    label: "Skip Supreme Cutscenes",
    buttonId: "toggleCutscene1M",
  },
  {
    key: "skipCutsceneTranscendent",
    labelId: "transcendentTxt",
    label: "Skip Transcendent Cutscenes",
    buttonId: "toggleCutsceneTranscendent",
  },
];

const CUTSCENE_STATE_SETTERS = {
  skipCutscene1K: (value) => { skipCutscene1K = value; },
  skipCutscene10K: (value) => { skipCutscene10K = value; },
  skipCutscene100K: (value) => { skipCutscene100K = value; },
  skipCutscene1M: (value) => { skipCutscene1M = value; },
  skipCutsceneTranscendent: (value) => { skipCutsceneTranscendent = value; },
};

const CUTSCENE_STATE_GETTERS = {
  skipCutscene1K: () => skipCutscene1K,
  skipCutscene10K: () => skipCutscene10K,
  skipCutscene100K: () => skipCutscene100K,
  skipCutscene1M: () => skipCutscene1M,
  skipCutsceneTranscendent: () => skipCutsceneTranscendent,
};

function updateCutsceneSkipDisplay(
  { labelId, label, buttonId },
  cutsceneEnabled
) {
  const isSkipping = !cutsceneEnabled;

  const labelElement = byId(labelId);
  if (labelElement) {
    labelElement.textContent = `${label} ${isSkipping ? "On" : "Off"}`;
  }

  const buttonElement = byId(buttonId);
  if (buttonElement) {
    buttonElement.classList.toggle("active", isSkipping);
  }
}

const QUALIFYING_VAULT_BUCKETS = new Set(["under100k", "under1m", "transcendent", "special"]);

function normalizeInventoryRecord(raw) {
  if (raw == null) {
    return { record: null, mutated: raw !== undefined };
  }

  if (typeof raw === "string") {
    const title = raw.trim();
    if (!title) {
      return { record: null, mutated: true };
    }

    return {
      record: {
        title,
        rarityClass: "",
        qualifiesForVault: false,
      },
      mutated: true,
    };
  }

  if (typeof raw !== "object") {
    return { record: null, mutated: true };
  }

  const record = raw;
  let mutated = false;

  let title = "";
  if (typeof record.title === "string") {
    title = record.title.trim();
    if (title !== record.title) {
      record.title = title;
      mutated = true;
    }
  } else if (record.title != null) {
    title = String(record.title).trim();
    record.title = title;
    mutated = true;
  }

  if (!title) {
    return { record: null, mutated: true };
  }

  if (typeof record.rarityClass === "string") {
    const trimmed = record.rarityClass.trim();
    if (trimmed !== record.rarityClass) {
      record.rarityClass = trimmed;
      mutated = true;
    }
  } else if (record.rarityClass != null) {
    record.rarityClass = String(record.rarityClass).trim();
    mutated = true;
  } else if (record.rarityClass !== "") {
    record.rarityClass = "";
    mutated = true;
  }

  if (typeof record.rolledAt !== "number" || !Number.isFinite(record.rolledAt)) {
    if (Object.prototype.hasOwnProperty.call(record, "rolledAt")) {
      delete record.rolledAt;
      mutated = true;
    }
  }

  const bucket = normalizeRarityBucket(record.rarityClass);

  if (bucket) {
    if (record.rarityBucket !== bucket) {
      record.rarityBucket = bucket;
      mutated = true;
    }
  } else if (record.rarityBucket) {
    delete record.rarityBucket;
    mutated = true;
  }

  const qualifies = QUALIFYING_VAULT_BUCKETS.has(bucket);
  if (record.qualifiesForVault !== qualifies) {
    record.qualifiesForVault = qualifies;
    mutated = true;
  }

  return { record, mutated };
}

function normalizeInventoryRecords(records) {
  if (!Array.isArray(records)) {
    return { records: [], mutated: records != null };
  }

  const normalized = [];
  let mutated = false;

  records.forEach((raw) => {
    const { record, mutated: recordMutated } = normalizeInventoryRecord(raw);
    if (record) {
      normalized.push(record);
    } else {
      mutated = true;
    }

    if (recordMutated) {
      mutated = true;
    }
  });

  return { records: normalized, mutated };
}

function getQualifyingInventoryCount(items = inventory) {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  return items.reduce((total, item) => {
    if (!item || typeof item !== "object") {
      return total;
    }

    if (typeof item.qualifiesForVault === "boolean") {
      return item.qualifiesForVault ? total + 1 : total;
    }

    const bucket = item.rarityBucket || normalizeRarityBucket(item.rarityClass);
    if (bucket && bucket !== item.rarityBucket) {
      item.rarityBucket = bucket;
    } else if (!bucket && item.rarityBucket) {
      delete item.rarityBucket;
    }

    const qualifies = QUALIFYING_VAULT_BUCKETS.has(bucket);
    item.qualifiesForVault = qualifies;
    return qualifies ? total + 1 : total;
  }, 0);
}

function createEmptyAchievementStats() {
  return {
    qualifyingInventoryCount: 0,
    inventoryTitleSet: new Set(),
    eventBucketCounts: new Map(),
    totalEventTitleCount: 0,
    distinctEventBucketCount: 0,
  };
}

let latestAchievementStats = createEmptyAchievementStats();

function computeAchievementStats(items = inventory) {
  const qualifyingInventoryCount = getQualifyingInventoryCount(items);
  const inventoryTitleSet = new Set();
  const eventBucketCounts = new Map();
  let totalEventTitleCount = 0;

  if (Array.isArray(items)) {
    items.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }

      if (typeof item.title === "string" && item.title) {
        inventoryTitleSet.add(item.title);
      }

      const bucket =
        (typeof item.rarityBucket === "string" && item.rarityBucket) ||
        normalizeRarityBucket(item.rarityClass);

      if (bucket && bucket.startsWith("event")) {
        totalEventTitleCount += 1;
        eventBucketCounts.set(bucket, (eventBucketCounts.get(bucket) || 0) + 1);
      }
    });
  }

  const stats = {
    qualifyingInventoryCount,
    inventoryTitleSet,
    eventBucketCounts,
    totalEventTitleCount,
    distinctEventBucketCount: eventBucketCounts.size,
  };

  latestAchievementStats = stats;
  return stats;
}

const ACHIEVEMENTS = [
  // Roll milestones
  { name: "I think I like this", count: 100 },
  { name: "Finding the Groove", count: 250 },
  { name: "Hooked Already", count: 500 },
  { name: "This is getting serious", count: 1000 },
  { name: "Can't Stop Now", count: 2500 },
  { name: "I'm the Roll Master", count: 5000 },
  { name: "Streak Seeker", count: 7500 },
  { name: "It's over 9000!!", count: 10000 },
  { name: "Roll Revolution", count: 15000 },
  { name: "When will you stop?", count: 25000 },
  { name: "No Unnamed?", count: 30303 },
  { name: "Calculated Chaos", count: 40000 },
  { name: "Beyond Luck", count: 50000 },
  { name: "Rolling machine", count: 100000 },
  { name: "Your PC must be burning", count: 250000 },
  { name: "Half a million!1!!1", count: 500000 },
  { name: "Rolling Virtuoso", count: 750000 },
  { name: "One, Two.. ..One Million!", count: 1000000 },
  { name: "Millionaire Machine", count: 2000000 },
  { name: "Triple Threat Spinner", count: 3000000 },
  { name: "Momentum Master", count: 5000000 },
  { name: "Lucky Tenacity", count: 7500000 },
  { name: "No H1di?", count: 10000000 },
  { name: "Breaking Reality", count: 15000000 },
  { name: "Are you really doing this?", count: 25000000 },
  { name: "Multiversal Roller", count: 30000000 },
  { name: "You have no limits...", count: 50000000 },
  { name: "Anomaly Hunter", count: 75000000 },
  { name: "WHAT HAVE YOU DONE", count: 100000000 },
  { name: "Oddity Voyager", count: 150000000 },
  { name: "Improbability Engine", count: 300000000 },
  { name: "Beyond Imagination", count: 500000000 },
  { name: "AHHHHHHHHHHH", count: 1000000000 },
  { name: "Worldshaper", count: 2500000000 },
  { name: "Entropy Rewriter", count: 5000000000 },
  { name: "RNG Architect", count: 25000000000 },
  // Playtime goals
  { name: "Just the beginning", timeCount: 0 },
  { name: "Just Five More Minutes...", timeCount: 1800 },
  { name: "This doesn't add up", timeCount: 3600 },
  { name: "When does it end...", timeCount: 7200 },
  { name: "Late Night Grinder", timeCount: 21600 },
  { name: "I swear I'm not addicted...", timeCount: 36000 },
  { name: "Grass? What's that?", timeCount: 86400 },
  { name: "Unnamed's RNG biggest fan", timeCount: 172800 },
  { name: "Weekday Warrior", timeCount: 432000 },
  { name: "RNG is life!", timeCount: 604800 },
  { name: "I. CAN'T. STOP", timeCount: 1209600 },
  { name: "No Lifer", timeCount: 2629800 },
  { name: "Are you okay?", timeCount: 5259600 },
  { name: "Seasoned Grinder", timeCount: 9460800 },
  { name: "You are a True No Lifer", timeCount: 15778800 },
  { name: "No one's getting this legit", timeCount: 31557600 },
  { name: "Two Years Deep", timeCount: 63115200 },
  { name: "Triennial Tenacity", timeCount: 94672800 },
  { name: "Four-Year Fixture", timeCount: 126230400 },
  { name: "Half-Decade Hero", timeCount: 157788000 },
  { name: "Seven-Year Streak", timeCount: 220903200 },
  { name: "Decade of Determination", timeCount: 315576000 },
  { name: "Fifteen-Year Folly", timeCount: 473364000 },
  { name: "Twenty-Year Timeline", timeCount: 631152000 },
  { name: "Quarter-Century Quest", timeCount: 788940000 },
  { name: "Timeless Wanderer", timeCount: 946728000 },
  // Inventory milestones
  { name: "Tiny Vault", inventoryCount: 10 },
  { name: "Growing Gallery", inventoryCount: 25 },
  { name: "Treasure Trove", inventoryCount: 50 },
  { name: "Vault Legend", inventoryCount: 100 },
  // Rarity triumphs
  { name: "Grand Entrance", rarityBucket: "under10k" },
  { name: "One of a Kind", rarityBucket: "special" },
  { name: "Mastered the Odds", rarityBucket: "under100k" },
  { name: "Supreme Fortune", rarityBucket: "under1m" },
  { name: "Transcendent Conqueror", rarityBucket: "transcendent" },
  // Title triumphs
  { name: "Celestial Alignment", requiredTitle: "『Equinox』 [1 in 25,000,000]" },
  { name: "Creator?!", requiredTitle: "Unnamed [1 in 30,303]" },
  { name: "Silly Joyride", requiredTitle: "Silly Car :3 [1 in 1,000,000]" },
  { name: "Ginger Guardian", requiredTitle: "Ginger [1 in 1,144,141]" },
  { name: "H1di Hunted", requiredTitle: "H1di [1 in 9,890,089]" },
  { name: "902.. released.. wilderness..", requiredTitle: "Experiment [1 in 100,000/10th]" },
  { name: "Abomination Wrangler", requiredTitle: "Abomination [1 in 1,000,000/20th]" },
  { name: "Veiled Visionary", requiredTitle: "Veil [1 in 50,000/5th]" },
  { name: "Iridocyclitis Survivor", requiredTitle: "Iridocyclitis Veil [1 in 5,000/50th]" },
  { name: "Cherry Grove Champion", requiredTitle: "LubbyJubby's Cherry Grove [1 in 5,666]" },
  { name: "Firestarter", requiredTitle: "FireCraze [1 in 4,200/69th]" },
  { name: "Orbital Dreamer", requiredTitle: "ORB [1 in 55,555/30th]" },
  { name: "Glitched Reality", requiredTitle: "Gl1tch3d [1 in 12,404/40,404th]" },
  { name: "Gregarious Encounter", requiredTitle: "Greg [1 in 50,000,000]" },
  { name: "Mint Condition", requiredTitle: "Mintllie [1 in 500,000,000]" },
  { name: "Geezer Whisperer", requiredTitle: "Geezer [1 in 5,000,000,000]" },
  { name: "Polar Lights", requiredTitle: "Polarr [1 in 50,000,000,000]" },
  { name: "Mythical Gamer!!!!", requiredTitle: "MythicWall [1 in 17,017]" },
  // Event exclusives
  { name: "Spooky Spectator", requiredEventBucket: "eventTitleHalloween24" },
  { name: "Winter Wonderland", requiredEventBucket: "eventTitleXmas24" },
  { name: "Festival Firecracker", requiredEventBucket: "eventTitleNew25" },
  { name: "Valentine's Sweetheart", requiredEventBucket: "eventV25" },
  { name: "Happy Easter 2025!", requiredEventBucket: "eventE25" },
  { name: "Happy Summer 2025!", requiredEventBucket: "eventS25" },
  { name: "It's SPOOKY season!", requiredEventBucket: "eventTitleHalloween25" },
  { name: "Seasonal Tourist", minEventTitleCount: 1 },
  { name: "Event!", minDistinctEventBuckets: 1 },
  { name: "Event Explorer", minDistinctEventBuckets: 3 },
  { name: "Event Expert", minDistinctEventBuckets: 5 },
  { name: "Seasonal Archivist", minEventTitleCount: 10 },
  { name: "All the Seasons!", minEventTitleCount: 20 },
  { name: "I LOVE SEASONS!!!", minEventTitleCount: 50 },
];

const ACHIEVEMENT_DATA_BY_NAME = new Map(
  ACHIEVEMENTS.map((achievement) => [achievement.name, achievement])
);

function hasEventAchievementProgress(achievement, stats = latestAchievementStats) {
  if (!achievement || !stats) {
    return false;
  }

  const { eventBucketCounts, distinctEventBucketCount, totalEventTitleCount } = stats;

  if (achievement.requiredEventBucket) {
    return eventBucketCounts.has(achievement.requiredEventBucket);
  }

  if (Array.isArray(achievement.requiredEventBuckets) && achievement.requiredEventBuckets.length) {
    if (achievement.requiredEventBuckets.every((bucket) => eventBucketCounts.has(bucket))) {
      return true;
    }

    return achievement.requiredEventBuckets.some((bucket) => eventBucketCounts.has(bucket));
  }

  if (typeof achievement.minDistinctEventBuckets === "number") {
    if (distinctEventBucketCount >= achievement.minDistinctEventBuckets) {
      return true;
    }

    return distinctEventBucketCount > 0;
  }

  if (typeof achievement.minEventTitleCount === "number") {
    if (totalEventTitleCount >= achievement.minEventTitleCount) {
      return true;
    }

    return totalEventTitleCount > 0;
  }

  return false;
}

function isAchievementCurrentlyAvailable(achievement, stats = latestAchievementStats) {
  if (!achievement) {
    return true;
  }

  if (hasEventAchievementProgress(achievement, stats)) {
    return true;
  }

  if (achievement.requiredEventBucket) {
    return isEventBucketActive(achievement.requiredEventBucket);
  }

  if (Array.isArray(achievement.requiredEventBuckets)) {
    return achievement.requiredEventBuckets.every((bucket) => isEventBucketActive(bucket));
  }

  if (
    typeof achievement.minDistinctEventBuckets === "number" ||
    typeof achievement.minEventTitleCount === "number"
  ) {
    return ACTIVE_EVENT_BUCKETS.size > 0;
  }

  return true;
}

const COLLECTOR_ACHIEVEMENTS = [
  { name: "Achievement Collector", count: 5 },
  { name: "Achievement Hoarder", count: 10 },
  { name: "Achievement Addict", count: 20 },
  { name: "Achievement God", count: 33 },
  { name: "Ultimate Collector", count: 50 },
  { name: "Nice...", count: 69 },
  { name: "Achievement Enthusiast", count: 100 },
  { name: "Achievements...", count: 200 },
];

const ACHIEVEMENT_GROUP_STYLES = [
  { selector: ".achievement-item", unlocked: { backgroundColor: "blue" } },
  { selector: ".achievement-itemT", unlocked: { backgroundColor: "#0011ff9a" } },
  { selector: ".achievement-itemC", unlocked: { backgroundColor: "#ff00f281" } },
  { selector: ".achievement-itemInv", unlocked: { backgroundColor: "#2e8b5670" } },
  { selector: ".achievement-itemE", unlocked: { backgroundColor: "#ffee008a", color: "black" } },
  { selector: ".achievement-itemSum", unlocked: { backgroundColor: "#ff00158e" } },
  { selector: ".achievement-itemR", unlocked: { backgroundColor: "#0033ffa1" } },
  { selector: ".achievement-itemTitle", unlocked: { backgroundColor: "#765cafa2" } },
  { selector: ".achievement-itemEvent", unlocked: { backgroundColor: "#ffee00b7", color: "black" } },
];

const ACHIEVEMENT_TOAST_DURATION = 3400;
const achievementToastQueue = [];
let achievementToastContainer = null;
let achievementToastActive = false;

function ensureAchievementToastContainer() {
  if (achievementToastContainer && document.body.contains(achievementToastContainer)) {
    return achievementToastContainer;
  }

  achievementToastContainer = document.createElement("div");
  achievementToastContainer.className = "achievement-toast-stack";
  document.body.appendChild(achievementToastContainer);
  return achievementToastContainer;
}

function processAchievementToastQueue() {
  if (achievementToastActive || achievementToastQueue.length === 0) {
    return;
  }

  achievementToastActive = true;
  const name = achievementToastQueue.shift();
  const container = ensureAchievementToastContainer();

  const toast = document.createElement("div");
  toast.className = "achievement-toast";
  toast.innerHTML = `
    <div class="achievement-toast__icon"><i class="fa-solid fa-trophy"></i></div>
    <div class="achievement-toast__content">
      <span class="achievement-toast__title">Achievement Unlocked</span>
      <span class="achievement-toast__name">${name}</span>
    </div>
  `;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  updateAchievementsList();

  const removeToast = () => {
    if (!toast.isConnected) {
      return;
    }

    toast.classList.remove("show");
    toast.classList.add("hide");

    let finalized = false;
    const finalize = () => {
      if (finalized) {
        return;
      }
      finalized = true;
      toast.remove();
      achievementToastActive = false;
      updateAchievementsList();
      processAchievementToastQueue();
    };

    toast.addEventListener("transitionend", finalize, { once: true });
    setTimeout(finalize, 320);
  };

  setTimeout(removeToast, ACHIEVEMENT_TOAST_DURATION);
}

function getAudioElement(id) {
  if (audioElementCache.has(id)) {
    const cached = audioElementCache.get(id);
    if (cached && document.contains(cached)) {
      return cached;
    }
    audioElementCache.delete(id);
  }

  const element = document.getElementById(id) || window[id] || null;
  if (element && element.preload === "none") {
    element.preload = "auto";
  }

  audioElementCache.set(id, element);
  return element;
}

function resetAudioState(audio, id) {
  if (!audio) return;

  const targetTime = AUDIO_RESET_OVERRIDES[id] ?? 0;
  const assignTime = () => {
    if (typeof audio.currentTime === "number" && audio.currentTime !== targetTime) {
      try {
        audio.currentTime = targetTime;
      } catch (error) {
        // Ignore errors that occur if metadata isn't available yet.
      }
    }
  };

  assignTime();

  if (audio.readyState < 1 && !pendingAudioResetHandlers.has(audio)) {
    const handler = () => {
      pendingAudioResetHandlers.delete(audio);
      audio.removeEventListener("loadedmetadata", handler);
      assignTime();
    };
    pendingAudioResetHandlers.set(audio, handler);
    audio.addEventListener("loadedmetadata", handler, { once: true });
  }
}

function seekAudioWhenReady(audio, time) {
  if (!audio || typeof time !== "number" || Number.isNaN(time)) {
    return;
  }

  const assignTime = () => {
    try {
      if (typeof audio.currentTime === "number" && audio.currentTime !== time) {
        audio.currentTime = time;
      }
      return true;
    } catch (error) {
      return false;
    }
  };

  if (assignTime()) {
    return;
  }

  const handleReady = () => {
    if (assignTime()) {
      audio.removeEventListener("loadedmetadata", handleReady);
      audio.removeEventListener("canplay", handleReady);
    }
  };

  audio.addEventListener("loadedmetadata", handleReady);
  audio.addEventListener("canplay", handleReady);
}

function stopAllAudio(options = {}) {
  const preserveIds = new Set();

  if (options) {
    const { preservePinned = false, preserve = null } = options;
    if (preservePinned && pinnedAudioId) {
      preserveIds.add(pinnedAudioId);
    }

    if (typeof preserve === "string") {
      preserveIds.add(preserve);
    } else if (Array.isArray(preserve)) {
      preserve.forEach((id) => {
        if (id) {
          preserveIds.add(id);
        }
      });
    }
  }

  STOPPABLE_AUDIO_IDS.forEach((id) => {
    if (preserveIds.has(id)) {
      return;
    }

    const audio = getAudioElement(id);
    if (!audio) {
      return;
    }

    if (typeof audio.pause === "function") {
      audio.pause();
    }

    resetAudioState(audio, id);

    if (pausedEquippedAudioState && pausedEquippedAudioState.element === audio) {
      pausedEquippedAudioState = null;
      resumeEquippedAudioAfterCutscene = false;
    }

    if (currentAudio === audio) {
      currentAudio = null;
      if (pinnedAudioId === id) {
        pinnedAudioId = null;
      }
    }
  });
}

function pauseEquippedAudioForRarity(rarity) {
  if (!currentAudio) {
    resumeEquippedAudioAfterCutscene = false;
    pausedEquippedAudioState = null;
    return;
  }

  const rarityClass = rarity && typeof rarity === "object" ? rarity.class : null;
  const hasEquippableBackground = Boolean(
    rarityClass &&
    typeof backgroundDetails !== "undefined" &&
    backgroundDetails &&
    backgroundDetails[rarityClass]
  );

  const shouldResume = !hasEquippableBackground;

  try {
    const time = typeof currentAudio.currentTime === "number" ? currentAudio.currentTime : 0;
    const wasPlaying = !currentAudio.paused;
    if (wasPlaying) {
      currentAudio.pause();
    }
    pausedEquippedAudioState = {
      element: currentAudio,
      time,
      wasPlaying,
    };
  } catch (error) {
    pausedEquippedAudioState = {
      element: currentAudio,
      time: 0,
      wasPlaying: false,
    };
  }

  resumeEquippedAudioAfterCutscene = shouldResume;
}

function resumePausedEquippedAudio() {
  if (!resumeEquippedAudioAfterCutscene) {
    pausedEquippedAudioState = null;
    return;
  }

  const state = pausedEquippedAudioState;
  if (!state || !state.element) {
    resumeEquippedAudioAfterCutscene = false;
    pausedEquippedAudioState = null;
    return;
  }

  if (currentAudio && currentAudio !== state.element) {
    resumeEquippedAudioAfterCutscene = false;
    pausedEquippedAudioState = null;
    return;
  }

  const audio = state.element;
  const time = typeof state.time === "number" && !Number.isNaN(state.time) ? state.time : 0;

  seekAudioWhenReady(audio, time);

  if (state.wasPlaying) {
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => {
          seekAudioWhenReady(audio, time);
        })
        .catch(() => {});
    } else {
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
      seekAudioWhenReady(audio, time);
    }
  }

  currentAudio = audio;
  resumeEquippedAudioAfterCutscene = false;
  pausedEquippedAudioState = null;
}

function normalizeEquippedItemRecord(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const { title, rarityClass } = raw;
  if (typeof title !== "string" || typeof rarityClass !== "string") {
    return null;
  }

  const record = {
    title,
    rarityClass,
  };

  if (typeof raw.rolledAt === "number" && Number.isFinite(raw.rolledAt)) {
    record.rolledAt = raw.rolledAt;
  }

  return record;
}

function equippedRecordsMatch(a, b) {
  if (!a || !b) {
    return false;
  }

  if (a.title !== b.title || a.rarityClass !== b.rarityClass) {
    return false;
  }

  if (typeof a.rolledAt === "number" && typeof b.rolledAt === "number") {
    return a.rolledAt === b.rolledAt;
  }

  return true;
}

function isItemCurrentlyEquipped(item) {
  if (!equippedItem) {
    return false;
  }

  const candidate = normalizeEquippedItemRecord(item);
  if (!candidate) {
    return false;
  }

  return equippedRecordsMatch(candidate, equippedItem);
}

function applyEquippedItemOnStartup() {
  if (!equippedItem) {
    ensureMenuMusicPlaying();
    return;
  }

  const match = inventory.find((item) => isItemCurrentlyEquipped(item));
  if (!match) {
    equippedItem = null;
    storage.remove("equippedItem");
    changeBackground("menuDefault", null, { force: true });
    setEquinoxPulseActive(false);
    ensureMenuMusicPlaying();
    return;
  }

  const normalized = normalizeEquippedItemRecord(match);
  if (!normalized) {
    equippedItem = null;
    storage.remove("equippedItem");
    changeBackground("menuDefault", null, { force: true });
    setEquinoxPulseActive(false);
    ensureMenuMusicPlaying();
    return;
  }

  equippedItem = normalized;
  handleEquippedItem(normalized);
  if (typeof mainAudio !== "undefined" && mainAudio && typeof mainAudio.pause === "function") {
    try {
      mainAudio.pause();
    } catch (error) {
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const rollButton = byId("rollButton");
  const startButton = byId("startButton");
  const loadingScreen = byId("loadingScreen");
  const menuScreen = byId("menuScreen");
  const loadingText = loadingScreen ? loadingScreen.querySelector(".loadTxt") : null;

  if (pendingEquinoxPulseState !== null || equinoxPulseActive) {
    const desiredState = pendingEquinoxPulseState !== null ? pendingEquinoxPulseState : equinoxPulseActive;
    syncEquinoxPulseOnBody(desiredState);
  }

  if (pendingReducedAnimationsState !== null || reducedAnimationsEnabled) {
    const desiredReducedState = pendingReducedAnimationsState !== null ? pendingReducedAnimationsState : reducedAnimationsEnabled;
    syncReducedAnimationsOnBody(desiredReducedState);
  }

  if (rollButton) {
    setRollButtonEnabled(false);
    setupRollButtonProgress(rollButton);
  }

  if (!startButton) {
    return;
  }

  startButton.addEventListener("click", async () => {
    if (startButton.disabled) {
      return;
    }

    startButton.disabled = true;

    try {
      if (typeof mainAudio !== "undefined" && mainAudio && typeof mainAudio.play === "function") {
        if (mainAudio.preload === "none") {
          mainAudio.preload = "auto";
          try {
            mainAudio.load();
          } catch (error) {
          }
        }
        setTimeout(() => {
          const playAttempt = mainAudio.play();
          if (playAttempt && typeof playAttempt.catch === "function") {
            playAttempt.catch((error) => {
              console.warn("Unable to start background audio immediately.", error);
            });
          }
        }, 300);
      }
    } catch (error) {
      console.warn("Unable to start background audio immediately.", error);
    }

    if (menuScreen) {
      menuScreen.style.display = "none";
    }

    if (loadingScreen) {
      loadingScreen.style.display = "flex";
    }

    const updateMessage = (message) => {
      if (loadingText) {
        loadingText.textContent = message;
      }
    };

    try {
      await runInitialLoadSequence(updateMessage);
    } catch (error) {
      console.error("Failed to initialise game state.", error);
      updateMessage("Load failed. Tap play to retry.");
      if (loadingScreen) {
        loadingScreen.style.display = "none";
      }
      if (menuScreen) {
        menuScreen.style.display = "flex";
      }
      startButton.disabled = false;
      return;
    }

    if (loadingScreen) {
      loadingScreen.style.display = "none";
    }

    if (rollButton) {
      setRollButtonEnabled(true);
    }

    initializeAfterStart();
  });
});

function loadCutsceneSkip() {
  CUTSCENE_SKIP_SETTINGS.forEach((config) => {
    const { key } = config;
    const storedValue = storage.get(key);
    const resolvedValue = typeof storedValue === "boolean" ? storedValue : true;

    if (storedValue !== resolvedValue) {
      storage.set(key, resolvedValue);
    }

    const assignState = CUTSCENE_STATE_SETTERS[key];
    if (assignState) {
      assignState(resolvedValue);
    }

    updateCutsceneSkipDisplay(config, resolvedValue);
  });
}

function musicLoad() {
  stopAllAudio();
}

function formatRollCount(count) {
  if (count >= 1_000_000_000_000) {
      return Math.floor(count / 1_000_000_000_000) + 't';
  } else if (count >= 1_000_000_000) {
      return Math.floor(count / 1_000_000_000) + 'b';
  } else if (count >= 1_000_000) {
      return (Math.floor((count / 1_000_000) * 100) / 100) + 'm';
  } else if (count >= 100_000) {
      return Math.floor(count / 1_000) + 'k';
  } else if (count >= 1_000) {
      return (Math.floor((count / 1_000) * 100) / 100) + 'k';
  }
  return count.toString();
}

function updateRollDisplays() {
  const compactDisplay = byId("rollCountDisplay");
  if (compactDisplay) {
    compactDisplay.textContent = formatRollCount(rollCount);
  }

  const rawDisplay = byId("rollCountDisplay1");
  if (rawDisplay) {
    rawDisplay.textContent = rollCount1 + 1;
  }
}

function updateRollCount(increment = 1) {
  if (increment) {
    rollCount += increment;
    rollCount1 += increment + 1;
  }
  updateRollDisplays();
  updateAutoRollAvailability();
}

function persistUnlockedAchievements(unlocked) {
  storage.set("unlockedAchievements", Array.from(unlocked));
}

function unlockAchievement(name, unlocked) {
  if (unlocked.has(name)) {
    return;
  }
  unlocked.add(name);
  persistUnlockedAchievements(unlocked);
  showAchievementPopup(name);
}

function checkAchievements(context = {}) {
  const unlocked = new Set(storage.get("unlockedAchievements", []));
  const rarityBuckets = context && context.rarityBuckets instanceof Set
    ? context.rarityBuckets
    : new Set(storage.get("rolledRarityBuckets", []));
  const {
    qualifyingInventoryCount,
    inventoryTitleSet,
    eventBucketCounts,
    totalEventTitleCount,
    distinctEventBucketCount,
  } = computeAchievementStats();

  ACHIEVEMENTS.forEach((achievement) => {
    if (achievement.count && rollCount >= achievement.count) {
      unlockAchievement(achievement.name, unlocked);
    }

    if (
      achievement.timeCount !== undefined &&
      Number.isFinite(playTimeSeconds) &&
      playTimeSeconds >= achievement.timeCount
    ) {
      unlockAchievement(achievement.name, unlocked);
    }

    if (
      achievement.inventoryCount !== undefined &&
      qualifyingInventoryCount >= achievement.inventoryCount
    ) {
      unlockAchievement(achievement.name, unlocked);
    }

    if (achievement.rarityBucket && rarityBuckets.has(achievement.rarityBucket)) {
      unlockAchievement(achievement.name, unlocked);
    }

    if (
      achievement.requiredTitle &&
      inventoryTitleSet.has(achievement.requiredTitle)
    ) {
      unlockAchievement(achievement.name, unlocked);
    }

    if (
      Array.isArray(achievement.requiredTitles) &&
      achievement.requiredTitles.every((title) => inventoryTitleSet.has(title))
    ) {
      unlockAchievement(achievement.name, unlocked);
    }

    if (
      Array.isArray(achievement.anyTitle) &&
      achievement.anyTitle.some((title) => inventoryTitleSet.has(title))
    ) {
      unlockAchievement(achievement.name, unlocked);
    }

    if (
      achievement.requiredEventBucket &&
      eventBucketCounts.has(achievement.requiredEventBucket)
    ) {
      unlockAchievement(achievement.name, unlocked);
    }

    if (
      Array.isArray(achievement.requiredEventBuckets) &&
      achievement.requiredEventBuckets.every((bucket) =>
        eventBucketCounts.has(bucket)
      )
    ) {
      unlockAchievement(achievement.name, unlocked);
    }

    if (
      typeof achievement.minDistinctEventBuckets === "number" &&
      distinctEventBucketCount >= achievement.minDistinctEventBuckets
    ) {
      unlockAchievement(achievement.name, unlocked);
    }

    if (
      typeof achievement.minEventTitleCount === "number" &&
      totalEventTitleCount >= achievement.minEventTitleCount
    ) {
      unlockAchievement(achievement.name, unlocked);
    }
  });

  const unlockedCount = unlocked.size;

  COLLECTOR_ACHIEVEMENTS.forEach((collector) => {
    if (unlockedCount >= collector.count) {
      unlockAchievement(collector.name, unlocked);
    }
  });

  updateAutoRollAvailability();
}

function showAchievementPopup(name) {
  achievementToastQueue.push(name);
  if (postStartInitialized) {
    processAchievementToastQueue();
  }
}

function updateAchievementsList() {
  const unlocked = new Set(storage.get("unlockedAchievements", []));
  const stats = computeAchievementStats();

  ACHIEVEMENT_GROUP_STYLES.forEach(({ selector, unlocked: unlockedStyles }) => {
    $all(selector).forEach((item) => {
      const achievementName = item.getAttribute("data-name");
      const isUnlocked = achievementName && unlocked.has(achievementName);

      const unlockedBackground = unlockedStyles.background || unlockedStyles.backgroundColor;
      if (isUnlocked && unlockedBackground) {
        item.style.setProperty("--achievement-background", unlockedBackground);
        if (unlockedStyles.color) {
          item.style.setProperty("--achievement-color", unlockedStyles.color);
        } else {
          item.style.removeProperty("--achievement-color");
        }
        item.classList.add("achievement--unlocked");
      } else {
        item.style.setProperty(
          "--achievement-background",
          "linear-gradient(155deg, rgba(96, 96, 96, 0.85), rgba(58, 58, 58, 0.9))"
        );
        item.style.removeProperty("--achievement-color");
        item.classList.remove("achievement--unlocked");
      }
    });
  });

  $all("[data-name]").forEach((item) => {
    const achievementName = item.getAttribute("data-name");
    const achievement = ACHIEVEMENT_DATA_BY_NAME.get(achievementName);
    const isUnlocked = achievementName && unlocked.has(achievementName);
    const isActive = isAchievementCurrentlyAvailable(achievement, stats);
    const hasProgress = hasEventAchievementProgress(achievement, stats);
    const isEventAchievement = Boolean(
      achievement && (
        achievement.requiredEventBucket ||
        (Array.isArray(achievement.requiredEventBuckets) && achievement.requiredEventBuckets.length) ||
        typeof achievement.minDistinctEventBuckets === "number" ||
        typeof achievement.minEventTitleCount === "number"
      )
    );

    if (isEventAchievement) {
      if (!item.dataset.eventHint) {
        const baseHint = item.getAttribute("data-event");
        if (baseHint) {
          item.dataset.eventHint = baseHint;
        }
      }

      if (!isUnlocked && !isActive && !hasProgress) {
        item.classList.add("achievement--inactive");
        item.setAttribute("data-availability", "inactive");
        if (item.dataset.eventHint) {
          item.setAttribute("data-event", `${item.dataset.eventHint} (Currently unavailable)`);
        }
      } else {
        item.classList.remove("achievement--inactive");
        item.removeAttribute("data-availability");
        if (item.dataset.eventHint) {
          item.setAttribute("data-event", item.dataset.eventHint);
        }
      }
    } else {
      item.classList.remove("achievement--inactive");
      item.removeAttribute("data-availability");
    }
  });
}

function registerRollButtonHandler() {
  const rollButtonElement = document.getElementById("rollButton");
  if (!rollButtonElement) {
    return;
  }

  rollButtonElement.addEventListener("click", function () {
    const rollButton = byId("rollButton");
    if (!rollButton) {
      return;
    }

  const rollDisplay = document.querySelector(".container");
  if (rollDisplay && !rollDisplayHiddenByUser && rollDisplay.style.visibility === "hidden") {
    rollDisplay.style.visibility = "visible";
    cutsceneHidRollDisplay = false;
    const toggleBtn = document.getElementById("toggleRollDisplayBtn");
    if (toggleBtn) {
      toggleBtn.textContent = "Hide Roll & Display";
    }
  }

  mainAudio.pause();

  checkAchievements();
  updateAchievementsList();

  if (rollCount < 1) {
    rollCount++;
  }

  let rarity = rollRarity();
  pendingCutsceneRarity = rarity;

  const preservedAudioIds = [];
  if (
    resumeEquippedAudioAfterCutscene &&
    pausedEquippedAudioState &&
    pausedEquippedAudioState.element &&
    pausedEquippedAudioState.element.id
  ) {
    preservedAudioIds.push(pausedEquippedAudioState.element.id);
  }

  if (currentAudio && currentAudio.id) {
    preservedAudioIds.push(currentAudio.id);
  }

  stopAllAudio({
    preservePinned: true,
    preserve: preservedAudioIds,
  });

  let title = selectTitle(rarity);

  setRollButtonEnabled(false);

  const rollCountDisplay = byId("rollCountDisplay");
  if (rollCountDisplay) {
    rollCountDisplay.textContent = formatRollCount(rollCount);
  }
  const rollCountDisplayRaw = byId("rollCountDisplay1");
  if (rollCountDisplayRaw) {
    rollCountDisplayRaw.textContent = rollCount1 + 1;
  }

  if (
    rarity.type === "Cursed Mirage [1 in 11,111]" ||
    rarity.type === "Qbear [1 in 35,555]" ||
    rarity.type === "Wandering Spirit [1 in 150]" ||
    rarity.type === "Frozen Fate [1 in 200]" ||
    rarity.type === "Mysterious Echo [1 in 300]" ||
    rarity.type === "Forgotten Whisper [1 in 450]" ||
    rarity.type === "Cursed Artifact [1 in 700]" ||
    rarity.type === "Spectral Glare [1 in 850]" ||
    rarity.type === "Shadow Veil [1 in 1,000]" ||
    rarity.type === "Nightfall [1 in 1,200]" ||
    rarity.type === "Void Walker [1 in 1,500]" ||
    rarity.type === "Silent Listener [1 in 2,200]" ||
    rarity.type === "Ghostly Embrace [1 in 2,800]" ||
    rarity.type === "Endless Twilight [1 in 3,000]" ||
    rarity.type === "Abyssal Shade [1 in 3,500]" ||
    rarity.type === "Darkened Sky [1 in 4,200]" ||
    rarity.type === "Twisted Light [1 in 5,000]" ||
    rarity.type === "Ethereal Pulse [1 in 6,000]" ||
    rarity.type === "Enigmatic Dream [1 in 7,500]" ||
    rarity.type === "Celestial Dawn [1 in 12,000]" ||
    rarity.type === "Fate's Requiem [1 in 15,000]" ||
    rarity.type === "Demon Soul [1 in 9,999]" ||
    rarity.type === "Fear [1 in 1,250]" ||
    rarity.type === "Grim Destiny [1 in 8,500]" ||
    rarity.type === "Haunted Soul [1 in 2,000]" ||
    rarity.type === "Lost Soul [1 in 3,333]" ||
    rarity.type === "Devil's Heart [1 in 66,666]" ||
    rarity.type === "Shad0w [1 in 4,444]" ||
    rarity.type === "Found Soul [1 in 5,000]" ||
    rarity.type === "Haunted Reality [1 in 5,500]" ||
    rarity.type === "LubbyJubby's Cherry Grove [1 in 5,666]" ||
    rarity.type === "Arcane Pulse [1 in 77,777]" ||
    rarity.type === "Celestial Chorus [1 in 202,020]" ||
    rarity.type === "Eonbreak [1 in 20,000]" ||
    rarity.type === "Seraph's Wing [1 in 1,333]" ||
    rarity.type === "Ether Shift [1 in 5,540]" ||
    rarity.type === "Phantom Stride [1 in 990]" ||
    rarity.type === "Spectral Whisper [1 in 288]" ||
    rarity.type === "Starfall [1 in 600]" ||
    rarity.type === "Unstoppable [1 in 112]" ||
    rarity.type === "Memory [1 in 175]" ||
    rarity.type === "Isekai [1 in 300]" ||
    rarity.type === "Unfair [1 in ###]" ||
    rarity.type === "Emergencies [1 in 500]" ||
    rarity.type === "Samurai [1 in 800]" ||
    rarity.type === "Contortions [1 in 999]" ||
    rarity.type === "Gargantua [1 in 143]" ||
    rarity.type === "Oblivion [1 in 200]" ||
    rarity.type === "Fright [1 in 1,075]" ||
    rarity.type === "Unnamed [1 in 30,303]" ||
    rarity.type === "Overture [1 in 25,641]" ||
    rarity.type === "Impeached [1 in 101,010]" ||
    rarity.type === "Silly Car :3 [1 in 1,000,000]" ||
    rarity.type === "Greg [1 in 50,000,000]" ||
    rarity.type === "Mintllie [1 in 500,000,000]" ||
    rarity.type === "Geezer [1 in 5,000,000,000]" ||
    rarity.type === "Polarr [1 in 50,000,000,000]" ||
    rarity.type === "H1di [1 in 9,890,089]" ||
    rarity.type === "Rad [1 in 6,969]" ||
    rarity.type === "HARV [1 in 33,333]" ||
    rarity.type === "Experiment [1 in 100,000/10th]" ||
    rarity.type === "Veil [1 in 50,000/5th]" ||
    rarity.type === "Abomination [1 in 1,000,000/20th]" ||
    rarity.type === "Iridocyclitis Veil [1 in 5,000/50th]" ||
    rarity.type === "BlindGT [1 in 2,000,000/15th]" ||
    rarity.type === "MSFU [1 in 333/333rd]" ||
    rarity.type === "Blodhest [1 in 25,252]" ||
    rarity.type === "Tuon [1 in 50,000]" ||
    rarity.type === "ORB [1 in 55,555/30th]" ||
    rarity.type === "GD Addict [1 in ###]" ||
    rarity.type === "FireCraze [1 in 4,200/69th]" ||
    rarity.type === "sʜeɴvɪ✞∞ [1 in 77,777/7th]" ||
    rarity.type === "Light [1 in 29,979]" ||
    rarity.type === "X1sta [1 in 230,444]" ||
    rarity.type === "Hellish Fire [1 in 6,666]" ||
    rarity.type === "Isekai ♫ Lo-Fi [1 in 3,000]" ||
    rarity.type === "『Equinox』 [1 in 25,000,000]" ||
    rarity.type === "Ginger [1 in 1,144,141]" ||
    rarity.type === "Astrald [1 in 100,000]" ||
    rarity.type === "Hypernova [1 in 40,000]" ||
    rarity.type === "Nebula [1 in 62,500]" ||
    rarity.type === "Mastermind [1 in 110,010]" ||
    rarity.type === "Gl1tch3d [1 in 12,404/40,404th]" ||
    rarity.type === "MythicWall [1 in 17,017]" ||
    rarity.type === "The Scarecrow's Sigil [1 in 1,031]" ||
    rarity.type === "Pumpkin Hollow [1 in 3,110]" ||
    rarity.type === "Hollow Hill Manor [1 in 10,031]" ||
    rarity.type === "The Phantom Moon [1 in 10,031]" ||
    rarity.type === "The Void's Veil [1 in 10,031]" ||
    rarity.type === "Wailing Shade [1 in 31,010]"
  ) {
    const resultContainer = byId("result");
    if (resultContainer) {
      resultContainer.textContent = "";
    }
    const titleCont = document.querySelector(".container");
    if (!titleCont) {
      return;
    }
    hideRollDisplayForCutscene(titleCont);

    if (rarity.type === "Fright [1 in 1,075]") {
      frightAudio.play();
    } else if (rarity.type === "Gl1tch3d [1 in 12,404/40,404th]") {
      glitchedAudio.play();
    } else if (rarity.type === "Gargantua [1 in 143]") {
      gargantuaAudio.play();
    } else if (rarity.type === "Heart [1 in ♡♡♡]") {
      bigSuspenceAudio.play();
    } else if (rarity.type === "Qbear [1 in 35,555]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Easter Egg [1 in 13,333]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Easter Bunny [1 in 133,333]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "The Scarecrow's Sigil [1 in 1,031]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Pumpkin Hollow [1 in 3,110]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Hollow Hill Manor [1 in 10,031]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "The Phantom Moon [1 in 10,031]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "The Void's Veil [1 in 10,031]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Wailing Shade [1 in 31,010]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "MythicWall [1 in 17,017]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Memory [1 in 175]") {
      polarrSuspenceAudio.play();
    } else if (rarity.type === "Oblivion [1 in 200]") {
      polarrSuspenceAudio.play();
    } else if (rarity.type === "Eonbreak [1 in 20,000]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Hellish Fire [1 in 6,666]") {
      bigSuspenceAudio.play();
    } else if (rarity.type === "LubbyJubby's Cherry Grove [1 in 5,666]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Shad0w [1 in 4,444]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Demon Soul [1 in 9,999]") {
      bigSuspenceAudio.play();
    } else if (rarity.type === "GD Addict [1 in ###]") {
      bigSuspenceAudio.play();
    } else if (rarity.type === "Devil's Heart [1 in 66,666]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Phantom Stride [1 in 990]") {
      polarrSuspenceAudio.play();
    } else if (rarity.type === "Unnamed [1 in 30,303]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Fate's Requiem [1 in 15,000]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Celestial Dawn [1 in 12,000]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Unfair [1 in ###]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Overture [1 in 25,641]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Light [1 in 29,979]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "X1sta [1 in 230,444]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Cursed Mirage [1 in 11,111]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Wave [1 in 2,555]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Scorching [1 in 7,923]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Beach [1 in 12,555]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Tidal Wave [1 in 25,500]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "ORB [1 in 55,555/30th]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Grim Destiny [1 in 8,500]") {
      griAudio.play();
    } else if (rarity.type === "sʜeɴvɪ✞∞ [1 in 77,777/7th]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Isekai [1 in 300]") {
      scareSuspenceAudio.play();
    } else if (rarity.type === "Isekai ♫ Lo-Fi [1 in 3,000]") {
      scareSuspenceLofiAudio.play();
    } else if (rarity.type === "『Equinox』 [1 in 25,000,000]") {
      equinoxAudio.play();
    } else if (rarity.type === "Ginger [1 in 1,144,141]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Emergencies [1 in 500]") {
      scareSuspenceAudio.play();
    } else if (rarity.type === "Samurai [1 in 800]") {
      scareSuspenceAudio.play();
    } else if (rarity.type === "Contortions [1 in 999]") {
      scareSuspenceAudio.play();
    } else if (rarity.type === "Impeached [1 in 101,010]") {
      impeachedAudio.play();
    } else if (rarity.type === "Arcane Pulse [1 in 77,777]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "HARV [1 in 33,333]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Astrald [1 in 100,000]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Hypernova [1 in 40,000]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Nebula [1 in 62,500]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Mastermind [1 in 110,010]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Tuon [1 in 50,000]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Experiment [1 in 100,000/10th]") {
      expOpeningAudio.play();
    } else if (rarity.type === "H1di [1 in 9,890,089]") {
      h1diAudio.play();
    } else if (rarity.type === "Veil [1 in 50,000/5th]") {
      veilAudio.play();
    } else if (rarity.type === "Blodhest [1 in 25,252]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Abomination [1 in 1,000,000/20th]") {
      aboAudio.play();
      let warningPopup = document.getElementById("warningPopup");
      setTimeout(function () {
        warningPopup.style.display = "block";
      }, 100);
      setTimeout(function () {
        warningPopup.style.display = "none";
      }, 400);
      setTimeout(function () {
        warningPopup.style.display = "block";
      }, 700);
      setTimeout(function () {
        warningPopup.style.display = "none";
      }, 1000);
      setTimeout(function () {
        warningPopup.style.display = "block";
      }, 1300);
      setTimeout(function () {
        warningPopup.style.display = "none";
      }, 1600);
      setTimeout(function () {
        warningPopup.style.display = "block";
      }, 1900);
      setTimeout(function () {
        warningPopup.style.display = "none";
      }, 2200);
      setTimeout(function () {
        warningPopup.style.display = "block";
      }, 2500);
      setTimeout(function () {
        warningPopup.style.display = "none";
      }, 2800);
    } else if (rarity.type === "Celestial Chorus [1 in 202,020]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Iridocyclitis Veil [1 in 5,000/50th]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Geezer [1 in 5,000,000,000]") {
      geezerSuspenceAudio.play();
      let geezerPopup = document.getElementById("geezerPopup");
      setTimeout(function () {
        geezerPopup.style.display = "block";
      }, 100);
      setTimeout(function () {
        geezerPopup.style.display = "none";
      }, 400);
      setTimeout(function () {
        geezerPopup.style.display = "block";
      }, 700);
      setTimeout(function () {
        geezerPopup.style.display = "none";
      }, 1000);
      setTimeout(function () {
        geezerPopup.style.display = "block";
      }, 1300);
      setTimeout(function () {
        geezerPopup.style.display = "none";
      }, 1600);
      setTimeout(function () {
        geezerPopup.style.display = "block";
      }, 1900);
      setTimeout(function () {
        geezerPopup.style.display = "none";
      }, 9000);
    } else if (rarity.type === "Polarr [1 in 50,000,000,000]") {
      polarrSuspenceAudio.play();
    } else if (rarity.type === "Greg [1 in 50,000,000]") {
      gregAudio.play();
    } else if (rarity.type === "Rad [1 in 6,969]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "BlindGT [1 in 2,000,000/15th]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "FireCraze [1 in 4,200/69th]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "MSFU [1 in 333/333rd]") {
      msfuAudio.play();
    } else if (rarity.type == "Silly Car :3 [1 in 1,000,000]") {
      if (!skipCutsceneTranscendent) {
        if (typeof silcarAudio?.pause === "function") {
          try {
            silcarAudio.pause();
            silcarAudio.currentTime = 0;
          } catch (error) {
            /* no-op */
          }
        }
        silcarAudio.play();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
      } else {
        silcarAudio.play();
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 100);
      setTimeout(function () {
        document.body.className = "redBg";
      }, 200);
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 300);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 400);
      setTimeout(function () {
        document.body.className = "redBg";
      }, 500);
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 600);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 700);
      setTimeout(function () {
        document.body.className = "redBg";
      }, 800);
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 900);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 1000);
      setTimeout(function () {
        document.body.className = "redBg";
      }, 1100);
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 1200);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 1300);
      setTimeout(function () {
        document.body.className = "redBg";
      }, 1400);
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 1500);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 1600);
      setTimeout(function () {
        document.body.className = "redBg";
      }, 1700);
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 1800);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 1900);
      setTimeout(function () {
        document.body.className = "redBg";
      }, 2000);
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 2100);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 2200);
      setTimeout(function () {
        document.body.className = "redBg";
      }, 2300);
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 2400);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 2500);
      setTimeout(function () {
        document.body.className = "redBg";
      }, 2600);
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 2700);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 2800);
      setTimeout(function () {
        document.body.className = "redBg";
      }, 2900);
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 3000);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 3100);
      setTimeout(function () {
        document.body.className = "redBg";
      }, 3200);
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 3300);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 3400);
      setTimeout(function () {
        document.body.className = "redBg";
      }, 3500);
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 3600);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 3700);
      }
    } else if (rarity.type === "Mintllie [1 in 500,000,000]") {
      suspenseAudio.play();
      let warningPopup = document.getElementById("warningPopup");
      setTimeout(function () {
        document.body.className = "blackBg";
        warningPopup.style.display = "block";
      }, 100);
      setTimeout(function () {
        document.body.className = "redBg";
        warningPopup.style.display = "none";
      }, 300);
      setTimeout(function () {
        document.body.className = "blackBg";
        warningPopup.style.display = "block";
      }, 400);
      setTimeout(function () {
        document.body.className = "redBg";
        warningPopup.style.display = "none";
      }, 600);
      setTimeout(function () {
        document.body.className = "blackBg";
        warningPopup.style.display = "block";
      }, 700);
      setTimeout(function () {
        document.body.className = "redBg";
        warningPopup.style.display = "none";
      }, 900);
      setTimeout(function () {
        document.body.className = "blackBg";
        warningPopup.style.display = "block";
      }, 1000);
      setTimeout(function () {
        document.body.className = "redBg";
        warningPopup.style.display = "none";
      }, 1200);
      setTimeout(function () {
        document.body.className = "blackBg";
        warningPopup.style.display = "block";
      }, 1300);
      setTimeout(function () {
        document.body.className = "redBg";
        warningPopup.style.display = "none";
      }, 1500);
      setTimeout(function () {
        document.body.className = "blackBg";
        warningPopup.style.display = "block";
      }, 1600);
      setTimeout(function () {
        document.body.className = "redBg";
        warningPopup.style.display = "none";
      }, 1800);
      setTimeout(function () {
        document.body.className = "blackBg";
        warningPopup.style.display = "block";
      }, 1900);
      setTimeout(function () {
        document.body.className = "redBg";
        warningPopup.style.display = "none";
      }, 2100);
      setTimeout(function () {
        document.body.className = "blackBg";
        warningPopup.style.display = "block";
      }, 2200);
      setTimeout(function () {
        document.body.className = "redBg";
        warningPopup.style.display = "none";
      }, 2400);
      setTimeout(function () {
        document.body.className = "blackBg";
        warningPopup.style.display = "block";
      }, 2500);
      setTimeout(function () {
        document.body.className = "redBg";
        warningPopup.style.display = "none";
      }, 2700);
      setTimeout(function () {
        document.body.className = "blackBg";
        warningPopup.style.display = "block";
      }, 2800);
      setTimeout(function () {
        document.body.className = "redBg";
        warningPopup.style.display = "none";
      }, 3000);
      setTimeout(function () {
        document.body.className = "blackBg";
        warningPopup.style.display = "block";
      }, 3100);
      setTimeout(function () {
        document.body.className = "redBg";
        warningPopup.style.display = "none";
      }, 3300);
      setTimeout(function () {
        document.body.className = "blackBg";
        warningPopup.style.display = "block";
      }, 3400);
      setTimeout(function () {
        document.body.className = "redBg";
        warningPopup.style.display = "none";
      }, 3600);
      setTimeout(function () {
        document.body.className = "blackBg";
        warningPopup.style.display = "block";
        suspenseAudio.play();

        warningPopup.style.display = "none";
      }, 3700);
    } else {
      suspenseAudio.play();
    }

    if (rarity.type === "Greg [1 in 50,000,000]") {
      document.body.className = "blackBg";
      disableChange();
      startAnimation01();
      const container = document.getElementById("starContainer");

      for (let i = 0; i < 33; i++) {
        const star = document.createElement("span");
        star.className = "pink-star";
        star.innerHTML = "⁜";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }

      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          displayResult(title, rarity.type);
          updateRollingHistory(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
        }, 100);
        enableChange();
      }, 3000); // Wait for 3 seconds
    } else if (rarity.type === "Arcane Pulse [1 in 77,777]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
  
        const container1 = document.getElementById("squareContainer");
  
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-blue";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 100);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 10370); // Stop after 10.75 seconds
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            arcAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        arcAudio.play();
      }
    } else if (rarity.type === "Experiment [1 in 100,000/10th]") {
      disableChange();

      setTimeout(() => {
        document.body.style.backgroundImage = "url('files/backgrounds/exp_cutscene.gif')";
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundRepeat = "no-repeat";
        document.body.style.backgroundPosition = "center";
      }, 700)
    
      const container1 = document.getElementById("squareContainer");
      const container = document.getElementById("starContainer");
    
      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-white";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }
    
      setTimeout(() => {
        clearInterval(squareInterval);
      }, 20000); // Stop after 20 seconds
    
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
    
        const starClasses = [
          "white-star",
          "red-star"
        ];
        star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
    
        star.innerHTML = "▱";
        star.style.left = Math.random() * 100 + "vw";
    
        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);
    
        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);
    
        star.style.animationDelay = i * 0.08 + "s";
    
        container.appendChild(star);
    
        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        document.body.style.backgroundImage = "";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          displayResult(title, rarity.type);
          updateRollingHistory(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          expAudio.play();
        }, 100);
        enableChange();
      }, 20550); // Wait for 20.55 seconds
    } else if (rarity.type === "Hypernova [1 in 40,000]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-yellow";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "orange-star",
            "dark-red-star",
            "black-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "◈";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            hypernovaAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        hypernovaAudio.play();
      }
    } else if (rarity.type === "Nebula [1 in 62,500]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-blue";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "blue-star",
            "dark-blue-star",
            "black-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "◈";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            nebulaAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        nebulaAudio.play();
      }
    } else if (rarity.type === "Astrald [1 in 100,000]") {
      if (skipCutscene1M) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-blue";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "purple-star",
            "blue-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "<*>";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            astraldAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        astraldAudio.play();
      }
    } else if (rarity.type === "Mastermind [1 in 110,010]") {
      if (skipCutscene1M) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-white";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "white-star",
            "black-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "-X-";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            mastermindAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        mastermindAudio.play();
      }
    } else if (rarity.type === "Gl1tch3d [1 in 12,404/40,404th]") {
      disableChange();
      startAnimationA2()
    
      const container1 = document.getElementById("squareContainer");
      const container = document.getElementById("starContainer");
      const container2 = document.getElementById("starContainer");
      const container3 = document.getElementById("starContainer");

      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-white";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
      }, 50);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 4550); // Stop after 4.55 seconds
    
      for (let i = 0; i < 404; i++) {
        const star = document.createElement("span");
        const star2 = document.createElement("span2");
        const star3 = document.createElement("span3");
    
        const starClass = [
          "glitch-green-star",
        ];
        const starClass2 = [
          "glitch-blue-star",
        ];
        const starClass3 = [
          "glitch-red-star",
        ];
        star.className = starClass[Math.floor(Math.random() * starClass.length)];
        star2.className = starClass2[Math.floor(Math.random() * starClass2.length)];
        star3.className = starClass3[Math.floor(Math.random() * starClass3.length)];

        star.innerHTML = "#";
        star.style.left = Math.random() * 100 + "vw";

        star2.innerHTML = "$";
        star2.style.left = Math.random() * 100 + "vw";

        star3.innerHTML = "@";
        star3.style.left = Math.random() * 100 + "vw";
    
        const randomX = (Math.random() - 0.25) * 10 + "vw";
        star.style.setProperty("--randomX", randomX);
        star2.style.setProperty("--randomX", randomX);
        star3.style.setProperty("--randomX", randomX);
    
        const randomRotation = (Math.random() - 0.5) * 7200 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);
        star2.style.setProperty("--randomRotation", randomRotation);
        star3.style.setProperty("--randomRotation", randomRotation);
    
        star.style.animationDelay = i * 0.01 + "s";
        star2.style.animationDelay = i * 0.01 + "s";
        star3.style.animationDelay = i * 0.01 + "s";
    
        container.appendChild(star);
        container2.appendChild(star2);
        container3.appendChild(star3);

        star.addEventListener("animationend", () => {
          star.remove();
        });
        star2.addEventListener("animationend", () => {
          star2.remove();
        });
        star3.addEventListener("animationend", () => {
          star3.remove();
        });
      }
      startFlash();
      document.body.classList.add('flashing');
    
      setTimeout(() => {
        document.body.classList.remove('flashing');
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          displayResult(title, rarity.type);
          updateRollingHistory(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
        }, 100);
        enableChange();
      }, 5450); // Wait for 5.45 seconds
    } else if (rarity.type === "HARV [1 in 33,333]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-red";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "orange-star",
            "dark-red-star",
            "purple-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "◈";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            harvAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        harvAudio.play();
      }
    } else if (rarity.type === "Tuon [1 in 50,000]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-green";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "orange-star",
            "green-star",
            "red-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "𓃠";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            tuonAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        tuonAudio.play();
      }
    } else if (rarity.type === "Qbear [1 in 35,555]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-purple";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
      
        function createSquare2() {
          const square = document.createElement("div");
          square.className = "animated-square-blue";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
          createSquare2();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "purple-star",
            "blue-star",
            "red-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "△";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            qbearAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        qbearAudio.play();
      }
    } else if (rarity.type === "Light [1 in 29,979]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-blue";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
      
        function createSquare2() {
          const square = document.createElement("div");
          square.className = "animated-square-white";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
          createSquare2();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "purple-star",
            "blue-star",
            "white-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "◀■▶";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            lightAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        lightAudio.play();
      }
    } else if (rarity.type === "X1sta [1 in 230,444]") {
      if (skipCutscene1M) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-white";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
      
        function createSquare2() {
          const square = document.createElement("div");
          square.className = "animated-square-red";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
          createSquare2();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "purple-star",
            "red-star",
            "white-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "◅▻";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            x1staAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        x1staAudio.play();
      }
    } else if (rarity.type === "Iridocyclitis Veil [1 in 5,000/50th]") {
      document.body.className = "blackBg";
      disableChange();
      startAnimationA5();
    
      const container1 = document.getElementById("squareContainer");
      const container = document.getElementById("starContainer");
    
      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-blue";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
      }, 50);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 9350); // Stop after 9.35 seconds
    
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
    
        const starClasses = [
          "orange-star",
          "dark-red-star",
          "blue-star"
        ];
        star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
    
        star.innerHTML = "⟮⟯";
        star.style.left = Math.random() * 100 + "vw";
    
        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);
    
        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);
    
        star.style.animationDelay = i * 0.08 + "s";
    
        container.appendChild(star);
    
        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          displayResult(title, rarity.type);
          updateRollingHistory(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          iriAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "sʜeɴvɪ✞∞ [1 in 77,777/7th]") {
      document.body.className = "blackBg";
      disableChange();
      startAnimationA5Shenvii();
    
      const container1 = document.getElementById("squareContainer");
      const container = document.getElementById("starContainer");
    
      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-black";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
      }, 50);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 9350); // Stop after 9.35 seconds
    
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
    
        const starClasses = [
          "purple-star",
          "red-star",
          "white-star"
        ];
        star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
    
        star.innerHTML = "✭";
        star.style.left = Math.random() * 100 + "vw";
    
        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);
    
        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);
    
        star.style.animationDelay = i * 0.08 + "s";
    
        container.appendChild(star);
    
        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          displayResult(title, rarity.type);
          updateRollingHistory(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          shenviiAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "LubbyJubby's Cherry Grove [1 in 5,666]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-cyan";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "pink-star",
            "cyan-star",
            "blue-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "◌";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            lubjubAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        lubjubAudio.play();
      }
    } else if (rarity.type === "Rad [1 in 6,969]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-cyan";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "green-star",
            "cyan-star",
            "blue-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "◌";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            radAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        radAudio.play();
      }
    } else if (rarity.type === "Blodhest [1 in 25,252]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5H();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-purple";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "blue-star",
            "cyan-star",
            "purple-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "—";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            blodAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        blodAudio.play();
      }
    } else if (rarity.type === "BlindGT [1 in 2,000,000/15th]") {
      document.body.className = "blackBg";
      disableChange();
      startAnimationA5();
    
      const container1 = document.getElementById("squareContainer");
      const container = document.getElementById("starContainer");
    
      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-purple";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
      }, 50);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 9350); // Stop after 9.35 seconds
    
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
    
        const starClasses = [
          "purple-star",
          "white-star",
          "gray-star"
        ];
        star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
    
        star.innerHTML = "•";
        star.style.left = Math.random() * 100 + "vw";
    
        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);
    
        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);
    
        star.style.animationDelay = i * 0.08 + "s";
    
        container.appendChild(star);
    
        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          displayResult(title, rarity.type);
          updateRollingHistory(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          blindAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "Shad0w [1 in 4,444]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationBlackHole();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-blue";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "pink-star",
            "cyan-star",
            "blue-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "◊";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            shaAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        shaAudio.play();
      }
    } else if (rarity.type === "Overture [1 in 25,641]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
      
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-red";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "orange-star",
            "dark-red-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "◇";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            overtureAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        overtureAudio.play();
      }
    } else if (rarity.type === "Celestial Chorus [1 in 202,020]") {
      if (skipCutscene1M) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
  
        const container1 = document.getElementById("squareContainer");
  
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-pink";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 100);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
  
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
          star.className = "purple-star";
          star.innerHTML = "O";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
  
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            celAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        celAudio.play();
      }
    } else if (rarity.type === "Devil's Heart [1 in 66,666]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
  
        const container1 = document.getElementById("squareContainer");
  
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-orange";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 100);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
  
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
          star.className = "red-star";
          star.innerHTML = "✕";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
  
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            devilAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        devilAudio.play();
      }
    } else if (rarity.type === "Demon Soul [1 in 9,999]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
  
        const container1 = document.getElementById("squareContainer");
  
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-red";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 100);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
  
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
          star.className = "orange-star";
          star.innerHTML = "O";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8000);
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 9000);
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            demsoAudio.play();
          }, 100);
          enableChange();
        }, 9850); // Wait for 9.85 seconds
      } else {
        bigSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        demsoAudio.play();
      }
    } else if (rarity.type === "GD Addict [1 in ###]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
  
        const container1 = document.getElementById("squareContainer");
  
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-blue";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 100);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
  
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
          star.className = "yellow-star";
          star.innerHTML = "∆∆∆";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8000);
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 9000);
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            astredAudio.play();
          }, 100);
          enableChange();
        }, 9850); // Wait for 9.85 seconds
      } else {
        bigSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        astredAudio.play();
      }
    } else if (rarity.type === "Heart [1 in ♡♡♡]") {
      document.body.className = "blackBg";
      disableChange();

      const container1 = document.getElementById("squareContainer");

      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-red";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
      }, 100);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 9350); // Stop after 9.35 seconds

      const container = document.getElementById("starContainer");

      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "pink-star";
        star.innerHTML = "♡";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "red-star";
        star.innerHTML = "♡";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8000);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 9000);
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          heartAudio.play();
        }, 100);
        enableChange();
      }, 9850); // Wait for 9.85 seconds
    } else if (rarity.type === "Easter Egg [1 in 13,333]") {
      document.body.className = "blackBg";
      disableChange();

      const container1 = document.getElementById("squareContainer");

      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-white";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      function createSquare2() {
        const square = document.createElement("div");
        square.className = "animated-square-orange";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      function createSquare3() {
        const square = document.createElement("div");
        square.className = "animated-square-yellow";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
        createSquare2();
        createSquare3();
      }, 100);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 10000); // Stop after 10 seconds

      const container = document.getElementById("starContainer");

      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "yellow-star";
        star.innerHTML = "𓎥";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "orange-star";
        star.innerHTML = "𓎥";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          esteggAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "MythicWall [1 in 17,017]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        disableChange();

        const container1 = document.getElementById("squareContainer");

        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-black";

          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";

          container1.appendChild(square);

          square.addEventListener("animationend", () => {
            square.remove();
          });
        }

        function createSquare2() {
          const square = document.createElement("div");
          square.className = "animated-square-blue";

          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";

          container1.appendChild(square);

          square.addEventListener("animationend", () => {
            square.remove();
          });
        }

        function createSquare3() {
          const square = document.createElement("div");
          square.className = "animated-square-cyan";

          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";

          container1.appendChild(square);

          square.addEventListener("animationend", () => {
            square.remove();
          });
        }

        const squareInterval = setInterval(() => {
          createSquare();
          createSquare2();
          createSquare3();
        }, 100);

        setTimeout(() => {
          clearInterval(squareInterval);
        }, 10000); // Stop after 10 seconds

        const container = document.getElementById("starContainer");

        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
          star.className = "black-star";
          star.innerHTML = "‖";

          star.style.left = Math.random() * 100 + "vw";

          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);

          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);

          star.style.animationDelay = i * 0.08 + "s";

          container.appendChild(star);

          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
          star.className = "cyan-star";
          star.innerHTML = "*";

          star.style.left = Math.random() * 100 + "vw";

          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);

          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);

          star.style.animationDelay = i * 0.08 + "s";

          container.appendChild(star);

          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
          star.className = "blue-star";
          star.innerHTML = "<>";

          star.style.left = Math.random() * 100 + "vw";

          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);

          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);

          star.style.animationDelay = i * 0.08 + "s";

          container.appendChild(star);

          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            mythicwallAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        mythicwallAudio.play();
      }
    } else if (rarity.type === "Easter Bunny [1 in 133,333]") {
      document.body.className = "blackBg";
      disableChange();

      const container1 = document.getElementById("squareContainer");

      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-white";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      function createSquare2() {
        const square = document.createElement("div");
        square.className = "animated-square-orange";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      function createSquare3() {
        const square = document.createElement("div");
        square.className = "animated-square-yellow";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      function createSquare4() {
        const square = document.createElement("div");
        square.className = "animated-square-red";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
        createSquare2();
        createSquare3();
        createSquare4();
      }, 100);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 10000); // Stop after 10 seconds

      const container = document.getElementById("starContainer");

      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "yellow-star";
        star.innerHTML = "𓎥";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "orange-star";
        star.innerHTML = "𓎥";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "white-star";
        star.innerHTML = "*";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "red-star";
        star.innerHTML = "<>";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          estbunAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "The Scarecrow's Sigil [1 in 1,031]") {
      document.body.className = "blackBg";
      disableChange();

      const container1 = document.getElementById("squareContainer");

      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-orange";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
      }, 100);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 10000); // Stop after 10 seconds

      const container = document.getElementById("starContainer");

      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "white-star";
        star.innerHTML = "🎃";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          thescarecrowssigilAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "Pumpkin Hollow [1 in 3,110]") {
      document.body.className = "blackBg";
      disableChange();

      const container1 = document.getElementById("squareContainer");

      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-orange";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
      }, 100);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 10000); // Stop after 10 seconds

      const container = document.getElementById("starContainer");

      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "orange-star";
        star.innerHTML = "●";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "white-star";
        star.innerHTML = "🎃";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          pumpkinhollowAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "Hollow Hill Manor [1 in 10,031]") {
      document.body.className = "blackBg";
      disableChange();

      const container1 = document.getElementById("squareContainer");

      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-blue";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      function createSquare2() {
        const square = document.createElement("div");
        square.className = "animated-square-cyan";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
        createSquare2();
      }, 100);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 10000); // Stop after 10 seconds

      const container = document.getElementById("starContainer");

      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "cyan-star";
        star.innerHTML = "◌";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "blue-star";
        star.innerHTML = "●";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "white-star";
        star.innerHTML = "🎃";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "orange-star";
        star.innerHTML = "▼";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          hollowhillmanorAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "The Phantom Moon [1 in 10,031]") {
      document.body.className = "blackBg";
      disableChange();

      const container1 = document.getElementById("squareContainer");

      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-blue";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      function createSquare2() {
        const square = document.createElement("div");
        square.className = "animated-square-orange";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
        createSquare2();
      }, 100);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 10000); // Stop after 10 seconds

      const container = document.getElementById("starContainer");

      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "blue-star";
        star.innerHTML = "●";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "orange-star";
        star.innerHTML = "◉";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "🎃-star";
        star.innerHTML = "*";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          thephantommoonAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "The Void's Veil [1 in 10,031]") {
      document.body.className = "blackBg";
      disableChange();

      const container1 = document.getElementById("squareContainer");

      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-purple";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      function createSquare2() {
        const square = document.createElement("div");
        square.className = "animated-square-cyan";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
        createSquare2();
      }, 100);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 10000); // Stop after 10 seconds

      const container = document.getElementById("starContainer");
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "cyan-star";
        star.innerHTML = "◌";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "white-star";
        star.innerHTML = "🎃";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "purple-star";
        star.innerHTML = "<>";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          thevoidsveilAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "Wailing Shade [1 in 31,010]") {
      document.body.className = "blackBg";
      disableChange();

      const container1 = document.getElementById("squareContainer");

      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-purple";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      function createSquare2() {
        const square = document.createElement("div");
        square.className = "animated-square-cyan";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      function createSquare3() {
        const square = document.createElement("div");
        square.className = "animated-square-blue";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
        createSquare2();
        createSquare3();
      }, 100);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 10000); // Stop after 10 seconds

      const container = document.getElementById("starContainer");

      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "blue-star";
        star.innerHTML = "▼";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "white-star";
        star.innerHTML = "🎃";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
        star.className = "cyan-star";
        star.innerHTML = "●";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          wailingshadeAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "Hellish Fire [1 in 6,666]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
  
        const container1 = document.getElementById("squareContainer");
  
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-orange";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 100);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
  
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
          star.className = "pink-star";
          star.innerHTML = "O";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8000);
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 9000);
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            hellAudio.play();
          }, 100);
          enableChange();
        }, 9850); // Wait for 9.85 seconds
      } else {
        bigSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        hellAudio.play();
      }
    } else if (rarity.type === "Grim Destiny [1 in 8,500]") {
      disableChange();

      document.body.style.backgroundImage = "url('files/backgrounds/gri_cutscene.gif')";
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundRepeat = "no-repeat";
      document.body.style.backgroundPosition = "center";

      const container1 = document.getElementById("squareContainer");

      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-white";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
      }, 750);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 29500); // Stop after 29.5 seconds to cover the longer cutscene duration

      const container = document.getElementById("starContainer");

      for (let i = 0; i < 10; i++) {
        const star = document.createElement("span");
        star.className = "gray-star";
        star.innerHTML = "DIE";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.000005) * 25 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 4 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
      setTimeout(() => {
        document.body.className = "whiteFlash";
        document.body.style.backgroundImage = "";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
        }, 100);
        enableChange();
      }, 32000); // Wait for 32 seconds to allow the full Grim Destiny cutscene
    } else if (rarity.type === "Impeached [1 in 101,010]") {
      if (skipCutscene1M) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation01();
  
        const container1 = document.getElementById("squareContainer");
  
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 100);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 3000); // Stop after 3 seconds
  
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
          }, 100);
          enableChange();
        }, 3000); // Wait for 3 seconds
      } else {
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
      }
    } else if (rarity.type === "H1di [1 in 9,890,089]") {
      if (!skipCutsceneTranscendent) {
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
      } else {
        document.body.className = "blackBg";
        disableChange();
        startAnimation06();

      const container1 = document.getElementById("squareContainer");

      function createSquare(colorClass) {
        const square = document.createElement("div");
        square.className = `animated-square-${colorClass}`;
        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";
        container1.appendChild(square);
        square.addEventListener("animationend", () => square.remove());
      }

      const container = document.getElementById("starContainer");

      function createStars(colorClass, count) {
        for (let i = 0; i < count; i++) {
          const star = document.createElement("span");
          star.className = `${colorClass}-star`;
          star.innerHTML = "<>";
          star.style.left = Math.random() * 100 + "vw";
          star.style.setProperty(
            "--randomX",
            (Math.random() - 0.25) * 20 + "vw"
          );
          star.style.setProperty(
            "--randomRotation",
            (Math.random() - 0.5) * 720 + "deg"
          );
          star.style.animationDelay = i * 0.04 + "s";
          container.appendChild(star);
          star.addEventListener("animationend", () => star.remove());
        }
      }

      createStars("red", 276);
      createStars("white", 276);

      const squareInterval = setInterval(() => {
        createSquare("white");
        createSquare("red");
      }, 50);

      let flashTimes = [
        1000, 1500, 2500, 3000, 4000, 4500, 5500, 10200, 10400, 10600, 11000,
        11200, 11400, 11800, 12200, 12400, 12600, 12800, 13000, 13200, 13400,
        13600, 13800,
      ];

      flashTimes.forEach((time, index) => {
        setTimeout(() => {
          document.body.className = index % 2 === 0 ? "whiteFlash" : "blackBg";
        }, time);
      });

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 14000);

      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
        }, 100);
        enableChange();
      }, 14000); // Wait for 14 seconds
      }
    } else if (rarity.type === "ORB [1 in 55,555/30th]") {
      document.body.className = "blackBg";
      disableChange();
      startAnimationA5();

      const container = document.getElementById("starContainer");
      const container1 = document.getElementById("squareContainer");

      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
      }, 50);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 9350); // Stop after 9.35 seconds
    
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
    
        const starClasses = [
          "purple-star",
          "blue-star",
          "orange-star"
        ];
        star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
    
        star.innerHTML = "ʘ";
        star.style.left = Math.random() * 100 + "vw";
    
        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);
    
        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);
    
        star.style.animationDelay = i * 0.08 + "s";
    
        container.appendChild(star);
    
        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          displayResult(title, rarity.type);
          updateRollingHistory(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          orbAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "FireCraze [1 in 4,200/69th]") {
      document.body.className = "blackBg";
      disableChange();
      startAnimationA5();

      const container = document.getElementById("starContainer");
      const container1 = document.getElementById("squareContainer");

      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-orange";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
      }, 50);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 9350); // Stop after 9.35 seconds
    
      for (let i = 0; i < 133; i++) {
        const star = document.createElement("span");
    
        const starClasses = [
          "white-star",
          "orange-star"
        ];
        star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
    
        star.innerHTML = "▱";
        star.style.left = Math.random() * 100 + "vw";
    
        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);
    
        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);
    
        star.style.animationDelay = i * 0.08 + "s";
    
        container.appendChild(star);
    
        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          displayResult(title, rarity.type);
          updateRollingHistory(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          crazeAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "Veil [1 in 50,000/5th]") {
      document.body.className = "blackBg";
      disableChange();
      startAnimation06();

      const container1 = document.getElementById("squareContainer");

      function createSquare(colorClass) {
        const square = document.createElement("div");
        square.className = `animated-square-${colorClass}`;
        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";
        container1.appendChild(square);
        square.addEventListener("animationend", () => square.remove());
      }

      const container = document.getElementById("starContainer");

      function createStars(colorClass, count) {
        for (let i = 0; i < count; i++) {
          const star = document.createElement("span");
          star.className = `${colorClass}-star`;
          star.innerHTML = "◊";
          star.style.left = Math.random() * 100 + "vw";
          star.style.setProperty(
            "--randomX",
            (Math.random() - 0.25) * 20 + "vw"
          );
          star.style.setProperty(
            "--randomRotation",
            (Math.random() - 0.5) * 720 + "deg"
          );
          star.style.animationDelay = i * 0.04 + "s";
          container.appendChild(star);
          star.addEventListener("animationend", () => star.remove());
        }
      }

      createStars("orange", 276);
      createStars("green", 276);

      const squareInterval = setInterval(() => {
        createSquare("green");
        createSquare("orange");
      }, 50);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 13700);

      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
        }, 100);
        enableChange();
      }, 13700); // Wait for 13.7 seconds
    } else if (rarity.type === "Unfair [1 in ###]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5();
  
        const container1 = document.getElementById("squareContainer");
  
        function createSquare(colorClass) {
          const square = document.createElement("div");
          square.className = `animated-square-${colorClass}`;
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
          container1.appendChild(square);
          square.addEventListener("animationend", () => square.remove());
        }
  
        const container = document.getElementById("starContainer");
  
        function createStars(colorClass, count) {
          for (let i = 0; i < count; i++) {
            const star = document.createElement("span");
            star.className = `${colorClass}-star`;
            star.innerHTML = "◊";
            star.style.left = Math.random() * 100 + "vw";
            star.style.setProperty(
              "--randomX",
              (Math.random() - 0.25) * 20 + "vw"
            );
            star.style.setProperty(
              "--randomRotation",
              (Math.random() - 0.5) * 720 + "deg"
            );
            star.style.animationDelay = i * 0.04 + "s";
            container.appendChild(star);
            star.addEventListener("animationend", () => star.remove());
          }
        }
  
        createStars("yellow", 276);
        createStars("blue", 276);
  
        const squareInterval = setInterval(() => {
          createSquare("blue");
          createSquare("yellow");
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 10370); // Stop after 10.37 seconds
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            astblaAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        astblaAudio.play();
      }
    } else if (rarity.type === "Abomination [1 in 1,000,000/20th]") {
      disableChange();
      document.body.style.backgroundImage = "url('files/backgrounds/gri_cutscene.gif')";

      setTimeout(() => {
        document.body.style.backgroundImage = "url('files/backgrounds/abo_cutscene.gif')";
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundRepeat = "no-repeat";
        document.body.style.backgroundPosition = "center";
      }, 1800)

      const container1 = document.getElementById("squareContainer");

      function createSquare(colorClass) {
        const square = document.createElement("div");
        square.className = `animated-square-${colorClass}`;
        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";
        container1.appendChild(square);
        square.addEventListener("animationend", () => square.remove());
      }

      const container = document.getElementById("starContainer");

      function createStars(colorClass, count) {
        for (let i = 0; i < count; i++) {
          const star = document.createElement("span");
          star.className = `${colorClass}-star`;
          star.innerHTML = "◊";
          star.style.left = Math.random() * 100 + "vw";
          star.style.setProperty(
            "--randomX",
            (Math.random() - 0.25) * 20 + "vw"
          );
          star.style.setProperty(
            "--randomRotation",
            (Math.random() - 0.5) * 720 + "deg"
          );
          star.style.animationDelay = i * 0.04 + "s";
          container.appendChild(star);
          star.addEventListener("animationend", () => star.remove());
        }
      }

      createStars("purple", 500);
      createStars("pink", 500);

      const squareInterval = setInterval(() => {
        createSquare("purple");
        createSquare("pink");
      }, 50); 

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 18700);

      setTimeout(() => {
        document.body.className = "whiteFlash";
        document.body.style.backgroundImage = "";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
        }, 100);
        enableChange();
      }, 18800); // Wait for 18.8 seconds
    } else if (rarity.type === "Gargantua [1 in 143]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Gargantua");
        disableChange();
        startAnimation11();
        const container = document.getElementById("starContainer");

        for (let i = 0; i < 69; i++) {
          const star = document.createElement("span");
          star.className = "blue-star";
          star.innerHTML = "⁙";

          star.style.left = Math.random() * 100 + "vw";

          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);

          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);

          star.style.animationDelay = i * 0.08 + "s";

          container.appendChild(star);

          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 4000);
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 6000);
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            updateRollingHistory(title, rarity.type);
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
          }, 100);
          enableChange();
        }, 7000); // Wait for 7 seconds
      } else {
        updateRollingHistory(title, rarity.type);
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
      }
    } else if (rarity.type === "MSFU [1 in 333/333rd]") {
      document.body.className = "blackBg";
      disableChange();
      startAnimationMSFU();

      const container1 = document.getElementById("squareContainer");

      function createSquare(colorClass) {
        const square = document.createElement("div");
        square.className = `animated-square-${colorClass}`;
        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";
        container1.appendChild(square);
        square.addEventListener("animationend", () => square.remove());
      }

      const container = document.getElementById("starContainer");

      function createStars(count) {
        for (let i = 0; i < count; i++) {
          const star = document.createElement("span");
          star.className = 'red-star';
          star.innerHTML = "𖣘";
          star.style.left = Math.random() * 100 + "vw";
          star.style.setProperty(
            "--randomX",
            (Math.random() - 0.25) * 20 + "vw"
          );
          star.style.setProperty(
            "--randomRotation",
            (Math.random() - 0.5) * 720 + "deg"
          );
          star.style.animationDelay = i * 0.04 + "s";
          container.appendChild(star);
          star.addEventListener("animationend", () => star.remove());
        }
      }

      createStars("orange", 276);
      createStars("red", 276);

      const squareInterval = setInterval(() => {
        createSquare("red");
        createSquare("orange");
      }, 50);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 7777);

      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          updateRollingHistory(title, rarity.type);
          addToInventory(title, rarity.class);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          msfuAudio.play();
          titleCont.style.visibility = "visible";
        }, 100);
        enableChange();
      }, 8888); // Wait for 8.88 seconds
    } else if (rarity.type === "Memory [1 in 175]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Memory");
        disableChange();
        startAnimation9();
        const container = document.getElementById("starContainer");

        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
          star.className = "purple-star";
          star.innerHTML = "□";

          star.style.left = Math.random() * 100 + "vw";

          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);

          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);

          star.style.animationDelay = i * 0.08 + "s";

          container.appendChild(star);

          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8000);
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10500);
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 11000);
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 11500);
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            memAudio.play();
          }, 100);
          enableChange();
        }, 12000); // Wait for 12 seconds
      } else {
        polarrSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        memAudio.play();
      }
    } else if (rarity.type === "Oblivion [1 in 200]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Oblivion");
        disableChange();
        startAnimation9();
        const container = document.getElementById("starContainer");

        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
          star.className = "purple-star";
          star.innerHTML = "O";

          star.style.left = Math.random() * 100 + "vw";

          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);

          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);

          star.style.animationDelay = i * 0.08 + "s";

          container.appendChild(star);

          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8000);
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10500);
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 11000);
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 11500);
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            oblAudio.play();
          }, 100);
          enableChange();
        }, 12000); // Wait for 12 seconds
      } else {
        polarrSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        oblAudio.play();
      }
    } else if (rarity.type === "Eonbreak [1 in 20,000]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        console.log("Rolled Eonbreak");
        disableChange();
        startAnimation3();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
      
          const starClasses = [
            "cyan-star",
            "blue-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "▢";
          star.style.left = Math.random() * 100 + "vw";
      
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
      
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
      
          star.style.animationDelay = i * 0.08 + "s";
      
          container.appendChild(star);
      
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            eonbreakAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        eonbreakAudio.play();
      }
    } else if (rarity.type === "Isekai [1 in 300]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Isekai");
        disableChange();
        startAnimation10();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 33; i++) {
          const star = document.createElement("span");
          star.className = "green-star";
          star.innerHTML = "⁂";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            isekaiAudio.play();
          }, 100);
          enableChange();
        }, 3000); // Wait for 3 seconds
      } else {
        scareSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        isekaiAudio.play();
      }
    } else if (rarity.type === "『Equinox』 [1 in 25,000,000]") {
      if (!skipCutsceneTranscendent) {
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
      } else {
        disableChange();

      setTimeout(() => {
        document.body.style.backgroundImage = "url('files/backgrounds/equinox_cutscene.gif')";
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundRepeat = "no-repeat";
        document.body.style.backgroundPosition = "center";
      }, 1000)

      const container1 = document.getElementById("squareContainer");

      function createCircle(colorClass) {
        const circle = document.createElement("div");
        circle.className = `animated-circle-${colorClass}`;
        circle.style.left = Math.random() * 100 + "vw";
        circle.style.top = Math.random() * 100 + "vh";
        container1.appendChild(circle);
        circle.addEventListener("animationend", () => circle.remove());
      }

      const container = document.getElementById("starContainer");

      function createStars(colorClass, count) {
        for (let i = 0; i < count; i++) {
          const star = document.createElement("span");
          star.className = `${colorClass}-star`;
          star.innerHTML = "●";
          star.style.left = Math.random() * 100 + "vw";
          star.style.setProperty(
            "--randomX",
            (Math.random() - 0.25) * 20 + "vw"
          );
          star.style.setProperty(
            "--randomRotation",
            (Math.random() - 0.5) * 720 + "deg"
          );
          star.style.animationDelay = i * 0.04 + "s";
          container.appendChild(star);
          star.addEventListener("animationend", () => star.remove());
        }
      }

      createStars("white", 500);
      createStars("black", 500);

      const circleInterval = setInterval(() => {
        createCircle("white");
        createCircle("black");
      }, 50);

      setTimeout(() => {
        clearInterval(circleInterval);
      }, 10500);

      setTimeout(() => {
        document.body.className = "whiteFlash";
        document.body.style.backgroundImage = "";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
        }, 100);
        enableChange();
      }, 10500); // Wait for 10.5 seconds
      }
    } else if (rarity.type === "Isekai ♫ Lo-Fi [1 in 3,000]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        console.log("Rolled Isekai ♫ Lo-Fi");
        disableChange();
        startAnimation10();
        const container = document.getElementById("starContainer");
        const container1 = document.getElementById("squareContainer");
  
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-green";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 3000); // Stop after 3 seconds
  
        for (let i = 0; i < 33; i++) {
          const star = document.createElement("span");
          star.className = "green-star";
          star.innerHTML = "⁂";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            isekailofiAudio.play();
          }, 100);
          enableChange();
        }, 3100); // Wait for 3.1 seconds
      } else {
        scareSuspenceLofiAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        isekailofiAudio.play();
      }
    } else if (rarity.type === "Emergencies [1 in 500]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Emergencies");
        disableChange();
        startAnimation10();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 33; i++) {
          const star = document.createElement("span");
          star.className = "green-star";
          star.innerHTML = "⌖";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            emerAudio.play();
          }, 100);
          enableChange();
        }, 3000); // Wait for 3 seconds
      } else {
        scareSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        emerAudio.play();
      }
    } else if (rarity.type === "Samurai [1 in 800]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Samurai");
        disableChange();
        startAnimation10();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 33; i++) {
          const star = document.createElement("span");
          star.className = "green-star";
          star.innerHTML = "⨁";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            samuraiAudio.play();
          }, 100);
          enableChange();
        }, 3000); // Wait for 3 seconds
      } else {
        scareSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        samuraiAudio.play();
      }
    } else if (rarity.type === "Contortions [1 in 999]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Contortions");
        disableChange();
        startAnimation10();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 33; i++) {
          const star = document.createElement("span");
          star.className = "green-star";
          star.innerHTML = "⨳";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            contAudio.play();
          }, 100);
          enableChange();
        }, 3000); // Wait for 3 seconds
      } else {
        scareSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        contAudio.play();
      }
    } else if (rarity.type === "Fright [1 in 1,075]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        console.log("Rolled Fright");
        disableChange();
        startAnimation4();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 200; i++) {
          const star = document.createElement("span");
          star.className = "dark-red-star";
          star.innerHTML = "⨹";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
          }, 100);
          enableChange();
        }, 32000); // Wait for 32 seconds to match the extended cutscene
      } else {
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
      }
    } else if (rarity.type === "Phantom Stride [1 in 990]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Phantom Stride");
        disableChange();
        startAnimation9();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 133; i++) {
          const star = document.createElement("span");
          star.className = "purple-star";
          star.innerHTML = "-";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8000);
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10500);
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 11000);
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 11500);
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            phaAudio.play();
          }, 100);
          enableChange();
        }, 12000); // Wait for 12 seconds
      } else {
        polarrSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        phaAudio.play();
      }
    } else if (rarity.type === "Unnamed [1 in 30,303]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        console.log("Rolled Creator :3");
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-red";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 177; i++) {
          const star = document.createElement("span");
          star.className = "purple-star";
          star.innerHTML = "-";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
  
        for (let i = 0; i < 177; i++) {
          const star = document.createElement("span");
          star.className = "pink-star";
          star.innerHTML = "+";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            unnamedAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        unnamedAudio.play();
      }
    } else if (rarity.type === "Ginger [1 in 1,144,141]") {
      if (skipCutsceneTranscendent) {
        document.body.className = "blackBg";
        console.log("Rolled Ginger");
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-orange";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 177; i++) {
          const star = document.createElement("span");
          star.className = "orange-star";
          star.innerHTML = "ↀ";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            gingerAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        gingerAudio.play();
      }
    } else if (rarity.type === "Cursed Mirage [1 in 11,111]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        console.log("Rolled Cursed Mirage");
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-blue";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 177; i++) {
          const star = document.createElement("span");
          star.className = "cyan-star";
          star.innerHTML = "x";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            displayResult(title, rarity.type);
            updateRollingHistory(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            curAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        updateRollingHistory(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        curAudio.play();
      }
    } else if (rarity.type === "Wave [1 in 2,555]") {
      document.body.className = "blackBg";
      console.log("Rolled Wave");
      disableChange();
      startAnimationA5();
    
      const container1 = document.getElementById("squareContainer");
      const container = document.getElementById("starContainer");
    
      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-blue";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
      }, 50);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 9350); // Stop after 9.35 seconds
    
      for (let i = 0; i < 177; i++) {
        const star = document.createElement("span");
        star.className = "cyan-star";
        star.innerHTML = "~";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          displayResult(title, rarity.type);
          updateRollingHistory(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          waveAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "Scorching [1 in 7,923]") {
      document.body.className = "blackBg";
      console.log("Rolled Scorching");
      disableChange();
      startAnimationA5();
    
      const container1 = document.getElementById("squareContainer");
      const container = document.getElementById("starContainer");
    
      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-red";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
      }, 50);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 9350); // Stop after 9.35 seconds
    
      for (let i = 0; i < 177; i++) {
        const star = document.createElement("span");
        star.className = "yellow-star";
        star.innerHTML = "◈";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          displayResult(title, rarity.type);
          updateRollingHistory(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          scorchingAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "Beach [1 in 12,555]") {
      document.body.className = "blackBg";
      console.log("Rolled Beach");
      disableChange();
      startAnimationA5();
    
      const container1 = document.getElementById("squareContainer");
      const container = document.getElementById("starContainer");
    
      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-yellow";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
      }, 50);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 9350); // Stop after 9.35 seconds
    
      for (let i = 0; i < 177; i++) {
        const star = document.createElement("span");
        star.className = "blue-star";
        star.innerHTML = "<";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          displayResult(title, rarity.type);
          updateRollingHistory(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          beachAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "Tidal Wave [1 in 25,500]") {
      document.body.className = "blackBg";
      console.log("Rolled Tidal Wave");
      disableChange();
      startAnimationA5();
    
      const container1 = document.getElementById("squareContainer");
      const container = document.getElementById("starContainer");
    
      function createSquare() {
        const square = document.createElement("div");
        square.className = "animated-square-blue";

        square.style.left = Math.random() * 100 + "vw";
        square.style.top = Math.random() * 100 + "vh";

        container1.appendChild(square);

        square.addEventListener("animationend", () => {
          square.remove();
        });
      }

      const squareInterval = setInterval(() => {
        createSquare();
      }, 50);

      setTimeout(() => {
        clearInterval(squareInterval);
      }, 9350); // Stop after 9.35 seconds
    
      for (let i = 0; i < 177; i++) {
        const star = document.createElement("span");
        star.className = "cyan-star";
        star.innerHTML = "~";

        star.style.left = Math.random() * 100 + "vw";

        const randomX = (Math.random() - 0.25) * 20 + "vw";
        star.style.setProperty("--randomX", randomX);

        const randomRotation = (Math.random() - 0.5) * 720 + "deg";
        star.style.setProperty("--randomRotation", randomRotation);

        star.style.animationDelay = i * 0.08 + "s";

        container.appendChild(star);

        star.addEventListener("animationend", () => {
          star.remove();
        });
      }
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 7500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 7750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 8500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 8750);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 9500);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10000);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10100);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10175);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10250);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10325);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10400);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10475);
    
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10550);
    
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10625);
    
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          displayResult(title, rarity.type);
          updateRollingHistory(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          tidalwaveAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
    } else if (rarity.type === "Celestial Dawn [1 in 12,000]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        console.log("Rolled Celestial Dawn");
        disableChange();
        startAnimationA5();
  
        const container1 = document.getElementById("squareContainer");
  
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-pink";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 100);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 10370); // Stop after 10.37 seconds
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            celdawAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        celdawAudio.play();
      }
    } else if (rarity.type === "Fate's Requiem [1 in 15,000]") {
      if (skipCutscene100K) {
        document.body.className = "blackBg";
        console.log("Rolled Fate's Requiem");
        disableChange();
        startAnimationA5();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-blue";
  
          square.style.left = Math.random() * 100 + "vw";
          square.style.top = Math.random() * 100 + "vh";
  
          container1.appendChild(square);
  
          square.addEventListener("animationend", () => {
            square.remove();
          });
        }
  
        const squareInterval = setInterval(() => {
          createSquare();
        }, 50);
  
        setTimeout(() => {
          clearInterval(squareInterval);
        }, 9350); // Stop after 9.35 seconds
      
        for (let i = 0; i < 177; i++) {
          const star = document.createElement("span");
          star.className = "blue-star";
          star.innerHTML = "*";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
  
        for (let i = 0; i < 177; i++) {
          const star = document.createElement("span");
          star.className = "cyan-star";
          star.innerHTML = "✕";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 7500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 7750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 8500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 8750);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 9500);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10000);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10100);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10175);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10250);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10325);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10400);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10475);
      
        setTimeout(function () {
          document.body.className = "whiteFlash";
        }, 10550);
      
        setTimeout(function () {
          document.body.className = "blackBg";
        }, 10625);
      
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            titleCont.style.visibility = "visible";
            fatreAudio.play();
          }, 100);
          enableChange();
        }, 10750); // Wait for 10.75 seconds
      } else {
        hugeSuspenceAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        fatreAudio.play();
      }
    } else if (rarity.type === "Geezer [1 in 5,000,000,000]") {
      document.body.className = "blackBg";
      console.log("Rolled EpIk GeEzEr TiTlE");
      disableChange();
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          geezerAudio.play();
          setTimeout(() => {
            titleCont.style.visibility = "visible";
          }, 8640);
        }, 100);
        enableChange();
      }, 9000); // Wait for 9 seconds
    } else if (rarity.type === "Polarr [1 in 50,000,000,000]") {
      document.body.className = "blackBg";
      console.log("Rolled BOOM");
      disableChange();
      startAnimation03();

      const starColors = [
        "white",
        "green",
        "blue",
        "purple",
        "orange",
        "pink",
        "red",
      ];
      const container = document.getElementById("starContainer");

      starColors.forEach((color) => {
        for (let i = 0; i < 155; i++) {
          const star = document.createElement("span");
          star.className = `${color}-star`;
          star.innerHTML = "■";
          star.style.left = Math.random() * 100 + "vw";

          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);

          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);

          star.style.animationDelay = i * 0.08 + "s";

          container.appendChild(star);

          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      });

      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 10000);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 10500);
      setTimeout(function () {
        document.body.className = "whiteFlash";
      }, 11000);
      setTimeout(function () {
        document.body.className = "blackBg";
      }, 11500);
      setTimeout(() => {
        document.body.className = "whiteFlash";
        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          polarrAudio.play();
        }, 100);
        enableChange();
      }, 12000); // Wait for 12 seconds
    } else if (rarity.type === "Unstoppable [1 in 112]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Unstoppable");
        disableChange();
        startAnimation8();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "fast-blue-star";
          star.innerHTML = "▦";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            unstoppableAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        unstoppableAudio.play();
      }
    } else if (rarity.type === "Wandering Spirit [1 in 150]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Wandering Spirit");
        disableChange();
        startAnimation8();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "white-star";
          star.innerHTML = "■";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            wanspiAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        wanspiAudio.play();
      }
    } else if (rarity.type === "Spectral Whisper [1 in 288]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Spectral Whisper");
        disableChange();
        startAnimation8();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "pink-star";
          star.innerHTML = "■";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            spectralAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        spectralAudio.play();
      }
    } else if (rarity.type === "Starfall [1 in 600]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Starfall");
        disableChange();
        startAnimation8();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "purple-star";
          star.innerHTML = "⁘";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            starfallAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        starfallAudio.play();
      }
    } else if (rarity.type === "Cursed Artifact [1 in 700]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Cursed Artifact");
        disableChange();
        startAnimation8();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "white-star";
          star.innerHTML = "◄►";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            curartAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        curartAudio.play();
      }
    } else if (rarity.type === "Forgotten Whisper [1 in 450]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Forgotten Whisper");
        disableChange();
        startAnimation8();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "brown-star";
          star.innerHTML = "⟬⟭";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            forgAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        forgAudio.play();
      }
    } else if (rarity.type === "Spectral Glare [1 in 850]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Spectral Glare");
        disableChange();
        startAnimation8();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "brown-star";
          star.innerHTML = "⟬⟭";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            forgAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        forgAudio.play();
      }
    } else if (rarity.type === "Mysterious Echo [1 in 300]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Mysterious Echo");
        disableChange();
        startAnimation8();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "white-star";
          star.innerHTML = "△";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            mysAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        mysAudio.play();
      }
    } else if (rarity.type === "Frozen Fate [1 in 200]") {
      if (skipCutscene1K) {
        document.body.className = "blackBg";
        console.log("Rolled Frozen Fate");
        disableChange();
        startAnimation8();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "fast-cyan-star";
          star.innerHTML = "▣";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            froAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        froAudio.play();
      }
    } else if (rarity.type === "Shadow Veil [1 in 1,000]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        console.log("Rolled Shadow Veil");
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "yellow-star";
          star.innerHTML = "—";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
  
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            shadAudio.play();
            titleCont.style.visibility = "visible";
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        shadAudio.play();
        titleCont.style.visibility = "visible";
      }
    } else if (rarity.type === "Nightfall [1 in 1,200]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        console.log("Rolled Nightfall");
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "purple-star";
          star.innerHTML = "—";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
  
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            nighAudio.play();
            titleCont.style.visibility = "visible";
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        nighAudio.play();
        titleCont.style.visibility = "visible";
      }
    } else if (rarity.type === "Void Walker [1 in 1,500]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "cyan-star";
          star.innerHTML = "◁▷";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
  
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            voiAudio.play();
            titleCont.style.visibility = "visible";
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        voiAudio.play();
        titleCont.style.visibility = "visible";
      }
    } else if (rarity.type === "Silent Listener [1 in 2,200]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "green-star";
          star.innerHTML = "—";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
  
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            silAudio.play();
            titleCont.style.visibility = "visible";
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        silAudio.play();
        titleCont.style.visibility = "visible";
      }
    } else if (rarity.type === "Ghostly Embrace [1 in 2,800]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "green-star";
          star.innerHTML = "—";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
  
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            ghoAudio.play();
            titleCont.style.visibility = "visible";
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        ghoAudio.play();
        titleCont.style.visibility = "visible";
      }
    } else if (rarity.type === "Endless Twilight [1 in 3,000]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "white-star";
          star.innerHTML = "—";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
  
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            endAudio.play();
            titleCont.style.visibility = "visible";
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        endAudio.play();
        titleCont.style.visibility = "visible";
      }
    } else if (rarity.type === "Abyssal Shade [1 in 3,500]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "blue-star";
          star.innerHTML = "𓆟";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
  
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            abysAudio.play();
            titleCont.style.visibility = "visible";
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        abysAudio.play();
        titleCont.style.visibility = "visible";
      }
    } else if (rarity.type === "Darkened Sky [1 in 4,200]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "fast-cyan-star";
          star.innerHTML = "▣";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            darAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        froAudio.play();
      }
    } else if (rarity.type === "Twisted Light [1 in 5,000]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "fast-cyan-star";
          star.innerHTML = "▣";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            twiligAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        froAudio.play();
      }
    } else if (rarity.type === "Ethereal Pulse [1 in 6,000]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "cyan-star";
          star.innerHTML = "▣";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            ethpulAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        froAudio.play();
      }
    } else if (rarity.type === "Enigmatic Dream [1 in 7,500]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "fast-cyan-star";
          star.innerHTML = "▣";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            eniAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        eniAudio.play();
      }
    } else if (rarity.type === "Fear [1 in 1,250]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "gray-star";
          star.innerHTML = "▣";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            fearAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        fearAudio.play();
      }
    } else if (rarity.type === "Haunted Soul [1 in 2,000]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "fast-cyan-star";
          star.innerHTML = "▣";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            hauAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        hauntAudio.play();
      }
    } else if (rarity.type === "Lost Soul [1 in 3,333]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "white-star";
          star.innerHTML = "←→";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            lostsAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        lostsAudio.play();
      }
    } else if (rarity.type === "Found Soul [1 in 5,000]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "fast-red-star";
          star.innerHTML = "▣";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            titleCont.style.visibility = "visible";
            foundsAudio.play();
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        titleCont.style.visibility = "visible";
        foundsAudio.play();
      }
    } else if (rarity.type === "Haunted Reality [1 in 5,500]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "blue-star";
          star.innerHTML = "-◪";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
  
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            hauntAudio.play();
            titleCont.style.visibility = "visible";
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        hauntAudio.play();
        titleCont.style.visibility = "visible";
      }
    } else if (rarity.type === "Ether Shift [1 in 5,540]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "purple-star";
          star.innerHTML = "=";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
  
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            ethAudio.play();
            titleCont.style.visibility = "visible";
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        ethAudio.play();
        titleCont.style.visibility = "visible";
      }
    } else if (rarity.type === "Seraph's Wing [1 in 1,333]") {
      if (skipCutscene10K) {
        document.body.className = "blackBg";
        disableChange();
        startAnimation7();
        const container = document.getElementById("starContainer");
  
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = "white-star";
          star.innerHTML = "<>";
  
          star.style.left = Math.random() * 100 + "vw";
  
          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);
  
          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);
  
          star.style.animationDelay = i * 0.08 + "s";
  
          container.appendChild(star);
  
          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
        setTimeout(() => {
          document.body.className = "whiteFlash";
  
          setTimeout(() => {
            document.body.className = rarity.class;
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class);
            setRollButtonEnabled(true);
            serAudio.play();
            titleCont.style.visibility = "visible";
          }, 100);
          enableChange();
        }, 4400); // Wait for 4.4 seconds
      } else {
        suspenseAudio.pause();
        addToInventory(title, rarity.class);
        updateRollingHistory(title, rarity.type);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        setRollButtonEnabled(true);
        serAudio.play();
        titleCont.style.visibility = "visible";
      }
    } else if (
      rarity.type === "Silly Car :3 [1 in 1,000,000]" ||
      rarity.type === "Greg [1 in 50,000,000]" ||
      rarity.type === "Mintllie [1 in 500,000,000]"
    ) {
      document.body.className = "blackBg";
      disableChange();
      startAnimation07();

      const starColors = [
        "white",
        "green",
        "blue",
        "purple",
        "orange",
        "pink",
        "red",
      ];
      const container = document.getElementById("starContainer");

      starColors.forEach((color) => {
        for (let i = 0; i < 44; i++) {
          const star = document.createElement("span");
          star.className = `${color}-star`;
          star.innerHTML = "■";
          star.style.left = Math.random() * 100 + "vw";

          const randomX = (Math.random() - 0.25) * 20 + "vw";
          star.style.setProperty("--randomX", randomX);

          const randomRotation = (Math.random() - 0.5) * 720 + "deg";
          star.style.setProperty("--randomRotation", randomRotation);

          star.style.animationDelay = i * 0.08 + "s";

          container.appendChild(star);

          star.addEventListener("animationend", () => {
            star.remove();
          });
        }
      });

      setTimeout(() => {
        document.body.className = "whiteFlash";

        if (rarity.type === "Mintllie [1 in 500,000,000]") {
          mintllieAudio.play();
        }

        setTimeout(() => {
          document.body.className = rarity.class;
          addToInventory(title, rarity.class);
          updateRollingHistory(title, rarity.type);
          displayResult(title, rarity.type);
          changeBackground(rarity.class);
          setRollButtonEnabled(true);
          titleCont.style.visibility = "visible";
        }, 100);
        enableChange();
      }, 4400); // Wait for 4.4 seconds
    }
  } else {
    addToInventory(title, rarity.class);
    displayResult(title, rarity.type);
    updateRollingHistory(title, rarity.type);
    changeBackground(rarity.class);
    rollCount++;
    rollCount1++;
    setTimeout(() => {
      setRollButtonEnabled(true);
    }, cooldownTime);
  }
  localStorage.setItem("rollCount", rollCount);
  localStorage.setItem("rollCount1", rollCount1);
  load();
  });
}

function registerCutsceneToggleButtons() {
  CUTSCENE_SKIP_SETTINGS.forEach((config) => {
    const { key, buttonId } = config;
    const buttonElement = byId(buttonId);
    const assignState = CUTSCENE_STATE_SETTERS[key];
    const readState = CUTSCENE_STATE_GETTERS[key];

    if (!buttonElement || typeof assignState !== "function" || typeof readState !== "function") {
      return;
    }

    updateCutsceneSkipDisplay(config, readState());

    buttonElement.addEventListener("click", () => {
      const nextValue = !Boolean(readState());
      assignState(nextValue);
      storage.set(key, nextValue);
      const isSkipping = !nextValue;
      console.log(
        `Cutscene skip for ${config.label} is now ${isSkipping ? "On" : "Off"}`
      );
      updateCutsceneSkipDisplay(config, nextValue);
    });
  });
}

function rollRarity() {
  lastRollPersisted = true;
  lastRollAutoDeleted = false;
  lastRollRarityClass = null;
  allowForcedAudioPlayback = false;

  const rarities = [
    {
      type: "Common [1 in 2.5]",
      class: "commonBgImg",
      chance: 35,
      titles: ["Good", "Natural", "Simple", "Basic", "Plain", "Average", "Ordinary", "Usual", "Regular", "Standard"],
    },
    {
      type: "Rare [1 in 4]",
      class: "rareBgImg",
      chance: 26.5,
      titles: ["Divine", "Crystallized", "Radiant", "Gleaming", "Shimmering", "Glowing", "Luminous", "Brilliant", "Sparkling", "Dazzling"],
    },
    {
      type: "Epic [1 in 5]",
      class: "epicBgImg",
      chance: 18.34,
      titles: ["Mythic", "Enchanted", "Majestic", "Regal", "Heroic", "Noble", "Exalted", "Fabled", "Exotic", "Glorious"],
    },
    {
      type: "Legendary [1 in 13]",
      class: "legendaryBgImg",
      chance: 7.5,
      titles: ["Immortal", "Celestial", "Eternal", "Supreme", "Bounded", "Omniscient", "Omnipotent", "Ultimate", "Apex"],
    },
    {
      type: "Impossible [1 in 20]",
      class: "impossibleBgImg",
      chance: 5,
      titles: ["Fantastical", "Unbelievable", "Miraculous", "Extraordinary", "Astounding", "Phenomenal", "Inconceivable", "Unimaginable", "Supernatural", "Paranormal"],
    },
    {
      type: "Powered [1 in 40]",
      class: "poweredBgImg",
      chance: 2.5,
      titles: ["Undead", "Sidereum", "Glock", "Wind", "Lunar", "Solar", "Hazard", "Shattered", "Alien", "Veil"],
    },
    {
      type: "Toxic [1 in 50]",
      class: "toxBgImg",
      chance: 2,
      titles: ["Poison", "Death: Sick", "Virus"],
    },
    {
      type: "Flicker [1 in 67]",
      class: "flickerBgImg",
      chance: 1.5,
      titles: ["Glimmer", "Spark", "Flame", "Glow", "Pulse", "Twilight", "Flash", "Flare", "Beam", "Shine"],
    },
    {
      type: "Solarpower [1 in 67]",
      class: "solarpowerBgImg",
      chance: 1.5,
      titles: ["Hazard: Rays", "Ink: Leak", "Shattered: Beginning", "Alien: Abduction", "Veil: Nebula", "Nautilus", "Precious", "Glacier", "Bleeding", "Ink"],
    },
    {
      type: "Believer [1 in 80]",
      class: "belivBgImg",
      chance: 1.25,
      titles: ["Thoughts", "Graditude", "Fear: Fallen", "Optimist"],
    },
    {
      type: "Planet Breaker [1 in 99]",
      class: "plabreBgImg",
      chance: 1.01,
      titles: ["Explosion", "Death: Unalive", "Fear: Broken", "Space Dust"],
    },
    {
      type: "Unstoppable [1 in 112]",
      class: "unstoppableBgImg",
      chance: 0.8941045669,
      titles: ["Invincible", "Unyielding", "Indomitable", "Unbreakable", "Irresistible", "Unconquerable", "Chromatic: Genesis", "Chromatic: Exotic", "Chromatic", "Untouchable"],
    },
    {
      type: "Gargantua [1 in 143]",
      class: "gargBgImg",
      chance: 0.699,
      titles: ["Colossal", "Titanic", "Monumental", "Gigantic", "Mammoth", "Immense", "Enormous", "Vast", "Behemoth", "Leviathan"],
    },
    {
      type: "Memory [1 in 175]",
      class: "memBgImg",
      chance: 0.57142,
      titles: ["The Fallen"],
    },
    {
      type: "Wandering Spirit [1 in 150]",
      class: "wanspiBgImg",
      chance: 0.67,
      titles: ["Wandering Spirit"],
    },
    {
      type: "Frozen Fate [1 in 200]",
      class: "froBgImg",
      chance: 0.5,
      titles: ["Frozen Fate"],
    },
    {
      type: "Mysterious Echo [1 in 300]",
      class: "mysBgImg",
      chance: 0.33,
      titles: ["Mysterious Echo"],
    },
    {
      type: "Forgotten Whisper [1 in 450]",
      class: "forgBgImg",
      chance: 0.22,
      titles: ["Forgotten Whisper"],
    },
    {
      type: "Cursed Artifact [1 in 700]",
      class: "curartBgImg",
      chance: 0.14,
      titles: ["Cursed Artifact"],
    },
    {
      type: "Spectral Glare [1 in 850]",
      class: "specBgImg",
      chance: 0.12,
      titles: ["Spectral Glare"],
    },
    {
      type: "Shadow Veil [1 in 1,000]",
      class: "shadBgImg",
      chance: 0.1,
      titles: ["Shadow Veil"],
    },
    {
      type: "Nightfall [1 in 1,200]",
      class: "nighBgImg",
      chance: 0.083,
      titles: ["Nightfall"],
    },
    {
      type: "Void Walker [1 in 1,500]",
      class: "voiBgImg",
      chance: 0.067,
      titles: ["Void Walker"],
    },
    {
      type: "Silent Listener [1 in 2,200]",
      class: "silBgImg",
      chance: 0.045,
      titles: ["Silent Listener"],
    },
    {
      type: "Ghostly Embrace [1 in 2,800]",
      class: "ghoBgImg",
      chance: 0.036,
      titles: ["Ghostly Embrace"],
    },
    {
      type: "Endless Twilight [1 in 3,000]",
      class: "endBgImg",
      chance: 0.033,
      titles: ["Endless Twilight"],
    },
    {
      type: "Abyssal Shade [1 in 3,500]",
      class: "abysBgImg",
      chance: 0.029,
      titles: ["Abyssal Shade"],
    },
    {
      type: "Darkened Sky [1 in 4,200]",
      class: "darBgImg",
      chance: 0.024,
      titles: ["Darkened Sky"],
    },
    {
      type: "Twisted Light [1 in 5,000]",
      class: "twiligBgImg",
      chance: 0.02,
      titles: ["Twisted Light"],
    },
    {
      type: "LubbyJubby's Cherry Grove [1 in 5,666]",
      class: "lubjubBgImg",
      chance: 0.01764913519,
      titles: ["LubJub"],
    },
    {
      type: "Ethereal Pulse [1 in 6,000]",
      class: "ethpulBgImg",
      chance: 0.017,
      titles: ["Ethereal Pulse"],
    },
    {
      type: "Enigmatic Dream [1 in 7,500]",
      class: "eniBgImg",
      chance: 0.013,
      titles: ["Enigmatic Dream"],
    },
    {
      type: "Ginger [1 in 1,144,141]",
      class: "gingerBgImg",
      chance: 0.00008740181,
      titles: ["Orange puffy creature"],
    },
    {
      type: "Celestial Dawn [1 in 12,000]",
      class: "celdawBgImg",
      chance: 0.0083,
      titles: ["Celestial Dawn"],
    },
    {
      type: "Fate's Requiem [1 in 15,000]",
      class: "fatreBgImg",
      chance: 0.0067,
      titles: ["Fate's Requiem"],
    },
    {
      type: "Fear [1 in 1,250]",
      class: "fearBgImg",
      chance: 0.08,
      titles: ["Fear"],
    },
    {
      type: "Shad0w [1 in 4,444]",
      class: "shaBgImg",
      chance: 0.02250225022,
      titles: ["Galactic", "Mysterious", "Friendly"],
    },
    {
      type: "Haunted Soul [1 in 2,000]",
      class: "hauBgImg",
      chance: 0.05,
      titles: ["Haunted Soul"],
    },
    {
      type: "Lost Soul [1 in 3,333]",
      class: "lostsBgImg",
      chance: 0.03,
      titles: ["Lost Soul"],
    },
    {
      type: "Found Soul [1 in 5,000]",
      class: "foundsBgImg",
      chance: 0.02,
      titles: ["Found Soul"],
    },
    {
      type: "Haunted Reality [1 in 5,500]",
      class: "hauntBgImg",
      chance: 0.018,
      titles: ["Haunted Reality"],
    },
    {
      type: "Devil's Heart [1 in 66,666]",
      class: "devilBgImg",
      chance: 0.0015,
      titles: ["Devil's Heart"],
    },
    {
      type: "Oblivion [1 in 200]",
      class: "oblBgImg",
      chance: 0.499,
      titles: ["The Truth Seeker"],
    },
    {
      type: "Spectral Whisper [1 in 288]",
      class: "spectralBgImg",
      chance: 0.347222222,
      titles: ["Haunted", "Ethereal", "Shadow", "Phantom", "Echo", "Apparition", "Wraith", "Shade", "Banshee", "Poltergeist"],
    },
    {
      type: "Isekai [1 in 300]",
      class: "isekaiBgImg",
      chance: 0.333333333,
      titles: ["Otherworldly", "Transported", "Duality: Konosuba", "Immersive: Re:Zero", "Immersive", "Otherworldly: No Game No Life", "Protagonist", "Summoning", "Fantasyland", "Duality"],
    },
    {
      type: "Emergencies [1 in 500]",
      class: "emerBgImg",
      chance: 0.2,
      titles: ["Urgent", "Crisis", "Crisis: Earthquake", "Danger: Fire", "Immediate", "Alert: Flood", "Rescue", "Alert", "Danger", "Response"],
    },
    {
      type: "Samurai [1 in 800]",
      class: "samuraiBgImg",
      chance: 0.125,
      titles: ["Warrior", "Bushido", "Martial: Katana", "Feudal: Ronin", "Honor", "Honor: Shogun", "Feudal", "Martial", "Loyalty", "Tradition"],
    },
    {
      type: "Starfall [1 in 600]",
      class: "starfallBgImg",
      chance: 0.1666666666,
      titles: ["Meteoric", "Stardust", "Cosmic", "Nebula", "Galactic", "Supernova", "Celestial", "Orbiting", "Comet", "Radiant"],
    },
    {
      type: "Phantom Stride [1 in 990]",
      class: "phaBgImg",
      chance: 0.101010101,
      titles: ["Silent", "Shadowy", "Elusive", "Wandering", "Spectral", "Mysterious", "Ghostly", "Drifting", "Veiled", "Hidden"],
    },
    {
      type: "Contortions [1 in 999]",
      class: "contBgImg",
      chance: 0.1001001001,
      titles: ["Flexibility", "Twisting", "Bending: Acrobatics", "Agility: Gymnastics", "Elasticity", "Contorting: Movability", "Bending", "Stretching", "Agility", "Contorting"],
    },
    {
      type: "Seraph's Wing [1 in 1,333]",
      class: "seraphwingBgImg",
      chance: 0.0750187545,
      titles: ["Angelic", "Divine", "Holy", "Winged", "Heavenly", "Celestial", "Radiant", "Ascended", "Graceful", "Blessed",],
    },
    {
      type: "Ether Shift [1 in 5,540]",
      class: "ethershiftBgImg",
      chance: 0.0180505415,
      titles: ["Warped", "Dimensional", "Vortex", "Parallel", "Quantum", "Portal", "Astral", "Temporal", "Rifted"],
    },
    {
      type: "Hellish Fire [1 in 6,666]",
      class: "hellBgImg",
      chance: 0.015,
      titles: ["Devil", "Flame", "Fire", "Extinction", "Dead", "Lost Soul", "Burn: Soul", "Skull", "Collapse", "Doomsday"],
    },
    {
      type: "Demon Soul [1 in 9,999]",
      class: "demsoBgImg",
      chance: 0.010001,
      titles: ["Demon", "Soul", "Soul: Death", "Demon: Extinction", "Demon: Dead", "Demon: Lost Soul", "Soul: Skull"],
    },
    {
      type: "Cursed Mirage [1 in 11,111]",
      class: "cursedmirageBgImg",
      chance: 0.00900009,
      titles: ["Illusory", "Haunted", "Distorted", "Faded", "Enchanted", "Shimmering", "Twisted", "Charmed", "Eerie", "Phantasmal"],
    },
    {
      type: "Eonbreak [1 in 20,000]",
      class: "eonbreakBgImg",
      chance: 0.005,
      titles: ["Timeless", "Chronos", "Temporal", "Abyssal", "Infinite", "Endless", "Fractured", "Paradoxical", "Rifted", "Eternal"],
    },
    {
      type: "Unnamed [1 in 30,303]",
      class: "unnamedBgImg",
      chance: 0.0033,
      titles: ["Undefined: Name"],
    },
    {
      type: "Overture [1 in 25,641]",
      class: "overtureBgImg",
      chance: 0.0039,
      titles: ["Lightspeed", "Sky: The limit", "Arcane: Light", "Immense: Tarnished", "Vast: Electro", "Cloudpoint", "Glory", "Lord: History", "Starlight", "Momentum"],
    },
    {
      type: "HARV [1 in 33,333]",
      class: "harvBgImg",
      chance: 0.00300003,
      titles: ["Nightmare Sky", "Harvester", "Dullhan", "Cryptfire"]
    },
    {
      type: "Arcane Pulse [1 in 77,777]",
      class: "arcanepulseBgImg",
      chance: 0.00128572714,
      titles: ["Mystic", "Runic", "Enchanted", "Occult", "Magical", "Sorcerous", "Cabalistic", "Esoteric", "Divinatory", "Spellbound"],
    },
    {
      type: "Impeached [1 in 101,010]",
      class: "impeachedBgImg",
      chance: 0.00099,
      titles: ["Bloodlust", "Starscourge: Radiant, Symphony", "Bleeding: The Secret of Common", "Diaboli: The Secret of Divinus", "Surge: Infinity Overlord"],
    },
    {
      type: "Celestial Chorus [1 in 202,020]",
      class: "celestialchorusBgImg",
      chance: 0.00049500049,
      titles: ["Harmonic", "Symphonic", "Resonant", "Melodic", "Orchestral", "Ethereal", "Chiming", "Vibrant", "Sonic", "Sublime"],
    },
    {
      type: "Silly Car :3 [1 in 1,000,000]",
      class: "silcarBgImg",
      chance: 0.0001,
      titles: ["Vrom: Vrom"],
    },
    {
      type: "Greg [1 in 50,000,000]",
      class: "gregBgImg",
      chance: 0.000002,
      titles: ["Greg"],
    },
    {
      type: "Mintllie [1 in 500,000,000]",
      class: "mintllieBgImg",
      chance: 0.0000002,
      titles: ["Mintllie"],
    },
    {
      type: "Geezer [1 in 5,000,000,000]",
      class: "geezerBgGif",
      chance: 0.00000002,
      titles: ["Geezer"],
    },
    {
      type: "Polarr [1 in 50,000,000,000]",
      class: "polarrBgImg",
      chance: 0.000000002,
      titles: ["POLARR"],
    },
    {
      type: "H1di [1 in 9,890,089]",
      class: "h1diBgImg",
      chance: 0.000001011113156,
      titles: ["H1di"],
    },
    {
      type: "Blodhest [1 in 25,252]",
      class: "blodBgImg",
      chance: 0.00396008236,
      titles: ["Furry: Ultimate", "Blodhest"],
    },
    {
      type: "Tuon [1 in 50,000]",
      class: "tuonBgImg",
      chance: 0.002,
      titles: ["Gato", "Speen", "Car: Maxwell"],
    },
    {
      type: "Unfair [1 in ###]",
      class: "astblaBgImg",
      chance: 0.01,
      titles: ["Astrald BLACK"],
    },
    {
      type: "GD Addict [1 in ###]",
      class: "astredBgImg",
      chance: 0.05,
      titles: ["Astrald RED"],
    },
    {
      type: "Qbear [1 in 35,555]",
      class: "qbearBgImg",
      chance: 0.00281254394,
      titles: ["Qbear", "Risky Gato", "Samurai Gato", "Gato: Wew"],
    },
    {
      type: "Light [1 in 29,979]",
      class: "lightBgImg",
      chance: 0.0033356683,
      titles: ["Speed of Light", "Light: Feather", "Light", "Bright"],
    },
    {
      type: "X1sta [1 in 230,444]",
      class: "x1staBgImg",
      chance: 0.0004339449,
      titles: ["Corrupt", "X1sta", "Artist"],
    },
    {
      type: "Isekai ♫ Lo-Fi [1 in 3,000]",
      class: "isekailofiBgImg",
      chance: 0.033,
      titles: ["Isekai", "Singing", "Chill", "Calm"]
    },
    {
      type: "『Equinox』 [1 in 25,000,000]",
      class: "equinoxBgImg",
      chance: 0.000004,
      titles: ["LAYERS", "CHROMA", "衡"]
    },
    {
      type: "Astrald [1 in 100,000]",
      class: "astraldBgImg",
      chance: 0.001,
      titles: ["Astral", "Dream", "Cosmic"]
    },
    {
      type: "Hypernova [1 in 40,000]",
      class: "hypernovaBgImg",
      chance: 0.0025,
      titles: ["Supernova", "Stellar", "Celestial"]
    },
    {
      type: "Nebula [1 in 62,500]",
      class: "nebulaBgImg",
      chance: 0.0016,
      titles: ["Nebula", "Cosmic Cloud", "Stellar Nursery"]
    },
    {
      type: "Mastermind [1 in 110,010]",
      class: "mastermindBgImg",
      chance: 0.00090900827,
      titles: ["Mastermind", "Strategist", "Tactician"]
    },
    {
      type: "MythicWall [1 in 17,017]",
      class: "mythicwallBgImg",
      chance: 0.00587647646,
      titles: ["Mythical", "Dude"]
    },
    {
      type: "Pumpkin Hollow [1 in 3,110]",
      class: "pumpkinhollowBgImg",
      chance: 0.03215434083,
      titles: ["Mythical", "Dude"]
    },
    {
      type: "The Scarecrow's Sigil [1 in 1,031]",
      class: "thescarecrowssigilBgImg",
      chance: 0.09699321047,
      titles: ["Stalking", "Hay"]
    },
    {
      type: "Hollow Hill Manor [1 in 10,031]",
      class: "hollowhillmanorBgImg",
      chance: 0.0099690958,
      titles: ["Haunted", "Ghoul"]
    },
    {
      type: "The Phantom Moon [1 in 10,031]",
      class: "thephantommoonBgImg",
      chance: 0.0099690958,
      titles: ["Gravity", "Alive"]
    },
    {
      type: "The Void's Veil [1 in 10,031]",
      class: "thevoidsveilBgImg",
      chance: 0.0099690958,
      titles: ["Mystic", "Aliens"]
    },
    {
      type: "Wailing Shade [1 in 31,010]",
      class: "wailingshadeBgImg",
      chance: 0.0032247662,
      titles: ["Haunt", "Pray"]
    }
  ];

  const glitchedRarity = {
    type: "Gl1tch3d [1 in 12,404/40,404th]",
    class: "glitchedBgImg",
    chance: 0.0000806,
    titles: ["Gl1tch3d", "Glitch", "Corrupted"]
  };

  const abominationRarity = {
    type: "Abomination [1 in 1,000,000/20th]",
    class: "aboBgImg",
    chance: 0.000001,
    titles: ["Chaos", "Experiment: 902", "Damaged", "Assistance"],
  };

  const iridocyclitisVeilRarity = {
    type: "Iridocyclitis Veil [1 in 5,000/50th]",
    class: "iriBgImg",
    chance: 0.0002,
    titles: ["Cyclithe", "Veilborne", "Hemovail", "Abomination: 902"],
  };

  const ShenviiRarity = {
    type: "sʜeɴvɪ✞∞ [1 in 77,777/7th]",
    class: "shenviiBgImg",
    chance: 0.00001286,
    titles: ["Cat", "Unforgettable", "Pookie", "Orb: 902", "Infinity"],
  };

  const orbRarity = {
    type: "ORB [1 in 55,555/30th]",
    class: "orbBgImg",
    chance: 0.000018,
    titles: ["Energy", "Iris: 902", "Power"],
  }

  const experimentRarity = {
    type: "Experiment [1 in 100,000/10th]",
    class: "expBgImg",
    chance: 0.0001,
    titles: ["1106", "1073", "1105", "905", "302", "1130", "1263", "1005", "1473", "1748",
            "899", "1157", "1288", "1203", "1024", "1702", "786", "1684", "1337", "912",
            "1987", "1405", "771", "1883", "1294", "1772", "902", "1526", "1759", "666"],
  };

  const veilRarity = {
    type: "Veil [1 in 50,000/5th]",
    class: "veilBgImg",
    chance: 0.00002,
    titles: ["Fight", "Peace", "MSFU: 902"],
  };

  const blindRarity = {
    type: "BlindGT [1 in 2,000,000/15th]",
    class: "blindBgImg",
    chance: 0.0000005,
    titles: ["Moderator", "Moderator: 902"],
  };

  const msfuRarity = {
    type: "MSFU [1 in 333/333rd]",
    class: "msfuBgImg",
    chance: 0.003003,
    titles: ["Metal", "Universe", "Veil: 902"],
  };

  const fireCrazeRarity = {
    type: "FireCraze [1 in 4,200/69th]",
    class: "crazeBgImg",
    chance: 0.000238,
    titles: ["Fire", "Craze", "Iridocyclitis: 902"],
  };

  const specials = [
    { gate: 40404, data: glitchedRarity },
    { gate: 333,   data: msfuRarity },
    { gate: 69,    data: fireCrazeRarity },
    { gate: 50,    data: iridocyclitisVeilRarity },
    { gate: 30,    data: orbRarity },
    { gate: 20,    data: abominationRarity },
    { gate: 15,    data: blindRarity },
    { gate: 10,    data: experimentRarity },
    { gate: 7,     data: ShenviiRarity },
    { gate: 5,     data: veilRarity },
  ];

  for (const { gate, data } of specials) {
    if (rollCount % gate === 0 && Math.random() < data.chance) {
      return data;
    }
  }

  const total = rarities.reduce((sum, r) => sum + r.chance, 0);
  let pick = Math.random() * total;

  for (const r of rarities) {
    if ((pick -= r.chance) <= 0) {
      return r;
    }
  }

  return rarities[rarities.length - 1];
};

function clickSound() {
  let click = document.getElementById("click");

  click.play();

  document.getElementById("rollButton").addEventListener("click", clickSound);
}

let copyToastTimeout;
let profileDropdownOutsideHandler = null;

function positionCopyToast() {
  const toast = document.getElementById("copyToast");
  const trigger = document.querySelector(".creator-card");

  if (!toast || !trigger) {
    return;
  }

  let offset = trigger.offsetHeight + 12;
  const dropdown = document.getElementById("profileDropdown");

  if (dropdown && dropdown.classList.contains("profile-dropdown--visible")) {
    offset = trigger.offsetHeight + 14 + dropdown.offsetHeight + 12;
  }

  toast.style.top = `${offset}px`;
  toast.style.bottom = "auto";
}

function fallbackCopyToClipboard(inputElement) {
  inputElement.hidden = false;
  inputElement.select();
  inputElement.setSelectionRange(0, inputElement.value.length);
  document.execCommand("copy");
  inputElement.hidden = true;
  inputElement.blur();
}

function showCopyToast(message) {
  const toast = document.getElementById("copyToast");
  if (!toast) {
    return;
  }

  positionCopyToast();
  toast.textContent = message;
  toast.classList.add("copy-toast--visible");
  toast.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => {
    positionCopyToast();
  });

  if (copyToastTimeout) {
    clearTimeout(copyToastTimeout);
  }

  copyToastTimeout = setTimeout(() => {
    toast.classList.remove("copy-toast--visible");
    toast.setAttribute("aria-hidden", "true");
  }, 2200);
}

function showPopupCopyTxt(event) {
  if (event) {
    event.stopPropagation();
  }

  const copyText = document.getElementById("unnamedUser");
  const value = copyText.value;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(value).catch(() => {
      fallbackCopyToClipboard(copyText);
    });
  } else {
    fallbackCopyToClipboard(copyText);
  }

  openProfileDropdown();
  showCopyToast(`Copied ${value} to clipboard`);
}

function openProfileDropdown() {
  const dropdown = document.getElementById("profileDropdown");
  const trigger = document.querySelector(".creator-card");

  if (!dropdown || !trigger) {
    return;
  }

  dropdown.classList.add("profile-dropdown--visible");
  dropdown.setAttribute("aria-hidden", "false");
  trigger.setAttribute("aria-expanded", "true");

  if (profileDropdownOutsideHandler) {
    document.removeEventListener("click", profileDropdownOutsideHandler);
  }

  profileDropdownOutsideHandler = (event) => {
    if (!event.isTrusted) {
      return;
    }

    if (!dropdown.contains(event.target) && !trigger.contains(event.target)) {
      closeProfileDropdown();
    }
  };

  setTimeout(() => {
    document.addEventListener("click", profileDropdownOutsideHandler);
  }, 0);
}

function closeProfileDropdown() {
  const dropdown = document.getElementById("profileDropdown");
  const trigger = document.querySelector(".creator-card");

  if (!dropdown) {
    return;
  }

  dropdown.classList.remove("profile-dropdown--visible");
  dropdown.setAttribute("aria-hidden", "true");

  if (trigger) {
    trigger.setAttribute("aria-expanded", "false");
  }

  const toast = document.getElementById("copyToast");
  if (toast && toast.classList.contains("copy-toast--visible")) {
    requestAnimationFrame(() => {
      positionCopyToast();
    });
  }

  if (profileDropdownOutsideHandler) {
    document.removeEventListener("click", profileDropdownOutsideHandler);
    profileDropdownOutsideHandler = null;
  }
}

function openDiscord() {
  window.open("https://discord.gg/m6k7Jagm3v", "_blank");
}

function openGithub() {
  window.open("https://github.com/The-Unnamed-Official/Unnamed-RNG/tree/published", "_blank");
}

function selectTitle(rarity) {
  const titles = rarity.titles;
  return titles[Math.floor(Math.random() * titles.length)];
}

function addToInventory(title, rarityClass) {
  lastRollRarityClass = rarityClass || null;
  const rolledAt = typeof rollCount === "number"
    ? rollCount
    : parseInt(localStorage.getItem("rollCount")) || 0;
  pendingAutoEquipRecord = null;
  const autoDeleteSet = getAutoDeleteSet();
  const bucket = normalizeRarityBucket(rarityClass);
  recordRarityBucketRoll(bucket);
  if (autoDeleteSet.has(bucket)) {
    lastRollPersisted = false;
    lastRollAutoDeleted = true;
    resumeEquippedAudioAfterCutscene = true;
    return false; // not persisted
  }

  const excludedRarities = new Set(Array.from(document.querySelectorAll('.rarity-button.active')).map(btn => btn.dataset.rarity));

  for (const category in rarityCategories) {
    if (excludedRarities.has(category) && rarityCategories[category].includes(rarityClass)) {
      lastRollPersisted = false;
      lastRollAutoDeleted = true;
      resumeEquippedAudioAfterCutscene = true;
      return false;
    }
  }

  const { record: newRecord } = normalizeInventoryRecord({ title, rarityClass, rolledAt });
  if (!newRecord) {
    return false;
  }

  inventory.push(newRecord);
  storage.set("inventory", inventory);
  pendingAutoEquipRecord = newRecord;
  renderInventory();
  checkAchievements();
  updateAchievementsList();
  if (isEquinoxRarityClass(newRecord.rarityClass)) {
    setEquinoxPulseActive(true);
  }
  lastRollPersisted = true;
  lastRollAutoDeleted = false;
  return true; // persisted
}

function applyPendingAutoEquip() {
  if (!pendingAutoEquipRecord) {
    return;
  }

  const normalized = normalizeEquippedItemRecord(pendingAutoEquipRecord);
  pendingAutoEquipRecord = null;

  if (!normalized) {
    return;
  }

  if (isItemCurrentlyEquipped(normalized)) {
    return;
  }

  resumeEquippedAudioAfterCutscene = false;
  pausedEquippedAudioState = null;

  equippedItem = normalized;
  storage.set("equippedItem", normalized);
  setEquinoxPulseActive(isEquinoxRecord(normalized));
  renderInventory();
}

function displayResult(title, rarity) {
  const resultDiv = document.getElementById("result");
  if (!resultDiv) {
    return;
  }

  pendingCutsceneRarity = null;

  const rarityValue = rarity == null ? "" : rarity;
  const rarityText = typeof rarityValue === "string" ? rarityValue : String(rarityValue);
  const [rarityName, oddsRaw] = rarityText.split(" [");
  const odds = oddsRaw ? oddsRaw.replace(/\]$/, "") : "";
  const bucket = normalizeRarityBucket(lastRollRarityClass);
  const bucketClass = bucket ? `roll-result-card--${bucket}` : "";
  const bucketLabel = bucket ? (RARITY_BUCKET_LABELS[bucket] || bucket) : "";
  const labelClasses = getLabelClassForRarity(lastRollRarityClass, bucket);

  const card = document.createElement("div");
  card.className = "roll-result-card";
  if (bucketClass) {
    card.classList.add(bucketClass);
  }
  if (lastRollAutoDeleted) {
    card.classList.add("roll-result-card--skipped");
  }

  const header = document.createElement("div");
  header.className = "roll-result-card__header";

  const rarityLabel = document.createElement("span");
  rarityLabel.className = "roll-result-card__rarity";
  if (labelClasses.length) {
    rarityLabel.classList.add(...labelClasses);
  }
  rarityLabel.textContent = (rarityName || rarityText || "Unknown").trim();
  header.appendChild(rarityLabel);

  if (odds) {
    const oddsEl = document.createElement("span");
    oddsEl.className = "roll-result-card__odds";
    oddsEl.textContent = odds;
    header.appendChild(oddsEl);
  }

  const badge = document.createElement("span");
  badge.className = "roll-result-card__badge";
  badge.textContent = lastRollAutoDeleted ? "Skipped" : "New Title";
  header.appendChild(badge);

  const titleEl = document.createElement("div");
  titleEl.className = "roll-result-card__title";
  titleEl.textContent = title || "Unknown";

  const statusEl = document.createElement("div");
  statusEl.className = "roll-result-card__status";
  if (lastRollAutoDeleted) {
    statusEl.textContent = bucketLabel
      ? `Auto-deleted (${bucketLabel})`
      : "Auto-deleted";
    statusEl.classList.add("roll-result-card__status--skipped");
  } else {
    statusEl.textContent = "Added to inventory";
  }

  card.appendChild(header);
  card.appendChild(titleEl);
  card.appendChild(statusEl);

  resultDiv.innerHTML = "";
  resultDiv.appendChild(card);

  resumePausedEquippedAudio();

  requestAnimationFrame(() => {
    card.classList.add("is-visible");
  });
}

function recordRarityBucketRoll(bucket) {
  if (!bucket) {
    return;
  }

  if (rolledRarityBuckets.has(bucket)) {
    return;
  }

  rolledRarityBuckets.add(bucket);
  storage.set("rolledRarityBuckets", Array.from(rolledRarityBuckets));
  checkAchievements({ rarityBuckets: rolledRarityBuckets });
}

function getAutoDeleteSet() {
  return new Set(
    Array.from(document.querySelectorAll('.rarity-button.active'))
      .map(btn => btn.dataset.rarity)
  );
}

function normalizeRarityBucket(rarityClass) {
  if (!rarityClass || typeof rarityClass !== "string") return "";
  const cls = rarityClass.trim();

  const prefixMatches = [
    { prefix: "under10me", bucket: "transcendent" },
    { prefix: "under10ms", bucket: "transcendent" },
    { prefix: "under10m", bucket: "transcendent" },
    { prefix: "under1m", bucket: "under1m" },
    { prefix: "under100k", bucket: "under100k" },
    { prefix: "under10k", bucket: "under10k" },
    { prefix: "under1k", bucket: "under1k" },
    { prefix: "under100", bucket: "under100" },
  ];

  for (const { prefix, bucket } of prefixMatches) {
    if (cls.startsWith(prefix)) {
      return bucket;
    }
  }

  if (cls === "special") return "special";
  if (["under100", "under1k", "under10k", "under100k", "under1m", "transcendent", "special"].includes(cls)) {
    return cls;
  }

  const labelEntry = RARITY_LABEL_CLASS_MAP[cls];
  if (labelEntry) {
    const labels = Array.isArray(labelEntry) ? labelEntry : [labelEntry];
    for (const label of labels) {
      if (typeof label !== "string") {
        continue;
      }

      const normalizedLabel = label.trim();
      if (!normalizedLabel) {
        continue;
      }

      if (
        normalizedLabel.startsWith("event") ||
        normalizedLabel === "transcendent" ||
        normalizedLabel === "special" ||
        normalizedLabel.startsWith("under")
      ) {
        return normalizedLabel;
      }
    }
  }

  return RARITY_CLASS_BUCKET_MAP[cls] || "";
}

function getLabelClassForRarity(rarityClass, bucket) {
  const fallback = bucket ? [bucket] : [];

  if (!rarityClass || typeof rarityClass !== "string") {
    return fallback;
  }

  const cls = rarityClass.trim();
  const mapped = RARITY_LABEL_CLASS_MAP[cls];

  if (!mapped) {
    return fallback;
  }

  if (Array.isArray(mapped)) {
    return mapped.filter(Boolean);
  }

  if (typeof mapped === "string" && mapped.trim()) {
    return mapped.trim().split(/\s+/);
  }

  return fallback;
}

function deleteByRarityBucket(bucket) {
  const before = inventory.length;

  const isLocked = (it) => {
    try {
      return typeof lockedItems === 'object' && lockedItems && lockedItems[it.title];
    } catch { return false; }
  };

  inventory = inventory.filter(it => {
    const b = normalizeRarityBucket(it.rarityClass);
    // Keep if different bucket OR locked
    return b !== bucket || isLocked(it);
  });

  if (inventory.length !== before) {
    localStorage.setItem('inventory', JSON.stringify(inventory));
    renderInventory();
  }
}

function saveToggledStates() {
  const activeRarities = Array.from(document.querySelectorAll('.rarity-button.active'))
    .map(btn => btn.dataset.rarity);
  localStorage.setItem("toggledRarities", JSON.stringify(activeRarities));
}

function loadToggledStates() {
  const savedRarities = JSON.parse(localStorage.getItem("toggledRarities")) || [];
  document.querySelectorAll(".rarity-button").forEach(button => {
    if (savedRarities.includes(button.dataset.rarity)) {
      button.classList.add("active");
    }
  });
}

function deleteAllFromInventory() {
  inventory = [];
  localStorage.setItem("inventory", JSON.stringify(inventory));
  renderInventory();
  load();
}

function deleteAllByRarity(rarityClass) {
  const lockedItems = JSON.parse(localStorage.getItem("lockedItems")) || {};

  inventory = inventory.filter((item) => {
    return item.rarityClass !== rarityClass || lockedItems[item.title] === true;
  });

  localStorage.setItem("inventory", JSON.stringify(inventory));
  renderInventory();
}

function registerInterfaceToggleButtons() {
  const toggleInventoryBtn = document.getElementById("toggleInventoryBtn");
  if (toggleInventoryBtn) {
    toggleInventoryBtn.addEventListener("click", function () {
      const inventorySection = document.querySelector(".inventory");
      if (!inventorySection) {
        return;
      }

      const isVisible = inventorySection.style.visibility !== "visible";

      if (isVisible) {
        inventorySection.style.visibility = "visible";
        this.textContent = "Hide Inventory";
        document.body.classList.add("inventory-open");
      } else {
        inventorySection.style.visibility = "hidden";
        this.textContent = "Show Inventory";
        document.body.classList.remove("inventory-open");
      }
    });
  }

  const toggleUiBtn = document.getElementById("toggleUiBtn");
  const uiSection = document.querySelector(".ui");

  if (toggleUiBtn && uiSection) {
    toggleUiBtn.addEventListener("click", function (event) {
      const isVisible = uiSection.style.visibility !== "hidden";

      if (isVisible) {
        uiSection.style.visibility = "hidden";
        this.textContent = "Show UI";
      } else {
        uiSection.style.visibility = "visible";
        this.textContent = "Hide UI";
      }

      if (this.textContent === "Show UI") {
        toggleUiBtn.style.display = "none";
        event.stopPropagation();
      }
    });

    document.addEventListener("click", () => {
      if (toggleUiBtn.style.display === "none") {
        toggleUiBtn.style.display = "block";
      }
    });
  }

  const toggleRollDisplayBtn = document.getElementById("toggleRollDisplayBtn");
  if (toggleRollDisplayBtn) {
    toggleRollDisplayBtn.addEventListener("click", function () {
      const inventorySection = document.querySelector(".container");
      if (!inventorySection) {
        return;
      }

      const isVisible = inventorySection.style.visibility !== "hidden";

      if (isVisible) {
        inventorySection.style.visibility = "hidden";
        rollDisplayHiddenByUser = true;
        this.textContent = "Show Roll & Display";
      } else {
        inventorySection.style.visibility = "visible";
        rollDisplayHiddenByUser = false;
        cutsceneHidRollDisplay = false;
        this.textContent = "Hide Roll & Display";
      }
    });
  }

  const toggleRollHistoryBtn = document.getElementById("toggleRollHistoryBtn");
  if (toggleRollHistoryBtn) {
    toggleRollHistoryBtn.addEventListener("click", function () {
      const historySection = document.querySelector(".historySection");
      const container = document.querySelector(".container1");
      if (!historySection || !container) {
        return;
      }

      const isVisible = historySection.style.visibility !== "hidden";

      if (isVisible) {
        historySection.style.visibility = "hidden";
        this.textContent = "Show Roll History";
        container.style.left = "10px";
      } else {
        historySection.style.visibility = "visible";
        this.textContent = "Hide Roll History";
        container.style.left = "383px";
      }
    });
  }

  const toggleReducedAnimationsBtn = document.getElementById("toggleReducedAnimationsBtn");
  if (toggleReducedAnimationsBtn) {
    const updateButtonState = () => {
      const active = isReducedAnimationsEnabled();
      toggleReducedAnimationsBtn.textContent = active ? "Restore Animations" : "Reduce Animations";
      toggleReducedAnimationsBtn.setAttribute("aria-pressed", String(active));
    };

    updateButtonState();

    toggleReducedAnimationsBtn.addEventListener("click", () => {
      setReducedAnimationsEnabled(!isReducedAnimationsEnabled());
      updateButtonState();
    });
  }
}

function registerResponsiveHandlers() {
  const applyLayout = () => {
    const container = document.querySelector(".container1");
    const inventory = document.querySelector(".inventory");
    const settingsButton = document.getElementById("settingsButton");
    const achievementsButton = document.getElementById("achievementsButton");
    const statsButton = document.getElementById("statsButton");
    const sliderContainer = document.querySelector(".slider-container");
    const originalParent = document.querySelector(".original-parent");

    if (!container || !inventory || !settingsButton || !achievementsButton || !statsButton) {
      return;
    }

    if (window.innerWidth < 821) {
      settingsButton.style.display = "none";
      achievementsButton.style.display = "none";
      statsButton.style.display = "none";
      container.style.left = "10px";
      inventory.style.height = "58vh";
      inventory.style.width = "42vh";

      if (sliderContainer && !container.contains(sliderContainer)) {
        container.appendChild(sliderContainer);
      }
    } else if (window.innerWidth > 821 && window.innerHeight > 1400) {
      inventory.style.width = "70vh";
      container.style.left = "383px";

      if (originalParent && sliderContainer && !originalParent.contains(sliderContainer)) {
        originalParent.appendChild(sliderContainer);
      }
    } else {
      container.style.left = "383px";
      settingsButton.style.display = "inline-block";
      achievementsButton.style.display = "inline-block";
      statsButton.style.display = "inline-block";
      inventory.style.width = "60vh";
      inventory.style.height = "85vh";

      if (originalParent && sliderContainer && !originalParent.contains(sliderContainer)) {
        originalParent.appendChild(sliderContainer);
      }
    }
  };

  applyLayout();
  window.addEventListener("resize", applyLayout);
}

function setupInventoryTabs() {
  const tabButtons = Array.from(document.querySelectorAll(".inventory-tab"));
  const panels = Array.from(document.querySelectorAll(".inventory-panel"));

  if (!tabButtons.length || !panels.length) {
    return;
  }

  panels.forEach((panel, index) => {
    if (!panel.id) {
      const suffix = panel.dataset.tabPanel ? panel.dataset.tabPanel.replace(/\s+/g, "-") : String(index);
      panel.id = `inventory-panel-${suffix}`;
    }
  });

  tabButtons.forEach((button) => {
    const targetPanel = panels.find((panel) => panel.dataset.tabPanel === button.dataset.tab);
    if (targetPanel) {
      button.setAttribute("aria-controls", targetPanel.id);
    }
  });

  let activeTabName = null;

  const activateTab = (tabName) => {
    if (!tabName || tabName === activeTabName) {
      return;
    }

    activeTabName = tabName;

    tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === tabName;
      button.classList.toggle("inventory-tab--active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.tabPanel === tabName;
      panel.classList.toggle("inventory-panel--active", isActive);
      panel.setAttribute("aria-hidden", String(!isActive));
    });

    document.querySelectorAll(".dropdown-menu.open").forEach((menu) => {
      menu.style.display = "none";
      menu.classList.remove("open");
      const parentItem = menu.closest(".inventory-item");
      if (parentItem) {
        parentItem.classList.remove("inventory-item--menu-open");
      }
    });
  };

  tabButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tab);
    });

    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
        return;
      }

      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + direction + tabButtons.length) % tabButtons.length;
      const nextButton = tabButtons[nextIndex];
      if (nextButton) {
        nextButton.focus();
        activateTab(nextButton.dataset.tab);
      }
    });
  });

  const defaultTab = tabButtons.find((button) => button.classList.contains("inventory-tab--active"))
    || tabButtons[0];

  if (defaultTab) {
    activateTab(defaultTab.dataset.tab);
  }
}

const backgroundDetails = {
  menuDefault: { image: "files/backgrounds/menu.png", audio: null },
  commonBgImg: { image: "files/backgrounds/common.png", audio: null },
  rareBgImg: { image: "files/backgrounds/rare.png", audio: null },
  epicBgImg: { image: "files/backgrounds/epic.png", audio: null },
  legendaryBgImg: { image: "files/backgrounds/legendary.png", audio: null },
  impossibleBgImg: { image: "files/backgrounds/impossible.png", audio: null },
  poweredBgImg: { image: "files/backgrounds/powered.png", audio: null },
  toxBgImg: { image: "files/backgrounds/toxic.png", audio: null },
  flickerBgImg: { image: "files/backgrounds/flicker.png", audio: null },
  solarpowerBgImg: { image: "files/backgrounds/solarpower.png", audio: null },
  belivBgImg: { image: "files/backgrounds/beliv.png", audio: null },
  plabreBgImg: { image: "files/backgrounds/plabre.png", audio: "plabreAudio" },
  wanspiBgImg: { image: "files/backgrounds/wanspi.png", audio: "wanspiAudio" },
  lubjubBgImg: { image: "files/backgrounds/lubjub.gif", audio: "lubjubAudio" },
  gingerBgImg: { image: "files/backgrounds/ginger.gif", audio: "gingerAudio" },
  hollowhillmanorBgImg: { image: "files/backgrounds/hollowhillmanor.gif", audio: "hollowhillmanorAudio" },
  pumpkinhollowBgImg: { image: "files/backgrounds/pumpkinhollow.gif", audio: "pumpkinhollowAudio" },
  thephantommoonBgImg: { image: "files/backgrounds/thephantommoon.gif", audio: "thephantommoonAudio" },
  thescarecrowssigilBgImg: { image: "files/backgrounds/thescarecrowssigil.gif", audio: "thescarecrowssigilAudio" },
  thevoidsveilBgImg: { image: "files/backgrounds/thevoidsveil.gif", audio: "thevoidsveilAudio" },
  wailingshadeBgImg: { image: "files/backgrounds/wailingshade.gif", audio: "wailingshadeAudio" },
  froBgImg: { image: "files/backgrounds/fro.png", audio: "froAudio" },
  mysBgImg: { image: "files/backgrounds/mys.png", audio: "mysAudio" },
  forgBgImg: { image: "files/backgrounds/forg.png", audio: "forgAudio" },
  curartBgImg: { image: "files/backgrounds/curart.png", audio: "curartAudio" },
  specBgImg: { image: "files/backgrounds/spec.png", audio: "specAudio" },
  shadBgImg: { image: "files/backgrounds/shad.png", audio: "shadAudio" },
  nighBgImg: { image: "files/backgrounds/nigh.png", audio: "nighAudio" },
  voiBgImg: { image: "files/backgrounds/voi.png", audio: "voiAudio" },
  silBgImg: { image: "files/backgrounds/sil.png", audio: "silAudio" },
  ghoBgImg: { image: "files/backgrounds/gho.png", audio: "ghoAudio" },
  endBgImg: { image: "files/backgrounds/end.png", audio: "endAudio" },
  abysBgImg: { image: "files/backgrounds/abys.png", audio: "abysAudio" },
  darBgImg: { image: "files/backgrounds/dar.png", audio: "darAudio" },
  twiligBgImg: { image: "files/backgrounds/twilig.png", audio: "twiligAudio" },
  ethpulBgImg: { image: "files/backgrounds/ethpul.png", audio: "ethpulAudio" },
  tuonBgImg: { image: "files/backgrounds/tuon.gif", audio: "tuonAudio" },
  eniBgImg: { image: "files/backgrounds/eni.png", audio: "eniAudio" },
  griBgImg: { image: "files/backgrounds/gri.png", audio: "griAudio" },
  celdawBgImg: { image: "files/backgrounds/celdaw.png", audio: "celdawAudio" },
  fatreBgImg: { image: "files/backgrounds/fatre.png", audio: "fatreAudio" },
  fearBgImg: { image: "files/backgrounds/fear.gif", audio: "fearAudio" },
  hauBgImg: { image: "files/backgrounds/hau.png", audio: "hauAudio" },
  lostsBgImg: { image: "files/backgrounds/losts.png", audio: "lostsAudio" },
  foundsBgImg: { image: "files/backgrounds/founds.png", audio: "foundsAudio" },
  hauntBgImg: { image: "files/backgrounds/haunt.png", audio: "hauntAudio" },
  devilBgImg: { image: "files/backgrounds/devil.png", audio: "devilAudio" },
  isekaiBgImg: { image: "files/backgrounds/isekai.png", audio: "isekaiAudio" },
  emerBgImg: { image: "files/backgrounds/emergencies.png", audio: "emerAudio" },
  demsoBgImg: { image: "files/backgrounds/demso.png", audio: "demsoAudio" },
  fircraBgImg: { image: "files/backgrounds/fircra.gif", audio: "fircraAudio" },
  shaBgImg: { image: "files/backgrounds/sha.png", audio: "shaAudio" },
  iriBgImg: { image: "files/backgrounds/iri.gif", audio: "iriAudio" },
  radBgImg: { image: "files/backgrounds/rad.png", audio: "radAudio" },
  blodBgImg: { image: "files/backgrounds/blod.png", audio: "blodAudio" },
  h1diBgImg: { image: "files/backgrounds/h1di.gif", audio: "h1diAudio" },
  orbBgImg: { image: "files/backgrounds/orb.png", audio: "orbAudio" },
  heartBgImg: { image: "files/backgrounds/heart.png", audio: "heartAudio" },
  astblaBgImg: { image: "files/backgrounds/astbla.png", audio: "astblaAudio" },
  astredBgImg: { image: "files/backgrounds/astred.png", audio: "astredAudio" },
  crazeBgImg: { image: "files/backgrounds/firecraze.png", audio: "crazeAudio" },
  shenviiBgImg: { image: "files/backgrounds/shenvii.gif", audio: "shenviiAudio" },
  qbearBgImg: { image: "files/backgrounds/qbear.png", audio: "qbearAudio" },
  isekailofiBgImg: { image: "files/backgrounds/isekailofi.png", audio: "isekailofiAudio" },
  equinoxBgImg: { image: "files/backgrounds/equinox.gif", audio: "equinoxAudio" },
  waveBgImg: { image: "files/backgrounds/wave.png", audio: "waveAudio" },
  scorchingBgImg: { image: "files/backgrounds/scho.png", audio: "scorchingAudio" },
  beachBgImg: { image: "files/backgrounds/beach.png", audio: "beachAudio" },
  tidalwaveBgImg: { image: "files/backgrounds/tidwav.gif", audio: "tidalwaveAudio" },
  mythicwallBgImg: { image: "files/backgrounds/mythicwall.gif", audio: "mythicwallAudio" },
  samuraiBgImg: {
    image: "files/backgrounds/samurai.png",
    audio: "samuraiAudio",
  },
  contBgImg: { image: "files/backgrounds/contortions.png", audio: "contAudio" },
  pumpkinBgImg: {
    image: "files/backgrounds/pumpkin.png",
    audio: "pumpkinAudio",
  },
  unstoppableBgImg: {
    image: "files/backgrounds/unstoppable.gif",
    audio: "unstoppableAudio",
  },
  gargBgImg: {
    image: "files/backgrounds/gargantua.png",
    audio: "gargantuaAudio",
  },
  spectralBgImg: {
    image: "files/backgrounds/spectral.png",
    audio: "spectralAudio",
  },
  starfallBgImg: {
    image: "files/backgrounds/starfall.png",
    audio: "starfallAudio",
  },
  memBgImg: { image: "files/backgrounds/memory.png", audio: "memAudio" },
  oblBgImg: { image: "files/backgrounds/oblivion.png", audio: "oblAudio" },
  phaBgImg: { image: "files/backgrounds/phantomstride.png", audio: "phaAudio" },
  frightBgImg: { image: "files/backgrounds/fright.png", audio: "frightAudio" },
  hellBgImg: { image: "files/backgrounds/hell.png", audio: "hellAudio" },
  unnamedBgImg: {
    image: "files/backgrounds/unnamed.gif",
    audio: "unnamedAudio",
  },
  overtureBgImg: {
    image: "files/backgrounds/overture.png",
    audio: "overtureAudio",
  },
  impeachedBgImg: {
    image: "files/backgrounds/impeached.png",
    audio: "impeachedAudio",
  },
  silcarBgImg: {
    image: "files/backgrounds/sillycar.png",
    audio: "silcarAudio",
  },
  eonbreakBgImg: {
    image: "files/backgrounds/eonbreak.png",
    audio: "eonbreakAudio",
  },
  celestialchorusBgImg: {
    image: "files/backgrounds/celestialchorus.png",
    audio: "celAudio",
  },
  arcanepulseBgImg: {
    image: "files/backgrounds/arcanepulse.png",
    audio: "arcAudio",
  },
  seraphwingBgImg: {
    image: "files/backgrounds/seraphwing.png",
    audio: "serAudio",
  },
  gregBgImg: { image: "files/backgrounds/greg.png", audio: "gregAudio" },
  cursedmirageBgImg: {
    image: "files/backgrounds/cursed.png",
    audio: "curAudio",
  },
  mintllieBgImg: {
    image: "files/backgrounds/mintllie.png",
    audio: "mintllieAudio",
  },
  geezerBgGif: { image: "files/backgrounds/geezer.gif", audio: "geezerAudio" },
  polarrBgImg: { image: "files/backgrounds/polarr.png", audio: "polarrAudio" },
  ethershiftBgImg: { image: "files/backgrounds/ether.png", audio: "ethAudio" },
  msfuBgImg: { image: "files/backgrounds/msfu.png", audio: "msfuAudio" },
  oppBgImg: { image: "files/backgrounds/oppression.jpg", audio: "oppAudio" },
  glitchedBgImg: { image: "files/backgrounds/glitched.gif", audio: "glitchedAudio" },
  astraldBgImg: { image: "files/backgrounds/astrald.gif", audio: "astraldAudio" },
  hypernovaBgImg: { image: "files/backgrounds/hypernova.gif", audio: "hypernovaAudio" },
  mastermindBgImg: { image: "files/backgrounds/mastermind.gif", audio: "mastermindAudio" },
  nebulaBgImg: { image: "files/backgrounds/nebula.gif", audio: "nebulaAudio" },
  norstaBgImg: { image: "files/backgrounds/norsta.png", audio: "norstaAudio" },
  sanclaBgImg: { image: "files/backgrounds/sancla.png", audio: "sanclaAudio" },
  silnigBgImg: { image: "files/backgrounds/silnig.png", audio: "silnigAudio" },
  reidasBgImg: { image: "files/backgrounds/reidas.png", audio: "reidasAudio" },
  frogarBgImg: { image: "files/backgrounds/frogar.png", audio: "frogarAudio" },
  cancansymBgImg: { image: "files/backgrounds/cancansym.png", audio: "cancansymAudio" },
  ginharBgImg: { image: "files/backgrounds/ginhar.png", audio: "ginharAudio" },
  jolbeBgImg: { image: "files/backgrounds/jolbel.png", audio: "jolbelAudio" },
  holcheBgImg: { image: "files/backgrounds/holche.png", audio: null },
  cristoBgImg: { image: "files/backgrounds/cristo.png", audio: null },
  harvBgImg: { image: "files/backgrounds/harv.png", audio: "harvAudio" },
  aboBgImg: { image: "files/backgrounds/abo.gif", audio: "aboAudio" },
  expBgImg: { image: "files/backgrounds/exp.gif", audio: "expAudio" },
  veilBgImg: { image: "files/backgrounds/veil.gif", audio: "veilAudio" },
  blindBgImg: { image: "files/backgrounds/blind.png", audio: "blindAudio" },
  lightBgImg: { image: "files/backgrounds/light.png", audio: "lightAudio" },
  x1staBgImg: { image: "files/backgrounds/x1sta.png", audio: "x1staAudio" },
  esteggBgImg: { image: "files/backgrounds/estegg.png", audio: "esteggAudio" },
  estbunBgImg: { image: "files/backgrounds/estbun.png", audio: "estbunAudio" },
};

function triggerScreenShakeByBucket(bucket) {
  // Map rarity buckets to shake classes
  const map = {
    under100: 'shake-xs',     // optional tiniest shake
    under1k:  'shake-s',
    under10k: 'shake-m',
    under100k:'shake-xl',
    under1m:  'shake-xl',     // "actually too much"
    special:  'shake-xl'      // same "too much" for specials
  };
  const cls = map[bucket];
  if (!cls) return;

  if (isReducedAnimationsEnabled()) {
    return;
  }

  const el = document.body;

  // Clean previous shakes
  el.classList.remove('shake-xs','shake-s','shake-m','shake-l','shake-xl');

  // Respect reduced motion: heavy -> medium
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finalClass = prefersReduced && (cls === 'shake-xl') ? 'shake-m' : cls;

  el.classList.add(finalClass);

  // Remove shake class after animation ends
  const onEnd = (e) => {
    if (!e || (typeof e.animationName === 'string' && e.animationName.startsWith('screenShake'))) {
      el.classList.remove('shake-xs','shake-s','shake-m','shake-l','shake-xl');
      el.removeEventListener('animationend', onEnd);
    }
  };
  el.addEventListener('animationend', onEnd);
}

function enableChange() {
  isChangeEnabled = true;
  finalizeCutsceneState();
}

function pauseEquippedAudioForPendingCutscene() {
  if (!pendingCutsceneRarity) {
    return;
  }

  const rarity = pendingCutsceneRarity;
  pendingCutsceneRarity = null;
  pauseEquippedAudioForRarity(rarity);
}

function setEquipToggleButtonDisabled(button, disabled) {
  if (!button) {
    return;
  }

  const shouldDisable = Boolean(disabled);
  if (button.disabled !== shouldDisable) {
    button.disabled = shouldDisable;
  }

  button.classList.toggle("dropdown-item--disabled", shouldDisable);

  if (shouldDisable) {
    button.setAttribute("aria-disabled", "true");
  } else {
    button.removeAttribute("aria-disabled");
  }
}

function updateEquipToggleButtonsDisabled(disabled) {
  $all('.dropdown-item[data-action="equip-toggle"]').forEach((button) => {
    setEquipToggleButtonDisabled(button, disabled);
  });
}

function setInventoryDeleteButtonDisabled(button, disabled) {
  if (!button) {
    return;
  }

  const shouldDisable = Boolean(disabled);
  if (button.disabled !== shouldDisable) {
    button.disabled = shouldDisable;
  }

  button.classList.toggle("dropdown-item--disabled", shouldDisable);

  if (shouldDisable) {
    button.setAttribute("aria-disabled", "true");
  } else {
    button.removeAttribute("aria-disabled");
  }
}

function updateInventoryDeleteButtonsDisabled(disabled) {
  $all('.dropdown-item[data-action="delete"]').forEach((button) => {
    setInventoryDeleteButtonDisabled(button, disabled);
  });
}

function disableChange() {
  isChangeEnabled = false;
  cutsceneActive = true;
  scheduleCutsceneFailsafe();
  // Hide stack during cutscenes (body backgrounds/gifs will show)
  if (__bgStack) __bgStack.classList.add("is-hidden");
  pauseEquippedAudioForPendingCutscene();
  updateEquipToggleButtonsDisabled(true);
  updateInventoryDeleteButtonsDisabled(true);
}

function renderInventory() {
  const inventoryList = document.getElementById("inventoryList");
  inventoryList.innerHTML = "";

  let newBucketRecorded = false;
  let inventoryUpdated = false;
  inventory.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const bucket = item.rarityBucket || normalizeRarityBucket(item.rarityClass);

    if (bucket && bucket !== item.rarityBucket) {
      item.rarityBucket = bucket;
      inventoryUpdated = true;
    } else if (!bucket && item.rarityBucket) {
      delete item.rarityBucket;
      inventoryUpdated = true;
    }

    const qualifies = QUALIFYING_VAULT_BUCKETS.has(bucket);
    if (item.qualifiesForVault !== qualifies) {
      item.qualifiesForVault = qualifies;
      inventoryUpdated = true;
    }

    if (bucket && !rolledRarityBuckets.has(bucket)) {
      rolledRarityBuckets.add(bucket);
      newBucketRecorded = true;
    }
  });

  if (inventoryUpdated) {
    storage.set("inventory", inventory);
  }

  if (newBucketRecorded) {
    storage.set("rolledRarityBuckets", Array.from(rolledRarityBuckets));
    checkAchievements({ rarityBuckets: rolledRarityBuckets });
  } else if (inventoryUpdated) {
    checkAchievements();
  }

  const lockedItems = JSON.parse(localStorage.getItem("lockedItems")) || {};

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedItems = inventory.slice(start, end);

  paginatedItems.forEach((item, index) => {
    const absoluteIndex = start + index;
    const listItem = document.createElement("li");
    listItem.className = item.rarityClass || "";
    listItem.classList.add("inventory-item");
    listItem.dataset.locked = lockedItems[item.title] ? "true" : "false";
    const bucket = normalizeRarityBucket(item.rarityClass);
    if (bucket) {
      listItem.dataset.bucket = bucket;
    }

    const isEquipped = isItemCurrentlyEquipped(item);
    listItem.dataset.equipped = isEquipped ? "true" : "false";
    listItem.classList.toggle("inventory-item--equipped", Boolean(isEquipped));

    const itemTitle = document.createElement("span");
    itemTitle.className = "rarity-text";
    itemTitle.textContent = item.title.toUpperCase();
    const labelClasses = getLabelClassForRarity(item.rarityClass, bucket);
    if (labelClasses.length) {
      itemTitle.classList.add(...labelClasses);
    }

    const rarityText = document.createElement("span");
    listItem.appendChild(itemTitle);
    listItem.appendChild(rarityText);

    const burgerBar = document.createElement("div");
    burgerBar.className = "burger-bar";
    burgerBar.innerHTML = "☰";

    const dropdownMenu = document.createElement("div");
    dropdownMenu.className = "dropdown-menu";
    dropdownMenu.style.display = "none";

    // HEADER: aura title + rolled-at line
    const header = document.createElement("div");
    header.className = "dropdown-header";

    // prefer your formatter if present, else fallback
    const rolledText = typeof item.rolledAt === "number"
      ? (typeof formatRollCount === "function" ? formatRollCount(item.rolledAt) : item.rolledAt.toLocaleString())
      : "Unknown";

    header.innerHTML = `
      <div class="info-title">${item.title}</div>
      <div class="info-sub">Rolled at: ${rolledText}</div>
    `;
    dropdownMenu.appendChild(header);

    // Divider
    const divider = document.createElement("div");
    divider.className = "dropdown-divider";
    dropdownMenu.appendChild(divider);
    
    const equipButton = document.createElement("button");
    equipButton.className = "dropdown-item";
    equipButton.dataset.action = "equip-toggle";
    equipButton.textContent = isEquipped ? "Unequip" : "Equip";
    equipButton.classList.toggle("dropdown-item--unequip", Boolean(isEquipped));
    setEquipToggleButtonDisabled(equipButton, cutsceneActive);
    equipButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (cutsceneActive) {
        return;
      }
      if (isItemCurrentlyEquipped(item)) {
        unequipItem();
      } else {
        equipItem(item);
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "dropdown-item danger";
    deleteButton.dataset.action = "delete";
    deleteButton.textContent = "Delete";
    setInventoryDeleteButtonDisabled(deleteButton, cutsceneActive);
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (cutsceneActive) {
        return;
      }
      if (listItem.dataset.locked !== "true") {
        deleteFromInventory(absoluteIndex);
      }
    });

    const lockButton = document.createElement("button");
    lockButton.textContent = listItem.dataset.locked === "true" ? "Unlock" : "Lock";
    lockButton.style.backgroundColor = listItem.dataset.locked === "true" ? "darkgray" : "";
    lockButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleLock(item.title, listItem, lockButton);
    });

    dropdownMenu.appendChild(equipButton);
    dropdownMenu.appendChild(deleteButton);
    dropdownMenu.appendChild(lockButton);
    burgerBar.appendChild(dropdownMenu);
    listItem.appendChild(burgerBar);

    burgerBar.addEventListener("click", (event) => {
      event.stopPropagation();

      // Close other menus
      document.querySelectorAll(".dropdown-menu").forEach(m => {
        if (m !== dropdownMenu) {
          m.style.display = "none";
          m.classList.remove("open");
          const parentItem = m.closest(".inventory-item");
          if (parentItem) {
            parentItem.classList.remove("inventory-item--menu-open");
          }
        }
      });

      // Toggle this one
      const willOpen = dropdownMenu.style.display !== "block";
      dropdownMenu.style.display = willOpen ? "block" : "none";
      dropdownMenu.classList.toggle("open", willOpen);
      listItem.classList.toggle("inventory-item--menu-open", willOpen);
    });

    inventoryList.appendChild(listItem);
  });

  updatePagination();
  checkAchievements();
}

function toggleLock(itemTitle, listItem, lockButton) {
  const lockedItems = JSON.parse(localStorage.getItem("lockedItems")) || {};
  const isLocked = listItem.dataset.locked === "true";
  listItem.dataset.locked = isLocked ? "false" : "true";
  lockButton.textContent = isLocked ? "Lock" : "Unlock";
  lockButton.style.backgroundColor = isLocked ? "" : "darkgray";
  if (isLocked) {
    delete lockedItems[itemTitle];
  } else {
    lockedItems[itemTitle] = true;
  }
  localStorage.setItem("lockedItems", JSON.stringify(lockedItems));
}

function deleteFromInventory(absoluteIndex) {
  const lockedItems = JSON.parse(localStorage.getItem("lockedItems")) || {};
  const item = inventory[absoluteIndex];
  if (!item) {
    return;
  }

  delete lockedItems[item.title];
  localStorage.setItem("lockedItems", JSON.stringify(lockedItems));

  const wasEquipped = isItemCurrentlyEquipped(item);

  if (wasEquipped) {
    unequipItem({ force: true, skipRender: true });
  }

  inventory.splice(absoluteIndex, 1);
  renderInventory();
  localStorage.setItem("inventory", JSON.stringify(inventory));
  load();
}

function equipItem(item) {
  if (cutsceneActive) {
    return;
  }

  pendingAutoEquipRecord = null;

  const normalized = normalizeEquippedItemRecord(item);
  if (!normalized) {
    return;
  }

  equippedItem = normalized;
  storage.set("equippedItem", normalized);

  resumeEquippedAudioAfterCutscene = false;
  pausedEquippedAudioState = null;

  handleEquippedItem(normalized);

  if (typeof mainAudio !== "undefined" && mainAudio && typeof mainAudio.pause === "function") {
    try {
      mainAudio.pause();
    } catch (error) {
      /* no-op */
    }
  }

  renderInventory();
}

function unequipItem(options = {}) {
  const { force = false, skipRender = false } = options;

  if (cutsceneActive && !force) {
    return;
  }

  if (!equippedItem) {
    return;
  }

  if (isEquinoxRecord(equippedItem)) {
    setEquinoxPulseActive(false);
  }

  equippedItem = null;
  storage.remove("equippedItem");

  resumeEquippedAudioAfterCutscene = false;
  pausedEquippedAudioState = null;

  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch (error) {
      /* no-op */
    }
    if (currentAudio.id) {
      resetAudioState(currentAudio, currentAudio.id);
    }
  }
  currentAudio = null;
  pinnedAudioId = null;

  changeBackground("menuDefault", null, { force: true });
  ensureMenuMusicPlaying();

  if (!skipRender) {
    renderInventory();
  }
}

function handleEquippedItem(item) {
  if (!item) {
    setEquinoxPulseActive(false);
    return;
  }

  setEquinoxPulseActive(isEquinoxRecord(item));
  changeBackground(item.rarityClass, item.title, { force: true });
}

function updatePagination() {
  const pageNumber = document.getElementById("pageNumber");
  const backPageButton = document.getElementById("backPageButton");
  const prevPageButton = document.getElementById("prevPageButton");
  const nextPageButton = document.getElementById("nextPageButton");
  const lastPageButton = document.getElementById("lastPageButton");

  const sortedInventory = [...inventory];

  const totalPages = Math.ceil(sortedInventory.length / itemsPerPage);
  pageNumber.textContent = `Page ${currentPage} of ${totalPages}`;

  backPageButton.disabled = currentPage === 1;
  prevPageButton.disabled = currentPage === 1;
  nextPageButton.disabled = currentPage === totalPages;
  lastPageButton.disabled = currentPage === totalPages;

  const end = (currentPage - 1) * itemsPerPage;
  const start = end + itemsPerPage;
  sortedInventory.slice(start, end);
}

function backPage() {
  if (currentPage > 1) {
    currentPage = 1;
    renderInventory();
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderInventory();
  }
}

function nextPage() {
  const totalPages = Math.ceil(inventory.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderInventory();
  }
}

function lastPage() {
  const totalPages = Math.ceil(inventory.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage = totalPages;
    renderInventory();
  }
}

function toggleFullscreen() {
  const fullscreenBtn = document.querySelector(".fullscreen-btn");
  const icon = fullscreenBtn.querySelector("i");

  if (!document.fullscreenElement) {
    document.documentElement
      .requestFullscreen()
      .then(() => {
        fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
      })
      .catch((err) => {
        alert(
          `Error attempting to enable fullscreen mode: ${err.message} (${err.name})`
        );
      });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().then(() => {
        fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
      });
    }
  }
}

function registerDeleteAllButton() {
  const deleteAllButton = document.getElementById("deleteAllButton");
  if (!deleteAllButton) {
    return;
  }

  deleteAllButton.addEventListener("click", function () {
    const confirmDelete = confirm("Are you sure you want to delete all Titles?");
    if (confirmDelete) {
      deleteAllFromInventory();
    }
  });
}

function startAnimation() {
  const star = document.getElementById("star");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 3000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 5000);

  setTimeout(() => {
    star.classList.add("cutsceneStar");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 7000);
}

function startAnimation1() {
  const star = document.getElementById("star");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 1000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 2000);

  setTimeout(() => {
    star.classList.add("cutsceneStar");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 3000);
}

function startAnimation01() {
  const star = document.getElementById("starBig");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 1000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 2000);

  setTimeout(() => {
    star.classList.add("cutsceneStarBig");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 3000);
}

function startAnimationA1() {
  const heart = document.getElementById("heart");

  setTimeout(() => {
    heart.classList.add("heartbeat");
    heart.classList.remove("hide1");
  }, 4100);

  setTimeout(() => {
    heart.classList.add("scale-up11")
  }, 7900);

  setTimeout(() => {
    heart.classList.add("scale-up12")
  }, 12500);

  setTimeout(() => {
    heart.classList.add("scale-up-and-vanish");
  }, 20350);

  setTimeout(() => {
    heart.classList.add("hide1");
    heart.classList.add("cutsceneHeart");
    heart.classList.remove("scale-up-and-vanish");
    heart.classList.remove("heart_show");
    heart.classList.remove("heartbeat");
  }, 20450);
}

function startAnimationA2() {
  const heart = document.getElementById("heart");

  setTimeout(() => {
    heart.classList.add("heartbeat");
    heart.classList.remove("hide1");
  }, 100);

  setTimeout(() => {
    heart.classList.add("scale-up11")
  }, 1900);

  setTimeout(() => {
    heart.classList.add("scale-up12")
  }, 2500);

  setTimeout(() => {
    heart.classList.add("scale-up-and-vanish");
  }, 4100);

  setTimeout(() => {
    heart.classList.add("hide1");
    heart.classList.add("cutsceneHeart");
    heart.classList.remove("scale-up-and-vanish");
    heart.classList.remove("heart_show");
    heart.classList.remove("heartbeat");
  }, 5450);
}

function startAnimation3() {
  const star = document.getElementById("star");

  star.classList.add("spin");
  star.classList.remove("hide");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 3000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 8000);

  setTimeout(() => {
    star.classList.add("hide");
    star.classList.add("cutsceneStar");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 12000);
}

function startAnimation03() {
  const star = document.getElementById("starBig");

  star.classList.add("spin");
  star.classList.remove("hide");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 3000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 8000);

  setTimeout(() => {
    star.classList.add("hide");
    star.classList.add("cutsceneStarBig");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 12000);
}

function startAnimation4() {
  const star = document.getElementById("star");

  star.classList.add("scale-up-and-down");

  setTimeout(() => {
    star.classList.add("scale-down");
  }, 7000);

  setTimeout(() => {
    star.classList.add("scale-up");
    star.classList.remove("scale-down");
  }, 12000);

  setTimeout(() => {
    star.classList.add("scale-down");
    star.classList.remove("scale-up");
  }, 17000);

  setTimeout(() => {
    star.classList.add("scale-up");
    star.classList.remove("scale-down");
  }, 22000);

  setTimeout(() => {
    star.classList.add("cutsceneStar");
    star.classList.remove("scale-up-and-down");
    star.classList.remove("scale-down");
    star.classList.remove("scale-up");
  }, 27000);
}

function startAnimation5() {
  const star = document.getElementById("star");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 7000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 15000);

  setTimeout(() => {
    star.classList.add("cutsceneStar");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 17000);
}

function startAnimationA5() {
  const star = document.getElementById("star");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 2000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 8750);

  setTimeout(() => {
    star.classList.add("cutsceneStar");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 10750);
}

function startAnimationA5Shenvii() {
  const starShenvii = document.getElementById("starEvent");

  starShenvii.classList.add("spin");

  setTimeout(() => {
    starShenvii.classList.add("spin-slow");
  }, 2000);

  setTimeout(() => {
    starShenvii.classList.add("scale-up-and-vanish");
  }, 8750);

  setTimeout(() => {
    starShenvii.classList.add("cutsceneStarEvent");
    starShenvii.classList.remove("scale-up-and-vanish");
    starShenvii.classList.remove("spin-slow");
    starShenvii.classList.remove("spin");
  }, 10750);
}

function startAnimationA5H() {
  const star = document.getElementById("starBig");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 2000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 8750);

  setTimeout(() => {
    star.classList.add("cutsceneStarBig");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 10750);
}

function startAnimation6() {
  const star = document.getElementById("star");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 5000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 12000);

  setTimeout(() => {
    star.classList.add("cutsceneStar");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 14000);
}

function startAnimation06() {
  const star = document.getElementById("starBig");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 5000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 12000);

  setTimeout(() => {
    star.classList.add("cutsceneStarBig");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 14000);
}

function startAnimation06Fast() {
  const star = document.getElementById("starBig");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spinF");
  }, 9000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 18000);

  setTimeout(() => {
    star.classList.add("cutsceneStarBig");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spinF");
    star.classList.remove("spin");
  }, 18500);
}

function startAnimation7() {
  const star = document.getElementById("star");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 1000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 2000);

  setTimeout(() => {
    star.classList.add("cutsceneStar");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 4000);
}

function startAnimation07() {
  const star = document.getElementById("starBig");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 1000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 2000);

  setTimeout(() => {
    star.classList.add("cutsceneStarBig");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 4000);
}

function startAnimation007() {
  const star = document.getElementById("starEvent");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 1000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 2000);

  setTimeout(() => {
    star.classList.add("cutsceneStarEvent");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 4000);
}

function startAnimation8() {
  const star = document.getElementById("starSmall");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 1000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 2000);

  setTimeout(() => {
    star.classList.add("cutsceneStarSmall");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 4000);
}

function startAnimation9() {
  const star = document.getElementById("starSmall");

  star.classList.add("spin");
  star.classList.remove("hide");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 3000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 8000);

  setTimeout(() => {
    star.classList.add("hide");
    star.classList.add("cutsceneStarSmall");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 12000);
}

function startAnimation10() {
  const star = document.getElementById("starSmall");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 1000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 2000);

  setTimeout(() => {
    star.classList.add("cutsceneStarSmall");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 3000);
}

function startAnimation10B() {
  const star = document.getElementById("star");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 1000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 2000);

  setTimeout(() => {
    star.classList.add("cutsceneStar");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 3000);
}

function startAnimation11() {
  const star = document.getElementById("starSmall");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 3000);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 5000);

  setTimeout(() => {
    star.classList.add("cutsceneStarSmall");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 7000);
}

function startAnimationMSFU() {
  const star = document.getElementById("msfuStar");

  star.classList.add("spin");

  setTimeout(() => {
    star.classList.add("spin-slow");
  }, 4568);

  setTimeout(() => {
    star.classList.add("scale-up-and-vanish");
  }, 6666);

  setTimeout(() => {
    star.classList.add("msfuStar");
    star.classList.remove("scale-up-and-vanish");
    star.classList.remove("spin-slow");
    star.classList.remove("spin");
  }, 8888);
}

function startAnimationBlackHole() {
  createParticleGroup();
  
  const blackHole = document.querySelector('.black-hole');
  const particles = document.querySelectorAll('.particle');
  
  blackHole.classList.remove('active');
  particles.forEach(p => p.classList.remove('active'));
  
  void blackHole.offsetWidth;
  
  blackHole.classList.add('active');
  particles.forEach(p => p.classList.add('active'));
  
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, 9350);
  });
}

const COOLDOWN_BUTTON_CONFIGS = [
  { id: "cooldownButton", reduceTo: 350, effectSeconds: 90, resetDelay: 90000, spawnDelay: 120000 },
  { id: "cooldownButton1", reduceTo: 200, effectSeconds: 60, resetDelay: 60000, spawnDelay: 300000 },
  { id: "cooldownButton2", reduceTo: 75, effectSeconds: 30, resetDelay: 30000, spawnDelay: 600000 },
];

const cooldownSpawnTimers = new Map();

function getActiveCooldownButton() {
  return document.querySelector("#cooldownButton, #cooldownButton1, #cooldownButton2");
}

function scheduleCooldownButton(config, delay = config.spawnDelay) {
  const existingTimer = cooldownSpawnTimers.get(config.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    if (cooldownBuffActive || cooldownTime < BASE_COOLDOWN_TIME || getActiveCooldownButton()) {
      scheduleCooldownButton(config, 10000);
      return;
    }

    spawnCooldownButton(config);
  }, delay);

  cooldownSpawnTimers.set(config.id, timer);
}

function spawnCooldownButton(config) {
  if (cooldownBuffActive || cooldownTime < BASE_COOLDOWN_TIME || getActiveCooldownButton()) {
    scheduleCooldownButton(config, 10000);
    return;
  }

  const button = document.createElement("button");
  button.innerText = "Reduce Cooldown";
  button.id = config.id;
  button.style.position = "absolute";

  const randomX = Math.floor(Math.random() * (window.innerWidth - 100));
  const randomY = Math.floor(Math.random() * (window.innerHeight - 50));
  button.style.left = `${randomX}px`;
  button.style.top = `${randomY}px`;

  button.addEventListener("click", () => {
    if (cooldownBuffActive) {
      return;
    }

    activateCooldownBuff(config.reduceTo, config.effectSeconds, config.resetDelay);

    button.innerText = "Cooldown Reduced!";
    button.disabled = true;

    setTimeout(() => {
      if (button.isConnected) {
        document.body.removeChild(button);
      }
    }, 1000);
  });

  document.body.appendChild(button);
}

function clearCooldownEffectDisplay() {
  if (cooldownEffectIntervalId) {
    clearInterval(cooldownEffectIntervalId);
    cooldownEffectIntervalId = null;
  }

  const existingDisplay = document.getElementById("countdownDisplay");
  if (existingDisplay && existingDisplay.isConnected) {
    existingDisplay.remove();
  }
}

function showCooldownEffect(duration, { expiresAt } = {}) {
  clearCooldownEffectDisplay();

  const normalizedDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const targetExpiresAt = Number.isFinite(expiresAt)
    ? expiresAt
    : Date.now() + normalizedDuration * 1000;

  if (!Number.isFinite(targetExpiresAt) || targetExpiresAt <= Date.now()) {
    return;
  }

  const countdownDisplay = document.createElement("div");
  countdownDisplay.id = "countdownDisplay";
  countdownDisplay.className = "roll-cooldown-display";
  document.body.appendChild(countdownDisplay);

  const updateCountdown = () => {
    const millisecondsLeft = targetExpiresAt - Date.now();
    if (millisecondsLeft <= 0) {
      clearCooldownEffectDisplay();
      return;
    }

    const secondsLeft = Math.max(0, Math.ceil(millisecondsLeft / 1000));
    countdownDisplay.textContent = `Roll-Cooldown Effect: ${secondsLeft}s`;
  };

  updateCountdown();
  cooldownEffectIntervalId = setInterval(updateCountdown, 1000);
}

function persistCooldownBuffState(reduceTo, expiresAt) {
  if (!Number.isFinite(reduceTo) || !Number.isFinite(expiresAt)) {
    return;
  }

  localStorage.setItem(COOLDOWN_BUFF_REDUCE_TO_KEY, String(reduceTo));
  localStorage.setItem(COOLDOWN_BUFF_EXPIRES_AT_KEY, String(expiresAt));
}

function clearPersistedCooldownBuffState() {
  localStorage.removeItem(COOLDOWN_BUFF_REDUCE_TO_KEY);
  localStorage.removeItem(COOLDOWN_BUFF_EXPIRES_AT_KEY);
}

function endCooldownBuff() {
  clearPersistedCooldownBuffState();
  clearCooldownEffectDisplay();

  if (cooldownBuffTimeoutId) {
    clearTimeout(cooldownBuffTimeoutId);
    cooldownBuffTimeoutId = null;
  }

  cooldownTime = BASE_COOLDOWN_TIME;
  recordRollCooldownDuration("default", cooldownTime);
  cooldownBuffActive = false;
  scheduleAllCooldownButtons();
}

function scheduleCooldownBuffExpiration(expiresAt) {
  if (cooldownBuffTimeoutId) {
    clearTimeout(cooldownBuffTimeoutId);
    cooldownBuffTimeoutId = null;
  }

  if (!Number.isFinite(expiresAt)) {
    return;
  }

  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) {
    endCooldownBuff();
    return;
  }

  cooldownBuffTimeoutId = setTimeout(() => {
    cooldownBuffTimeoutId = null;
    endCooldownBuff();
  }, remainingMs);
}

function activateCooldownBuff(reduceTo, effectSeconds, resetDelay) {
  if (!Number.isFinite(reduceTo) || reduceTo <= 0) {
    return;
  }

  const durationMs = Number.isFinite(resetDelay) && resetDelay > 0
    ? resetDelay
    : (Number.isFinite(effectSeconds) && effectSeconds > 0 ? effectSeconds * 1000 : 0);

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return;
  }

  const expiresAt = Date.now() + durationMs;

  cooldownBuffActive = true;
  cooldownTime = reduceTo;
  recordRollCooldownDuration("buffed", cooldownTime);

  persistCooldownBuffState(reduceTo, expiresAt);

  const secondsForDisplay = Number.isFinite(effectSeconds) && effectSeconds > 0
    ? effectSeconds
    : Math.ceil(durationMs / 1000);

  showCooldownEffect(secondsForDisplay, { expiresAt });
  scheduleCooldownBuffExpiration(expiresAt);
}

function initializeCooldownBuffState() {
  const storedReduceTo = Number.parseInt(localStorage.getItem(COOLDOWN_BUFF_REDUCE_TO_KEY), 10);
  const storedExpiresAt = Number.parseInt(localStorage.getItem(COOLDOWN_BUFF_EXPIRES_AT_KEY), 10);

  if (!Number.isFinite(storedReduceTo) || storedReduceTo <= 0) {
    clearPersistedCooldownBuffState();
    return;
  }

  if (!Number.isFinite(storedExpiresAt)) {
    clearPersistedCooldownBuffState();
    return;
  }

  const remainingMs = storedExpiresAt - Date.now();
  if (remainingMs <= 0) {
    endCooldownBuff();
    return;
  }

  cooldownBuffActive = true;
  cooldownTime = storedReduceTo;
  recordRollCooldownDuration("buffed", cooldownTime);

  const secondsForDisplay = Math.ceil(remainingMs / 1000);
  showCooldownEffect(secondsForDisplay, { expiresAt: storedExpiresAt });
  scheduleCooldownBuffExpiration(storedExpiresAt);
}

function scheduleAllCooldownButtons() {
  COOLDOWN_BUTTON_CONFIGS.forEach((config) => {
    scheduleCooldownButton(config);
  });
}

function registerMenuDragHandlers() {
  const settingsMenu = document.getElementById("settingsMenu");
  const settingsHeader = settingsMenu?.querySelector(".settings-header");
  const settingsBody = settingsMenu?.querySelector(".settings-body");
  const achievementsMenu = document.getElementById("achievementsMenu");
  const achievementsHeader = achievementsMenu?.querySelector(".achievements-header");
  const achievementsBody = achievementsMenu?.querySelector(".achievements-body");
  const statsMenu = document.getElementById("statsMenu");
  const statsHeader = statsMenu?.querySelector(".stats-header");
  const statsDragHandle = statsMenu?.querySelector(".stats-menu__drag-handle");
  const headerStats = statsMenu?.querySelector("h3");
  let isDraggingSettings = false;
  let isDraggingAchievements = false;
  let isDraggingStats = false;
  let offsetX = 0;
  let offsetY = 0;
  let offsetXAchievements = 0;
  let offsetYAchievements = 0;
  let offsetXStats = 0;
  let offsetYStats = 0;
  let offsetXStyle = 0;
  let offsetYStyle = 0;

  if (settingsHeader && settingsMenu) {
    settingsHeader.addEventListener("mousedown", (event) => {
      if (event.button !== 0 || event.target.closest(".settings-close-btn")) {
        return;
      }

      const rect = settingsMenu.getBoundingClientRect();
      settingsMenu.style.left = `${rect.left}px`;
      settingsMenu.style.top = `${rect.top}px`;
      settingsMenu.style.transform = "none";

      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      isDraggingSettings = true;
      settingsHeader.classList.add("is-dragging");
      event.preventDefault();
    });
  }

  if (statsMenu && statsDragHandle) {
    statsDragHandle.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        return;
      }

      const rect = statsMenu.getBoundingClientRect();
      statsMenu.style.left = `${rect.left}px`;
      statsMenu.style.top = `${rect.top}px`;
      statsMenu.style.transform = "none";

      offsetXStyle = event.clientX - rect.left;
      offsetYStyle = event.clientY - rect.top;
    });
  }

  if (achievementsHeader && achievementsMenu) {
    achievementsHeader.addEventListener("mousedown", (event) => {
      if (event.button !== 0 || event.target.closest(".achievements-close-btn")) {
        return;
      }

      const rect = achievementsMenu.getBoundingClientRect();
      achievementsMenu.style.left = `${rect.left}px`;
      achievementsMenu.style.top = `${rect.top}px`;
      achievementsMenu.style.transform = "none";

      offsetXAchievements = event.clientX - rect.left;
      offsetYAchievements = event.clientY - rect.top;
      isDraggingAchievements = true;
      achievementsHeader.classList.add("is-dragging");
      event.preventDefault();
    });
  }

  if (statsHeader && statsMenu) {
    statsHeader.addEventListener("mousedown", (event) => {
      if (event.button !== 0 || event.target.closest(".stats-close-btn")) {
        return;
      }

      const rect = statsMenu.getBoundingClientRect();
      statsMenu.style.left = `${rect.left}px`;
      statsMenu.style.top = `${rect.top}px`;
      statsMenu.style.transform = "none";

      offsetXStats = event.clientX - rect.left;
      offsetYStats = event.clientY - rect.top;
      isDraggingStats = true;
      statsHeader.classList.add("is-dragging");
    });
  }

  if (headerStats && statsDragHandle) {
    headerStats.addEventListener("mousedown", (event) => {
      isDraggingStats = true;
      statsDragHandle.classList.add("is-dragging");
      event.preventDefault();
    });
  }

  if (settingsMenu && settingsBody) {
    settingsMenu.addEventListener(
      "wheel",
      (event) => {
        if (settingsBody.contains(event.target)) {
          return;
        }

        settingsBody.scrollTop += event.deltaY;
        event.preventDefault();
      },
      { passive: false }
    );
  }

  if (achievementsMenu && achievementsBody) {
    achievementsMenu.addEventListener(
      "wheel",
      (event) => {
        if (achievementsBody.contains(event.target)) {
          return;
        }

        achievementsBody.scrollTop += event.deltaY;
        event.preventDefault();
      },
      { passive: false }
    );
  }

  document.addEventListener("mousemove", (event) => {
    if (isDraggingSettings && settingsMenu) {
      settingsMenu.style.left = `${event.clientX - offsetX}px`;
      settingsMenu.style.top = `${event.clientY - offsetY}px`;
    }

    if (isDraggingAchievements && achievementsMenu) {
      achievementsMenu.style.left = `${event.clientX - offsetXAchievements}px`;
      achievementsMenu.style.top = `${event.clientY - offsetYAchievements}px`;
    }

    if (isDraggingStats && statsMenu) {
      statsMenu.style.left = `${event.clientX - offsetXStats}px`;
      statsMenu.style.top = `${event.clientY - offsetYStats}px`;
    }
  });

  document.addEventListener("mouseup", () => {
    if (isDraggingSettings) {
      isDraggingSettings = false;
      settingsHeader?.classList.remove("is-dragging");
    }

    if (isDraggingAchievements) {
      isDraggingAchievements = false;
      achievementsHeader?.classList.remove("is-dragging");
    }

    if (isDraggingStats) {
      isDraggingStats = false;
      statsHeader?.classList.remove("is-dragging");
      statsDragHandle?.classList.remove("is-dragging");
    }
  });
}

function enhanceInventoryDeleteButtons() {
  document.querySelectorAll(".inventory-delete-btn").forEach((button) => {
    if (button.childElementCount > 0) {
      return;
    }

    const label = button.textContent.replace(/\s+/g, " ").trim();
    if (!label) {
      return;
    }

    const labelSpan = document.createElement("span");
    labelSpan.className = "inventory-delete-btn__label";
    labelSpan.textContent = label;

    button.textContent = "";
    button.appendChild(labelSpan);
    button.classList.add("inventory-delete-btn--overlay");
  });
}

function registerMenuButtons() {
  const settingsButton = document.getElementById("settingsButton");
  const achievementsButton = document.getElementById("achievementsButton");
  const achievementsMenu = document.getElementById("achievementsMenu");
  const closeAchievements = document.getElementById("closeAchievements");
  const statsMenu = document.getElementById("statsMenu");
  const statsButton = document.getElementById("statsButton");
  const closeStats = document.getElementById("closeStats");
  const settingsMenu = document.getElementById("settingsMenu");
  const closeSettings = document.getElementById("closeSettings");

  if (settingsButton && settingsMenu) {
    settingsButton.addEventListener("click", () => {
      settingsMenu.style.display = "flex";
    });
  }

  if (closeSettings && settingsMenu) {
    closeSettings.addEventListener("click", () => {
      settingsMenu.style.display = "none";
    });
  }

  if (achievementsButton && achievementsMenu) {
    achievementsButton.addEventListener("click", () => {
      achievementsMenu.style.display = "flex";
      const achievementsBodyElement = achievementsMenu.querySelector(".achievements-body");
      if (achievementsBodyElement) {
        achievementsBodyElement.scrollTop = 0;
      }
    });
  }

  if (closeAchievements && achievementsMenu) {
    closeAchievements.addEventListener("click", () => {
      achievementsMenu.style.display = "none";
    });
  }

  if (statsButton && statsMenu) {
    statsButton.addEventListener("click", () => {
      statsMenu.style.display = "block";
      statsMenu.style.transform = "translate(-50%, -50%)";
      statsMenu.style.left = "50%";
      statsMenu.style.top = "50%";
    });
  }

  if (closeStats && statsMenu) {
    closeStats.addEventListener("click", () => {
      statsMenu.style.display = "none";
    });
  }
}

function clampVolume(value, fallback = 1) {
  const number = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  if (number < 0) {
    return 0;
  }
  if (number > 1) {
    return 1;
  }
  return number;
}

function getAudioCategory(id) {
  if (typeof id !== "string" || !id) {
    return "title";
  }

  if (CUTSCENE_VOLUME_AUDIO_IDS.has(id)) {
    if (!ROLL_AUDIO_IDS.has(id) || cutsceneActive || pendingCutsceneRarity) {
      return "cutscene";
    }
  }

  if (ROLL_AUDIO_IDS.has(id)) {
    return "roll";
  }

  if (MENU_AUDIO_IDS.has(id)) {
    return "menu";
  }

  return "title";
}

function getCategoryVolume(category) {
  switch (category) {
    case "roll":
      return rollAudioVolume;
    case "cutscene":
      return cutsceneAudioVolume;
    case "menu":
      return menuAudioVolume;
    case "title":
    default:
      return titleAudioVolume;
  }
}

function getEffectiveVolumeForAudioId(id) {
  const masterVolume = clampVolume(audioVolume, 1);
  const categoryVolume = clampVolume(getCategoryVolume(getAudioCategory(id)), 1);
  return clampVolume(masterVolume * categoryVolume, 0);
}

function ensureMenuMusicPlaying() {
  const audio =
    typeof mainAudio !== "undefined" && mainAudio instanceof HTMLAudioElement
      ? mainAudio
      : document.getElementById("mainAudio");

  if (!audio || typeof audio.play !== "function") {
    return;
  }

  try {
    if (audio.preload === "none") {
      audio.preload = "auto";
      try {
        audio.load();
      } catch (error) {
        /* no-op */
      }
    }

    audio.volume = getEffectiveVolumeForAudioId(audio.id || "mainAudio");

    const playAttempt = audio.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {});
    }
  } catch (error) {
    /* no-op */
  }
}

function initializeAudioVolumeStateFromStorage() {
  const savedVolume = localStorage.getItem("audioVolume");
  if (savedVolume !== null) {
    audioVolume = clampVolume(savedVolume, audioVolume);
    if (audioVolume > 0) {
      previousVolume = audioVolume;
    }
  }

  const savedRollVolume = localStorage.getItem("rollAudioVolume");
  if (savedRollVolume !== null) {
    rollAudioVolume = clampVolume(savedRollVolume, rollAudioVolume);
  }

  const savedCutsceneVolume = localStorage.getItem("cutsceneAudioVolume");
  if (savedCutsceneVolume !== null) {
    cutsceneAudioVolume = clampVolume(savedCutsceneVolume, cutsceneAudioVolume);
  }

  const savedTitleVolume = localStorage.getItem("titleAudioVolume");
  if (savedTitleVolume !== null) {
    titleAudioVolume = clampVolume(savedTitleVolume, titleAudioVolume);
  }

  const savedMenuVolume = localStorage.getItem("menuAudioVolume");
  if (savedMenuVolume !== null) {
    menuAudioVolume = clampVolume(savedMenuVolume, menuAudioVolume);
  }

  isMuted = audioVolume === 0;

  updateAudioElements();
}

initializeAudioVolumeStateFromStorage();

function setupAudioControls() {
  initializeAudioVolumeStateFromStorage();

  audioSliderElement = document.getElementById("audioSlider");
  audioSliderValueLabelElement = document.getElementById("audioSliderValue");
  rollAudioSliderElement = document.getElementById("rollAudioSlider");
  rollAudioSliderValueLabelElement = document.getElementById("rollAudioSliderValue");
  cutsceneAudioSliderElement = document.getElementById("cutsceneAudioSlider");
  cutsceneAudioSliderValueLabelElement = document.getElementById("cutsceneAudioSliderValue");
  titleAudioSliderElement = document.getElementById("titleAudioSlider");
  titleAudioSliderValueLabelElement = document.getElementById("titleAudioSliderValue");
  menuAudioSliderElement = document.getElementById("menuAudioSlider");
  menuAudioSliderValueLabelElement = document.getElementById("menuAudioSliderValue");
  muteButtonElement = document.getElementById("muteButton");
  const resetDataButton = document.getElementById("resetDataButton");

  if (audioSliderElement) {
    audioSliderElement.value = audioVolume;
    audioSliderElement.addEventListener("input", () => {
      audioVolume = clampVolume(audioSliderElement.value, audioVolume);
      if (audioVolume === 0) {
        isMuted = true;
        setSliderMutedState(true);
      } else {
        isMuted = false;
        previousVolume = audioVolume;
        setSliderMutedState(false);
      }
      localStorage.setItem("audioVolume", audioVolume);
      updateAudioElements();
      updateAudioSliderUi();
    });
    updateAudioSliderUi();
  }

  const attachCategorySliderHandler = (sliderElement, valueLabelElement, storageKey, onUpdate) => {
    if (!sliderElement) {
      return;
    }

    sliderElement.value = clampVolume(onUpdate("get"), 1);
    updateSliderUi(sliderElement, valueLabelElement);

    sliderElement.addEventListener("input", () => {
      const value = clampVolume(sliderElement.value, onUpdate("get"));
      onUpdate("set", value);
      localStorage.setItem(storageKey, value);
      updateAudioElements();
      updateSliderUi(sliderElement, valueLabelElement);
    });
  };

  attachCategorySliderHandler(rollAudioSliderElement, rollAudioSliderValueLabelElement, "rollAudioVolume", (action, value) => {
    if (action === "set") {
      rollAudioVolume = value;
    }
    return rollAudioVolume;
  });

  attachCategorySliderHandler(
    cutsceneAudioSliderElement,
    cutsceneAudioSliderValueLabelElement,
    "cutsceneAudioVolume",
    (action, value) => {
      if (action === "set") {
        cutsceneAudioVolume = value;
      }
      return cutsceneAudioVolume;
    }
  );

  attachCategorySliderHandler(titleAudioSliderElement, titleAudioSliderValueLabelElement, "titleAudioVolume", (action, value) => {
    if (action === "set") {
      titleAudioVolume = value;
    }
    return titleAudioVolume;
  });

  attachCategorySliderHandler(menuAudioSliderElement, menuAudioSliderValueLabelElement, "menuAudioVolume", (action, value) => {
    if (action === "set") {
      menuAudioVolume = value;
    }
    return menuAudioVolume;
  });

  if (muteButtonElement) {
    muteButtonElement.addEventListener("click", () => {
      isMuted = !isMuted;

      if (isMuted) {
        if (audioVolume > 0) {
          previousVolume = audioVolume;
        }
        audioVolume = 0;
      } else {
        audioVolume = previousVolume > 0 ? previousVolume : 1;
      }

      audioVolume = clampVolume(audioVolume, 1);

      if (audioSliderElement) {
        audioSliderElement.value = audioVolume;
      }
      localStorage.setItem("audioVolume", audioVolume);
      updateAudioElements();
      setSliderMutedState(isMuted);
      updateAudioSliderUi();
    });
  }

  if (resetDataButton) {
    resetDataButton.addEventListener("click", () => {
      if (confirm("Are you sure you want to reset all data?")) {
        console.log("Data reset!");
        stopPlayTimeTracker();
        localStorage.clear();
        setPlayTimeSeconds(0, { persist: false });
        checkAchievements();
        updateAchievementsList();

        setTimeout(() => {
          localStorage.clear();
          location.reload();
        }, 100);
      }
    });
  }

  setSliderMutedState(audioVolume === 0);
}

function updateAudioElements() {
  const audioElements = document.querySelectorAll("audio");
  audioElements.forEach((audio) => {
    const id = typeof audio.id === "string" ? audio.id : "";
    audio.volume = getEffectiveVolumeForAudioId(id);
  });
}

function setSliderMutedState(muted) {
  if (!audioSliderElement) {
    return;
  }

  audioSliderElement.classList.toggle("muted", Boolean(muted));
}

function updateAudioSliderUi() {
  updateSliderUi(audioSliderElement, audioSliderValueLabelElement);
}

function updateSliderUi(sliderElement, valueLabelElement) {
  if (!sliderElement) {
    return;
  }

  const value = clampVolume(sliderElement.value, 0);
  const percentage = Math.round(value * 100);
  if (valueLabelElement) {
    valueLabelElement.textContent = `${percentage}%`;
  }

  const startColor = { r: 96, g: 0, b: 126 };
  const endColor = { r: 255, g: 165, b: 0 };
  const r = Math.round(startColor.r + (endColor.r - startColor.r) * value);
  const g = Math.round(startColor.g + (endColor.g - startColor.g) * value);
  const b = Math.round(startColor.b + (endColor.b - startColor.b) * value);
  const thumbColor = `rgb(${r}, ${g}, ${b})`;

  sliderElement.style.setProperty("--thumb-color", thumbColor);

  const trackColor = sliderElement.classList.contains("muted")
    ? "rgba(128, 96, 186, 0.75)"
    : thumbColor;

  sliderElement.style.setProperty("--slider-fill-color", trackColor);
  sliderElement.style.setProperty("--slider-progress", `${percentage}%`);
}

function initializeAutoRollControls() {
  autoRollButtonElement = document.getElementById("autoRollButton");
  if (!autoRollButtonElement) {
    return;
  }

  autoRollButtonElement.addEventListener("click", () => {
    if (!isAutoRollUnlocked()) {
      return;
    }

    if (autoRollInterval) {
      stopAutoRoll();
    } else {
      startAutoRoll();
    }
  });

  const savedState = localStorage.getItem("autoRollEnabled");
  if (savedState === "true" && isAutoRollUnlocked()) {
    startAutoRoll();
  } else {
    stopAutoRoll();
  }

  updateAutoRollAvailability();
}

function startAutoRoll() {
  if (!autoRollButtonElement || autoRollInterval || !isAutoRollUnlocked()) {
    return;
  }

  autoRollInterval = setInterval(() => {
    document.getElementById("rollButton")?.click();
  }, 400);
  localStorage.setItem("autoRollEnabled", "true");
  updateAutoRollAvailability();
}

function stopAutoRoll() {
  if (!autoRollButtonElement) {
    return;
  }

  if (autoRollInterval) {
    clearInterval(autoRollInterval);
    autoRollInterval = null;
  }
  localStorage.setItem("autoRollEnabled", "false");
  updateAutoRollAvailability();
}

function isAutoRollUnlocked() {
  return rollCount >= AUTO_ROLL_UNLOCK_ROLLS;
}

function ensureAutoRollButtonReference() {
  if (!autoRollButtonElement) {
    autoRollButtonElement = document.getElementById("autoRollButton");
  }
  return autoRollButtonElement;
}

function updateAutoRollAvailability() {
  const button = ensureAutoRollButtonReference();
  if (!button) {
    return;
  }

  const unlocked = isAutoRollUnlocked();
  if (!unlocked) {
    if (autoRollInterval) {
      clearInterval(autoRollInterval);
      autoRollInterval = null;
    }
    button.disabled = true;
    button.classList.add("locked");
    button.classList.remove("on");
    button.classList.add("off");
    button.textContent = `Auto Roll: Locked (${AUTO_ROLL_UNLOCK_ROLLS.toLocaleString()} rolls required)`;
    localStorage.setItem("autoRollEnabled", "false");
    return;
  }

  button.disabled = false;
  button.classList.remove("locked");
  if (autoRollInterval) {
    button.textContent = "Auto Roll: On";
    button.classList.add("on");
    button.classList.remove("off");
  } else {
    button.textContent = "Auto Roll: Off";
    button.classList.remove("on");
    button.classList.add("off");
  }
}

updateAudioSliderUi();

function initializeHeartEffect() {
  if (heartIntervalId) {
    return;
  }

  if (!heartContainerElement) {
    heartContainerElement = document.createElement("div");
    document.body.appendChild(heartContainerElement);
  }

  const createHeart = () => {
    const heart = document.createElement("div");
    heart.classList.add("heart");
    heart.textContent = "🎃";
    heart.style.left = `${Math.random() * 100}vw`;
    heart.style.top = `${Math.random() * 100}vh`;
    heart.style.fontSize = `${Math.random() * 25 + 15}px`;
    heartContainerElement.appendChild(heart);

    setTimeout(() => {
      heart.remove();
    }, 1000);
  };

  heartIntervalId = setInterval(createHeart, 33);
}

const secretKey = "ImpeachedGlazer";

function showStatusMessage(message, duration = 2000) {
  const status = document.getElementById("status");
  if (!status) {
    return;
  }

  status.style.display = "";
  status.textContent = message;
  status.classList.add("showStatus");

  setTimeout(() => {
    status.classList.remove("showStatus");
    setTimeout(() => {
      if (status.isConnected) {
        status.style.display = "none";
      }
    }, 500);
  }, duration);
}

function registerDataPersistenceButtons() {
  const saveButton = document.getElementById("saveButton");
  const importButton = document.getElementById("importButton");

  if (saveButton) {
    saveButton.addEventListener("click", () => {
      const data = JSON.stringify(collectLocalStorageSnapshot());
      const encryptedData = CryptoJS.AES.encrypt(data, secretKey).toString();
      const blob = new Blob([encryptedData], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "localStorageData.json";
      a.click();

      URL.revokeObjectURL(url);
    });
  }

  if (importButton) {
    importButton.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";

      input.addEventListener("change", (event) => {
        const file = event.target.files?.[0];
        if (!file) {
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const encryptedData = e.target?.result;
            if (typeof encryptedData !== "string") {
              throw new Error("Invalid file contents");
            }

            const bytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
            const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
            const importedData = JSON.parse(decryptedData);
            if (!importedData || typeof importedData !== "object") {
              throw new Error("Invalid file format.");
            }

            stopPlayTimeTracker();

            localStorage.clear();

            let importedPlayTime = null;

            Object.entries(importedData).forEach(([key, value]) => {
              if (typeof key !== "string") {
                return;
              }

              const stringValue = typeof value === "string" ? value : String(value);
              localStorage.setItem(key, stringValue);

              if (key === "playTime") {
                importedPlayTime = stringValue;
              }
            });

            if (importedPlayTime !== null) {
              setPlayTimeSeconds(importedPlayTime);
            } else {
              setPlayTimeSeconds(0, { persist: false });
            }

            initializePlayTimeTracker();

            showStatusMessage("Data imported successfully! Refreshing...", 1500);

            setTimeout(() => {
              location.reload();
            }, 1500);
          } catch (error) {
            showStatusMessage("Error: Invalid file format.");
          }
        };

        reader.readAsText(file);
      });

      input.click();
    });
  }
}

function initializePlayTimeTracker() {
  if (playTimeIntervalId) {
    return;
  }

  const timerDisplay = document.getElementById("timer");
  if (!timerDisplay) {
    return;
  }

  setPlayTimeSeconds(localStorage.getItem("playTime"), { persist: false });
  checkAchievements();
  updateAchievementsList();

  playTimeIntervalId = setInterval(() => {
    setPlayTimeSeconds(playTimeSeconds + 1);
    checkAchievements();
    updateAchievementsList();
  }, 1000);
}

const rollingHistory = [];

function updateRollingHistory(title, rarity) {
    const historyList = document.getElementById('historyList');

    rollingHistory.unshift({ title, rarity });

    if (rollingHistory.length > 10) {
        rollingHistory.pop();
    }

    historyList.innerHTML = '';
    rollingHistory.forEach((roll) => {
        const listItem = document.createElement('li');
        const entryText = document.createElement('span');
        entryText.classList.add('history-entry-text');
        entryText.textContent = `${roll.rarity} - ${roll.title}`;

        const rarityClass = getClassForRarity(roll.rarity);
        if (rarityClass) {
            entryText.classList.add(rarityClass);
        }

        listItem.appendChild(entryText);
        historyList.appendChild(listItem);
    });
}

function registerRarityDeletionButtons() {
  const buttonMappings = [
    ["deleteAllUnder100Button", "under100"],
    ["deleteAllUnder1kButton", "under1k"],
    ["deleteAllUnder10kButton", "under10k"],
    ["deleteAllUnder100kButton", "under100k"],
    ["deleteAllUnder1mButton", "under1m"],
    ["deleteAllTranscendentButton", "transcendent"],
    ["deleteAllSpecialButton", "special"],
  ];

  buttonMappings.forEach(([id, bucket]) => {
    const button = document.getElementById(id);
    if (button) {
      button.addEventListener("click", () => deleteByRarityBucket(bucket));
    }
  });
}

function getClassForRarity(rarity) {
  const rarityClasses = {
      'Common [1 in 2.5]': 'under100',
      'Rare [1 in 4]': 'under100',
      'Epic [1 in 5]': 'under100',
      'Legendary [1 in 13]': 'under100',
      'Impossible [1 in 20]': 'under100',
      'Powered [1 in 40]': 'under100',
      'Toxic [1 in 50]': 'under100',
      'Solarpower [1 in 67]': 'under100',
      'Flicker [1 in 67]': 'under100',
      'Believer [1 in 80]': 'under100',
      'Planet Breaker [1 in 99]': 'under100',
      'Unstoppable [1 in 112]': 'under1k',
      'Gargantua [1 in 143]': 'under1k',
      'Wandering Spirit [1 in 150]': 'under1k',
      'Memory [1 in 175]': 'under1k',
      'Oblivion [1 in 200]': 'under1k',
      'Frozen Fate [1 in 200]': 'under1k',
      'Spectral Whisper [1 in 288]': 'under1k',
      'Mysterious Echo [1 in 300]': 'under1k',
      'Isekai [1 in 300]': 'under1k',
      'Forgotten Whisper [1 in 450]': 'under1k',
      'Emergencies [1 in 500]': 'under1k',
      'Starfall [1 in 600]': 'under1k',
      'Cursed Artifact [1 in 700]': 'under1k',
      'Samurai [1 in 800]': 'under1k',
      'Spectral Glare [1 in 850]': 'under1k',
      'Phantom Stride [1 in 990]': 'under1k',
      'Contortions [1 in 999]': 'under1k',
      'Shadow Veil [1 in 1,000]': 'under10k',
      'Fright [1 in 1,075]': 'under10k',
      'Nightfall [1 in 1,200]': 'under10k',
      'Fear [1 in 1,250]': 'under10k',
      "Seraph's Wing [1 in 1,333]": 'under10k',
      'Void Walker [1 in 1,500]': 'under10k',
      'Haunted Soul [1 in 2,000]': 'under10k',
      'Silent Listener [1 in 2,200]': 'under10k',
      'Ghostly Embrace [1 in 2,800]': 'under10k',
      'Endless Twilight [1 in 3,000]': 'under10k',
      'Lost Soul [1 in 3,333]': 'under10k',
      'Abyssal Shade [1 in 3,500]': 'under10k',
      'Darkened Sky [1 in 4,200]': 'under10k',
      'Shad0w [1 in 4,444]': 'under10k',
      'Twisted Light [1 in 5,000]': 'under10k',
      'Found Soul [1 in 5,000]': 'under10k',
      'Haunted Reality [1 in 5,500]': 'under10k',
      "LubbyJubby's Cherry Grove [1 in 5,666]": 'under10k',
      'Rad [1 in 6,969]': 'under10k',
      'Ether Shift [1 in 5,540]': 'under10k',
      'Ethereal Pulse [1 in 6,000]': 'under10k',
      'Hellish Fire [1 in 6,666]': 'under10k',
      'Enigmatic Dream [1 in 7,500]': 'under10k',
      'Grim Destiny [1 in 8,500]': 'under10k',
      'Demon Soul [1 in 9,999]': 'under10k',
      'Firecracker [1 in 2,025]': 'eventTitleNew25',
      'Veil [1 in 50,000/5th]': 'special',
      'Experiment [1 in 100,000/10th]': 'special',
      'Abomination [1 in 1,000,000/20th]': 'special',
      'Iridocyclitis Veil [1 in 5,000/50th]': 'special',
      'Cursed Mirage [1 in 11,000]': 'under100k',
      'Celestial Dawn [1 in 12,000]': 'under100k',
      'Blodhest [1 in 25,252]': 'under100k',
      'Unnamed [1 in 30,303]': 'under100k',
      "Fate's Requiem [1 in 15,000]": 'under100k',
      'Eonbreak [1 in 20,000]': 'under100k',
      'Overture  [1 in 25,641]': 'under100k',
      'HARV [1 in 33,333]': 'under100k',
      "Devil's Heart [1 in 66,666]": 'under100k',
      'Arcane Pulse [1 in 77,777]': 'under100k',
      'Impeached [1 in 101,010]': 'under1m',
      'Celestial Chorus [1 in 202,020]': 'under1m',
      'Silly Car :3 [1 in 1,000,000]': 'transcendent',
      'H1di [1 in 9,890,089]': 'transcendent',
      'BlindGT [1 in 2,000,000/15th]': 'special',
      'MSFU [1 in 333/333rd]': 'special',
      'Orb [1 in 55,555/30th]': 'special',
      'Tuon [1 in 50,000]': 'under100k',
      'Heart [1 in ♡♡♡]': 'eventV25',
      'Unfair [1 in ###]': 'under100k',
      'GD Addict [1 in ###]': 'under10k',
      'Qbear [1 in 35,555]': 'under100k',
      'Light [1 in 29,979]': 'under100k',
      'X1sta [1 in 230,444]': 'under1m',
      'sʜeɴvɪ✞∞ [1 in 77,777/7th]': 'special',
      'Easter Bunny [1 in 133,333]': 'eventE25',
      'Easter Egg [1 in 13,333]': 'eventE25',
      'Isekai ♫ Lo-Fi [1 in 3,000]': 'under10k',
      '『Equinox』 [1 in 25,000,000]': 'transcendent',
      'Ginger [1 in 1,144,141]': 'transcendent',
      'Wave [1 in 2,555]': 'eventS25',
      'Scorching [1 in 7,923]': 'eventS25',
      'Beach [1 in 12,555]': 'eventS25',
      'Tidal Wave [1 in 25,500]': 'eventS25',
      'Hypernova [1 in 40,000]': 'under100k',
      'Astrald [1 in 100,000]': 'under1m',
      'Nebula [1 in 62,500]': 'under100k',
      'Gl1tch3d [1 in 12,404/40,404th]': 'special',
      'Mastermind [110,010]': 'under1m',
      "MythicWall [1 in 17,017]": 'under100k',
      "MythicWall [1 in 1,031]": 'under100k',
      "MythicWall [1 in 3,110]": 'under100k',
      "MythicWall [1 in 31,010]": 'under100k',
      "Hollow Hill Maner [1 in 10,031]": 'eventHalloween25',
  };

  return rarityClasses[rarity] || null;
}


document
  .getElementById("deleteAllUnder100Button")
  .addEventListener("click", () => {
    renderInventory();
    const rarities = [
      "commonBgImg",
      "rareBgImg",
      "epicBgImg",
      "legendaryBgImg",
      "impossibleBgImg",
      "poweredBgImg",
      "plabreBgImg",
      "solarpowerBgImg",
      "belivBgImg",
      "flickerBgImg",
      "toxBgImg"
    ];
    rarities.forEach(rarity => deleteAllByRarity(rarity));
  });

document
  .getElementById("deleteAllCommonButton")
  .addEventListener("click", () => deleteAllByRarity("commonBgImg"));
document
  .getElementById("deleteAllRareButton")
  .addEventListener("click", () => deleteAllByRarity("rareBgImg"));
document
  .getElementById("deleteAllEpicButton")
  .addEventListener("click", () => deleteAllByRarity("epicBgImg"));
document
  .getElementById("deleteAllLegendaryButton")
  .addEventListener("click", () => deleteAllByRarity("legendaryBgImg"));
document
  .getElementById("deleteAllImpossibleButton")
  .addEventListener("click", () => deleteAllByRarity("impossibleBgImg"));
document
  .getElementById("deleteAllPoweredButton")
  .addEventListener("click", () => deleteAllByRarity("poweredBgImg"));
document
  .getElementById("deleteAllPlanetBreakerButton")
  .addEventListener("click", () => deleteAllByRarity("plabreBgImg"));
document
  .getElementById("deleteAllSolarpowerButton")
  .addEventListener("click", () => deleteAllByRarity("solarpowerBgImg"));
document
  .getElementById("deleteAllBelieverButton")
  .addEventListener("click", () => deleteAllByRarity("belivBgImg"));
document
  .getElementById("deleteAllFlickerButton")
  .addEventListener("click", () => deleteAllByRarity("flickerBgImg"));
document
  .getElementById("deleteAllToxicButton")
  .addEventListener("click", () => deleteAllByRarity("toxBgImg"));
document
  .getElementById("deleteAllIsekaiLofiButton")
  .addEventListener("click", () => deleteAllByRarity("isekailofiBgImg"));


document
  .getElementById("deleteAllUnder1kButton")
  .addEventListener("click", () => {
    renderInventory();
    const raritiesUnder1k = [
      "unstoppableBgImg",
      "spectralBgImg",
      "starfallBgImg",
      "gargBgImg",
      "memBgImg",
      "oblBgImg",
      "phaBgImg",
      "isekaiBgImg",
      "emerBgImg",
      "samuraiBgImg",
      "contBgImg",
      "wanspiBgImg",
      "froBgImg",
      "mysBgImg",
      "forgBgImg",
      "curartBgImg",
      "specBgImg",
    ];
    raritiesUnder1k.forEach(rarity => deleteAllByRarity(rarity));
});

document
  .getElementById("deleteAllUnstoppableButton")
  .addEventListener("click", () => deleteAllByRarity("unstoppableBgImg"));
document
  .getElementById("deleteAllSpectralButton")
  .addEventListener("click", () => deleteAllByRarity("spectralBgImg"));
document
  .getElementById("deleteAllStarfallButton")
  .addEventListener("click", () => deleteAllByRarity("starfallBgImg"));
document
  .getElementById("deleteAllGargantuaButton")
  .addEventListener("click", () => deleteAllByRarity("gargBgImg"));
document
  .getElementById("deleteAllMemoryButton")
  .addEventListener("click", () => deleteAllByRarity("memBgImg"));
document
  .getElementById("deleteAllOblivionButton")
  .addEventListener("click", () => deleteAllByRarity("oblBgImg"));
document
  .getElementById("deleteAllPhantomStrideButton")
  .addEventListener("click", () => deleteAllByRarity("phaBgImg"));
document
  .getElementById("deleteAllIsekaiButton")
  .addEventListener("click", () => deleteAllByRarity("isekaiBgImg"));
document
  .getElementById("deleteAllEquinoxButton")
  .addEventListener("click", () => deleteAllByRarity("equinoxBgImg"));
document
  .getElementById("deleteAllGingerButton")
  .addEventListener("click", () => deleteAllByRarity("gingerBgImg"));
document
  .getElementById("deleteAllEmergenciesButton")
  .addEventListener("click", () => deleteAllByRarity("emerBgImg"));
document
  .getElementById("deleteAllPumpkinButton")
  .addEventListener("click", () => deleteAllByRarity("pumpkinBgImg"));
document
  .getElementById("deleteAllEtherShiftButton")
  .addEventListener("click", () => deleteAllByRarity("ethershiftBgImg"));
document
  .getElementById("deleteAllCursedMirageButton")
  .addEventListener("click", () => deleteAllByRarity("cursedmirageBgImg"));
document
  .getElementById("deleteAllHellishFireButton")
  .addEventListener("click", () => deleteAllByRarity("hellBgImg"));
document
  .getElementById("deleteAllSamuraiButton")
  .addEventListener("click", () => deleteAllByRarity("samuraiBgImg"));
document
  .getElementById("deleteAllContortionsButton")
  .addEventListener("click", () => deleteAllByRarity("contBgImg"));
document
  .getElementById("deleteAllFrightButton")
  .addEventListener("click", () => deleteAllByRarity("frightBgImg"));
document
  .getElementById("deleteAllHeartButton")
  .addEventListener("click", () => deleteAllByRarity("heartBgImg"));
document
  .getElementById("deleteAllGDAddictButton")
  .addEventListener("click", () => deleteAllByRarity("astredBgImg"));
document
  .getElementById("deleteAllWaveButton")
  .addEventListener("click", () => deleteAllByRarity("wave"));
document
  .getElementById("deleteAllScorchingButton")
  .addEventListener("click", () => deleteAllByRarity("scorchingBgImg"));
document
  .getElementById("deleteAllBeachButton")
  .addEventListener("click", () => deleteAllByRarity("beachBgImg"));
document
  .getElementById("deleteAllTidalWaveButton")
  .addEventListener("click", () => deleteAllByRarity("tidalwaveBgImg"));


document
  .getElementById("deleteAllUnder10kButton")
  .addEventListener("click", () => {
    renderInventory();
    const raritiesUnder10k = [
      "ethershiftBgImg",
      "hellBgImg",
      "frightBgImg",
      "seraphwingBgImg",
      "shadBgImg",
      "shaBgImg",
      "nighBgImg",
      "voiBgImg",
      "silBgImg",
      "ghoBgImg",
      "endBgImg",
      "abysBgImg",
      "darBgImg",
      "twiligBgImg",
      "ethpulBgImg",
      "eniBgImg",
      "griBgImg",
      "fearBgImg",
      "hauntBgImg",
      "foundsBgImg",
      "lostsBgImg",
      "hauBgImg",
      "lubjubBgImg",
      "radBgImg",
      "demsoBgImg",
      "astredBgImg",
      "isekailofiBgImg",
      "thescarecrowssigilBgImg",
      "pumpkinhollowBgImg"
    ];
    raritiesUnder10k.forEach(rarity => deleteAllByRarity(rarity));
});

document
  .getElementById("deleteAllSeraphsWingButton")
  .addEventListener("click", () => deleteAllByRarity("seraphwingBgImg"));
document
  .getElementById("deleteAllArcanePulseButton")
  .addEventListener("click", () => deleteAllByRarity("arcanepulseBgImg"));
document
  .getElementById("deleteAllOvertureButton")
  .addEventListener("click", () => deleteAllByRarity("overtureBgImg"));
document
  .getElementById("deleteAllImpeachedButton")
  .addEventListener("click", () => deleteAllByRarity("impeachedBgImg"));
document
  .getElementById("deleteAllEonbreakButton")
  .addEventListener("click", () => deleteAllByRarity("eonbreakBgImg"));
document
  .getElementById("deleteAllCelestialChorusButton")
  .addEventListener("click", () => deleteAllByRarity("celestialchorusBgImg"));
document
  .getElementById("deleteAllWanderingSpiritButton")
  .addEventListener("click", () => deleteAllByRarity("wanspiBgImg"));
document
  .getElementById("deleteAllFrozenFateButton")
  .addEventListener("click", () => deleteAllByRarity("froBgImg"));
document
  .getElementById("deleteAllMysteriousEchoButton")
  .addEventListener("click", () => deleteAllByRarity("mysBgImg"));
document
  .getElementById("deleteAllForgottenWhisperButton")
  .addEventListener("click", () => deleteAllByRarity("forgBgImg"));
document
  .getElementById("deleteAllCursedArtifactButton")
  .addEventListener("click", () => deleteAllByRarity("curartBgImg"));
document
  .getElementById("deleteAllSpectralGlareButton")
  .addEventListener("click", () => deleteAllByRarity("specBgImg"));
document
  .getElementById("deleteAllShadowVeilButton")
  .addEventListener("click", () => deleteAllByRarity("shadBgImg"));
document
  .getElementById("deleteAllShad0wButton")
  .addEventListener("click", () => deleteAllByRarity("shaBgImg"));
document
  .getElementById("deleteAllUnnamedButton")
  .addEventListener("click", () => deleteAllByRarity("unnamedBgImg"));
document
  .getElementById("deleteAllNightfallButton")
  .addEventListener("click", () => deleteAllByRarity("nighBgImg"));
document
  .getElementById("deleteAllVoidWalkerButton")
  .addEventListener("click", () => deleteAllByRarity("voiBgImg"));
document
  .getElementById("deleteAllSilentListenerButton")
  .addEventListener("click", () => deleteAllByRarity("silBgImg"));
document
  .getElementById("deleteAllGhostlyEmbraceButton")
  .addEventListener("click", () => deleteAllByRarity("ghoBgImg"));
document
  .getElementById("deleteAllEndlessTwilightButton")
  .addEventListener("click", () => deleteAllByRarity("endBgImg"));
document
  .getElementById("deleteAllAbyssalShadeButton")
  .addEventListener("click", () => deleteAllByRarity("abysBgImg"));
document
  .getElementById("deleteAllDarkenedSkyButton")
  .addEventListener("click", () => deleteAllByRarity("darBgImg"));
document
  .getElementById("deleteAllTwistedLightButton")
  .addEventListener("click", () => deleteAllByRarity("twiligBgImg"));
document
  .getElementById("deleteAllEtherealPulseButton")
  .addEventListener("click", () => deleteAllByRarity("ethpulBgImg"));
document
  .getElementById("deleteAllEnigmaticDreamButton")
  .addEventListener("click", () => deleteAllByRarity("eniBgImg"));
document
  .getElementById("deleteAllGrimDestinyButton")
  .addEventListener("click", () => deleteAllByRarity("griBgImg"));
document
  .getElementById("deleteAllUnfairButton")
  .addEventListener("click", () => deleteAllByRarity("astblaBgImg"));
document
  .getElementById("deleteAllQbearButton")
  .addEventListener("click", () => deleteAllByRarity("qbearImgBg"));


document
  .getElementById("deleteAllUnder100kButton")
  .addEventListener("click", () => {
    renderInventory();
    const raritiesUnder10k = [
      "celdawBgImg",
      "fatreBgImg",
      "unnamedBgImg",
      "eonbreakBgImg",
      "overtureBgImg",
      "arcanepulseBgImg",
      "harvBgImg",
      "devilBgImg",
      "cursedmirageBgImg",
      "tuonBgImg",
      "astblaBgImg",
      "qbearImgBg",
      "lightImgBg",
      "hypernovaBgImg",
      "nebulaBgImg",
      "mythicwallBgImg",
      "hollowhillmanorBgImg",
      "thephantommoonBgImg",
      "thevoidsveilBgImg",
      "wailingshadeBgImg"
    ];
    raritiesUnder10k.forEach(rarity => deleteAllByRarity(rarity));
});

document
  .getElementById("deleteAllCelestialDawnButton")
  .addEventListener("click", () => deleteAllByRarity("celdawBgImg"));
document
  .getElementById("deleteAllFatesRequiemButton")
  .addEventListener("click", () => deleteAllByRarity("fatreBgImg"));
document
  .getElementById("deleteAllBlodhestButton")
  .addEventListener("click", () => deleteAllByRarity("blodBgImg"));
document
  .getElementById("deleteAllFearButton")
  .addEventListener("click", () => deleteAllByRarity("fearBgImg"));
document
  .getElementById("deleteAllHauntedSoulButton")
  .addEventListener("click", () => deleteAllByRarity("hauBgImg"));
document
  .getElementById("deleteAllTuonButton")
  .addEventListener("click", () => deleteAllByRarity("tuonBgImg"));
document
  .getElementById("deleteAllHollowHillManorButton")
  .addEventListener("click", () => deleteAllByRarity("hollowhillmanorBgImg"));
document
  .getElementById("deleteAllPumpkinHollowButton")
  .addEventListener("click", () => deleteAllByRarity("pumpkinhollowBgImg"));
document
  .getElementById("deleteAllThePhantomMoonButton")
  .addEventListener("click", () => deleteAllByRarity("thephantommoonBgImg"));
document
  .getElementById("deleteAllTheScarecrowsSigilButton")
  .addEventListener("click", () => deleteAllByRarity("thescarecrowssigilBgImg"));
document
  .getElementById("deleteAllTheVoidsVeilButton")
  .addEventListener("click", () => deleteAllByRarity("thevoidsveilBgImg"));
document
  .getElementById("deleteAllWailingShadeButton")
  .addEventListener("click", () => deleteAllByRarity("wailingshadeBgImg"));
document
  .getElementById("deleteAllLostSoulButton")
  .addEventListener("click", () => deleteAllByRarity("lostsBgImg"));
document
  .getElementById("deleteAllFoundSoulButton")
  .addEventListener("click", () => deleteAllByRarity("foundsBgImg"));
document
  .getElementById("deleteAllFoundSoulButton")
  .addEventListener("click", () => deleteAllByRarity("foundsBgImg"));
document
  .getElementById("deleteAllHauntedRealityButton")
  .addEventListener("click", () => deleteAllByRarity("hauntBgImg"));
document
  .getElementById("deleteAllDevilsHeartButton")
  .addEventListener("click", () => deleteAllByRarity("devilBgImg"));
document
  .getElementById("deleteAllSillyCarButton")
  .addEventListener("click", () => deleteAllByRarity("silcarBgImg"));
document
  .getElementById("deleteAllH1diButton")
  .addEventListener("click", () => deleteAllByRarity("h1diBgImg"));
document
  .getElementById("deleteAllLubJubButton")
  .addEventListener("click", () => deleteAllByRarity("lubjubBgImg"));
document
  .getElementById("deleteAllHarvButton")
  .addEventListener("click", () => deleteAllByRarity("harvBgImg"));
document
  .getElementById("deleteAllVeilButton")
  .addEventListener("click", () => deleteAllByRarity("veilBgImg"));
document
  .getElementById("deleteAllExperimentButton")
  .addEventListener("click", () => deleteAllByRarity("expBgImg"));
document
  .getElementById("deleteAllAbominationButton")
  .addEventListener("click", () => deleteAllByRarity("aboBgImg"));
document
  .getElementById("deleteAllJollyBellsButton")
  .addEventListener("click", () => deleteAllByRarity("jolbelBgImg"));
document
  .getElementById("deleteAllCandyCaneSymphonyButton")
  .addEventListener("click", () => deleteAllByRarity("cancansymBgImg"));
document
  .getElementById("deleteAllNorthStarButton")
  .addEventListener("click", () => deleteAllByRarity("norstaBgImg"));
document
  .getElementById("deleteAllSantaClausButton")
  .addEventListener("click", () => deleteAllByRarity("sanclaBgImg"));
document
  .getElementById("deleteAllFrostedGarlandButton")
  .addEventListener("click", () => deleteAllByRarity("frogarBgImg"));
document
  .getElementById("deleteAllReindeerDashButton")
  .addEventListener("click", () => deleteAllByRarity("reidasBgImg"));
document
  .getElementById("deleteAllHolidayCheerButton")
  .addEventListener("click", () => deleteAllByRarity("holcheBgImg"));
document
  .getElementById("deleteAllCrimsonStockingsButton")
  .addEventListener("click", () => deleteAllByRarity("cristoBgImg"));
document
  .getElementById("deleteAllGingerbreadHarmonyButton")
  .addEventListener("click", () => deleteAllByRarity("ginharBgImg"));
document
  .getElementById("deleteAllSilentNightButton")
  .addEventListener("click", () => deleteAllByRarity("silnigBgImg"));
document
  .getElementById("deleteAllFircraButton")
  .addEventListener("click", () => deleteAllByRarity("fircraBgImg"));
document
  .getElementById("deleteAllDemonSoulButton")
  .addEventListener("click", () => deleteAllByRarity("demsoBgImg"));
document
    .getElementById("deleteAllIridocyclitisVeilButton")
    .addEventListener("click", () => deleteAllByRarity("iriBgImg"));
document
    .getElementById("deleteAllRadButton")
    .addEventListener("click", () => deleteAllByRarity("radBgImg"));
document
  .getElementById("deleteAllBlindGTButton")
  .addEventListener("click", () => deleteAllByRarity("blindBgImg"));
document
  .getElementById("deleteAllMSFUButton")
  .addEventListener("click", () => deleteAllByRarity("msfuBgImg"));
document
  .getElementById("deleteAllOrbButton")
  .addEventListener("click", () => deleteAllByRarity("orbBgImg"));
document
  .getElementById("deleteAllFireCrazeButton")
  .addEventListener("click", () => deleteAllByRarity("crazeBgImg"));
document
  .getElementById("deleteAllShenviiButton")
  .addEventListener("click", () => deleteAllByRarity("shenviiBgImg"));
document
  .getElementById("deleteAllX1staButton")
  .addEventListener("click", () => deleteAllByRarity("x1staBgImg"));
document
  .getElementById("deleteAllAstraldButton")
  .addEventListener("click", () => deleteAllByRarity("astraldBgImg"));
document
  .getElementById("deleteAllMastermindButton")
  .addEventListener("click", () => deleteAllByRarity("mastermindBgImg"));
document
  .getElementById("deleteAllHypernovaButton")
  .addEventListener("click", () => deleteAllByRarity("hypernovaBgImg"));
document
  .getElementById("deleteAllNebulaButton")
  .addEventListener("click", () => deleteAllByRarity("nebulaBgImg"));


document
  .getElementById("deleteAllUnder1mButton")
  .addEventListener("click", () => {
    renderInventory();
    const raritiesUnder10k = [
      "impeachedBgImg",
      "celestialchorusBgImg",
      "x1staBgImg",
      "astraldBgImg",
      "mastermindBgImg"
    ];
    raritiesUnder10k.forEach(rarity => deleteAllByRarity(rarity));
});

document
  .getElementById("deleteAllSpecialButton")
  .addEventListener("click", () => {
    renderInventory();
    const raritiesUnder10k = [
      "iriBgImg",
      "veilBgImg",
      "expBgImg",
      "aboBgImg",
      "blindBgImg",
      "msfuBgImg",
      "orbBgImg",
      'crazeBgImg',
      'shenviiBgImg',
    ];
    raritiesUnder10k.forEach(rarity => deleteAllByRarity(rarity));
});

function createParticle(minRadius, maxRadius, minSize, maxSize, speed, rotationRange) {
  const particle = document.createElement('div');
  particle.className = 'particle';
  
  const size = minSize + Math.random() * (maxSize - minSize);
  particle.style.width = `${size}px`;
  particle.style.height = `${size}px`;
  
  const radius = minRadius + Math.random() * (maxRadius - minRadius);
  const startAngle = Math.random() * 360;
  const rotationAmount = 270 + Math.random() * rotationRange;
  const scaleFactor = 0.2 + Math.random() * 0.3;
  const duration = speed + Math.random() * 2;
  const delay = Math.random() * -4;
  
  particle.style.setProperty('--orbit-radius', `${radius}px`);
  particle.style.setProperty('--start-angle', `${startAngle}deg`);
  particle.style.setProperty('--rotation-amount', `${rotationAmount}deg`);
  particle.style.setProperty('--scale-factor', scaleFactor);
  particle.style.setProperty('--duration', `${duration}s`);
  particle.style.setProperty('--delay', `${delay}s`);
  
  return particle;
}

function createParticleGroup() {
  const system = document.querySelector('.particle-system');
  system.innerHTML = '';
  
  for (let i = 0; i < 10; i++) {
    const particle = createParticle(10, 30, 1, 2, 2, 720);
    system.appendChild(particle);
  }
  
  for (let i = 0; i < 30; i++) {
    const particle = createParticle(30, 70, 1.5, 2.5, 3, 540);
    system.appendChild(particle);
  }
  
  for (let i = 0; i < 50; i++) {
    const particle = createParticle(70, 120, 2, 3, 4, 360);
    system.appendChild(particle);
  }
}

document.querySelectorAll(".rarity-button").forEach(button => {
  button.addEventListener("click", () => {
    button.classList.toggle("active");
    saveToggledStates();
  });
});

const canvas = document.getElementById('fireworksCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

function resizeCanvas() {
  if (!canvas) {
    return;
  }
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

if (canvas) {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

class Particle {
    constructor(x, y, color, velocityX, velocityY, lifetime) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.lifetime = lifetime;
    }

    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.velocityY += 0.025;
        this.lifetime -= 1;
    }

    draw() {
        if (!ctx) {
            return;
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

class Firework {
    constructor(x, y, targetY, color) {
        this.x = x;
        this.y = y;
        this.targetY = targetY;
        this.color = color;
        this.exploded = false;
        this.particles = [];
    }

    update() {
        if (!this.exploded) {
            this.y -= 6;
            if (this.y <= this.targetY) {
                this.exploded = true;
                this.createExplosion();
            }
        } else {
            this.particles.forEach(p => p.update());
            this.particles = this.particles.filter(p => p.lifetime > 0);
        }
    }

    draw() {
        if (!ctx) {
            return;
        }

        if (!this.exploded) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        } else {
            this.particles.forEach(p => p.draw());
        }
    }

    createExplosion() {
        for (let i = 0; i < 100; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 2;
            const velocityX = Math.cos(angle) * speed;
            const velocityY = Math.sin(angle) * speed;
            const lifetime = Math.random() * 33 + 33;
            this.particles.push(new Particle(this.x, this.y, this.color, velocityX, velocityY, lifetime));
        }
    }
}

const fireworks = [];
const colors = ['#FF5733', '#33FF57', '#3357FF', '#FFFF33', '#FF33FF', '#33FFFF'];
let fireworksIntervalId = null;
let fireworksAnimationFrameId = null;
let fireworksActive = false;

function launchFirework() {
    if (!fireworksActive || !canvas) {
        return;
    }

    const x = Math.random() * canvas.width;
    const targetY = Math.random() * canvas.height / 2;
    const color = colors[Math.floor(Math.random() * colors.length)];
    fireworks.push(new Firework(x, canvas.height, targetY, color));
}

function runFireworksFrame() {
    if (!fireworksActive || !ctx) {
        fireworksAnimationFrameId = null;
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fireworks.forEach((firework, index) => {
        firework.update();
        firework.draw();
        if (firework.exploded && firework.particles.length === 0) {
            fireworks.splice(index, 1);
        }
    });

    fireworksAnimationFrameId = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(runFireworksFrame)
        : setTimeout(runFireworksFrame, 16);
}

function startFireworksAnimation() {
    if (!canvas || !ctx || isReducedAnimationsEnabled()) {
        return;
    }

    if (fireworksActive) {
        return;
    }

    fireworksActive = true;

    if (fireworksIntervalId === null) {
        fireworksIntervalId = setInterval(launchFirework, 9999);
    }

    if (fireworksAnimationFrameId === null) {
        runFireworksFrame();
    }
}

function stopFireworksAnimation() {
    fireworksActive = false;

    if (fireworksIntervalId !== null) {
        clearInterval(fireworksIntervalId);
        fireworksIntervalId = null;
    }

    if (fireworksAnimationFrameId !== null) {
        if (typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(fireworksAnimationFrameId);
        } else {
            clearTimeout(fireworksAnimationFrameId);
        }
        fireworksAnimationFrameId = null;
    }

    fireworks.length = 0;

    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

if (!isReducedAnimationsEnabled()) {
    startFireworksAnimation();
}

function startRefreshTimer() {
  refreshTimeout = setTimeout(() => {
      location.reload();
  }, 1200000);
}

function cancelRefreshTimer() {
  clearTimeout(refreshTimeout);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
      startRefreshTimer();
  } else {
      cancelRefreshTimer();
  }
});

let __bgStack, __bgLayerA, __bgLayerB, __bgActive = 0;
let __currentBgClass = null;

function ensureBgStack() {
  if (__bgStack) return;

  // Create stack container + two layers
  __bgStack = document.createElement("div");
  __bgStack.id = "bg-stack";
  const a = document.createElement("div");
  const b = document.createElement("div");
  a.className = "bg-layer";
  b.className = "bg-layer";
  __bgStack.appendChild(a);
  __bgStack.appendChild(b);

  // Insert as the first child so it sits under typical content
  document.body.insertBefore(__bgStack, document.body.firstChild);

  __bgLayerA = a;
  __bgLayerB = b;

  // Initialize with whatever body currently has (so first fade looks natural)
  const initialBg = getComputedStyle(document.body).backgroundImage;
  if (initialBg && initialBg !== "none") {
    __bgLayerA.style.backgroundImage = initialBg;
    __bgLayerA.classList.add("is-active");
    __bgActive = 0;
  } else {
    __bgActive = 0; // A will be first to show when we set it
  }
}

function changeBackground(rarityClass, itemTitle, options = {}) {
  const force = typeof options === "object" && options !== null
    ? Boolean(options.force)
    : Boolean(options);

  if (!force && (!isChangeEnabled || !lastRollPersisted)) {
    return;
  }

  const details = backgroundDetails[rarityClass];
  if (!details) return;

  const shouldSkipAudioUpdate = !force && resumeEquippedAudioAfterCutscene && pausedEquippedAudioState && pausedEquippedAudioState.element;

  if (!shouldSkipAudioUpdate) {
    pinnedAudioId = details.audio || null;
    resumeEquippedAudioAfterCutscene = false;
    pausedEquippedAudioState = null;
  }

  const previousForcedState = allowForcedAudioPlayback;
  if (force) {
    allowForcedAudioPlayback = true;
  }

  try {
    // Update the body class so existing rarity-based styling keeps working.
    if (__currentBgClass !== rarityClass) {
      if (__currentBgClass) {
        document.body.classList.remove(__currentBgClass);
      }
      document.body.classList.add(rarityClass);
      __currentBgClass = rarityClass;
    }

    // Prepare the stack
    ensureBgStack();

    // Determine next layer and set its image
    const nextLayer = __bgActive === 0 ? __bgLayerB : __bgLayerA;
    const currLayer = __bgActive === 0 ? __bgLayerA : __bgLayerB;

    // Point to the file URL (string or template is ok)
    nextLayer.style.backgroundImage = `url(${details.image})`;

    const bucket = normalizeRarityBucket(rarityClass);
    triggerScreenShakeByBucket(bucket);

    // Trigger the crossfade on the next animation frame to ensure style is applied
    requestAnimationFrame(() => {
      // Bring the next one in, send the current one out
      nextLayer.classList.add("is-active");
      currLayer.classList.remove("is-active");
      __bgActive = __bgActive === 0 ? 1 : 0;
    });

    // Maintain your audio behavior
    if (!shouldSkipAudioUpdate) {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      if (details.audio) {
        const newAudio = document.getElementById(details.audio);
        if (newAudio) {
          newAudio.volume = getEffectiveVolumeForAudioId(details.audio);
          const playPromise = newAudio.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {});
          }
          currentAudio = newAudio;
        }
      } else {
        currentAudio = null;
      }
    }

    // Clear direct body background inline style so the stack is the only visual source.
    // This prevents flicker if some other code set document.body.style.backgroundImage.
    document.body.style.backgroundImage = "";
  } finally {
    if (force) {
      allowForcedAudioPlayback = previousForcedState;
    }
    if (!force) {
      applyPendingAutoEquip();
    } else {
      pendingAutoEquipRecord = null;
    }
  }
}