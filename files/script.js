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

let inventory = storage.get("inventory", []);
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
let audioVolume = 1;
let isMuted = false;
let previousVolume = audioVolume;
let refreshTimeout;
let hasScheduledLoad = false;
let skipCutscene1K = true;
let skipCutscene10K = true;
let skipCutscene100K = true;
let skipCutscene1M = true;
let cooldownBuffActive = cooldownTime < BASE_COOLDOWN_TIME;
let rollDisplayHiddenByUser = false;
let cutsceneHidRollDisplay = false;
let cutsceneActive = false;
let cutsceneFailsafeTimeout = null;
let lastRollPersisted = true;
let lastRollAutoDeleted = false;
let lastRollRarityClass = null;
let allowForcedAudioPlayback = false;
let pinnedAudioId = null;
let pausedEquippedAudioState = null;
let resumeEquippedAudioAfterCutscene = false;
const rolledRarityBuckets = new Set(storage.get("rolledRarityBuckets", []));

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
  "isekailofiAudio"
];

const STOPPABLE_AUDIO_SET = new Set(STOPPABLE_AUDIO_IDS);

const RARITY_BUCKET_LABELS = {
  under100: "Basic",
  under1k: "Decent",
  under10k: "Grand",
  under100k: "Mastery",
  under1m: "Supreme",
  special: "Special"
};

const originalAudioPlay = HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play = function (...args) {
  if (
    this instanceof HTMLAudioElement &&
    STOPPABLE_AUDIO_SET.has(this.id) &&
    !lastRollPersisted &&
    !allowForcedAudioPlayback
  ) {
    return Promise.resolve();
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
  }, 15000);
}

function finalizeCutsceneState() {
  clearTimeout(cutsceneFailsafeTimeout);
  cutsceneFailsafeTimeout = null;
  cutsceneActive = false;
  ensureBgStack();
  if (__bgStack) {
    __bgStack.classList.remove("is-hidden");
  }
  restoreRollDisplayAfterCutscene();
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
  ],
  under1m: [
    "impeachedBgImg",
    "celestialchorusBgImg",
    "x1staBgImg",
    "silcarBgImg",
    "gingerBgImg",
    "h1diBgImg",
    "equinoxBgImg",
    "gregBgImg",
    "mintllieBgImg",
    "geezerBgGif",
    "polarrBgImg",
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
  silcarBgImg: "under10ms",
  gingerBgImg: "under10m",
  h1diBgImg: "under10m",
  equinoxBgImg: "under10me",
  waveBgImg: "eventS",
  beachBgImg: "eventS",
  tidalwaveBgImg: "eventS",
  scorchingBgImg: "eventS",
  heartBgImg: "eventV",
  esteggBgImg: "eventE",
  estbunBgImg: "eventE",
  fircraBgImg: "eventTitle",
  pumpkinBgImg: "eventTitleHalloween",
  norstaBgImg: "eventTitleXmas",
  sanclaBgImg: "eventTitleXmas",
  silnigBgImg: "eventTitleXmas",
  reidasBgImg: "eventTitleXmas",
  frogarBgImg: "eventTitleXmas",
  cancansymBgImg: "eventTitleXmas",
  ginharBgImg: "eventTitleXmas",
  jolbelBgImg: "eventTitleXmas",
  jolbeBgImg: "eventTitleXmas",
  holcheBgImg: "eventTitleXmas",
  cristoBgImg: "eventTitleXmas",
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
      inventory = storage.get("inventory", []);
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

const CUTSCENE_SKIP_SETTINGS = [
  { key: "skipCutscene1K", labelId: "1KTxt", label: "Skip Decent Cutscenes" },
  { key: "skipCutscene10K", labelId: "10KTxt", label: "Skip Grand Cutscenes" },
  { key: "skipCutscene100K", labelId: "100KTxt", label: "Skip Mastery Cutscenes" },
  { key: "skipCutscene1M", labelId: "1MTxt", label: "Skip Supreme Cutscenes" },
];

const CUTSCENE_STATE_SETTERS = {
  skipCutscene1K: (value) => { skipCutscene1K = value; },
  skipCutscene10K: (value) => { skipCutscene10K = value; },
  skipCutscene100K: (value) => { skipCutscene100K = value; },
  skipCutscene1M: (value) => { skipCutscene1M = value; },
};

const ACHIEVEMENTS = [
  { name: "I think I like this", count: 100 },
  { name: "This is getting serious", count: 1000 },
  { name: "I'm the Roll Master", count: 5000 },
  { name: "It's over 9000!!", count: 10000 },
  { name: "When will you stop?", count: 25000 },
  { name: "No Unnamed?", count: 30303 },
  { name: "Beyond Luck", count: 50000 },
  { name: "Rolling machine", count: 100000 },
  { name: "Your PC must be burning", count: 250000 },
  { name: "Half a million!1!!1", count: 500000 },
  { name: "One, Two.. ..One Million!", count: 1000000 },
  { name: "No H1di?", count: 10000000 },
  { name: "Are you really doing this?", count: 25000000 },
  { name: "You have no limits...", count: 50000000 },
  { name: "WHAT HAVE YOU DONE", count: 100000000 },
  { name: "AHHHHHHHHHHH", count: 1000000000 },
  { name: "Just the beginning", timeCount: 0 },
  { name: "This doesn't add up", timeCount: 3600 },
  { name: "When does it end...", timeCount: 7200 },
  { name: "I swear I'm not addicted...", timeCount: 36000 },
  { name: "Grass? What's that?", timeCount: 86400 },
  { name: "Unnamed's RNG biggest fan", timeCount: 172800 },
  { name: "RNG is life!", timeCount: 604800 },
  { name: "I. CAN'T. STOP", timeCount: 1209600 },
  { name: "No Lifer", timeCount: 2629800 },
  { name: "Are you okay?", timeCount: 5259600 },
  { name: "You are a True No Lifer", timeCount: 15778800 },
  { name: "No one's getting this legit", timeCount: 31557600 },
  { name: "Happy Summer!", timeCount: 0 },
  { name: "Grand Entrance", rarityBucket: "under10k" },
  { name: "One of a Kind", rarityBucket: "special" },
  { name: "Mastered the Odds", rarityBucket: "under100k" },
  { name: "Supreme Fortune", rarityBucket: "under1m" },
];

const COLLECTOR_ACHIEVEMENTS = [
  { name: "Achievement Collector", count: 5 },
  { name: "Achievement Hoarder", count: 10 },
  { name: "Achievement Addict", count: 20 },
  { name: "Achievement God", count: 33 },
  { name: "T̶h̶e̶ ̶U̶l̶t̶i̶m̶a̶t̶e̶ ̶C̶o̶l̶l̶e̶c̶t̶o̶r̶", count: 50 },
];

const ACHIEVEMENT_GROUP_STYLES = [
  { selector: ".achievement-item", unlocked: { backgroundColor: "blue" } },
  { selector: ".achievement-itemT", unlocked: { backgroundColor: "green" } },
  { selector: ".achievement-itemC", unlocked: { backgroundColor: "red" } },
  { selector: ".achievement-itemE", unlocked: { backgroundColor: "yellow", color: "black" } },
  { selector: ".achievement-itemSum", unlocked: { backgroundColor: "orange", color: "black" } },
  { selector: ".achievement-itemR", unlocked: { backgroundColor: "#6d8bff" } },
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

  try {
    if (typeof state.time === "number" && !Number.isNaN(state.time)) {
      audio.currentTime = state.time;
    }
  } catch (error) {
    /* no-op */
  }

  if (state.wasPlaying) {
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
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

function playMainMenuAudio() {
  if (typeof mainAudio === "undefined" || !mainAudio) {
    return;
  }

  try {
    if (typeof audioVolume === "number") {
      mainAudio.volume = audioVolume;
    }
    const playPromise = mainAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  } catch (error) {
    /* no-op */
  }
}

function applyEquippedItemOnStartup() {
  if (!equippedItem) {
    return;
  }

  const match = inventory.find((item) => isItemCurrentlyEquipped(item));
  if (!match) {
    equippedItem = null;
    storage.remove("equippedItem");
    changeBackground("menuDefault", null, { force: true });
    playMainMenuAudio();
    return;
  }

  const normalized = normalizeEquippedItemRecord(match);
  if (!normalized) {
    equippedItem = null;
    storage.remove("equippedItem");
    changeBackground("menuDefault", null, { force: true });
    playMainMenuAudio();
    return;
  }

  equippedItem = normalized;
  handleEquippedItem(normalized);
  if (typeof mainAudio !== "undefined" && mainAudio && typeof mainAudio.pause === "function") {
    try {
      mainAudio.pause();
    } catch (error) {
      /* no-op */
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const rollButton = byId("rollButton");
  const startButton = byId("startButton");
  const loadingScreen = byId("loadingScreen");
  const menuScreen = byId("menuScreen");
  const loadingText = loadingScreen ? loadingScreen.querySelector(".loadTxt") : null;

  if (rollButton) {
    rollButton.disabled = true;
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
        // Kick off playback without awaiting so UI initialisation continues even if the
        // browser delays or blocks autoplay.
        const playAttempt = mainAudio.play();
        if (playAttempt && typeof playAttempt.catch === "function") {
          playAttempt.catch((error) => {
            console.warn("Unable to start background audio immediately.", error);
          });
        }
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
      rollButton.disabled = false;
    }
  });
});

function loadContent() {
  LOADING_SEQUENCE.forEach(({ action }) => action());
}

function load() {
  if (document.readyState === "loading" && !hasScheduledLoad) {
    hasScheduledLoad = true;
    document.addEventListener("DOMContentLoaded", () => {
      hasScheduledLoad = false;
      loadContent();
    }, { once: true });
  }
}

function loadCutsceneSkip() {
  CUTSCENE_SKIP_SETTINGS.forEach(({ key, labelId, label }) => {
    const storedValue = storage.get(key);
    const resolvedValue = typeof storedValue === "boolean" ? storedValue : true;

    if (storedValue !== resolvedValue) {
      storage.set(key, resolvedValue);
    }

    const assignState = CUTSCENE_STATE_SETTERS[key];
    if (assignState) {
      assignState(resolvedValue);
    }

    const labelElement = byId(labelId);
    if (labelElement) {
      labelElement.textContent = `${label} ${resolvedValue ? "" : "On"}`;
    }
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

  ACHIEVEMENTS.forEach((achievement) => {
    if (achievement.count && rollCount >= achievement.count) {
      unlockAchievement(achievement.name, unlocked);
    }

    if (achievement.timeCount !== undefined && typeof playTime !== "undefined" && playTime >= achievement.timeCount) {
      unlockAchievement(achievement.name, unlocked);
    }

    if (achievement.rarityBucket && rarityBuckets.has(achievement.rarityBucket)) {
      unlockAchievement(achievement.name, unlocked);
    }
  });

  const unlockedCount = unlocked.size;

  COLLECTOR_ACHIEVEMENTS.forEach((collector) => {
    if (unlockedCount >= collector.count) {
      unlockAchievement(collector.name, unlocked);
    }
  });
}

function showAchievementPopup(name) {
  achievementToastQueue.push(name);
  processAchievementToastQueue();
}

function updateAchievementsList() {
  const unlocked = new Set(storage.get("unlockedAchievements", []));

  ACHIEVEMENT_GROUP_STYLES.forEach(({ selector, unlocked: unlockedStyles }) => {
    $all(selector).forEach((item) => {
      const achievementName = item.getAttribute("data-name");
      const isUnlocked = achievementName && unlocked.has(achievementName);

      item.style.backgroundColor = isUnlocked ? unlockedStyles.backgroundColor : "gray";
      item.style.color = isUnlocked && unlockedStyles.color ? unlockedStyles.color : "";
    });
  });
}

document.addEventListener("DOMContentLoaded", updateAchievementsList);

document.getElementById("rollButton").addEventListener("click", function () {
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
  pauseEquippedAudioForRarity(rarity);

  const preservedAudioIds = [];
  if (
    resumeEquippedAudioAfterCutscene &&
    pausedEquippedAudioState &&
    pausedEquippedAudioState.element &&
    pausedEquippedAudioState.element.id
  ) {
    preservedAudioIds.push(pausedEquippedAudioState.element.id);
  }

  stopAllAudio({
    preservePinned: true,
    preserve: preservedAudioIds,
  });

  let title = selectTitle(rarity);

  rollButton.disabled = true;

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
    rarity.type === "Heart [1 in ♡♡♡]" ||
    rarity.type === "GD Addict [1 in ###]" ||
    rarity.type === "FireCraze [1 in 4,200/69th]" ||
    rarity.type === "sʜeɴvɪ✞∞ [1 in 77,777/7th]" ||
    rarity.type === "Light [1 in 29,979]" ||
    rarity.type === "X1sta [1 in 230,444]" ||
    rarity.type === "Easter Egg [1 in 13,333]" ||
    rarity.type === "Easter Bunny [1 in 133,333]" ||
    rarity.type === "Hellish Fire [1 in 6,666]" ||
    rarity.type === "Isekai ♫ Lo-Fi [1 in 3,000]" ||
    rarity.type === "『Equinox』 [1 in 2,500,000]" ||
    rarity.type === "Ginger [1 in 1,144,141]" ||
    rarity.type === "Wave [1 in 2,555]" ||
    rarity.type === "Scorching [1 in 7,923]" ||
    rarity.type === "Beach [1 in 12,555]" ||
    rarity.type === "Tidal Wave [1 in 25,500]" ||
    rarity.type === "Scorching [1 in 7,923]" ||
    rarity.type === "Beach [1 in 12,555]" ||
    rarity.type === "Tidal Wave [1 in 25,500]"
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
    } else if (rarity.type === "『Equinox』 [1 in 2,500,000]") {
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
          rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
          rollButton.disabled = false;
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          expAudio.play();
        }, 100);
        enableChange();
      }, 20550); // Wait for 20.55 seconds
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
          rollButton.disabled = false;
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
          rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
          rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
          rollButton.disabled = false;
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
          rollButton.disabled = false;
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          esteggAudio.play();
        }, 100);
        enableChange();
      }, 10750); // Wait for 10.75 seconds
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
          rollButton.disabled = false;
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          estbunAudio.play();
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
          rollButton.disabled = false;
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
          griAudio.play();
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
      }
    } else if (rarity.type === "H1di [1 in 9,890,089]") {
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
          rollButton.disabled = false;
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
        }, 100);
        enableChange();
      }, 14000); // Wait for 14 seconds
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
          rollButton.disabled = false;
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
          rollButton.disabled = false;
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
          rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
          rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
          rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        isekaiAudio.play();
      }
    } else if (rarity.type === "『Equinox』 [1 in 2,500,000]") {
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

      const squareInterval = setInterval(() => {
        createCircles("white");
        createCircles("black");
      }, 50); 

      setTimeout(() => {
        clearInterval(squareInterval);
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
          rollButton.disabled = false;
          rollCount++;
          rollCount1++;
          titleCont.style.visibility = "visible";
        }, 100);
        enableChange();
      }, 10500); // Wait for 10.5 seconds
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
        rollCount++;
        rollCount1++;
        titleCont.style.visibility = "visible";
        unnamedAudio.play();
      }
    } else if (rarity.type === "Ginger [1 in 1,144,141]") {
      if (skipCutscene1M) {
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
          rollButton.disabled = false;
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
          rollButton.disabled = false;
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
          rollButton.disabled = false;
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
          rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
          rollButton.disabled = false;
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
          rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
            rollButton.disabled = false;
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
        rollButton.disabled = false;
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
          rollButton.disabled = false;
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
      rollButton.disabled = false;
    }, cooldownTime);
  }
  localStorage.setItem("rollCount", rollCount);
  localStorage.setItem("rollCount1", rollCount1);
  load();
});

const toggleCutscene1KBtn = document.getElementById("toggleCutscene1K");
const toggleCutscene1KTxt = document.getElementById("1KTxt");
toggleCutscene1KBtn.addEventListener("click", function () {
  skipCutscene1K = !skipCutscene1K;
  console.log(`Cutscene skip for 1K has been set to ${skipCutscene1K}`);
  localStorage.setItem('skipCutscene1K', JSON.stringify(skipCutscene1K));
  toggleCutscene1KTxt.textContent = `Skip Decent Cutscenes ${skipCutscene1K ? "" : "On"}`;
});

const toggleCutscene10KBtn = document.getElementById("toggleCutscene10K");
const toggleCutscene10KTxt = document.getElementById("10KTxt");
toggleCutscene10KBtn.addEventListener("click", function () {
  skipCutscene10K = !skipCutscene10K;
  console.log(`Cutscene skip for 10K has been set to ${skipCutscene10K}`);
  localStorage.setItem('skipCutscene10K', JSON.stringify(skipCutscene10K));
  toggleCutscene10KTxt.textContent = `Skip Grand Cutscenes ${skipCutscene10K ? "" : "On"}`;
});

const toggleCutscene100KBtn = document.getElementById("toggleCutscene100K");
const toggleCutscene100KTxt = document.getElementById("100KTxt");
toggleCutscene100KBtn.addEventListener("click", function () {
  skipCutscene100K = !skipCutscene100K;
  console.log(`Cutscene skip for 100K has been set to ${skipCutscene100K}`);
  localStorage.setItem('skipCutscene100K', JSON.stringify(skipCutscene100K));
  toggleCutscene100KTxt.textContent = `Skip Mastery Cutscenes ${skipCutscene100K ? "" : "On"}`;
});

const toggleCutscene1MBtn = document.getElementById("toggleCutscene1M");
const toggleCutscene1MTxt = document.getElementById("1MTxt");
toggleCutscene1MBtn.addEventListener("click", function () {
  skipCutscene1M = !skipCutscene1M;
  console.log(`Cutscene skip for 1M has been set to ${skipCutscene1M}`);
  localStorage.setItem('skipCutscene1M', JSON.stringify(skipCutscene1M));
  toggleCutscene1MTxt.textContent = `Skip Supreme Cutscenes ${skipCutscene1M ? "" : "On"}`;
});

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
      titles: ["Immortal", "Celestial", "Eternal", "Transcendent", "Supreme", "Bounded", "Omniscient", "Omnipotent", "Ultimate", "Apex"],
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
      type: "Grim Destiny [1 in 8,500]",
      class: "griBgImg",
      chance: 0.012,
      titles: ["Grim Destiny"],
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
      type: "Fright [1 in 1,075]",
      class: "frightBgImg",
      chance: 0.093,
      titles: ["Twilight: Iridescent Memory", "Glitch", "Arcane: Dark", "Exotic: Apex", "Ethereal", "Stormal: Hurricane", "Matrix", "Arcane: Legacy", "Starscourge", "Sailor: Flying Dutchman"],
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
      titles: ["Warped", "Dimensional", "Vortex", "Parallel", "Quantum", "Portal", "Transcendent", "Astral", "Temporal", "Rifted"],
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
      type: "Rad [1 in 6,969]",
      class: "radBgImg",
      chance: 0.01434926101,
      titles: ["Rad", "Furry", ":3"],
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
      type: "『Equinox』 [1 in 2,500,000]",
      class: "equinoxBgImg",
      chance: 0.00014,
      titles: ["LAYERS", "CHROMA", "衡"]
    },
    {
      type: "Wave [1 in 2,555]",
      class: "waveBgImg",
      chance: 0.03913894324,
      titles: ["Water", "H2O", "Ocean"]
    },
    {
      type: "Scorching [1 in 7,923]",
      class: "scorchingBgImg",
      chance: 0.01262148176,
      titles: ["Burning", "Warm", "Sweatty", "Fire", "Heat"]
    },
    {
      type: "Beach [1 in 12,555]",
      class: "beachBgImg",
      chance: 0.0079649542,
      titles: ["Dusty", "Sandy", "Tropical"]
    },
    {
      type: "Tidal Wave [1 in 25,500]",
      class: "tidalwaveBgImg",
      chance: 0.00392156862,
      titles: ["Du da du dum du, da du dum du", "Tsunami", "Surf"]
    }
  ];

  const abominationRarity = {
    type: "Abomination [1 in 1,000,000/20th]",
    class: "aboBgImg",
    chance: 0.000001,
    titles: ["Chaos", "Experiment: 902", "Damaged", "Assistance"],
  };

  const iridocyclitisVeilRarity = {
    type: "Iridocyclitis Veil [1 in 5,000/50th]",
    class: "iriBgImg",
    chance: 0.02,
    titles: ["Cyclithe", "Veilborne", "Hemovail", "Abomination: 902"],
  };

  const ShenviiRarity = {
    type: "sʜeɴvɪ✞∞ [1 in 77,777/7th]",
    class: "shenviiBgImg",
    chance: 0.000055,
    titles: ["Cat", "Unforgettable", "Pookie", "Orb: 902", "Infinity"],
  };

  const orbRarity = {
    type: "ORB [1 in 55,555/30th]",
    class: "orbBgImg",
    chance: 0.00019,
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
    chance: 0.0002,
    titles: ["Fight", "Peace", "MSFU: 902"],
  };

  const blindRarity = {
    type: "BlindGT [1 in 2,000,000/15th]",
    class: "blindBgImg",
    chance: 0.000005,
    titles: ["Moderator", "Moderator: 902"],
  };

  const msfuRarity = {
    type: "MSFU [1 in 333/333rd]",
    class: "msfuBgImg",
    chance: 0.3003003003,
    titles: ["Metal", "Universe", "Veil: 902"],
  };

  const fireCrazeRarity = {
    type: "FireCraze [1 in 4,200/69th]",
    class: "crazeBgImg",
    chance: 0.001,
    titles: ["Fire", "Craze", "Iridocyclitis: 902"],
  };

  let randomNum = Math.random() * 110;
  let cumulativeChance = 0.004;

  if (rollCount % 333 === 0) {
    cumulativeChance += msfuRarity.chance;
    if (randomNum <= cumulativeChance) {
      return msfuRarity;
    }
  } else if (rollCount % 69 === 0) {
    cumulativeChance += fireCrazeRarity.chance;
    if (randomNum <= cumulativeChance) {
      return fireCrazeRarity;
    }
  } else if (rollCount % 50 === 0) {
    cumulativeChance += iridocyclitisVeilRarity.chance;
    if (randomNum <= cumulativeChance) {
      return iridocyclitisVeilRarity;
    }
  } else if (rollCount % 30 === 0) {
    cumulativeChance += orbRarity.chance;
    if (randomNum <= cumulativeChance) {
      return orbRarity;
    }
  } else if (rollCount % 20 === 0) {
    cumulativeChance += abominationRarity.chance;
    if (randomNum <= cumulativeChance) {
      return abominationRarity;
    }
  } else if (rollCount % 10 === 0) {
    cumulativeChance += experimentRarity.chance;
    if (randomNum <= cumulativeChance) {
      return experimentRarity;
    }
  } else if (rollCount % 15 === 0) {
    cumulativeChance += blindRarity.chance;
    if (randomNum <= cumulativeChance) {
      return blindRarity;
    }
  } else if (rollCount % 7 === 0) {
    cumulativeChance += ShenviiRarity.chance;
    if (randomNum <= cumulativeChance) {
      return ShenviiRarity;
    }
  } else if (rollCount % 5 === 0) {
    cumulativeChance += veilRarity.chance;
    if (randomNum <= cumulativeChance) {
      return veilRarity;
    }
  } else {
    for (let rarity of rarities) {
      cumulativeChance += rarity.chance;
      if (randomNum <= cumulativeChance) {
        return rarity;
      }
    }
  }
  
  return rarities[0];  
};

function clickSound() {
  let click = document.getElementById("click");

  click.play();

  document.getElementById("rollButton").addEventListener("click", clickSound);
}

function showPopupCopyTxt() {
  var copyText = document.getElementById("unnamedUser");
  copyText.hidden = false;
  copyText.select();
  document.execCommand("copy");
  copyText.hidden = true;
  alert("Copied selected discord user: " + copyText.value);

  document.getElementById("profileModal").style.display = "block";
}

function closePopup() {
  document.getElementById("profileModal").style.display = "none";
}

function openDiscord() {
  window.open("https://discord.gg/m6k7Jagm3v", "_blank");
  closePopup();
}

function openGithub() {
  window.open("https://github.com/The-Unnamed-Official/Unnamed-RNG/tree/published", "_blank");
  closePopup();
}

window.onclick = function(event) {
  var modal = document.getElementById("profileModal");
  if (event.target === modal) {
    modal.style.display = "none";
  }
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
  const autoDeleteSet = getAutoDeleteSet();
  const bucket = normalizeRarityBucket(rarityClass);
  recordRarityBucketRoll(bucket);
  if (autoDeleteSet.has(bucket)) {
    lastRollPersisted = false;
    lastRollAutoDeleted = true;
    resumeEquippedAudioAfterCutscene = true;
    showStatusMessage(`${title} auto-deleted`, 800);
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

  inventory.push({ title, rarityClass, rolledAt });
  localStorage.setItem("inventory", JSON.stringify(inventory));
  renderInventory();
  lastRollPersisted = true;
  lastRollAutoDeleted = false;
  return true; // persisted
}

function displayResult(title, rarity) {
  const resultDiv = document.getElementById("result");
  if (!resultDiv) {
    return;
  }

  const rarityValue = rarity == null ? "" : rarity;
  const rarityText = typeof rarityValue === "string" ? rarityValue : String(rarityValue);
  const [rarityName, oddsRaw] = rarityText.split(" [");
  const odds = oddsRaw ? oddsRaw.replace(/\]$/, "") : "";
  const bucket = normalizeRarityBucket(lastRollRarityClass);
  const bucketClass = bucket ? `roll-result-card--${bucket}` : "";
  const bucketLabel = bucket ? (RARITY_BUCKET_LABELS[bucket] || bucket) : "";
  const labelClass = getLabelClassForRarity(lastRollRarityClass, bucket);

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
  if (labelClass) {
    rarityLabel.classList.add(labelClass);
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
    { prefix: "under10me", bucket: "under1m" },
    { prefix: "under10ms", bucket: "under1m" },
    { prefix: "under10m", bucket: "under1m" },
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
  if (["under100", "under1k", "under10k", "under100k", "under1m", "special"].includes(cls)) {
    return cls;
  }

  return RARITY_CLASS_BUCKET_MAP[cls] || "";
}

function getLabelClassForRarity(rarityClass, bucket) {
  if (!rarityClass || typeof rarityClass !== "string") {
    return bucket || "";
  }

  const cls = rarityClass.trim();
  return RARITY_LABEL_CLASS_MAP[cls] || bucket || "";
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

document
  .getElementById("toggleInventoryBtn")
  .addEventListener("click", function () {
    const inventorySection = document.querySelector(".inventory");
    const isVisible = inventorySection.style.visibility !== "visible";

    if (isVisible) {
      inventorySection.style.visibility = "visible";
      this.textContent = "Hide Inventory";
    } else {
      inventorySection.style.visibility = "hidden";
      this.textContent = "Show Inventory";
    }
  });

const toggleUiBtn = document.getElementById("toggleUiBtn");
const uiSection = document.querySelector(".ui");

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

document
  .getElementById("toggleRollDisplayBtn")
  .addEventListener("click", function () {
    const inventorySection = document.querySelector(".container");
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

window.addEventListener("resize", function () {
  const container = document.querySelector(".container1");
  const inventory = document.querySelector(".inventory");
  const SeButton = document.getElementById("settingsButton");
  const AButton = document.getElementById("achievementsButton");
  const StButton = document.getElementById("statsButton");
  const sliderContainer = document.querySelector(".slider-container");
  const originalParent = document.querySelector(".original-parent");

  if (window.innerWidth < 821) {
    SeButton.style.display = "none";
    AButton.style.display = "none";
    StButton.style.display = "none";
    container.style.left = "10px";
    inventory.style.height = "58vh";
    inventory.style.width = "42vh";

    if (!container.contains(sliderContainer)) {
      container.appendChild(sliderContainer);
    }
  } else if (window.innerWidth > 821 && window.innerHeight > 1400) { 
    // Fix: Use '&&' instead of '&'
    inventory.style.width = "70vh";
    container.style.left = "383px";

    if (originalParent && !originalParent.contains(sliderContainer)) {
      originalParent.appendChild(sliderContainer);
    }
  } else {
    container.style.left = "383px";
    SeButton.style.display = "inline-block";
    AButton.style.display = "inline-block";
    StButton.style.display = "inline-block";
    inventory.style.width = "60vh";
    inventory.style.height = "85vh";

    if (originalParent && !originalParent.contains(sliderContainer)) {
      originalParent.appendChild(sliderContainer);
    }
  }
});

document
  .getElementById("toggleRollHistoryBtn")
  .addEventListener("click", function () {
    const historySection = document.querySelector(".historySection");
    const container = document.querySelector(".container1");
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
    image: "files/backgrounds/unnamed.png",
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

function disableChange() {
  isChangeEnabled = false;
  cutsceneActive = true;
  scheduleCutsceneFailsafe();
  // Hide stack during cutscenes (body backgrounds/gifs will show)
  if (__bgStack) __bgStack.classList.add("is-hidden");
}

function renderInventory() {
  const inventoryList = document.getElementById("inventoryList");
  inventoryList.innerHTML = "";

  let newBucketRecorded = false;
  inventory.forEach((item) => {
    const bucket = normalizeRarityBucket(item.rarityClass);
    if (bucket && !rolledRarityBuckets.has(bucket)) {
      rolledRarityBuckets.add(bucket);
      newBucketRecorded = true;
    }
  });

  if (newBucketRecorded) {
    storage.set("rolledRarityBuckets", Array.from(rolledRarityBuckets));
    checkAchievements({ rarityBuckets: rolledRarityBuckets });
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
    const labelClass = getLabelClassForRarity(item.rarityClass, bucket);
    if (labelClass) {
      itemTitle.classList.add(labelClass);
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
    equipButton.textContent = isEquipped ? "Unequip" : "Equip";
    equipButton.classList.toggle("dropdown-item--unequip", Boolean(isEquipped));
    equipButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (isItemCurrentlyEquipped(item)) {
        unequipItem();
      } else {
        equipItem(item);
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
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
        }
      });

      // Toggle this one
      const willOpen = dropdownMenu.style.display !== "block";
      dropdownMenu.style.display = willOpen ? "block" : "none";
      dropdownMenu.classList.toggle("open", willOpen);
    });

    inventoryList.appendChild(listItem);
  });

  updatePagination();
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
  delete lockedItems[item.title];
  localStorage.setItem("lockedItems", JSON.stringify(lockedItems));

  inventory.splice(absoluteIndex, 1);
  renderInventory();
  localStorage.setItem("inventory", JSON.stringify(inventory));
  load();
}

function equipItem(item) {
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

function unequipItem() {
  if (!equippedItem) {
    return;
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
  playMainMenuAudio();

  renderInventory();
}

function handleEquippedItem(item) {
  if (!item) {
    return;
  }

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

document.addEventListener("DOMContentLoaded", (event) => {
  document
    .getElementById("deleteAllButton")
    .addEventListener("click", function () {
      var confirmDelete = confirm(
        "Are you sure you want to delete all Titles?"
      );
      if (confirmDelete) {
        deleteAllFromInventory();
      }
    });
});

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

    cooldownBuffActive = true;
    cooldownTime = config.reduceTo;

    showCooldownEffect(config.effectSeconds);

    button.innerText = "Cooldown Reduced!";
    button.disabled = true;

    setTimeout(() => {
      if (button.isConnected) {
        document.body.removeChild(button);
      }
    }, 1000);

    setTimeout(() => {
      cooldownTime = BASE_COOLDOWN_TIME;
      cooldownBuffActive = false;
      scheduleAllCooldownButtons();
    }, config.resetDelay);
  });

  document.body.appendChild(button);
}

function showCooldownEffect(duration) {
  const existingDisplay = document.getElementById("countdownDisplay");
  if (existingDisplay) {
    existingDisplay.remove();
  }

  const countdownDisplay = document.createElement("div");
  countdownDisplay.id = "countdownDisplay";
  countdownDisplay.style.position = "fixed";
  countdownDisplay.style.bottom = "20px";
  countdownDisplay.style.right = "20px";
  countdownDisplay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  countdownDisplay.style.color = "white";
  countdownDisplay.style.padding = "10px";
  countdownDisplay.style.borderRadius = "5px";
  countdownDisplay.style.zIndex = "100000";

  countdownDisplay.innerText = `Roll-Cooldown Effect: ${duration}s`;
  document.body.appendChild(countdownDisplay);

  let timeLeft = duration - 1;
  const interval = setInterval(() => {
    if (timeLeft < 0) {
      clearInterval(interval);
      if (countdownDisplay.isConnected) {
        document.body.removeChild(countdownDisplay);
      }
      return;
    }

    countdownDisplay.innerText = `Roll-Cooldown Effect: ${timeLeft}s`;
    timeLeft--;
  }, 1000);
}

function scheduleAllCooldownButtons() {
  COOLDOWN_BUTTON_CONFIGS.forEach((config) => {
    scheduleCooldownButton(config);
  });
}

scheduleAllCooldownButtons();

document.addEventListener("DOMContentLoaded", () => {
  const settingsMenu = document.getElementById("settingsMenu");
  const settingsHeader = settingsMenu?.querySelector(".settings-header");
  const settingsBody = settingsMenu?.querySelector(".settings-body");
  const achievementsMenu = document.getElementById("achievementsMenu");
  const achievementsHeader = achievementsMenu?.querySelector(".achievements-header");
  const achievementsBody = achievementsMenu?.querySelector(".achievements-body");
  const statsMenu = document.getElementById("statsMenu");
  const statsHeader = statsMenu?.querySelector(".stats-header");
  const statsDragHandle = statsMenu?.querySelector(".stats-menu__drag-handle");
  const headerStats = statsMenu.querySelector("h3");
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

  if (settingsHeader) {
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

  if (achievementsHeader) {
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

  if (headerStats) {
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
    if (isDraggingSettings) {
      settingsMenu.style.left = `${event.clientX - offsetX}px`;
      settingsMenu.style.top = `${event.clientY - offsetY}px`;
    }

    if (isDraggingAchievements) {
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
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
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
});

const settingsButton = document.getElementById("settingsButton");
const achievementsButton = document.getElementById("achievementsButton");
const achievementsMenu = document.getElementById("achievementsMenu");
const closeAchievements = document.getElementById("closeAchievements");
const statsMenu = document.getElementById("statsMenu");
const statsButton = document.getElementById("statsButton");
const closeStats = document.getElementById("closeStats");
const settingsMenu = document.getElementById("settingsMenu");
const closeSettings = document.getElementById("closeSettings");
const audioSlider = document.getElementById("audioSlider");
const audioSliderValueLabel = document.getElementById("audioSliderValue");
const resetDataButton = document.getElementById("resetDataButton");
const autoRollButton = document.getElementById("autoRollButton");
const rollButton = document.getElementById("rollButton");

settingsButton.addEventListener("click", () => {
  settingsMenu.style.display = "block";
});

closeSettings.addEventListener("click", () => {
  settingsMenu.style.display = "none";
});

achievementsButton.addEventListener("click", () => {
  achievementsMenu.style.display = "block";
  const achievementsBodyElement = achievementsMenu.querySelector(".achievements-body");
  if (achievementsBodyElement) {
    achievementsBodyElement.scrollTop = 0;
  }
});

closeAchievements.addEventListener("click", () => {
  achievementsMenu.style.display = "none";
});

statsButton.addEventListener("click", () => {
  statsMenu.style.display = "block";
  statsMenu.style.transform = "translate(-50%, -50%)";
  statsMenu.style.left = "50%";
  statsMenu.style.top = "50%";
});

closeStats.addEventListener("click", () => {
  statsMenu.style.display = "none";
});

const muteButton = document.getElementById("muteButton");

const savedVolume = localStorage.getItem("audioVolume");
if (savedVolume !== null) {
  audioVolume = parseFloat(savedVolume);
  previousVolume = audioVolume;
  audioSlider.value = audioVolume;
  updateAudioElements(audioVolume);
} else {
  updateAudioElements(audioVolume);
}
setSliderMutedState(audioVolume === 0);
updateAudioSliderUi();

audioSlider.addEventListener("input", () => {
  audioVolume = parseFloat(audioSlider.value);
  if (audioVolume === 0) {
    isMuted = true;
    setSliderMutedState(true);
  } else {
    isMuted = false;
    previousVolume = audioVolume;
    setSliderMutedState(false);
  }
  localStorage.setItem("audioVolume", audioVolume);
  updateAudioElements(audioVolume);
  updateAudioSliderUi();
});

muteButton.addEventListener("click", () => {
  isMuted = !isMuted;

  if (isMuted) {
    previousVolume = audioVolume;
    audioVolume = 0;
  } else {
    audioVolume = previousVolume;
  }

  audioSlider.value = audioVolume;
  localStorage.setItem("audioVolume", audioVolume);
  updateAudioElements(audioVolume);
  setSliderMutedState(isMuted);
  updateAudioSliderUi();
});

function updateAudioElements(volume) {
  const audioElements = document.querySelectorAll("audio");
  audioElements.forEach((audio) => (audio.volume = volume));
}

function setSliderMutedState(muted) {
  if (!audioSlider) {
    return;
  }

  audioSlider.classList.toggle("muted", Boolean(muted));
}

function updateAudioSliderUi() {
  if (!audioSlider) {
    return;
  }

  const value = Math.max(0, Math.min(1, parseFloat(audioSlider.value) || 0));
  const percentage = Math.round(value * 100);
  if (audioSliderValueLabel) {
    audioSliderValueLabel.textContent = `${percentage}%`;
  }

  const startColor = { r: 96, g: 0, b: 126 };
  const endColor = { r: 255, g: 165, b: 0 };
  const r = Math.round(startColor.r + (endColor.r - startColor.r) * value);
  const g = Math.round(startColor.g + (endColor.g - startColor.g) * value);
  const b = Math.round(startColor.b + (endColor.b - startColor.b) * value);
  const thumbColor = `rgb(${r}, ${g}, ${b})`;

  audioSlider.style.setProperty("--thumb-color", thumbColor);

  const trackColor = audioSlider.classList.contains("muted")
    ? "rgba(128, 96, 186, 0.75)"
    : thumbColor;

  audioSlider.style.background = `linear-gradient(90deg, ${trackColor} ${percentage}%, rgba(255, 255, 255, 0.12) ${percentage}%)`;
}

resetDataButton.addEventListener("click", () => {
  if (confirm("Are you sure you want to reset all data?")) {
    console.log("Data reset!");
    localStorage.clear();
    
    setTimeout(() => {
      localStorage.clear();
      location.reload();
      let playTime = 0;
    }, 100);
  }
});

const savedState = localStorage.getItem("autoRollEnabled");
if (savedState === "true") {
  startAutoRoll();
} else {
  stopAutoRoll();
}

autoRollButton.addEventListener("click", () => {
  if (autoRollInterval) {
    stopAutoRoll();
  } else {
    startAutoRoll();
  }
});

function startAutoRoll() {
  autoRollInterval = setInterval(() => {
    document.getElementById("rollButton").click();
  },400);
  autoRollButton.textContent = "Auto Roll: On";
  console.log("Rolling...");
  autoRollButton.classList.remove("off");
  autoRollButton.classList.add("on");
  localStorage.setItem("autoRollEnabled", "true");
}

function stopAutoRoll() {
  clearInterval(autoRollInterval);
  console.log("Stopped rolling");
  autoRollInterval = null;
  autoRollButton.textContent = "Auto Roll: Off";
  autoRollButton.classList.remove("on");
  autoRollButton.classList.add("off");
  localStorage.setItem("autoRollEnabled", "false");
}

updateAudioSliderUi();

const heartContainer = document.createElement('div');
document.body.appendChild(heartContainer);

function createHeart() {
    const heart = document.createElement('div');
    heart.classList.add('heart');
    heart.textContent = '🌊';
    heart.style.left = Math.random() * 100 + 'vw';
    heart.style.top = Math.random() * 100 + 'vh';
    heart.style.fontSize = Math.random() * 25 + 15 + 'px';

    heartContainer.appendChild(heart);

    setTimeout(() => {
        heart.remove();
    }, 1000);
}

setInterval(createHeart, 33);

const secretKey = 'ImpeachedGlazer';

document.getElementById('saveButton').addEventListener('click', () => {
  const data = JSON.stringify(localStorage);

  const encryptedData = CryptoJS.AES.encrypt(data, secretKey).toString();

  const blob = new Blob([encryptedData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'localStorageData.json';
  a.click();

  URL.revokeObjectURL(url);
});

function showStatusMessage(message, duration = 2000) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.classList.add('showStatus');

  setTimeout(() => {
      status.classList.remove('showStatus');
      setTimeout(() => (status.style.display = 'none'), 500);
  }, duration);
}

    let playTime = parseInt(localStorage.getItem('playTime')) || 0;
    
    const timerDisplay = document.getElementById('timer');

    function formatTime(seconds) {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return [
        hrs.toString().padStart(2, '0'),
        mins.toString().padStart(2, '0'),
        secs.toString().padStart(2, '0')
      ].join(':');
    }

    timerDisplay.textContent = formatTime(playTime);

    setInterval(() => {
      playTime++;
      timerDisplay.textContent = formatTime(playTime);
      localStorage.setItem('playTime', playTime);
      checkAchievements();
      updateAchievementsList();
    }, 1000);

document.getElementById('importButton').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const encryptedData = e.target.result;

          const bytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
          const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

          const importedData = JSON.parse(decryptedData);

          Object.keys(importedData).forEach(key => {
            localStorage.setItem(key, importedData[key]);
          });

                  showStatusMessage("Data imported successfully! Refreshing...", 1500);

                  setTimeout(() => {
                      location.reload();
                  }, 1500);
              } catch (error) {
                  showStatusMessage("Error: Invalid file format.");
              }
          };
          reader.readAsText(file);
      }
  });

  input.click();
});

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

document.getElementById("deleteAllUnder100Button")?.addEventListener("click", () => deleteByRarityBucket('under100'));
document.getElementById("deleteAllUnder1kButton")?.addEventListener("click", () => deleteByRarityBucket('under1k'));
document.getElementById("deleteAllUnder10kButton")?.addEventListener("click", () => deleteByRarityBucket('under10k'));
document.getElementById("deleteAllUnder100kButton")?.addEventListener("click", () => deleteByRarityBucket('under100k'));
document.getElementById("deleteAllUnder1mButton")?.addEventListener("click", () => deleteByRarityBucket('under1m'));
document.getElementById("deleteAllSpecialButton")?.addEventListener("click", () => deleteByRarityBucket('special'));

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
      'Firecracker [1 in 2,025]': 'eventTitle',
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
      'Silly Car :3 [1 in 1,000,000]': 'under10ms',
      'H1di [1 in 9,890,089]': 'under10m',
      'BlindGT [1 in 2,000,000/15th]': 'special',
      'MSFU [1 in 333/333rd]': 'special',
      'Orb [1 in 55,555/30th]': 'special',
      'Tuon [1 in 50,000]': 'under100k',
      'Heart [1 in ♡♡♡]': 'eventV',
      'Unfair [1 in ###]': 'under100k',
      'GD Addict [1 in ###]': 'under10k',
      'Qbear [1 in 35,555]': 'under100k',
      'Light [1 in 29,979]': 'under100k',
      'X1sta [1 in 230,444]': 'under1m',
      'sʜeɴvɪ✞∞ [1 in 77,777/7th]': 'special',
      'Easter Bunny [1 in 133,333]': 'eventE',
      'Easter Egg [1 in 13,333]': 'eventE',
      'Isekai ♫ Lo-Fi [1 in 3,000]': 'under10k',
      '『Equinox』 [1 in 2,500,000]': 'under10me',
      'Ginger [1 in 1,144,141]': 'under10m',
      'Wave [1 in 2,555]': 'eventS',
      'Scorching [1 in 7,923]': 'eventS',
      'Beach [1 in 12,555]': 'eventS',
      'Tidal Wave [1 in 25,500]': 'eventS'
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
  .getElementById("deleteAllLostSoulButton")
  .addEventListener("click", () => deleteAllByRarity("lostsBgImg"));
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
  .getElementById("deleteAllUnder1mButton")
  .addEventListener("click", () => {
    renderInventory();
    const raritiesUnder10k = [
      "impeachedBgImg",
      "celestialchorusBgImg",
      "x1staBgImg",
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
      'shenviiBgImg'
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

document.querySelectorAll(".cutsceneSkipBtb").forEach(button => {
  button.addEventListener("click", () => {
    button.classList.toggle("active");
    saveToggledStates();
  });
});


const canvas = document.getElementById('fireworksCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

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

function launchFirework() {
    const x = Math.random() * canvas.width;
    const targetY = Math.random() * canvas.height / 2;
    const color = colors[Math.floor(Math.random() * colors.length)];
    fireworks.push(new Firework(x, canvas.height, targetY, color));
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fireworks.forEach((firework, index) => {
        firework.update();
        firework.draw();
        if (firework.exploded && firework.particles.length === 0) {
            fireworks.splice(index, 1);
        }
    });
    requestAnimationFrame(animate);
}

setInterval(launchFirework, 9999);

animate();

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
          newAudio.volume = typeof audioVolume === "number" ? audioVolume : 1;
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
  }
}