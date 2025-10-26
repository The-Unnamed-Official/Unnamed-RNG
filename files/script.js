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

const EVENT_END_TIMESTAMP = 1762614000 * 1000;
const EVENT_DISCORD_TIMESTAMP_FULL = "<t:1762614000:f>";
const EVENT_DISCORD_TIMESTAMP_RELATIVE = "<t:1762614000:R>";
const EVENT_TIME_ZONE = "Europe/Berlin";

const POTION_TYPES = Object.freeze({
  LUCK: "luck",
  SPEED: "speed",
});

const POTION_STORAGE_KEY = "craftedPotions";
const ACTIVE_BUFFS_KEY = "activePotionBuffs";
const BUFFS_DISABLED_KEY = "buffsDisabled";
const BUFFS_PAUSE_TIMESTAMP_KEY = "buffsPausedAt";

const BUFF_ICON_MAP = Object.freeze({
  [POTION_TYPES.LUCK]: "files/images/LuckBuff.png",
  [POTION_TYPES.SPEED]: "files/images/SpeedBuff.png",
});

const BUFF_TOOLTIP_EFFECT_CLASS_MAP = Object.freeze({
  [POTION_TYPES.LUCK]: "buff-tooltip__effect--luck",
  [POTION_TYPES.SPEED]: "buff-tooltip__effect--speed",
});

const DESCENDED_TITLE_TYPE = "Descended Title [1 in ƐƐƐ]";
const DESCENDED_TITLE_CLASS = "destitBgImg";
const UNKNOWN_TITLE_TYPE = "UnKnOwN [1 in ᔦᔦᔦ]";
const UNKNOWN_TITLE_CLASS = "unknownBgImg";
const DESCENDED_POTION_ID = "descendentPotion";
const DESCENDED_POTION_REWARD_CHANCE = 1 / 333;
const UNKNOWN_TITLE_REWARD_CHANCE = 1 / 444;
const DESCENDED_CUTSCENE_TIMINGS = Object.freeze({
  GLITCH_MS: 1100,
  FLASH_MS: 3300,
  TOTAL_MS: 3500,
});
const DESCENDED_TITLE_DEFINITIONS = Object.freeze([
  Object.freeze({ type: DESCENDED_TITLE_TYPE, class: DESCENDED_TITLE_CLASS }),
  Object.freeze({ type: UNKNOWN_TITLE_TYPE, class: UNKNOWN_TITLE_CLASS }),
]);
const DESCENDED_TITLE_TYPE_SET = new Set(
  DESCENDED_TITLE_DEFINITIONS.map((definition) => definition.type)
);
const DESCENDED_TITLE_CLASS_SET = new Set(
  DESCENDED_TITLE_DEFINITIONS.map((definition) => definition.class)
);
const UNKNOWN_CUTSCENE_TIMINGS = Object.freeze({
  FADE_OUT_MS: 4400,
  TOTAL_MS: 5000,
});
const UNKNOWN_CUTSCENE_AUDIO_LEAD_MS = 4000;

function isDescendedTitleType(type) {
  return DESCENDED_TITLE_TYPE_SET.has(type);
}

function getDescendedDefinitionByType(type) {
  return DESCENDED_TITLE_DEFINITIONS.find((definition) => definition.type === type) || null;
}

function createDescendedRarityPayload(definition = null) {
  const resolvedDefinition = definition || DESCENDED_TITLE_DEFINITIONS[0];
  if (!resolvedDefinition) {
    return {
      type: DESCENDED_TITLE_TYPE,
      class: DESCENDED_TITLE_CLASS,
      titles: [DESCENDED_TITLE_TYPE],
    };
  }

  return {
    type: resolvedDefinition.type,
    class: resolvedDefinition.class,
    titles: [resolvedDefinition.type],
  };
}

let buffTooltipElement = null;
let buffTooltipNameElement = null;
let buffTooltipEffectElement = null;
let buffTooltipTimerElement = null;
let activeBuffTooltipCard = null;
let lastBuffPointerPosition = null;
let inventoryListHandlersInitialized = false;

function normalizeAchievementNameList(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((value) => typeof value === "string" && value.trim().length > 0);
}

const storedUnlockedAchievements = storage.get("unlockedAchievements", []);
let unlockedAchievementsCache = new Set(normalizeAchievementNameList(storedUnlockedAchievements));

const COLLECTOR_LUCK_TIERS = [
  { name: "Achievement Enthusiast", value: 100 },
  { name: "Nice...", value: 69 },
  { name: "Ultimate Collector", value: 50 },
  { name: "Achievement God", value: 33 },
  { name: "Achievement Addict", value: 30 },
  { name: "Achievement Hoarder", value: 20 },
  { name: "Achievement Collector", value: 10 },
];

const COLLECTOR_SPEED_TIERS = [
  { name: "Achievement Enthusiast", value: 100 },
  { name: "Nice...", value: 69 },
  { name: "Achievement God", value: 33 },
];

function ensureBuffTooltipElement() {
  if (buffTooltipElement) {
    return;
  }

  const tooltip = document.createElement("div");
  tooltip.id = "buffTooltip";
  tooltip.className = "buff-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.setAttribute("aria-hidden", "true");
  tooltip.innerHTML = `
    <div class="buff-tooltip__name"></div>
    <div class="buff-tooltip__effect"></div>
    <div class="buff-tooltip__timer"></div>
  `;

  document.body.appendChild(tooltip);

  buffTooltipElement = tooltip;
  buffTooltipNameElement = tooltip.querySelector(".buff-tooltip__name");
  buffTooltipEffectElement = tooltip.querySelector(".buff-tooltip__effect");
  buffTooltipTimerElement = tooltip.querySelector(".buff-tooltip__timer");
}

function hideBuffTooltip() {
  if (!buffTooltipElement) {
    return;
  }

  buffTooltipElement.classList.remove("buff-tooltip--visible");
  buffTooltipElement.classList.remove("buff-tooltip--below");
  buffTooltipElement.classList.remove("buff-tooltip--disabled");
  buffTooltipElement.setAttribute("aria-hidden", "true");
  activeBuffTooltipCard = null;
}

function positionBuffTooltip(event, card) {
  if (!buffTooltipElement) {
    return;
  }

  const cardRect = card.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const anchorX = cardRect.left + cardRect.width / 2;

  const tooltipWidth = buffTooltipElement.offsetWidth;
  const halfWidth = tooltipWidth / 2;
  const clampedX = Math.max(
    halfWidth + 8,
    Math.min(viewportWidth - halfWidth - 8, anchorX)
  );

  buffTooltipElement.style.left = `${clampedX - halfWidth}px`;

  const tooltipHeight = buffTooltipElement.offsetHeight;
  let top = cardRect.top - tooltipHeight - 14;
  let below = false;

  if (top < 8) {
    top = cardRect.bottom + 14;
    below = true;
  }

  buffTooltipElement.style.top = `${top}px`;
  buffTooltipElement.classList.toggle("buff-tooltip--below", below);
}

function showBuffTooltip(card, event) {
  ensureBuffTooltipElement();
  if (!buffTooltipElement) {
    return;
  }

  const { buffName = "", buffEffect = "", buffTimer = "", buffType = "", buffDisabled = "false" } = card.dataset;

  buffTooltipNameElement.textContent = buffName;
  buffTooltipEffectElement.textContent = buffEffect;
  buffTooltipTimerElement.textContent = buffDisabled === "true" ? `${buffTimer} (Disabled)` : buffTimer;

  buffTooltipEffectElement.className = "buff-tooltip__effect";
  const mappedClass = BUFF_TOOLTIP_EFFECT_CLASS_MAP[buffType];
  if (mappedClass) {
    buffTooltipEffectElement.classList.add(mappedClass);
  }

  buffTooltipElement.classList.toggle("buff-tooltip--disabled", buffDisabled === "true");
  buffTooltipElement.setAttribute("aria-hidden", "false");
  buffTooltipElement.classList.add("buff-tooltip--visible");

  positionBuffTooltip(event, card);
}

function handleBuffCardPointerEnter(event) {
  const card = event.currentTarget;
  activeBuffTooltipCard = card;
  if (Number.isFinite(event.clientX)) {
    lastBuffPointerPosition = { x: event.clientX, y: event.clientY };
  }
  showBuffTooltip(card, event);
}

function handleBuffCardPointerMove(event) {
  if (!activeBuffTooltipCard || activeBuffTooltipCard !== event.currentTarget) {
    return;
  }

  if (Number.isFinite(event.clientX)) {
    lastBuffPointerPosition = { x: event.clientX, y: event.clientY };
  }
  positionBuffTooltip(event, event.currentTarget);
}

function handleBuffCardPointerLeave(event) {
  if (activeBuffTooltipCard === event.currentTarget) {
    activeBuffTooltipCard = null;
  }

  lastBuffPointerPosition = null;
  hideBuffTooltip();
}

function handleBuffCardFocus(event) {
  const card = event.currentTarget;
  activeBuffTooltipCard = card;
  lastBuffPointerPosition = null;
  showBuffTooltip(card, null);
}

function handleBuffCardBlur(event) {
  if (activeBuffTooltipCard === event.currentTarget) {
    activeBuffTooltipCard = null;
  }

  lastBuffPointerPosition = null;
  hideBuffTooltip();
}

function restoreBuffTooltipForPointer() {
  if (!lastBuffPointerPosition) {
    return;
  }

  const { x, y } = lastBuffPointerPosition;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return;
  }

  const element = document.elementFromPoint(x, y);
  if (!element) {
    return;
  }

  const card = element.closest(".buff-card");
  if (!card) {
    return;
  }

  activeBuffTooltipCard = card;
  showBuffTooltip(card, { clientX: x });
}

const POTION_DEFINITIONS = [
  {
    id: "luckyPotion",
    name: "Lucky Potion",
    image: "files/images/LuckyPotion.png",
    type: POTION_TYPES.LUCK,
    effectPercent: 50,
    durationSeconds: 60,
    craftCost: {
      classes: { commonBgImg: 30, rareBgImg: 20, epicBgImg: 10, legendaryBgImg: 5, unstoppableBgImg: 1 },
      titles: [],
    },
  },
  {
    id: "fortuneSpoid1",
    name: "Fortune Spoid I",
    image: "files/images/Fortune1Spoid.png",
    type: POTION_TYPES.LUCK,
    effectPercent: 50,
    durationSeconds: 120,
    craftCost: {
      classes: { commonBgImg: 50, rareBgImg: 35, impossibleBgImg: 20, poweredBgImg: 10, unstoppableBgImg: 2 },
      titles: [],
      potions: { luckyPotion: 2 },
    },
  },
  {
    id: "fortuneSpoid2",
    name: "Fortune Spoid II",
    image: "files/images/Fortune2Spoid.png",
    type: POTION_TYPES.LUCK,
    effectPercent: 75,
    durationSeconds: 240,
    craftCost: {
      classes: { commonBgImg: 80, rareBgImg: 60, toxBgImg: 35, flickerBgImg: 15, unstoppableBgImg: 5, spectralBgImg: 1 },
      titles: [],
      potions: { luckyPotion: 3 },
    },
  },
  {
    id: "fortuneSpoid3",
    name: "Fortune Spoid III",
    image: "files/images/Fortune3spoid.png",
    type: POTION_TYPES.LUCK,
    effectPercent: 100,
    durationSeconds: 300,
    craftCost: {
      classes: { commonBgImg: 110, rareBgImg: 85, plabreBgImg: 30, unstoppableBgImg: 10, wanspiBgImg: 8, curartBgImg: 6, shadBgImg: 1 },
      titles: [],
      potions: { luckyPotion: 4 },
    },
  },
  {
    id: "fortunePotion1",
    name: "Fortune Potion I",
    image: "files/images/Fortune1Potion.png",
    type: POTION_TYPES.LUCK,
    effectPercent: 150,
    durationSeconds: 300,
    craftCost: {
      classes: { commonBgImg: 135, legendaryBgImg: 100, solarpowerBgImg: 80, belivBgImg: 45, unstoppableBgImg: 10, gargBgImg: 8, memBgImg: 5, isekaiBgImg: 2 },
      titles: [],
      potions: { luckyPotion: 8 },
    },
  },
  {
    id: "fortunePotion2",
    name: "Fortune Potion II",
    image: "files/images/Fortune2Potion.png",
    type: POTION_TYPES.LUCK,
    effectPercent: 200,
    durationSeconds: 420,
    craftCost: {
      classes: { commonBgImg: 150, poweredBgImg: 110, flickerBgImg: 90, unstoppableBgImg: 20, memBgImg: 15, oblBgImg: 11, froBgImg: 7, isekailofiBgImg: 1  },
      titles: [],
      potions: { luckyPotion: 12, fortuneSpoid1: 1 },
    },
  },
  {
    id: "fortunePotion3",
    name: "Fortune Potion III",
    image: "files/images/Fortune3Potion.png",
    type: POTION_TYPES.LUCK,
    effectPercent: 300,
    durationSeconds: 540,
    craftCost: {
      classes: { commonBgImg: 190, legendaryBgImg: 160, plabreBgImg: 65, unstoppableBgImg: 30, mysBgImg: 20, forgBgImg: 8, fearBgImg: 2 },
      titles: [],
      potions: { luckyPotion: 18, fortuneSpoid1: 2, fortuneSpoid2: 1 },
    },
  },
  {
    id: "basicPotion",
    name: "Basic Potion",
    image: "files/images/BasicPotion.png",
    buffImage: "files/images/BasicBuff.png",
    type: POTION_TYPES.LUCK,
    effectPercent: 5000,
    durationSeconds: 31536000,
    durationDisplay: "Duration: Next Roll",
    consumeOnRoll: true,
    disableWithToggle: true,
    craftCost: {
      classes: { commonBgImg: 400, rareBgImg: 250, unstoppableBgImg: 15, fearBgImg: 1, lostsBgImg: 1 },
      titles: [],
      potions: { luckyPotion: 30, fortuneSpoid1: 3 },
    },
  },
  {
    id: "decentPotion",
    name: "Decent Potion",
    image: "files/images/DecentPotion.png",
    buffImage: "files/images/DecentBuff.png",
    type: POTION_TYPES.LUCK,
    effectPercent: 32000,
    durationSeconds: 31536000,
    durationDisplay: "Duration: Next Roll",
    consumeOnRoll: true,
    disableWithToggle: true,
    craftCost: {
      classes: { commonBgImg: 600, rareBgImg: 300, unstoppableBgImg: 35, fearBgImg: 2, lostsBgImg: 2 },
      titles: [],
      potions: { luckyPotion: 40, fortuneSpoid1: 4 },
    },
  },
  {
    id: "bloodyPotion",
    name: "Bloody Potion",
    image: "files/images/BloodyPotion.png",
    buffImage: "files/images/BloodyBuff.png",
    type: POTION_TYPES.LUCK,
    effectPercent: 66666,
    durationSeconds: 31536000,
    durationDisplay: "Duration: Next Roll",
    consumeOnRoll: true,
    disableWithToggle: true,
    eventExclusive: "Halloween Event Exclusive",
    craftCost: {
      classes: {
        commonBgImg: 800,
        rareBgImg: 500,
        unstoppableBgImg: 45,
        fearBgImg: 3,
      },
      titles: [],
      potions: { luckyPotion: 50, fortuneSpoid1: 5, basicPotion: 1,  },
    },
  },
  {
    id: "pumpkinPotion",
    name: "Pumpkin Potion",
    image: "files/images/PumpkinPotion.png",
    buffImage: "files/images/PumpkinBuff.png",
    type: POTION_TYPES.LUCK,
    effectPercent: 333333,
    durationSeconds: 31536000,
    durationDisplay: "Duration: Next Roll",
    consumeOnRoll: true,
    disableWithToggle: true,
    eventExclusive: "Halloween Event Exclusive",
    craftCost: {
      classes: {
        commonBgImg: 900,
        rareBgImg: 600,
        legendaryBgImg: 100,
        unstoppableBgImg: 50,
        fearBgImg: 4,
      },
      titles: [],
      potions: { luckyPotion: 75, fortuneSpoid1: 7, basicPotion: 2 },
    },
  },
  {
    id: DESCENDED_POTION_ID,
    name: "Descendent Potion",
    image: "files/images/DescendentPotion.png",
    buffImage: "files/images/DescendentBuff.png",
    type: POTION_TYPES.LUCK,
    effectPercent: 500000,
    durationSeconds: 31536000,
    durationDisplay: "Duration: Next Roll",
    consumeOnRoll: true,
    disableWithToggle: true,
    craftCost: {
      classes: {
        commonBgImg: 1000,
        rareBgImg: 700,
        legendaryBgImg: 200,
        unstoppableBgImg: 70,
        memBgImg: 30,
        oblBgImg: 20,
        mysBgImg: 15,
      },
      titles: [],
      potions: { luckyPotion: 90, fortuneSpoid1: 2, fortuneSpoid2: 1, basicPotion: 2 },
    },
  },
  {
    id: "speedPotion",
    name: "Speed Potion",
    image: "files/images/SpeedPotion.png",
    type: POTION_TYPES.SPEED,
    effectPercent: 25,
    durationSeconds: 60,
    craftCost: {
      classes: { commonBgImg: 55, rareBgImg: 33, epicBgImg: 22, legendaryBgImg: 11, unstoppableBgImg: 4 },
      titles: [],
    },
  },
  {
    id: "hasteSpoid1",
    name: "Haste Spoid I",
    image: "files/images/Haste1Spoid.png",
    type: POTION_TYPES.SPEED,
    effectPercent: 25,
    durationSeconds: 120,
    craftCost: {
      classes: { commonBgImg: 80, rareBgImg: 55, impossibleBgImg: 35, poweredBgImg: 20, unstoppableBgImg: 9 },
      titles: [],
    },
  },
  {
    id: "hasteSpoid2",
    name: "Haste Spoid II",
    image: "files/images/Haste2Spoid.png",
    type: POTION_TYPES.SPEED,
    effectPercent: 40,
    durationSeconds: 180,
    craftCost: {
      classes: { commonBgImg: 105, rareBgImg: 80, toxBgImg: 45, flickerBgImg: 25, unstoppableBgImg: 14, spectralBgImg: 10 },
      titles: [],
    },
  },
  {
    id: "hasteSpoid3",
    name: "Haste Spoid III",
    image: "files/images/Haste3spoid.png",
    type: POTION_TYPES.SPEED,
    effectPercent: 65,
    durationSeconds: 240,
    craftCost: {
      classes: { commonBgImg: 135, rareBgImg: 105, plabreBgImg: 55, unstoppableBgImg: 24, mysBgImg: 15, samuraiBgImg: 10 },
      titles: [],
    },
  },
  {
    id: "hastePotion1",
    name: "Haste Potion I",
    image: "files/images/Haste1Potion.png",
    type: POTION_TYPES.SPEED,
    effectPercent: 65,
    durationSeconds: 360,
    craftCost: {
      classes: { commonBgImg: 155, legendaryBgImg: 115, solarpowerBgImg: 95, belivBgImg: 55, unstoppableBgImg: 14, gargBgImg: 13, contBgImg: 5, lostsBgImg: 1 },
      titles: [],
    },
  },
  {
    id: "hastePotion2",
    name: "Haste Potion II",
    image: "files/images/Haste2Potion.png",
    type: POTION_TYPES.SPEED,
    effectPercent: 100,
    durationSeconds: 420,
    craftCost: {
      classes: { commonBgImg: 185, poweredBgImg: 135, flickerBgImg: 105, unstoppableBgImg: 29, memBgImg: 30, oblBgImg: 20, froBgImg: 15, starfallBgImg: 2 },
      titles: [],
    },
  },
  {
    id: "hastePotion3",
    name: "Haste Potion III",
    image: "files/images/Haste3Potion.png",
    type: POTION_TYPES.SPEED,
    effectPercent: 150,
    durationSeconds: 600,
    craftCost: {
      classes: { commonBgImg: 252, legendaryBgImg: 181, plabreBgImg: 77, unstoppableBgImg: 49, specBgImg: 30, phaBgImg: 10, nighBgImg: 2, voiBgImg: 1 },
      titles: [],
    },
  },
];

const POTION_TRANSACTION_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "potionTransactionStarter",
    name: "Supporter Starter Bundle",
    priceUsd: 1,
    description:
      "Jump-start your potion reserves with a massive infusion of core brews. Limited-time offer: your first purchase this week is free!",
    rewards: Object.freeze({
      potions: Object.freeze({
        luckyPotion: 1000,
        basicPotion: 500,
        decentPotion: 300,
      }),
    }),
    bannerImage: "files/images/supportBundleBanner.png",
    maxPurchases: 10,
    limitLabel: "Max 10 purchases",
    limitReachedActionLabel: "Limit Reached",
    promotion: Object.freeze({
      maxUses: 1,
      checkoutUrl: "https://buy.stripe.com/9B6fZj8QJfnF7jp2VK3AY02",
      priceLabel: "Free (Limited Week)",
      actionLabel: "Claim for Free",
      badgeText: "First purchase free!",
      usedBadgeText: "Free claim used",
    }),
  }),
  Object.freeze({
    id: "potionTransactionDescended",
    name: "Descended Power Bundle",
    priceUsd: 2,
    description: "Secure a stockpile of top-tier Halloween brews for your next session.",
    rewards: Object.freeze({
      potions: Object.freeze({
        [DESCENDED_POTION_ID]: 130,
        bloodyPotion: 100,
        pumpkinPotion: 80,
      }),
    }),
    bannerImage: "files/images/descendedBundleBanner.png",
    maxPurchases: 3,
    limitLabel: "Max 3 purchases",
    limitReachedActionLabel: "Limit Reached",
  }),
  Object.freeze({
    id: "potionTransactionHalloweenFrights",
    name: "Halloween Frights Bundle",
    priceUsd: 0.3,
    description:
      "Celebrate Halloween with a terrifyingly generous stash of frightening brews and rare drops.",
    rewards: Object.freeze({
      potions: Object.freeze({
        bloodyPotion: 50,
        pumpkinPotion: 30,
      }),
    }),
    bannerImage: "files/images/halloweenBundleBanner.png",
    maxPurchases: 2,
    limitLabel: "Max 2 purchases",
    limitReachedActionLabel: "Limit Reached",
  }),
  Object.freeze({
    id: "potionTransactionHasty",
    name: "Hasty Bundle",
    priceUsd: 1,
    description:
      "Begin your quick rolling spree with Titles to explore!",
    rewards: Object.freeze({
      potions: Object.freeze({
        speedPotion: 1000,
        hasteSpoid1: 800,
        hasteSpoid2: 600,
        hastePotion1: 400,
        hastePotion2: 200,
      }),
    }),
    bannerImage: "files/images/hastyBundleBanner.png",
    maxPurchases: 10,
    limitLabel: "Max 10 purchases",
    limitReachedActionLabel: "Limit Reached",
    promotion: Object.freeze({
      maxUses: 1,
      checkoutUrl: "https://buy.stripe.com/14AaEZ1oh4J1cDJ67W3AY05",
      priceLabel: "Free (Limited Week)",
      actionLabel: "Claim for Free",
      badgeText: "First purchase free!",
      usedBadgeText: "Free claim used",
    }),
  }),
]);

const POTION_TRANSACTION_CHECKOUT_URLS = Object.freeze({
  potionTransactionStarter: "https://buy.stripe.com/28EeVfd6Z4J1dHN2VK3AY00",
  potionTransactionDescended: "https://buy.stripe.com/9B69AV0kd3EXdHN53S3AY01",
  potionTransactionHalloweenFrights: "https://buy.stripe.com/6oU6oJeb33EX5bh0NC3AY03",
  potionTransactionHasty: "https://buy.stripe.com/14A28t2slgrJ5bh9k83AY06",
});

const POTION_TRANSACTION_PURCHASE_COUNTS_KEY = "potionTransactionPurchaseCounts";

function normalizePotionTransactionPurchaseCounts(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const normalized = {};

  Object.entries(raw).forEach(([transactionId, value]) => {
    if (typeof transactionId !== "string" || !transactionId) {
      return;
    }

    const parsed = Math.max(0, Math.trunc(Number(value)));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    normalized[transactionId] = parsed;
  });

  return normalized;
}

let potionTransactionPurchaseCounts = normalizePotionTransactionPurchaseCounts(
  storage.get(POTION_TRANSACTION_PURCHASE_COUNTS_KEY, {}),
);

function writePotionTransactionPurchaseCounts(nextCounts) {
  const payload = normalizePotionTransactionPurchaseCounts(nextCounts);
  potionTransactionPurchaseCounts = payload;
  if (Object.keys(payload).length > 0) {
    storage.set(POTION_TRANSACTION_PURCHASE_COUNTS_KEY, payload);
  } else {
    storage.remove(POTION_TRANSACTION_PURCHASE_COUNTS_KEY);
  }
}

function getPotionTransactionPurchaseCount(transactionId) {
  if (typeof transactionId !== "string" || !transactionId) {
    return 0;
  }

  return potionTransactionPurchaseCounts[transactionId] || 0;
}

function setPotionTransactionPurchaseCount(transactionId, count) {
  if (typeof transactionId !== "string" || !transactionId) {
    return;
  }

  const parsed = Math.max(0, Math.trunc(Number(count)));
  if (!Number.isFinite(parsed)) {
    return;
  }

  const nextCounts = { ...potionTransactionPurchaseCounts };
  if (parsed <= 0) {
    delete nextCounts[transactionId];
  } else {
    nextCounts[transactionId] = parsed;
  }

  writePotionTransactionPurchaseCounts(nextCounts);
}

function incrementPotionTransactionPurchaseCount(transactionId) {
  if (typeof transactionId !== "string" || !transactionId) {
    return;
  }

  const current = getPotionTransactionPurchaseCount(transactionId);
  setPotionTransactionPurchaseCount(transactionId, current + 1);
}

function getPotionTransactionDefinition(transactionId) {
  if (typeof transactionId !== "string" || !transactionId) {
    return null;
  }

  return (
    POTION_TRANSACTION_DEFINITIONS.find((definition) => definition.id === transactionId) || null
  );
}

function getPotionTransactionBaseCheckoutUrl(transactionId) {
  if (typeof transactionId !== "string" || !transactionId) {
    return null;
  }

  return POTION_TRANSACTION_CHECKOUT_URLS[transactionId] || null;
}

function getPotionTransactionState(transaction) {
  if (!transaction || typeof transaction.id !== "string") {
    return null;
  }

  const purchaseCount = getPotionTransactionPurchaseCount(transaction.id);
  const maxPurchasesRaw = transaction.maxPurchases;
  const maxPurchases = Number.isFinite(maxPurchasesRaw)
    ? Math.max(0, Math.trunc(maxPurchasesRaw))
    : null;
  const remainingPurchases =
    maxPurchases !== null ? Math.max(0, maxPurchases - purchaseCount) : null;
  const limitReached = Boolean(remainingPurchases !== null && remainingPurchases <= 0);

  const promotion = transaction.promotion || null;
  const promoMaxUses = promotion && Number.isFinite(promotion.maxUses)
    ? Math.max(0, Math.trunc(promotion.maxUses))
    : 0;
  const promoActive = Boolean(
    promotion && purchaseCount < promoMaxUses && typeof promotion.checkoutUrl === "string"
  );

  let basePriceLabel = "";
  if (typeof transaction.priceDisplay === "string" && transaction.priceDisplay.trim()) {
    basePriceLabel = transaction.priceDisplay.trim();
  } else if (Number.isFinite(transaction.priceUsd)) {
    basePriceLabel = formatUsd(transaction.priceUsd);
  }
  if (!basePriceLabel) {
    basePriceLabel = "See checkout";
  }

  const priceLabel = promoActive
    ? promotion.priceLabel || "Free"
    : basePriceLabel;

  const checkoutUrl = promoActive
    ? promotion.checkoutUrl || null
    : transaction.checkoutUrl || getPotionTransactionBaseCheckoutUrl(transaction.id);

  const actionLabel = limitReached
    ? transaction.limitReachedActionLabel || "Limit Reached"
    : promoActive
    ? promotion.actionLabel || `Claim for ${priceLabel}`
    : transaction.actionLabel || `Purchase for ${priceLabel}`;

  const badges = [];

  if (maxPurchases !== null) {
    const limitText =
      typeof transaction.limitLabel === "string" && transaction.limitLabel.trim()
        ? transaction.limitLabel.trim()
        : "Limited stock";
    const counterText = `${remainingPurchases}/${maxPurchases} left`;
    badges.push({ type: "limit", text: limitText, counterText });
  }

  if (promotion) {
    if (promoActive && typeof promotion.badgeText === "string" && promotion.badgeText.trim()) {
      badges.push({ type: "promo", text: promotion.badgeText.trim() });
    } else if (
      !promoActive &&
      purchaseCount > 0 &&
      typeof promotion.usedBadgeText === "string" &&
      promotion.usedBadgeText.trim()
    ) {
      badges.push({ type: "promo", text: promotion.usedBadgeText.trim() });
    }
  }

  const actionDisabled = limitReached || !checkoutUrl;

  return {
    purchaseCount,
    maxPurchases,
    remainingPurchases,
    limitReached,
    promoActive,
    priceLabel,
    checkoutUrl,
    actionLabel,
    actionDisabled,
    badges,
  };
}

const PENDING_POTION_TRANSACTION_STORAGE_KEY = "pendingPotionTransactionId";
const PENDING_POTION_TRANSACTION_METADATA_KEY = "pendingPotionTransactionMeta";
const PENDING_POTION_TRANSACTION_MAX_AGE_MS = 15 * 60 * 1000;

const USD_CURRENCY_FORMATTER =
  typeof Intl !== "undefined" && typeof Intl.NumberFormat === "function"
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null;

let potionTransactionStatusTimeoutId = null;
let potionTransactionStatusPollIntervalId = null;
let potionTransactionDialogElement = null;
let potionTransactionDialogMessageElement = null;
let potionTransactionDialogSummaryElement = null;
let potionTransactionDialogConfirmButton = null;
let potionTransactionDialogPreviousFocus = null;
let pendingPotionTransaction = null;
let potionTransactionDialogKeyHandlerRegistered = false;
const POTION_TRANSACTION_POPUP_REMINDER_STORAGE_KEY =
  "potionTransactionPopupReminderDismissed";

let hasDismissedPotionTransactionPopupReminder = Boolean(
  storage.get(POTION_TRANSACTION_POPUP_REMINDER_STORAGE_KEY, false)
);

function markPotionTransactionPopupReminderDismissed() {
  if (hasDismissedPotionTransactionPopupReminder) {
    return;
  }

  hasDismissedPotionTransactionPopupReminder = true;
  storage.set(POTION_TRANSACTION_POPUP_REMINDER_STORAGE_KEY, true);
}

const POTION_SPAWN_CONFIGS = [
  {
    potionId: "luckyPotion",
    minDelayMs: 5 * 60 * 1000,
    maxDelayMs: 7 * 60 * 1000,
    lifespanMs: 45000,
    rareSpawns: [
      { potionId: "fortuneSpoid1", chance: 0.1 },
      { potionId: "fortuneSpoid2", chance: 0.01 },
      { potionId: "basicPotion", chance: 0.0002 },
      { potionId: "decentPotion", chance: 0.0001 },
    ],
  },
  {
    potionId: "speedPotion",
    minDelayMs: 5 * 60 * 1000,
    maxDelayMs: 7 * 60 * 1000,
    lifespanMs: 45000,
    rareSpawns: [
      { potionId: "hasteSpoid1", chance: 0.1 },
      { potionId: "hasteSpoid2", chance: 0.01 },
      { potionId: "basicPotion", chance: 0.0002 },
      { potionId: "decentPotion", chance: 0.0001 },
    ],
  },
];

const EQUINOX_RARITY_CLASS = "equinoxBgImg";
let equinoxPulseActive = false;
let pendingEquinoxPulseState = null;

let buffsDisabled = Boolean(storage.get(BUFFS_DISABLED_KEY, false));
let buffPauseStart = null;

function syncBuffPauseState() {
  const storedPauseTimestamp = storage.get(BUFFS_PAUSE_TIMESTAMP_KEY, null);
  let parsedPause = Number.isFinite(storedPauseTimestamp) ? storedPauseTimestamp : null;

  if (!buffsDisabled) {
    if (parsedPause !== null) {
      storage.remove(BUFFS_PAUSE_TIMESTAMP_KEY);
    }
    buffPauseStart = null;
    return;
  }

  if (parsedPause === null) {
    parsedPause = Date.now();
    storage.set(BUFFS_PAUSE_TIMESTAMP_KEY, parsedPause);
  }

  buffPauseStart = parsedPause;
}

syncBuffPauseState();

let potionInventory = normalizePotionInventory(storage.get(POTION_STORAGE_KEY, {}));
let activeBuffs = normalizeActiveBuffs(storage.get(ACTIVE_BUFFS_KEY, []));
let buffUpdateIntervalId = null;
const potionSpawnTimers = new Map();

function generateInventoryRecordId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `inv_${timePart}_${randomPart}`;
}

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

function initEventCountdown() {
  const countdownElement = byId("eventCountdown");
  if (!countdownElement) {
    return;
  }

  const eventDate = new Date(EVENT_END_TIMESTAMP);

  let absoluteLabel = eventDate.toLocaleString();
  try {
    absoluteLabel = eventDate.toLocaleString(undefined, {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: EVENT_TIME_ZONE,
    });
  } catch (error) {
  }

  const segmentsFor = (diffMs) => {
    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days > 0) {
      parts.push(`${days}d`);
    }
    if (days > 0 || hours > 0) {
      parts.push(`${hours}h`);
    }
    if (days > 0 || hours > 0 || minutes > 0) {
      parts.push(`${minutes}m`);
    }
    parts.push(`${seconds}s`);

    return parts.join(" ");
  };

  let intervalId = null;

  const render = () => {
    const now = Date.now();
    const diffMs = EVENT_END_TIMESTAMP - now;

    if (diffMs <= 0) {
      countdownElement.textContent = "Ending event!";
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      return;
    }

    const remainingLabel = segmentsFor(diffMs);
    countdownElement.textContent = `Ends in ${remainingLabel}`;
  };

  render();
  intervalId = setInterval(render, 1000);
}

let inventory = [];
let currentPage = 1;
const itemsPerPage = 10;
let inventorySearchQuery = "";
let filteredInventoryLength = 0;
const INVENTORY_SORT_MODES = Object.freeze({
  DEFAULT: "default",
  LOCKED: "locked",
  RARITY: "rarity",
});
const INVENTORY_SORT_MODE_KEY = "inventorySortMode";
const storedInventorySortMode = storage.get(
  INVENTORY_SORT_MODE_KEY,
  INVENTORY_SORT_MODES.DEFAULT
);
let inventorySortMode = normalizeInventorySortMode(storedInventorySortMode);
if (inventorySortMode !== storedInventorySortMode) {
  if (inventorySortMode === INVENTORY_SORT_MODES.DEFAULT) {
    storage.remove(INVENTORY_SORT_MODE_KEY);
  } else {
    storage.set(INVENTORY_SORT_MODE_KEY, inventorySortMode);
  }
}
let rollCount = parseInt(localStorage.getItem("rollCount")) || 0;
let rollCount1 = parseInt(localStorage.getItem("rollCount1")) || 0;
const BASE_COOLDOWN_TIME = 500;
let cooldownTime = BASE_COOLDOWN_TIME;
let equippedItem = normalizeEquippedItemRecord(storage.get("equippedItem", null));
let currentAudio = null;
let isChangeEnabled = true;
let autoRollInterval = null;
let autoRollActive = false;
let autoRollLastExecution = null;
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
let skipCutsceneHalloween25 = true;
let cooldownBuffActive = cooldownTime < BASE_COOLDOWN_TIME;
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
let pendingRollLuckValue = null;
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
let rollButtonManualCooldownUntil = 0;
let rollButtonManualEnableTimeoutId = null;

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

const POTION_RARITY_LABELS = {
  commonBgImg: "Common Titles",
  rareBgImg: "Rare Titles",
  epicBgImg: "Epic Titles",
  legendaryBgImg: "Legendary Titles",
  impossibleBgImg: "Impossible Titles",
  poweredBgImg: "Powered Titles",
  toxBgImg: "Toxic Titles",
  flickerBgImg: "Flicker Titles",
  solarpowerBgImg: "Solarpower Titles",
  belivBgImg: "Believer Titles",
  plabreBgImg: "Planet Breaker Titles",
  wanspiBgImg: "Wandering Spirit Titles",
  spectralBgImg: "Spectral Whisper Titles",
  memBgImg: "Memory Titles",
  oblBgImg: "Oblivion Titles",
  froBgImg: "Frozen Fate Titles",
  mysBgImg: "Mysterious Echo Titles",
  forgBgImg: "Forgotten Whisper Titles",
  curartBgImg: "Cursed Artifact Titles",
  shadBgImg: "Shadow Veil Titles",
  fearBgImg: "Fear Titles",
  unstoppableBgImg: "Unstoppable Titles",
  gargBgImg: "Gargantua Titles",
  isekaiBgImg: "Isekai Titles",
  isekailofiBgImg: "Isekai ♫ Lo-Fi Titles",
  emerBgImg: "Emergencies Titles",
  contBgImg: "Contortions Titles",
  lostsBgImg: "Lost Soul Titles",
  samuraiBgImg: "Samurai Titles",
  frightBgImg: "Fright Titles",
  specBgImg: "Spectral Glare Titles",
  phaBgImg: "Phantom Stride Titles",
  starfallBgImg: "Starfall Titles",
  nighBgImg: "Nightfall Titles",
  voiBgImg: "Void Walker Titles",
};

function getBuffIconForType(type) {
  return BUFF_ICON_MAP[type] || "";
}

function normalizePotionInventory(raw) {
  const result = {};
  const source = raw && typeof raw === "object" ? raw : {};

  POTION_DEFINITIONS.forEach(({ id }) => {
    const value = source[id];
    const parsed = Number.parseInt(value, 10);
    result[id] = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  });

  return result;
}

function getPotionDefinition(id) {
  if (typeof id !== "string") {
    return null;
  }

  return POTION_DEFINITIONS.find((potion) => potion.id === id) || null;
}

function getPotionCount(id) {
  return Number.isFinite(potionInventory[id]) ? potionInventory[id] : 0;
}

function savePotionInventory() {
  storage.set(POTION_STORAGE_KEY, potionInventory);
}

function adjustPotionCount(id, delta) {
  const potion = getPotionDefinition(id);
  if (!potion || !Number.isFinite(delta) || delta === 0) {
    return;
  }

  const current = getPotionCount(id);
  const next = Math.max(0, current + Math.trunc(delta));
  if (next === current) {
    return;
  }

  potionInventory = { ...potionInventory, [id]: next };
  savePotionInventory();
}

function summarizeInventoryForPotions(lockedItems = getLockedItemsMap()) {
  const classCounts = {};
  const titleCounts = {};
  const potionCounts = {};

  inventory.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    if (lockedItems && lockedItems[item.title]) {
      return;
    }

    if (item.rarityClass) {
      classCounts[item.rarityClass] = (classCounts[item.rarityClass] || 0) + 1;
    }

    if (item.title) {
      titleCounts[item.title] = (titleCounts[item.title] || 0) + 1;
    }
  });

  POTION_DEFINITIONS.forEach((potion) => {
    if (!potion || !potion.id) {
      return;
    }
    const count = getPotionCount(potion.id);
    if (count > 0) {
      potionCounts[potion.id] = count;
    }
  });

  return { classCounts, titleCounts, potionCounts };
}

function hasSufficientClassResources(costClasses = {}, summary) {
  return Object.entries(costClasses).every(([rarityClass, required]) => {
    if (!Number.isFinite(required) || required <= 0) {
      return true;
    }

    return (summary.classCounts[rarityClass] || 0) >= required;
  });
}

function hasSufficientTitleResources(costTitles = [], summary) {
  return costTitles.every((entry) => {
    if (!entry || typeof entry !== "object") {
      return true;
    }

    const { title, count } = entry;
    if (!title || !Number.isFinite(count) || count <= 0) {
      return true;
    }

    return (summary.titleCounts[title] || 0) >= count;
  });
}

function hasSufficientPotionResources(costPotions = {}, summary) {
  const counts = (summary && summary.potionCounts) || {};
  return Object.entries(costPotions).every(([potionId, required]) => {
    if (!potionId || !Number.isFinite(required) || required <= 0) {
      return true;
    }

    return (counts[potionId] || 0) >= required;
  });
}

function canCraftPotion(potion, summary = summarizeInventoryForPotions()) {
  if (!potion || typeof potion !== "object") {
    return false;
  }

  const cost = potion.craftCost || {};
  const costClasses = cost.classes || {};
  const costTitles = Array.isArray(cost.titles) ? cost.titles : [];
  const costPotions = cost.potions || {};

  return hasSufficientClassResources(costClasses, summary)
    && hasSufficientTitleResources(costTitles, summary)
    && hasSufficientPotionResources(costPotions, summary);
}

function removeItemsForPotion(potion, lockedItems = getLockedItemsMap()) {
  if (!potion) {
    return { inventoryChanged: false, potionsChanged: false };
  }

  const cost = potion.craftCost || {};
  const indicesToRemove = new Set();

  const markIndicesForClass = (rarityClass, count) => {
    if (!Number.isFinite(count) || count <= 0 || !rarityClass) {
      return;
    }

    let remaining = count;
    for (let index = 0; index < inventory.length && remaining > 0; index += 1) {
      const item = inventory[index];
      if (!item || item.rarityClass !== rarityClass || lockedItems[item.title]) {
        continue;
      }

      if (indicesToRemove.has(index)) {
        continue;
      }

      indicesToRemove.add(index);
      remaining -= 1;
    }
  };

  Object.entries(cost.classes || {}).forEach(([rarityClass, count]) => {
    markIndicesForClass(rarityClass, count);
  });

  const markIndicesForTitle = (title, count) => {
    if (!title || !Number.isFinite(count) || count <= 0) {
      return;
    }

    let remaining = count;
    for (let index = 0; index < inventory.length && remaining > 0; index += 1) {
      const item = inventory[index];
      if (!item || item.title !== title || lockedItems[item.title]) {
        continue;
      }

      if (indicesToRemove.has(index)) {
        continue;
      }

      indicesToRemove.add(index);
      remaining -= 1;
    }
  };

  (Array.isArray(cost.titles) ? cost.titles : []).forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    markIndicesForTitle(entry.title, entry.count);
  });

  let inventoryChanged = false;
  if (indicesToRemove.size) {
    const filtered = inventory.filter((_, index) => !indicesToRemove.has(index));
    if (filtered.length !== inventory.length) {
      inventory = filtered;
      storage.set("inventory", inventory);
      inventoryChanged = true;
    }
  }

  let potionsChanged = false;
  Object.entries(cost.potions || {}).forEach(([ingredientId, required]) => {
    if (!ingredientId || !Number.isFinite(required) || required <= 0) {
      return;
    }

    const current = getPotionCount(ingredientId);
    const toRemove = Math.min(current, Math.trunc(required));
    if (toRemove > 0) {
      adjustPotionCount(ingredientId, -toRemove);
      potionsChanged = true;
    }
  });

  return { inventoryChanged, potionsChanged };
}

function craftPotion(potionId) {
  const potion = getPotionDefinition(potionId);
  if (!potion) {
    return;
  }

  const lockedItems = getLockedItemsMap();
  const summary = summarizeInventoryForPotions(lockedItems);
  if (!canCraftPotion(potion, summary)) {
    return;
  }

  const removalResult = removeItemsForPotion(potion, lockedItems);
  const cost = potion.craftCost || {};
  const hasCost = Object.keys(cost.classes || {}).length > 0
    || (Array.isArray(cost.titles) && cost.titles.length > 0)
    || Object.keys(cost.potions || {}).length > 0;

  const removedInventory = removalResult.inventoryChanged;
  const removedPotions = removalResult.potionsChanged;
  const removedSomething = removedInventory || removedPotions;

  if (removedInventory) {
    renderInventory();
  } else if (!removedSomething && hasCost) {
    return;
  }

  adjustPotionCount(potion.id, 1);
  renderPotionInventory();
  renderPotionCrafting();
}

function getRequirementLabel(rarityClass) {
  return POTION_RARITY_LABELS[rarityClass] || rarityClass || "Unknown";
}

function formatPotionDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0 seconds";
  }

  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  }
  if (remainingSeconds > 0 || !parts.length) {
    parts.push(`${remainingSeconds} ${remainingSeconds === 1 ? "second" : "seconds"}`);
  }

  if (parts.length === 1) {
    return parts[0];
  }

  const last = parts.pop();
  return `${parts.join(", ")} and ${last}`;
}

function isRarityClassAffectedByLuck(rarityClass) {
  const bucket = normalizeRarityBucket(rarityClass);
  return Boolean(bucket && bucket !== "under100");
}

function extractDisplayedOddsFromType(rarityType) {
  if (typeof rarityType !== "string") {
    return null;
  }

  const oddsMatch = rarityType.match(/\[1 in ([^\]]+)\]/i);
  if (!oddsMatch) {
    return null;
  }

  const numericMatch = oddsMatch[1].match(/[\d.,]+/);
  if (!numericMatch) {
    return null;
  }

  const normalized = numericMatch[0].replace(/,/g, "");
  const parsed = parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function isRarityEligibleForLuck(rarityType, luckThreshold) {
  const displayedOdds = extractDisplayedOddsFromType(rarityType);
  if (!Number.isFinite(displayedOdds)) {
    return true;
  }

  return displayedOdds >= luckThreshold;
}

function formatUsd(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "$0.00";
  }

  if (USD_CURRENCY_FORMATTER) {
    try {
      return USD_CURRENCY_FORMATTER.format(number);
    } catch (error) {
      /* no-op */
    }
  }

  return `$${number.toFixed(2)}`;
}

function formatPotionRewardSummary(rewards) {
  if (!Array.isArray(rewards) || rewards.length === 0) {
    return "";
  }

  if (rewards.length === 1) {
    return rewards[0];
  }

  if (rewards.length === 2) {
    return `${rewards[0]} and ${rewards[1]}`;
  }

  const head = rewards.slice(0, -1).join(", ");
  return `${head}, and ${rewards[rewards.length - 1]}`;
}

function isPotionTransactionDialogVisible() {
  return (
    potionTransactionDialogElement &&
    potionTransactionDialogElement.classList.contains("potion-transaction-dialog--visible")
  );
}
function closePotionTransactionDialog() {
  if (!potionTransactionDialogElement) {
    return;
  }

  potionTransactionDialogElement.classList.remove("potion-transaction-dialog--visible");
  potionTransactionDialogElement.setAttribute("aria-hidden", "true");

  if (potionTransactionDialogMessageElement) {
    potionTransactionDialogMessageElement.textContent = "";
  }

  if (potionTransactionDialogSummaryElement) {
    potionTransactionDialogSummaryElement.textContent = "";
  }

  if (
    potionTransactionDialogPreviousFocus &&
    typeof potionTransactionDialogPreviousFocus.focus === "function"
  ) {
    try {
      potionTransactionDialogPreviousFocus.focus();
    } catch (error) {
      /* no-op */
    }
  }

  potionTransactionDialogPreviousFocus = null;
}

function cancelPotionTransactionDialog() {
  const hadPending = Boolean(pendingPotionTransaction);
  pendingPotionTransaction = null;
  closePotionTransactionDialog();

  if (hadPending) {
    showPotionTransactionStatus("Purchase cancelled.");
  }
}

function showPotionTransactionConfirmation(transaction, state = null, showPopupReminder = false) {
  if (!transaction) {
    return;
  }

  const resolvedState =
    state && typeof state === "object" ? state : getPotionTransactionState(transaction);

  if (!resolvedState) {
    showPotionTransactionStatus("Unable to process that transaction right now.", "error");
    return;
  }

  const priceLabel = resolvedState.priceLabel || formatUsd(transaction.priceUsd);
  const actionVerb = resolvedState.promoActive ? "Claim" : "Purchase";
  const messageText = showPopupReminder
    ? `Continue to ${actionVerb.toLowerCase()} ${transaction.name} for ${priceLabel} in the secure checkout?`
    : `${actionVerb} ${transaction.name} for ${priceLabel}?`;

  if (!potionTransactionDialogElement || !potionTransactionDialogConfirmButton) {
    const confirmed = confirm(messageText);
    if (!confirmed) {
      showPotionTransactionStatus("Purchase cancelled.");
      return;
    }

    markPotionTransactionPopupReminderDismissed();
    redirectToPotionTransactionCheckout(transaction, resolvedState);
    return;
  }

  pendingPotionTransaction = { transaction, state: resolvedState };

  const activeElement = document.activeElement;
  potionTransactionDialogPreviousFocus =
    activeElement && typeof activeElement.focus === "function" ? activeElement : null;

  if (potionTransactionDialogMessageElement) {
    potionTransactionDialogMessageElement.textContent = messageText;
  }

  if (potionTransactionDialogSummaryElement) {
    const potionRewards = (transaction.rewards && transaction.rewards.potions) || {};
    const rewardDescriptions = [];

    Object.entries(potionRewards).forEach(([potionId, amount]) => {
      const quantity = Math.max(0, Math.trunc(Number(amount)));
      if (quantity <= 0) {
        return;
      }

      const potionDefinition = getPotionDefinition(potionId);
      const potionName = potionDefinition ? potionDefinition.name : potionId;
      rewardDescriptions.push(`${quantity.toLocaleString()} × ${potionName}`);
    });

    if (rewardDescriptions.length > 0) {
      potionTransactionDialogSummaryElement.textContent = `This will add ${formatPotionRewardSummary(
        rewardDescriptions
      )} to your inventory.`;
    } else {
      potionTransactionDialogSummaryElement.textContent = "";
    }
  }

  potionTransactionDialogElement.setAttribute("aria-hidden", "false");
  potionTransactionDialogElement.classList.add("potion-transaction-dialog--visible");

  if (potionTransactionDialogConfirmButton) {
    potionTransactionDialogConfirmButton.focus();
  }
}

function setupPotionTransactionDialog() {
  if (potionTransactionDialogElement) {
    return;
  }

  const dialog = byId("potionTransactionDialog");
  const message = byId("potionTransactionDialogMessage");
  const summary = byId("potionTransactionDialogSummary");
  const confirmButton = byId("potionTransactionDialogConfirm");
  const cancelButton = byId("potionTransactionDialogCancel");

  if (!dialog || !confirmButton || !cancelButton) {
    return;
  }

  potionTransactionDialogElement = dialog;
  potionTransactionDialogMessageElement = message || null;
  potionTransactionDialogSummaryElement = summary || null;
  potionTransactionDialogConfirmButton = confirmButton;

  cancelButton.addEventListener("click", () => {
    cancelPotionTransactionDialog();
  });

  confirmButton.addEventListener("click", () => {
    if (!pendingPotionTransaction) {
      closePotionTransactionDialog();
      return;
    }

    const pending = pendingPotionTransaction;
    pendingPotionTransaction = null;
    closePotionTransactionDialog();
    markPotionTransactionPopupReminderDismissed();

    let transaction = pending;
    let state = null;

    if (pending && typeof pending === "object") {
      if (pending.transaction) {
        transaction = pending.transaction;
      }
      if (pending.state) {
        state = pending.state;
      }
    }

    if (!transaction) {
      showPotionTransactionStatus("Unable to process that transaction right now.", "error");
      return;
    }

    redirectToPotionTransactionCheckout(transaction, state);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      cancelPotionTransactionDialog();
    }
  });

  if (!potionTransactionDialogKeyHandlerRegistered) {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (isPotionTransactionDialogVisible()) {
        event.preventDefault();
        cancelPotionTransactionDialog();
      }
    });
    potionTransactionDialogKeyHandlerRegistered = true;
  }
}

function showPotionTransactionStatus(message, variant = "info") {
  const status = byId("potionTransactionStatus");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.setAttribute("aria-hidden", "false");
  status.classList.remove(
    "potion-transaction-status--success",
    "potion-transaction-status--error"
  );

  if (variant === "success") {
    status.classList.add("potion-transaction-status--success");
  } else if (variant === "error") {
    status.classList.add("potion-transaction-status--error");
  }

  status.classList.add("potion-transaction-status--visible");

  if (potionTransactionStatusTimeoutId) {
    clearTimeout(potionTransactionStatusTimeoutId);
  }

  potionTransactionStatusTimeoutId = setTimeout(() => {
    status.classList.remove(
      "potion-transaction-status--visible",
      "potion-transaction-status--success",
      "potion-transaction-status--error"
    );
    status.textContent = "";
    status.setAttribute("aria-hidden", "true");
    potionTransactionStatusTimeoutId = null;
  }, 5000);
}

function processPotionTransaction(transaction) {
  if (!transaction) {
    return;
  }

  const grantedRewards = [];
  const potionRewards = transaction.rewards?.potions || {};

  Object.entries(potionRewards).forEach(([potionId, amount]) => {
    const quantity = Math.max(0, Math.trunc(Number(amount)));
    if (quantity <= 0) {
      return;
    }

    const potion = getPotionDefinition(potionId);
    adjustPotionCount(potionId, quantity);

    const potionName = potion ? potion.name : potionId;
    grantedRewards.push(`${quantity.toLocaleString()} × ${potionName}`);
  });

  if (typeof transaction.id === "string" && transaction.id) {
    incrementPotionTransactionPurchaseCount(transaction.id);
  }

  renderPotionInventory();
  renderPotionCrafting();
  renderPotionTransactions();

  const updatedState = getPotionTransactionState(transaction);

  if (grantedRewards.length > 0) {
    let message = `Purchase successful! Added ${formatPotionRewardSummary(grantedRewards)} to your inventory.`;
    if (
      updatedState &&
      updatedState.maxPurchases !== null &&
      Number.isFinite(updatedState.maxPurchases) &&
      Number.isFinite(updatedState.remainingPurchases)
    ) {
      message += ` (${updatedState.remainingPurchases}/${updatedState.maxPurchases} left)`;
    }
    showPotionTransactionStatus(message, "success");
  } else {
    let message = "Purchase processed.";
    if (
      updatedState &&
      updatedState.maxPurchases !== null &&
      Number.isFinite(updatedState.maxPurchases) &&
      Number.isFinite(updatedState.remainingPurchases)
    ) {
      message += ` (${updatedState.remainingPurchases}/${updatedState.maxPurchases} left)`;
    }
    showPotionTransactionStatus(message);
  }
}

function getPotionTransactionCheckoutUrl(transactionId) {
  if (typeof transactionId !== "string" || !transactionId) {
    return null;
  }

  const transaction = getPotionTransactionDefinition(transactionId);
  if (!transaction) {
    return null;
  }

  const state = getPotionTransactionState(transaction);
  return state ? state.checkoutUrl : null;
}

function startPotionTransactionStatusPolling() {
  if (typeof window === "undefined" || typeof window.setInterval !== "function") {
    return;
  }

  if (potionTransactionStatusPollIntervalId !== null) {
    return;
  }

  potionTransactionStatusPollIntervalId = window.setInterval(() => {
    try {
      handlePotionTransactionCheckoutReturn();
    } catch (error) {
      console.warn("Failed to refresh checkout status.", error);
    }
  }, 10_000);
}

function stopPotionTransactionStatusPolling() {
  if (
    typeof window === "undefined" ||
    typeof window.clearInterval !== "function" ||
    potionTransactionStatusPollIntervalId === null
  ) {
    return;
  }

  window.clearInterval(potionTransactionStatusPollIntervalId);
  potionTransactionStatusPollIntervalId = null;
}

function setPendingPotionTransactionId(transactionId, metadata = null) {
  if (typeof transactionId !== "string" || !transactionId) {
    storage.remove(PENDING_POTION_TRANSACTION_STORAGE_KEY);
    storage.remove(PENDING_POTION_TRANSACTION_METADATA_KEY);
    stopPotionTransactionStatusPolling();
    return;
  }

  storage.set(PENDING_POTION_TRANSACTION_STORAGE_KEY, transactionId);
  const normalizedMetadata = (() => {
    const base = metadata && typeof metadata === "object" ? metadata : {};
    const payload = {
      transactionId,
      startedAt: Date.now(),
      checkoutUrl:
        typeof base.checkoutUrl === "string" && base.checkoutUrl
          ? base.checkoutUrl
          : null,
    };

    return payload;
  })();

  storage.set(PENDING_POTION_TRANSACTION_METADATA_KEY, normalizedMetadata);
  startPotionTransactionStatusPolling();
}

function clearPendingPotionTransactionId() {
  storage.remove(PENDING_POTION_TRANSACTION_STORAGE_KEY);
  storage.remove(PENDING_POTION_TRANSACTION_METADATA_KEY);
  stopPotionTransactionStatusPolling();
}

function buildCheckoutUrl(baseUrl, transactionId) {
  if (typeof baseUrl !== "string" || !baseUrl) {
    return null;
  }

  try {
    const url = new URL(baseUrl);
    if (transactionId) {
      url.searchParams.set("client_reference_id", transactionId);
    }
    return url.toString();
  } catch (error) {
    return baseUrl;
  }
}

function redirectToPotionTransactionCheckout(transaction, stateOverride = null) {
  if (!transaction) {
    showPotionTransactionStatus("Unable to process that transaction right now.", "error");
    return;
  }

  let state = getPotionTransactionState(transaction);
  if (!state && stateOverride && typeof stateOverride === "object") {
    state = stateOverride;
  }

  if (!state) {
    showPotionTransactionStatus("Unable to process that transaction right now.", "error");
    return;
  }

  if (state.limitReached) {
    showPotionTransactionStatus("You've reached the purchase limit for this bundle.", "error");
    return;
  }

  const checkoutUrl = buildCheckoutUrl(state.checkoutUrl, transaction.id);

  if (!checkoutUrl) {
    showPotionTransactionStatus("Checkout is currently unavailable.", "error");
    return;
  }

  setPendingPotionTransactionId(transaction.id, { checkoutUrl });

  if (
    typeof window !== "undefined" &&
    window.location &&
    typeof window.location.assign === "function"
  ) {
    try {
      window.location.assign(checkoutUrl);
      showPotionTransactionStatus("Redirecting to secure checkout...");
      return;
    } catch (error) {
      /* no-op */
    }
  }

  if (typeof window !== "undefined" && window.location) {
    try {
      window.location.href = checkoutUrl;
      showPotionTransactionStatus("Redirecting to secure checkout...");
      return;
    } catch (error) {
      /* no-op */
    }
  }

  clearPendingPotionTransactionId();

  showPotionTransactionStatus(
    "We couldn't open the secure checkout. Please try again in a moment.",
    "error",
  );
}

function normalizeStripeCheckoutStatus(params) {
  const successIndicators = new Set(["success", "true", "1", "paid", "completed"]);
  const cancelledIndicators = new Set(["cancel", "cancelled", "canceled", "0", "false"]);

  const statusCandidates = [
    params.get("stripeStatus"),
    params.get("stripe_status"),
    params.get("paymentStatus"),
    params.get("payment_status"),
    params.get("success"),
    params.get("checkout_status"),
    params.get("redirect_status"),
    params.get("status"),
  ];

  for (const candidate of statusCandidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const normalized = candidate.trim().toLowerCase();
    if (successIndicators.has(normalized)) {
      return "success";
    }

    if (cancelledIndicators.has(normalized)) {
      return "cancel";
    }
  }

  if (params.has("canceled") || params.has("cancelled")) {
    return "cancel";
  }

  if (params.has("stripe_success")) {
    return "success";
  }

  if (params.has("stripe_cancel")) {
    return "cancel";
  }

  if (params.has("session_id")) {
    const redirectStatus = params.get("redirect_status");
    if (typeof redirectStatus === "string") {
      const normalized = redirectStatus.trim().toLowerCase();
      if (cancelledIndicators.has(normalized) || normalized === "failed") {
        return "cancel";
      }
    }

    if (!params.has("canceled") && !params.has("cancelled")) {
      return "success";
    }
  }

  return null;
}

function resolveStripeCheckoutSessionId(params) {
  if (!params) {
    return null;
  }

  const candidateKeys = ["session_id", "sessionId", "stripeSessionId", "checkout_session_id"];
  for (const key of candidateKeys) {
    const value = params.get(key);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function isLikelyStripeSessionId(value) {
  if (typeof value !== "string" || value.length < 10) {
    return false;
  }

  return value.startsWith("cs_");
}

function resolveTransactionIdFromParams(params) {
  const candidateKeys = [
    "potionTransactionId",
    "transaction",
    "bundle",
    "bundleId",
    "client_reference_id",
  ];

  for (const key of candidateKeys) {
    const value = params.get(key);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function handlePotionTransactionCheckoutReturn(sourceUrl = null, options = {}) {
  const { suppressHistoryReset = false } = options || {};

  let resolvedUrl = null;
  if (typeof sourceUrl === "string" && sourceUrl) {
    try {
      const base = typeof window !== "undefined" && window.location ? window.location.origin : undefined;
      resolvedUrl = base ? new URL(sourceUrl, base) : new URL(sourceUrl);
    } catch (error) {
      return null;
    }
  } else {
    if (typeof window === "undefined" || typeof window.location === "undefined") {
      return null;
    }

    try {
      resolvedUrl = new URL(window.location.href);
    } catch (error) {
      return null;
    }
  }

  if (!resolvedUrl) {
    return null;
  }

  const params = new URLSearchParams(resolvedUrl.search || "");
  if (!params.toString()) {
    return null;
  }

  const status = normalizeStripeCheckoutStatus(params);
  if (!status) {
    return null;
  }

  const storedPendingId = storage.get(PENDING_POTION_TRANSACTION_STORAGE_KEY, null);
  const pendingMetadata = storage.get(PENDING_POTION_TRANSACTION_METADATA_KEY, null);
  if (typeof storedPendingId !== "string" || !storedPendingId) {
    return null;
  }

  if (!pendingMetadata || pendingMetadata.transactionId !== storedPendingId) {
    return null;
  }

  const pendingStartedAt = Number(pendingMetadata.startedAt);
  if (
    !Number.isFinite(pendingStartedAt) ||
    pendingStartedAt <= 0 ||
    Date.now() - pendingStartedAt > PENDING_POTION_TRANSACTION_MAX_AGE_MS
  ) {
    showPotionTransactionStatus(
      "Your checkout session expired. Please try the purchase again to receive your items.",
      "error",
    );
    clearPendingPotionTransactionId();
    if (
      !suppressHistoryReset &&
      typeof window !== "undefined" &&
      window.history &&
      typeof window.history.replaceState === "function"
    ) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
    return "error";
  }

  let transactionId = resolveTransactionIdFromParams(params);

  if (!transactionId && typeof storedPendingId === "string" && storedPendingId) {
    transactionId = storedPendingId;
  }

  if (transactionId !== storedPendingId) {
    return null;
  }

  if (status === "cancel") {
    if (transactionId && transactionId === storedPendingId) {
      clearPendingPotionTransactionId();
    }
    showPotionTransactionStatus("Checkout cancelled.");
    if (
      !suppressHistoryReset &&
      typeof window !== "undefined" &&
      window.history &&
      typeof window.history.replaceState === "function"
    ) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
    return "cancel";
  }

  if (status !== "success") {
    return null;
  }

  const sessionId = resolveStripeCheckoutSessionId(params);
  let allowWithoutSessionId = false;

  if (!isLikelyStripeSessionId(sessionId)) {
    const cameFromStripeCheckout = (() => {
      if (typeof document === "undefined") {
        return false;
      }

      const referrer = document.referrer || "";
      if (referrer.includes("checkout.stripe.com")) {
        return true;
      }

      return false;
    })();

    const attemptedStripeCheckoutUrl =
      pendingMetadata && typeof pendingMetadata.checkoutUrl === "string"
        ? pendingMetadata.checkoutUrl
        : "";

    if (cameFromStripeCheckout || attemptedStripeCheckoutUrl.includes("stripe.com")) {
      allowWithoutSessionId = true;
    }
  }

  if (!isLikelyStripeSessionId(sessionId) && allowWithoutSessionId) {
    console.warn(
      "Stripe checkout return missing session identifier. Proceeding based on pending checkout metadata.",
    );
  }

  if (!isLikelyStripeSessionId(sessionId) && !allowWithoutSessionId) {
    showPotionTransactionStatus(
      "We couldn't verify the purchase with Stripe. Please complete the checkout to receive your items.",
      "error",
    );
    clearPendingPotionTransactionId();
    if (
      !suppressHistoryReset &&
      typeof window !== "undefined" &&
      window.history &&
      typeof window.history.replaceState === "function"
    ) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
    return "error";
  }

  const transactionDefinition = POTION_TRANSACTION_DEFINITIONS.find(
    (definition) => definition.id === transactionId,
  );

  if (!transactionDefinition) {
    showPotionTransactionStatus(
      "Payment succeeded, but we couldn't match the purchased bundle. Please contact support.",
      "error",
    );
    clearPendingPotionTransactionId();
    if (
      !suppressHistoryReset &&
      typeof window !== "undefined" &&
      window.history &&
      typeof window.history.replaceState === "function"
    ) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
    return "error";
  }

  processPotionTransaction(transactionDefinition);
  clearPendingPotionTransactionId();
  if (
    !suppressHistoryReset &&
    typeof window !== "undefined" &&
    window.history &&
    typeof window.history.replaceState === "function"
  ) {
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }

  return "success";
}

function purchasePotionTransaction(transactionId) {
  const transaction = getPotionTransactionDefinition(transactionId);
  if (!transaction) {
    showPotionTransactionStatus("Unable to process that transaction right now.", "error");
    return;
  }

  const state = getPotionTransactionState(transaction);
  if (!state) {
    showPotionTransactionStatus("Unable to process that transaction right now.", "error");
    return;
  }

  if (state.limitReached) {
    showPotionTransactionStatus("You've reached the purchase limit for this bundle.", "error");
    return;
  }

  if (!state.checkoutUrl) {
    showPotionTransactionStatus("Checkout is currently unavailable.", "error");
    return;
  }

  const shouldShowPopupReminder = !hasDismissedPotionTransactionPopupReminder;

  showPotionTransactionConfirmation(transaction, state, shouldShowPopupReminder);
}

function renderPotionTransactions() {
  const container = byId("potionTransactionList");
  if (!container) {
    return;
  }

  container.innerHTML = "";

  POTION_TRANSACTION_DEFINITIONS.forEach((transaction) => {
    const state = getPotionTransactionState(transaction);

    const card = document.createElement("article");
    card.className = "potion-transaction-card";
    card.setAttribute("role", "listitem");
    if (state?.limitReached) {
      card.classList.add("potion-transaction-card--disabled");
      card.setAttribute("aria-disabled", "true");
    }

    if (typeof transaction.bannerImage === "string" && transaction.bannerImage.trim()) {
      const banner = document.createElement("div");
      banner.className = "potion-transaction-card__banner";
      const bannerImage = document.createElement("img");
      bannerImage.src = transaction.bannerImage;
      bannerImage.alt = "";
      bannerImage.loading = "lazy";
      banner.appendChild(bannerImage);
      card.appendChild(banner);
    }

    const header = document.createElement("div");
    header.className = "potion-transaction-card__header";

    const title = document.createElement("h4");
    title.className = "potion-transaction-card__title";
    title.textContent = transaction.name;

    const price = document.createElement("span");
    price.className = "potion-transaction-card__price";
    price.textContent = state?.priceLabel || formatUsd(transaction.priceUsd);

    header.appendChild(title);
    header.appendChild(price);
    card.appendChild(header);

    if (state && Array.isArray(state.badges) && state.badges.length > 0) {
      const badgesContainer = document.createElement("div");
      badgesContainer.className = "potion-transaction-card__badges";

      state.badges.forEach((badge) => {
        if (!badge || typeof badge.text !== "string" || !badge.text.trim()) {
          return;
        }

        const badgeElement = document.createElement("span");
        let badgeClassName = "potion-transaction-card__badge";
        if (badge.type) {
          badgeClassName += ` potion-transaction-card__badge--${badge.type}`;
        }
        badgeElement.className = badgeClassName;

        const badgeLabel = document.createElement("span");
        badgeLabel.textContent = badge.text.trim();
        badgeElement.appendChild(badgeLabel);

        if (badge.counterText) {
          const separator = document.createElement("span");
          separator.textContent = " • ";
          separator.setAttribute("aria-hidden", "true");

          const counter = document.createElement("span");
          counter.className = "potion-transaction-card__badge-counter";
          counter.textContent = badge.counterText;

          badgeElement.appendChild(separator);
          badgeElement.appendChild(counter);
        }

        badgesContainer.appendChild(badgeElement);
      });

      if (badgesContainer.children.length > 0) {
        card.appendChild(badgesContainer);
      }
    }

    if (typeof transaction.description === "string" && transaction.description.trim()) {
      const description = document.createElement("p");
      description.className = "potion-transaction-card__description";
      description.textContent = transaction.description;
      card.appendChild(description);
    }

    const rewardsList = document.createElement("ul");
    rewardsList.className = "potion-transaction-card__rewards";

    const potionRewards = transaction.rewards?.potions || {};
    Object.entries(potionRewards).forEach(([potionId, amount]) => {
      const quantity = Math.max(0, Math.trunc(Number(amount)));
      if (quantity <= 0) {
        return;
      }

      const potion = getPotionDefinition(potionId);

      const rewardItem = document.createElement("li");
      rewardItem.className = "potion-transaction-card__reward";

      const image = document.createElement("img");
      image.className = "potion-transaction-card__reward-image";
      image.src = potion && typeof potion.image === "string" ? potion.image : "";
      image.alt = potion ? potion.name : potionId;
      image.loading = "lazy";

      const label = document.createElement("span");
      label.className = "potion-transaction-card__reward-label";
      label.textContent = `${quantity.toLocaleString()} × ${potion ? potion.name : potionId}`;

      rewardItem.appendChild(image);
      rewardItem.appendChild(label);
      rewardsList.appendChild(rewardItem);
    });

    card.appendChild(rewardsList);

    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = "potion-transaction-card__action";
    actionButton.textContent = state?.actionLabel || `Purchase for ${formatUsd(transaction.priceUsd)}`;
    if (state?.actionDisabled) {
      actionButton.disabled = true;
      actionButton.setAttribute("aria-disabled", "true");
    } else {
      actionButton.addEventListener("click", () => purchasePotionTransaction(transaction.id));
    }

    card.appendChild(actionButton);
    container.appendChild(card);
  });
}

function renderPotionCrafting() {
  const container = byId("potionCraftingList");
  if (!container) {
    return;
  }

  const previousScrollTop = container.scrollTop;
  container.innerHTML = "";
  const summary = summarizeInventoryForPotions();

  POTION_DEFINITIONS.forEach((potion) => {
    const card = document.createElement("article");
    card.className = "potion-card";

    const imageWrapper = document.createElement("div");
    imageWrapper.className = "potion-card__image";
    const image = document.createElement("img");
    image.src = potion.image;
    image.alt = "";
    imageWrapper.appendChild(image);

    const title = document.createElement("h4");
    title.className = "potion-card__title";
    title.textContent = potion.name;

    let eventLabel = null;
    if (typeof potion.eventExclusive === "string" && potion.eventExclusive.trim().length > 0) {
      eventLabel = document.createElement("span");
      eventLabel.className = "potion-card__event-label";
      eventLabel.textContent = potion.eventExclusive;
    }

    const header = document.createElement("div");
    header.className = "potion-card__header";
    header.appendChild(title);
    if (eventLabel) {
      header.appendChild(eventLabel);
    }

    const effect = document.createElement("div");
    effect.className = "potion-card__effect";
    effect.textContent = potion.type === POTION_TYPES.LUCK
      ? `${formatPercentage(potion.effectPercent, true)} Luck`
      : `${formatPercentage(potion.effectPercent, true)} Speed`;

    const duration = document.createElement("div");
    duration.className = "potion-card__duration";
    const durationText = typeof potion.durationDisplay === "string"
      ? potion.durationDisplay
      : `Duration: ${formatPotionDuration(potion.durationSeconds)}`;
    duration.textContent = durationText;

    let rewardNote = null;
    if (potion.id === DESCENDED_POTION_ID) {
      rewardNote = document.createElement("p");
      rewardNote.className = "potion-card__note";
      rewardNote.innerHTML =
        'Also allows you to <strong>roll 2 titles</strong> <span class="descendent-potion__title">[????̸̺̦̊?̸̘̰̈́̿¿¿¿]</span> with chances of 1 in ƐƐƐ and <span class="descendent-potion__title__unknown">[¿¿?̸̘̰̈́̿¿??]</span> with chances of 1 in ᔦᔦᔦ';
    }

    const costTitle = document.createElement("p");
    costTitle.className = "potion-card__cost-title";
    costTitle.textContent = "Required Ingredients";

    const costList = document.createElement("ul");
    costList.className = "potion-card__cost-list";

    Object.entries(potion.craftCost?.classes || {}).forEach(([rarityClass, required]) => {
      if (!Number.isFinite(required) || required <= 0) {
        return;
      }

      const li = document.createElement("li");
      li.className = "potion-card__cost-item";
      const owned = summary.classCounts[rarityClass] || 0;
      if (owned < required) {
        li.classList.add("potion-card__cost-item--insufficient");
      }
      li.textContent = `${required} × ${getRequirementLabel(rarityClass)} (${owned} owned)`;
      costList.appendChild(li);
    });

    (Array.isArray(potion.craftCost?.titles) ? potion.craftCost.titles : []).forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }

      const { title: titleName, count } = entry;
      if (!titleName || !Number.isFinite(count) || count <= 0) {
        return;
      }

      const li = document.createElement("li");
      li.className = "potion-card__cost-item";
      const owned = summary.titleCounts[titleName] || 0;
      if (owned < count) {
        li.classList.add("potion-card__cost-item--insufficient");
      }
      li.textContent = `${count} × "${titleName}" (${owned} owned)`;
      costList.appendChild(li);
    });

    Object.entries(potion.craftCost?.potions || {}).forEach(([ingredientId, required]) => {
      if (!ingredientId || !Number.isFinite(required) || required <= 0) {
        return;
      }

      const li = document.createElement("li");
      li.className = "potion-card__cost-item";
      const ingredient = getPotionDefinition(ingredientId);
      const owned = summary.potionCounts[ingredientId] || 0;
      if (owned < required) {
        li.classList.add("potion-card__cost-item--insufficient");
      }
      const label = ingredient ? ingredient.name : ingredientId;
      li.textContent = `${required} × ${label} (${owned} owned)`;
      costList.appendChild(li);
    });

    if (!costList.children.length) {
      const li = document.createElement("li");
      li.className = "potion-card__cost-item";
      li.textContent = "No cost";
      costList.appendChild(li);
    }

    const actions = document.createElement("div");
    actions.className = "potion-card__actions";

    const craftButton = document.createElement("button");
    craftButton.className = "potion-card__action-button";
    craftButton.type = "button";
    const craftable = canCraftPotion(potion, summary);
    craftButton.disabled = !craftable;
    craftButton.textContent = craftable ? "Craft" : "Needs Resources";
    craftButton.addEventListener("click", () => craftPotion(potion.id));

    const ownedLabel = document.createElement("span");
    ownedLabel.className = "potion-card__inventory-count";
    ownedLabel.textContent = `Owned: ${getPotionCount(potion.id)}`;

    actions.appendChild(craftButton);
    actions.appendChild(ownedLabel);

    card.appendChild(imageWrapper);
    card.appendChild(header);
    card.appendChild(effect);
    card.appendChild(duration);
    if (rewardNote) {
      card.appendChild(rewardNote);
    }
    card.appendChild(costTitle);
    card.appendChild(costList);
    card.appendChild(actions);

    container.appendChild(card);
  });

  if (previousScrollTop > 0) {
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    container.scrollTop = Math.min(previousScrollTop, maxScrollTop);
  }
}

function renderPotionInventory() {
  const list = byId("potionInventoryList");
  if (!list) {
    return;
  }

  list.innerHTML = "";

  POTION_DEFINITIONS.forEach((potion) => {
    const count = getPotionCount(potion.id);
    const item = document.createElement("li");
    item.className = "potion-inventory__item";

    const title = document.createElement("h4");
    title.className = "potion-inventory__title";
    title.textContent = potion.name;

    let inventoryEventLabel = null;
    if (typeof potion.eventExclusive === "string" && potion.eventExclusive.trim().length > 0) {
      inventoryEventLabel = document.createElement("span");
      inventoryEventLabel.className = "potion-inventory__event-label";
      inventoryEventLabel.textContent = potion.eventExclusive;
    }

    const infoHeader = document.createElement("div");
    infoHeader.className = "potion-inventory__header";
    infoHeader.appendChild(title);
    if (inventoryEventLabel) {
      infoHeader.appendChild(inventoryEventLabel);
    }

    const imageWrapper = document.createElement("div");
    imageWrapper.className = "potion-inventory__image";
    const image = document.createElement("img");
    image.src = potion.image;
    image.alt = "";
    imageWrapper.appendChild(image);

    const actions = document.createElement("div");
    actions.className = "potion-inventory__actions";

    const useButton = document.createElement("button");
    useButton.className = "potion-inventory__use";
    useButton.type = "button";
    useButton.textContent = "Use";
    useButton.disabled = count <= 0;
    useButton.addEventListener("click", () => usePotion(potion.id));

    const useAllButton = document.createElement("button");
    useAllButton.className = "potion-inventory__use-all";
    useAllButton.type = "button";
    useAllButton.textContent = "Use All";
    useAllButton.disabled = count <= 0;
    useAllButton.addEventListener("click", () => useAllPotions(potion.id));

    actions.appendChild(useButton);
    actions.appendChild(useAllButton);

    const countLabel = document.createElement("div");
    countLabel.className = "potion-inventory__count";
    countLabel.textContent = `In stock: ${count}`;

    let inventoryRewardNote = null;
    if (potion.id === DESCENDED_POTION_ID) {
      inventoryRewardNote = document.createElement("p");
      inventoryRewardNote.className = "potion-inventory__note";
      inventoryRewardNote.innerHTML =
        'Also allows you to <strong>roll a title</strong> <span class="descendent-potion__title">[????̷̝̣͂?̸̺̦̊?̸̘̰̈́̿¿¿¿]</span> with chances of 1 in 333 or 1 in 444';
    }

    item.appendChild(infoHeader);
    item.appendChild(imageWrapper);
    item.appendChild(actions);
    item.appendChild(countLabel);
    if (inventoryRewardNote) {
      item.appendChild(inventoryRewardNote);
    }

    list.appendChild(item);
  });
}

function normalizeActiveBuffs(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  const pauseReference = buffsDisabled && Number.isFinite(buffPauseStart)
    ? buffPauseStart
    : Date.now();
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const potion = getPotionDefinition(entry.potionId);
      if (!potion) {
        return null;
      }

      const expiresAt = Number.parseInt(entry.expiresAt, 10);
      if (!Number.isFinite(expiresAt) || expiresAt <= pauseReference) {
        return null;
      }

      const effectPercent = Number.isFinite(entry.effectPercent)
        ? entry.effectPercent
        : potion.effectPercent;

      const id = typeof entry.id === "string" && entry.id
        ? entry.id
        : `${potion.id}-${expiresAt}`;

      const storedImage = typeof entry.image === "string" && entry.image ? entry.image : "";
      const image = storedImage
        || potion.buffImage
        || getBuffIconForType(potion.type)
        || potion.image;

      const storedConsumeFlag = entry.consumeOnRoll === true || entry.consumeOnRoll === "true";
      const consumeOnRoll = storedConsumeFlag || Boolean(potion.consumeOnRoll);

      let usesRemaining = 1;
      if (consumeOnRoll) {
        const parsedUses = Number.parseInt(entry.usesRemaining, 10);
        if (Number.isFinite(parsedUses) && parsedUses >= 1) {
          usesRemaining = parsedUses;
        }
      }

      let disableWithToggle = null;
      if (Object.prototype.hasOwnProperty.call(entry, "disableWithToggle")) {
        const raw = entry.disableWithToggle;
        disableWithToggle = raw === true || raw === "true";
      } else if (Object.prototype.hasOwnProperty.call(potion, "disableWithToggle")) {
        disableWithToggle = Boolean(potion.disableWithToggle);
      }

      const normalizedBuff = {
        id,
        potionId: potion.id,
        type: potion.type,
        effectPercent,
        name: entry.name || potion.name,
        image,
        expiresAt,
        consumeOnRoll,
      };

      if (consumeOnRoll) {
        normalizedBuff.usesRemaining = usesRemaining;
      }

      if (disableWithToggle !== null) {
        normalizedBuff.disableWithToggle = disableWithToggle;
      }

      return normalizedBuff;
    })
    .filter(Boolean);
}

function persistActiveBuffs() {
  if (activeBuffs.length) {
    storage.set(ACTIVE_BUFFS_KEY, activeBuffs);
  } else {
    storage.remove(ACTIVE_BUFFS_KEY);
  }
}

function pruneExpiredBuffs() {
  if (buffsDisabled) {
    return false;
  }
  const now = Date.now();
  const filtered = activeBuffs.filter((buff) => Number.isFinite(buff.expiresAt) && buff.expiresAt > now);
  const changed = filtered.length !== activeBuffs.length;
  if (changed) {
    activeBuffs = filtered;
  }
  return changed;
}

function isBuffToggleExempt(buff) {
  if (!buff || !buff.consumeOnRoll) {
    return false;
  }

  const disableFlag = buff.disableWithToggle === true || buff.disableWithToggle === "true";
  return !disableFlag;
}

function sumBuffEffect(buffs) {
  return buffs.reduce(
    (total, buff) => total + (Number.isFinite(buff.effectPercent) ? buff.effectPercent : 0),
    0,
  );
}

function getActivePotionBuffsByType(type, predicate = null) {
  return activeBuffs.filter((buff) => {
    if (!buff || buff.type !== type) {
      return false;
    }
    if (typeof predicate === "function") {
      return predicate(buff);
    }
    return true;
  });
}

function getActivePotionLuckBonusPercent(predicate = null) {
  return sumBuffEffect(getActivePotionBuffsByType(POTION_TYPES.LUCK, predicate));
}

function getActivePotionSpeedBonusPercent(predicate = null) {
  return sumBuffEffect(getActivePotionBuffsByType(POTION_TYPES.SPEED, predicate));
}

function findHighestCollectorTier(tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return null;
  }
  for (const tier of tiers) {
    if (tier && unlockedAchievementsCache.has(tier.name)) {
      return tier;
    }
  }
  return null;
}

function getPermanentLuckBonusTier() {
  return findHighestCollectorTier(COLLECTOR_LUCK_TIERS);
}

function getPermanentSpeedBonusTier() {
  return findHighestCollectorTier(COLLECTOR_SPEED_TIERS);
}

function getPermanentLuckBonusPercent() {
  const tier = getPermanentLuckBonusTier();
  return tier && Number.isFinite(tier.value) ? tier.value : 0;
}

function getPermanentSpeedBonusPercent() {
  const tier = getPermanentSpeedBonusTier();
  return tier && Number.isFinite(tier.value) ? tier.value : 0;
}

function getUnlockedAchievementsSnapshot() {
  return new Set(unlockedAchievementsCache);
}

function setUnlockedAchievementsCache(unlocked) {
  const normalized = normalizeAchievementNameList(Array.from(unlocked));
  unlockedAchievementsCache = new Set(normalized);
  handlePermanentBuffsChanged();
}

function getPermanentAchievementBuffs() {
  const buffs = [];
  const luckTier = getPermanentLuckBonusTier();
  if (luckTier && Number.isFinite(luckTier.value) && luckTier.value > 0) {
    buffs.push({
      id: "permanent-luck",
      name: luckTier.name,
      type: POTION_TYPES.LUCK,
      effectPercent: luckTier.value,
      image: getBuffIconForType(POTION_TYPES.LUCK),
      isPermanent: true,
      disableWithToggle: true,
    });
  }

  const speedTier = getPermanentSpeedBonusTier();
  if (speedTier && Number.isFinite(speedTier.value) && speedTier.value > 0) {
    buffs.push({
      id: "permanent-speed",
      name: speedTier.name,
      type: POTION_TYPES.SPEED,
      effectPercent: speedTier.value,
      image: getBuffIconForType(POTION_TYPES.SPEED),
      isPermanent: true,
      disableWithToggle: true,
    });
  }

  return buffs;
}

function getActiveLuckPercentBreakdown() {
  if (buffsDisabled) {
    const potionPercent = getActivePotionLuckBonusPercent(isBuffToggleExempt);
    return {
      total: potionPercent,
      permanent: 0,
      potion: potionPercent,
    };
  }

  const permanentPercent = getPermanentLuckBonusPercent();
  const potionPercent = getActivePotionLuckBonusPercent();

  return {
    total: permanentPercent + potionPercent,
    permanent: permanentPercent,
    potion: potionPercent,
  };
}

function getActiveLuckBonusPercent() {
  return getActiveLuckPercentBreakdown().total;
}

function getActiveSpeedBonusPercent() {
  if (buffsDisabled) {
    return getActivePotionSpeedBonusPercent(isBuffToggleExempt);
  }

  return getPermanentSpeedBonusPercent() + getActivePotionSpeedBonusPercent();
}

function formatBuffEffectValue(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPercentage(value, includeSign = false) {
  if (!Number.isFinite(value)) {
    return includeSign ? "+0%" : "0%";
  }
  const useFraction = !Number.isInteger(value);
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: useFraction ? 1 : 0,
    maximumFractionDigits: useFraction ? 1 : 0,
  });
  if (includeSign) {
    return `${value >= 0 ? "+" : ""}${formatted}%`;
  }
  return `${formatted}%`;
}

function updateLuckStatDisplay() {
  const valueElement = byId("luckStatValue");
  if (!valueElement) {
    return;
  }

  const permanentTotal = getPermanentLuckBonusPercent();
  const permanentEffective = buffsDisabled ? 0 : permanentTotal;
  const potionTotal = getActivePotionLuckBonusPercent();
  const potionEffective = buffsDisabled
    ? getActivePotionLuckBonusPercent(isBuffToggleExempt)
    : potionTotal;
  const total = permanentEffective + potionEffective;

  valueElement.textContent = formatPercentage(total, true);

  const breakdownElement = byId("luckStatBreakdown");
  if (breakdownElement) {
    let permanentText = `Permanent: ${formatPercentage(permanentEffective, true)}`;
    if (permanentTotal > 0 && permanentEffective !== permanentTotal) {
      permanentText += " (Disabled)";
    }
    const parts = [permanentText];
    if (potionTotal > 0) {
      let potionText = `Potions: ${formatPercentage(potionEffective, true)}`;
      if (buffsDisabled) {
        if (potionEffective === 0) {
          potionText += " (Disabled)";
        } else if (potionEffective !== potionTotal) {
          potionText += " (Partially Disabled)";
        }
      }
      parts.push(potionText);
    }
    breakdownElement.textContent = parts.join(" • ");
  }
}

function applySpeedBuffEffects() {
  const speedBonus = getActiveSpeedBonusPercent();
  if (speedBonus > 0) {
    const multiplier = 1 + speedBonus / 100;
    cooldownTime = Math.max(100, Math.round(BASE_COOLDOWN_TIME / multiplier));
    cooldownBuffActive = true;
    recordRollCooldownDuration("buffed", cooldownTime);
  } else {
    cooldownTime = BASE_COOLDOWN_TIME;
    cooldownBuffActive = false;
    recordRollCooldownDuration("default", BASE_COOLDOWN_TIME);
  }

  if (autoRollActive) {
    scheduleAutoRollTick();
  }
}

function formatBuffDuration(totalSeconds) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return `${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m ${seconds
    .toString()
    .padStart(2, "0")}s`;
}

function renderBuffTray() {
  const tray = byId("buffTray");
  if (!tray) {
    updateLuckStatDisplay();
    return;
  }

  hideBuffTooltip();
  tray.innerHTML = "";

  const referenceTime = buffsDisabled && Number.isFinite(buffPauseStart)
    ? buffPauseStart
    : Date.now();

  const potionBuffs = activeBuffs
    .slice()
    .sort((a, b) => a.expiresAt - b.expiresAt)
    .map((buff) => {
      const remainingSecondsRaw = Number.isFinite(buff.expiresAt)
        ? Math.max(0, Math.floor((buff.expiresAt - referenceTime) / 1000))
        : 0;
      const consumeOnRoll = Boolean(buff.consumeOnRoll);
      let usesRemaining = null;
      if (consumeOnRoll) {
        const parsedUses = Number.parseInt(buff.usesRemaining, 10);
        usesRemaining = Number.isFinite(parsedUses) && parsedUses >= 1 ? parsedUses : 1;
      }
      const timerText = consumeOnRoll
        ? usesRemaining > 1
          ? `Next ${usesRemaining} rolls`
          : "Next roll"
        : formatBuffDuration(remainingSecondsRaw);
      const disableWithToggle = !isBuffToggleExempt(buff);
      return {
        id: buff.id,
        name: buff.name,
        type: buff.type,
        effectPercent: buff.effectPercent,
        image: buff.image,
        remainingSeconds: remainingSecondsRaw,
        timerText,
        consumeOnRoll,
        usesRemaining,
        disableWithToggle,
      };
    });

  const permanentBuffs = getPermanentAchievementBuffs().map((buff) => ({
    ...buff,
    remainingSeconds: null,
    timerText: "Permanent",
  }));

  const buffsForDisplay = [...potionBuffs, ...permanentBuffs];

  if (!buffsForDisplay.length) {
    tray.style.display = "none";
    updateLuckStatDisplay();
    return;
  }

  tray.style.display = "flex";

  buffsForDisplay.forEach((buff) => {
    const card = document.createElement("div");
    card.className = "buff-card";
    const isDisabled = buff.disableWithToggle && buffsDisabled;
    if (isDisabled) {
      card.classList.add("buff-card--disabled");
    }
    card.tabIndex = 0;

    const icon = document.createElement("img");
    icon.className = "buff-card__icon";
    icon.src = buff.image || getBuffIconForType(buff.type) || "";
    icon.alt = "";

    const effect = document.createElement("span");
    effect.className = "buff-card__effect";
    const effectText = buff.type === POTION_TYPES.LUCK
      ? `${formatPercentage(buff.effectPercent, true)} Luck`
      : `${formatPercentage(buff.effectPercent, true)} Speed`;
    effect.textContent = effectText;

    const timer = document.createElement("span");
    timer.className = "buff-card__timer";
    const timerText = buff.timerText || (buff.remainingSeconds === null
      ? "Permanent"
      : formatBuffDuration(buff.remainingSeconds));
    timer.textContent = timerText;

    const name = buff.name || "";
    card.dataset.buffName = name;
    card.dataset.buffEffect = effectText;
    card.dataset.buffTimer = timerText;
    card.dataset.buffType = buff.type;
    card.dataset.buffDisabled = isDisabled ? "true" : "false";
    if (buff.consumeOnRoll) {
      card.dataset.buffConsume = "true";
    }

    card.setAttribute("aria-label", `${name}. ${effectText}. ${timerText}.`);
    card.setAttribute("role", "group");
    card.setAttribute("aria-disabled", isDisabled ? "true" : "false");

    card.addEventListener("mouseenter", handleBuffCardPointerEnter);
    card.addEventListener("mouseleave", handleBuffCardPointerLeave);
    card.addEventListener("mousemove", handleBuffCardPointerMove);
    card.addEventListener("focus", handleBuffCardFocus);
    card.addEventListener("blur", handleBuffCardBlur);

    card.appendChild(icon);
    card.appendChild(effect);
    card.appendChild(timer);
    tray.appendChild(card);
  });

  restoreBuffTooltipForPointer();
  updateLuckStatDisplay();
}

function handlePermanentBuffsChanged() {
  applySpeedBuffEffects();
  renderBuffTray();
}

function refreshBuffEffects() {
  const removed = pruneExpiredBuffs();
  applySpeedBuffEffects();
  renderBuffTray();
  if (removed) {
    persistActiveBuffs();
  }
}

function startBuffTicker() {
  if (buffUpdateIntervalId) {
    clearInterval(buffUpdateIntervalId);
  }

  buffUpdateIntervalId = setInterval(() => {
    const removed = pruneExpiredBuffs();
    if (removed) {
      persistActiveBuffs();
      applySpeedBuffEffects();
    }
    if (removed || activeBuffs.length) {
      renderBuffTray();
    }
  }, 1000);
}

function usePotion(potionId) {
  if (getPotionCount(potionId) <= 0) {
    return;
  }

  const potion = getPotionDefinition(potionId);
  if (!potion) {
    return;
  }

  adjustPotionCount(potionId, -1);
  renderPotionInventory();
  renderPotionCrafting();
  activatePotionBuff(potion);
}

function useAllPotions(potionId) {
  const available = getPotionCount(potionId);
  if (available <= 0) {
    return;
  }

  const potion = getPotionDefinition(potionId);
  if (!potion) {
    return;
  }

  adjustPotionCount(potionId, -available);
  renderPotionInventory();
  renderPotionCrafting();

  for (let i = 0; i < available; i += 1) {
    activatePotionBuff(potion);
  }
}

function shouldRollDescendedTitleThisRoll() {
  return activeBuffs.some((buff) => {
    if (!buff || buff.potionId !== DESCENDED_POTION_ID) {
      return false;
    }

    if (buffsDisabled && !isBuffToggleExempt(buff)) {
      return false;
    }

    const parsedUses = Number.parseInt(buff.usesRemaining, 10);
    const usesRemaining = Number.isFinite(parsedUses) && parsedUses >= 1 ? parsedUses : 1;

    return usesRemaining >= 1;
  });
}

function activatePotionBuff(potion) {
  if (!potion) {
    return;
  }

  const now = Date.now();
  const referenceTime = buffsDisabled && Number.isFinite(buffPauseStart)
    ? buffPauseStart
    : now;
  const durationSeconds = Number.isFinite(potion.durationSeconds)
    ? Math.max(0, potion.durationSeconds)
    : 0;
  const durationMs = durationSeconds * 1000;
  const icon = potion.buffImage || getBuffIconForType(potion.type) || potion.image;
  const consumeOnRoll = Boolean(potion.consumeOnRoll);
  const disableWithToggle = Object.prototype.hasOwnProperty.call(potion, "disableWithToggle")
    ? Boolean(potion.disableWithToggle)
    : null;

  const existing = activeBuffs.find((entry) => entry.potionId === potion.id);
  if (existing) {
    const baseExpiresAt = Math.max(existing.expiresAt || 0, referenceTime);
    existing.expiresAt = baseExpiresAt + durationMs;
    existing.effectPercent = potion.effectPercent;
    existing.name = potion.name;
    existing.image = icon;
    existing.consumeOnRoll = consumeOnRoll;
    if (consumeOnRoll) {
      const currentUses = Number.isFinite(existing.usesRemaining) && existing.usesRemaining >= 1
        ? existing.usesRemaining
        : 1;
      existing.usesRemaining = currentUses + 1;
    } else if (Object.prototype.hasOwnProperty.call(existing, "usesRemaining")) {
      delete existing.usesRemaining;
    }
    if (disableWithToggle !== null) {
      existing.disableWithToggle = disableWithToggle;
    } else if (Object.prototype.hasOwnProperty.call(existing, "disableWithToggle")) {
      delete existing.disableWithToggle;
    }
    persistActiveBuffs();
    refreshBuffEffects();
    return;
  }

  const expiresAt = referenceTime + durationMs;
  const buff = {
    id: `${potion.id}-${expiresAt}-${Math.random().toString(36).slice(2, 8)}`,
    potionId: potion.id,
    type: potion.type,
    effectPercent: potion.effectPercent,
    name: potion.name,
    image: icon,
    expiresAt,
    consumeOnRoll,
  };

  if (consumeOnRoll) {
    buff.usesRemaining = 1;
  }

  if (disableWithToggle !== null) {
    buff.disableWithToggle = disableWithToggle;
  }

  activeBuffs.push(buff);
  persistActiveBuffs();
  refreshBuffEffects();
}

function consumeSingleUseBuffs() {
  let changed = false;
  const idsToRemove = new Set();

  activeBuffs.forEach((buff) => {
    if (!buff || !buff.consumeOnRoll) {
      return;
    }

    if (buffsDisabled && !isBuffToggleExempt(buff)) {
      return;
    }

    const parsedUses = Number.parseInt(buff.usesRemaining, 10);
    const usesRemaining = Number.isFinite(parsedUses) && parsedUses >= 1 ? parsedUses : 1;

    if (usesRemaining > 1) {
      buff.usesRemaining = usesRemaining - 1;
      changed = true;
    } else {
      idsToRemove.add(buff.id);
    }
  });

  if (idsToRemove.size) {
    const originalLength = activeBuffs.length;
    activeBuffs = activeBuffs.filter((buff) => !idsToRemove.has(buff.id));
    if (activeBuffs.length !== originalLength) {
      changed = true;
    }
  }

  if (!changed) {
    return;
  }

  persistActiveBuffs();
  refreshBuffEffects();
}

function setBuffsDisabled(next) {
  const desired = Boolean(next);
  if (desired === buffsDisabled) {
    return;
  }

  buffsDisabled = desired;
  if (buffsDisabled) {
    storage.set(BUFFS_DISABLED_KEY, true);
    buffPauseStart = Date.now();
    storage.set(BUFFS_PAUSE_TIMESTAMP_KEY, buffPauseStart);
  } else {
    storage.remove(BUFFS_DISABLED_KEY);
    if (Number.isFinite(buffPauseStart)) {
      const pauseDuration = Date.now() - buffPauseStart;
      if (pauseDuration > 0) {
        activeBuffs.forEach((buff) => {
          if (Number.isFinite(buff.expiresAt)) {
            buff.expiresAt += pauseDuration;
          }
        });
      }
    }
    buffPauseStart = null;
    storage.remove(BUFFS_PAUSE_TIMESTAMP_KEY);
    persistActiveBuffs();
  }

  syncBuffPauseState();
  refreshBuffEffects();
  updateBuffsSwitchControl();
}

function updateBuffsSwitchControl() {
  const input = byId("toggleBuffsSwitch");
  const status = byId("toggleBuffsStatus");
  if (!input || !status) {
    return;
  }

  const enabled = !buffsDisabled;
  if (input.checked !== enabled) {
    input.checked = enabled;
  }

  input.setAttribute("aria-checked", String(enabled));
  status.textContent = enabled ? "Enabled" : "Disabled";
}

function cancelPotionSpawn(potionId) {
  const timer = potionSpawnTimers.get(potionId);
  if (timer) {
    clearTimeout(timer);
    potionSpawnTimers.delete(potionId);
  }
}

function cancelAllPotionSpawns() {
  potionSpawnTimers.forEach((timer) => clearTimeout(timer));
  potionSpawnTimers.clear();
}

function schedulePotionSpawn(config) {
  if (!config || !config.potionId) {
    return;
  }

  cancelPotionSpawn(config.potionId);

  const minDelay = Math.max(0, Number(config.minDelayMs) || 0);
  const maxDelay = Math.max(minDelay, Number(config.maxDelayMs) || minDelay);
  const delay = minDelay + Math.random() * (maxDelay - minDelay);

  const timer = setTimeout(() => {
    potionSpawnTimers.delete(config.potionId);
    spawnPotionPickup(config);
  }, delay);

  potionSpawnTimers.set(config.potionId, timer);
}

function scheduleAllPotionSpawns() {
  POTION_SPAWN_CONFIGS.forEach((config) => schedulePotionSpawn(config));
}

function resolveSpawnPotionId(config) {
  if (!config) {
    return null;
  }

  const baseId = config.potionId;
  const rarePool = Array.isArray(config.rareSpawns)
    ? config.rareSpawns.filter((entry) => entry && entry.potionId && Number.isFinite(Number(entry.chance)))
    : [];

  if (!rarePool.length) {
    return baseId;
  }

  const roll = Math.random();
  let cumulative = 0;
  for (const entry of rarePool) {
    const chance = Number(entry.chance);
    if (!Number.isFinite(chance) || chance <= 0) {
      continue;
    }
    cumulative += chance;
    if (roll < cumulative) {
      return entry.potionId;
    }
  }

  return baseId;
}

function spawnPotionPickup(config) {
  const layer = byId("potionSpawnLayer");
  if (!layer) {
    return;
  }

  const spawnPotionId = resolveSpawnPotionId(config) || config.potionId;
  const potion = getPotionDefinition(spawnPotionId);
  if (!potion) {
    return;
  }

  const spawn = document.createElement("button");
  spawn.type = "button";
  spawn.className = "potion-spawn";
  spawn.setAttribute("aria-label", `Collect ${potion.name}`);

  const image = document.createElement("img");
  image.src = potion.image;
  image.alt = "";
  spawn.appendChild(image);

  const size = 96;
  const padding = 24;
  const maxX = Math.max(0, window.innerWidth - size - padding * 2);
  const maxY = Math.max(0, window.innerHeight - size - padding * 2);
  const left = padding + Math.random() * maxX;
  const top = padding + Math.random() * maxY;

  spawn.style.left = `${Math.round(left)}px`;
  spawn.style.top = `${Math.round(top)}px`;

  const lifespan = Number.isFinite(config.lifespanMs) && config.lifespanMs > 0
    ? config.lifespanMs
    : 45000;

  const removeSpawn = () => {
    if (spawn.isConnected) {
      spawn.remove();
    }
  };

  const despawnTimeout = setTimeout(() => {
    removeSpawn();
  }, lifespan);

  let collected = false;
  spawn.addEventListener("click", () => {
    if (collected) {
      return;
    }

    collected = true;
    clearTimeout(despawnTimeout);
    spawn.classList.add("potion-spawn--collected");
    spawn.disabled = true;
    spawn.setAttribute("aria-hidden", "true");

    adjustPotionCount(potion.id, 1);
    renderPotionInventory();
    renderPotionCrafting();

    const finalizeCollection = () => {
      removeSpawn();
    };

    spawn.addEventListener("animationend", finalizeCollection, { once: true });
    spawn.addEventListener("transitionend", finalizeCollection, { once: true });
    setTimeout(finalizeCollection, 400);
  });

  layer.appendChild(spawn);
  schedulePotionSpawn(config);
}

function initializePotionFeatures() {
  setupPotionTransactionDialog();
  potionInventory = normalizePotionInventory(storage.get(POTION_STORAGE_KEY, {}));
  buffsDisabled = Boolean(storage.get(BUFFS_DISABLED_KEY, false));
  syncBuffPauseState();
  activeBuffs = normalizeActiveBuffs(storage.get(ACTIVE_BUFFS_KEY, []));
  pruneExpiredBuffs();
  persistActiveBuffs();
  renderPotionInventory();
  renderPotionTransactions();
  renderPotionCrafting();
  updateBuffsSwitchControl();
  refreshBuffEffects();
  startBuffTicker();
  cancelAllPotionSpawns();
  scheduleAllPotionSpawns();
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
  "unknownCutsceneAudio",
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
  "wailingshadeAudio",
  "alienAudio",
  "destitAudio",
  "unknownAudio"
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
  "unknownCutsceneAudio",
]);
const CUTSCENE_AUDIO_PLAYBACK_DELAY_MS = 100;

const RARITY_BUCKET_LABELS = {
  under100: "Basic",
  under1k: "Decent",
  under10k: "Grand",
  under100k: "Mastery",
  under1m: "Supreme",
  transcendent: "Transcendent",
  special: "Special",
  theDescended: "The Descended",
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

function setRollButtonEnabled(enabled, options = {}) {
  const button = document.getElementById("rollButton");
  if (!button) {
    return;
  }

  const { force = false } = options;

  if (!enabled) {
    button.disabled = true;
    if (!force) {
      const baseDelay = getRollButtonCooldownDelay();
      const now = typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
      rollButtonManualCooldownUntil = Math.max(
        rollButtonManualCooldownUntil,
        now + Math.max(0, baseDelay),
      );
    }

    if (rollButtonManualEnableTimeoutId !== null) {
      clearTimeout(rollButtonManualEnableTimeoutId);
      rollButtonManualEnableTimeoutId = null;
    }
    return;
  }

  const now = typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

  if (!force && now < rollButtonManualCooldownUntil) {
    const delay = Math.max(0, Math.round(rollButtonManualCooldownUntil - now));
    if (rollButtonManualEnableTimeoutId !== null) {
      clearTimeout(rollButtonManualEnableTimeoutId);
    }
    rollButtonManualEnableTimeoutId = setTimeout(() => {
      rollButtonManualEnableTimeoutId = null;
      setRollButtonEnabled(true, { force: true });
    }, delay);
    return;
  }

  rollButtonManualCooldownUntil = 0;
  if (rollButtonManualEnableTimeoutId !== null) {
    clearTimeout(rollButtonManualEnableTimeoutId);
    rollButtonManualEnableTimeoutId = null;
  }
  button.disabled = false;
}

function getRollButtonCooldownDelay() {
  if (Number.isFinite(cooldownTime) && cooldownTime >= 0) {
    return cooldownTime;
  }

  return BASE_COOLDOWN_TIME;
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

function playDescendedTitleCutscene({
  title = DESCENDED_TITLE_TYPE,
  rarity = null,
  titleContainer = null,
  setPendingRarity = true,
  onComplete = null,
} = {}) {
  const resolvedRarity = rarity || createDescendedRarityPayload();

  if (setPendingRarity || !pendingCutsceneRarity) {
    pendingCutsceneRarity = resolvedRarity;
  }

  const container = titleContainer || document.querySelector(".container");
  if (container) {
    hideRollDisplayForCutscene(container);
  }

  if (typeof destitAudio !== "undefined" && destitAudio && typeof destitAudio.play === "function") {
    try {
      destitAudio.currentTime = 0;
    } catch (error) {
      /* no-op */
    }
    const playPromise = destitAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }

  const overlay = document.createElement("div");
  overlay.className = "descended-cutscene";
  const glitchLayer = document.createElement("div");
  glitchLayer.className = "descended-cutscene__glitch";
  const pulseLayer = document.createElement("div");
  pulseLayer.className = "descended-cutscene__pulse";
  overlay.appendChild(glitchLayer);
  overlay.appendChild(pulseLayer);
  document.body.appendChild(overlay);

  const timeouts = [];
  const schedule = (callback, delay) => {
    const id = setTimeout(callback, delay);
    timeouts.push(id);
    return id;
  };

  requestAnimationFrame(() => {
    overlay.classList.add("descended-cutscene--visible", "descended-cutscene--phase-glitch");
  });

  schedule(() => {
    overlay.classList.remove("descended-cutscene--phase-glitch");
    overlay.classList.add("descended-cutscene--phase-pulse");
  }, DESCENDED_CUTSCENE_TIMINGS.GLITCH_MS);

  schedule(() => {
    overlay.classList.remove("descended-cutscene--phase-pulse");
    overlay.classList.add("descended-cutscene--phase-flash");
  }, DESCENDED_CUTSCENE_TIMINGS.FLASH_MS);

  const finalizeCutscene = () => {
    timeouts.forEach(clearTimeout);
    overlay.remove();

    if (typeof onComplete === "function") {
      try {
        const handled = onComplete({ container, title, rarity: resolvedRarity });
        if (handled === true) {
          return;
        }
      } catch (error) {
        console.error("Failed to complete Descended cutscene", error);
      }
    }

    enableChange();
  };

  schedule(finalizeCutscene, DESCENDED_CUTSCENE_TIMINGS.TOTAL_MS);
}

function playUnknownTitleCutscene({
  title = UNKNOWN_TITLE_TYPE,
  rarity = null,
  titleContainer = null,
  setPendingRarity = true,
  onComplete = null,
} = {}) {
  const resolvedRarity = rarity || createDescendedRarityPayload(getDescendedDefinitionByType(UNKNOWN_TITLE_TYPE));

  if (setPendingRarity || !pendingCutsceneRarity) {
    pendingCutsceneRarity = resolvedRarity;
  }

  const container = titleContainer || document.querySelector(".container");
  if (container) {
    hideRollDisplayForCutscene(container);
  }

  const timeouts = [];
  const schedule = (callback, delay) => {
    const id = setTimeout(callback, delay);
    timeouts.push(id);
    return id;
  };

  const cutsceneAudioElement = getAudioElement("unknownCutsceneAudio");
  const loopAudioElement = getAudioElement("unknownAudio");
  let loopAudioStarted = false;

  const stopCutsceneAudio = () => {
    if (!cutsceneAudioElement) {
      return;
    }

    if (typeof cutsceneAudioElement.pause === "function") {
      cutsceneAudioElement.pause();
    }

    try {
      cutsceneAudioElement.currentTime = 0;
    } catch (error) {
      /* no-op */
    }
  };

  const playLoopAudio = () => {
    if (!loopAudioElement || typeof loopAudioElement.play !== "function") {
      return;
    }

    try {
      loopAudioElement.currentTime = 0;
    } catch (error) {
      /* no-op */
    }

    loopAudioElement.volume = getEffectiveVolumeForAudioId(loopAudioElement.id || "unknownAudio");

    const playPromise = loopAudioElement.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  };

  const startLoopAudio = () => {
    if (loopAudioStarted) {
      return;
    }

    loopAudioStarted = true;
    stopCutsceneAudio();
    playLoopAudio();
  };

  if (cutsceneAudioElement && typeof cutsceneAudioElement.play === "function") {
    try {
      cutsceneAudioElement.currentTime = 0;
    } catch (error) {
      /* no-op */
    }

    cutsceneAudioElement.volume = getEffectiveVolumeForAudioId(
      cutsceneAudioElement.id || "unknownCutsceneAudio"
    );

    const playPromise = cutsceneAudioElement.play();
    const loopTimeoutId = schedule(startLoopAudio, UNKNOWN_CUTSCENE_AUDIO_LEAD_MS);

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        clearTimeout(loopTimeoutId);
        startLoopAudio();
      });
    }
  } else {
    startLoopAudio();
  }

  const overlay = document.createElement("div");
  overlay.className = "unknown-cutscene";
  const staticLayer = document.createElement("div");
  staticLayer.className = "unknown-cutscene__static";
  const glowLayer = document.createElement("div");
  glowLayer.className = "unknown-cutscene__glow";
  overlay.appendChild(staticLayer);
  overlay.appendChild(glowLayer);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add("unknown-cutscene--visible");
  });

  schedule(() => {
    overlay.classList.add("unknown-cutscene--fade-out");
  }, UNKNOWN_CUTSCENE_TIMINGS.FADE_OUT_MS);

  const finalizeCutscene = () => {
    timeouts.forEach(clearTimeout);
    overlay.remove();

    stopCutsceneAudio();
    startLoopAudio();

    if (typeof onComplete === "function") {
      try {
        const handled = onComplete({ container, title, rarity: resolvedRarity });
        if (handled === true) {
          return;
        }
      } catch (error) {
        console.error("Failed to complete Unknown cutscene", error);
      }
    }

    enableChange();
  };

  schedule(finalizeCutscene, UNKNOWN_CUTSCENE_TIMINGS.TOTAL_MS);
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
    "alienBgImg"
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
  theDescended: [
    "destitBgImg",
    "unknownBgImg",
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
  destitBgImg: "theDescended",
  unknownBgImg: "theDescended",
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
  setupInventorySortControls();
  setupInventorySearchControls();
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
  initializePotionFeatures();
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
  {
    key: "skipCutsceneHalloween25",
    labelId: "halloween25Txt",
    label: "Skip Halloween 2025 Title Cutscenes",
    buttonId: "toggleCutsceneHalloween25",
  },
];

const CUTSCENE_STATE_SETTERS = {
  skipCutscene1K: (value) => { skipCutscene1K = value; },
  skipCutscene10K: (value) => { skipCutscene10K = value; },
  skipCutscene100K: (value) => { skipCutscene100K = value; },
  skipCutscene1M: (value) => { skipCutscene1M = value; },
  skipCutsceneTranscendent: (value) => { skipCutsceneTranscendent = value; },
  skipCutsceneHalloween25: (value) => { skipCutsceneHalloween25 = value; },
};

const CUTSCENE_STATE_GETTERS = {
  skipCutscene1K: () => skipCutscene1K,
  skipCutscene10K: () => skipCutscene10K,
  skipCutscene100K: () => skipCutscene100K,
  skipCutscene1M: () => skipCutscene1M,
  skipCutsceneTranscendent: () => skipCutsceneTranscendent,
  skipCutsceneHalloween25: () => skipCutsceneHalloween25,
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

const QUALIFYING_VAULT_BUCKETS = new Set(["under100k", "under1m", "transcendent", "special", "theDescended"]);

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

  if (typeof record.luckValue === "number" && Number.isFinite(record.luckValue)) {
    const clamped = Math.max(0, record.luckValue);
    if (clamped !== record.luckValue) {
      record.luckValue = clamped;
      mutated = true;
    }
  } else if (Object.prototype.hasOwnProperty.call(record, "luckValue")) {
    delete record.luckValue;
    mutated = true;
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

  if (typeof record.inventoryId !== "string" || !record.inventoryId.trim()) {
    record.inventoryId = generateInventoryRecordId();
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
    inventoryRarityClassSet: new Set(),
    eventBucketCounts: new Map(),
    totalEventTitleCount: 0,
    distinctEventBucketCount: 0,
  };
}

let latestAchievementStats = createEmptyAchievementStats();

function computeAchievementStats(items = inventory) {
  const qualifyingInventoryCount = getQualifyingInventoryCount(items);
  const inventoryTitleSet = new Set();
  const inventoryRarityClassSet = new Set();
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

      if (typeof item.rarityClass === "string" && item.rarityClass) {
        inventoryRarityClassSet.add(item.rarityClass.trim());
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
    inventoryRarityClassSet,
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
  { name: "Precision Spinner", count: 75000 },
  { name: "Rolling machine", count: 100000 },
  { name: "Rhythm of Fortune", count: 150000 },
  { name: "Your PC must be burning", count: 250000 },
  { name: "Cascade of Clicks", count: 350000 },
  { name: "Half a million!1!!1", count: 500000 },
  { name: "Rolling Virtuoso", count: 750000 },
  { name: "One, Two.. ..One Million!", count: 1000000 },
  { name: "Momentum Maestro", count: 1500000 },
  { name: "Millionaire Machine", count: 2000000 },
  { name: "Probability Pioneer", count: 2500000 },
  { name: "Triple Threat Spinner", count: 3000000 },
  { name: "Odds Overdrive", count: 4000000 },
  { name: "Momentum Master", count: 5000000 },
  { name: "Luckstream Rider", count: 6000000 },
  { name: "Lucky Tenacity", count: 7500000 },
  { name: "Rollstorm Chaser", count: 8500000 },
  { name: "No H1di?", count: 10000000 },
  { name: "Quantum Quester", count: 12000000 },
  { name: "Breaking Reality", count: 15000000 },
  { name: "Variance Vanquisher", count: 18000000 },
  { name: "Are you really doing this?", count: 25000000 },
  { name: "Stochastic Sprinter", count: 27500000 },
  { name: "Multiversal Roller", count: 30000000 },
  { name: "Threshold Tumbler", count: 35000000 },
  { name: "You have no limits...", count: 50000000 },
  { name: "Cascade Commander", count: 60000000 },
  { name: "Anomaly Hunter", count: 75000000 },
  { name: "WHAT HAVE YOU DONE", count: 100000000 },
  { name: "Oddity Voyager", count: 150000000 },
  { name: "Permutation Prodigy", count: 200000000 },
  { name: "Improbability Engine", count: 300000000 },
  { name: "Destiny Defier", count: 400000000 },
  { name: "Beyond Imagination", count: 500000000 },
  { name: "Entropy Challenger", count: 750000000 },
  { name: "AHHHHHHHHHHH", count: 1000000000 },
  { name: "Randomness Ruler", count: 1500000000 },
  { name: "Worldshaper", count: 2500000000 },
  { name: "Chance Chancellor", count: 3500000000 },
  { name: "Entropy Rewriter", count: 5000000000 },
  { name: "Fate Fabricator", count: 7500000000 },
  { name: "Reality Reforger", count: 12500000000 },
  { name: "RNG Architect", count: 25000000000 },
  // Playtime goals
  { name: "Just the beginning", timeCount: 0 },
  { name: "Settling In", timeCount: 900 },
  { name: "Just Five More Minutes...", timeCount: 1800 },
  { name: "Spin Session", timeCount: 2700 },
  { name: "This doesn't add up", timeCount: 3600 },
  { name: "Roller Stretch", timeCount: 5400 },
  { name: "When does it end...", timeCount: 7200 },
  { name: "Triple Hour Tour", timeCount: 10800 },
  { name: "Marathon Warmup", timeCount: 14400 },
  { name: "Late Night Grinder", timeCount: 21600 },
  { name: "Half-Day Hero", timeCount: 28800 },
  { name: "I swear I'm not addicted...", timeCount: 36000 },
  { name: "Sunrise Sprint", timeCount: 43200 },
  { name: "Grass? What's that?", timeCount: 86400 },
  { name: "Weekend Warmup", timeCount: 129600 },
  { name: "Unnamed's RNG biggest fan", timeCount: 172800 },
  { name: "Marathon Weekend", timeCount: 259200 },
  { name: "Four-Day Focus", timeCount: 345600 },
  { name: "Weekday Warrior", timeCount: 432000 },
  { name: "Almost a Week", timeCount: 518400 },
  { name: "RNG is life!", timeCount: 604800 },
  { name: "Double Week Drift", timeCount: 907200 },
  { name: "I. CAN'T. STOP", timeCount: 1209600 },
  { name: "Three-Week Thrive", timeCount: 1814400 },
  { name: "No Lifer", timeCount: 2629800 },
  { name: "Five-Week Fixture", timeCount: 3024000 },
  { name: "Season Kickoff", timeCount: 4730400 },
  { name: "Are you okay?", timeCount: 5259600 },
  { name: "Quarter-Year Quest", timeCount: 7884000 },
  { name: "Seasoned Grinder", timeCount: 9460800 },
  { name: "Half-Year Hustle", timeCount: 12614400 },
  { name: "You are a True No Lifer", timeCount: 15778800 },
  { name: "Three-Quarter Marathon", timeCount: 18921600 },
  { name: "Nine-Month Nomad", timeCount: 25228800 },
  { name: "No one's getting this legit", timeCount: 31557600 },
  { name: "Eighteen-Month Endurance", timeCount: 47304000 },
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
  { name: "Celestial Alignment", requiredTitle: "『Equinox』 [1 in 25,000,000]", requiredRarityClass: "equinoxBgImg" },
  { name: "Creator?!", requiredTitle: "Unnamed [1 in 30,303]", requiredRarityClass: "unnamedBgImg" },
  { name: "Silly Joyride", requiredTitle: "Silly Car :3 [1 in 1,000,000]", requiredRarityClass: "silcarBgImg" },
  { name: "Ginger Guardian", requiredTitle: "Ginger [1 in 1,144,141]", requiredRarityClass: "gingerBgImg" },
  { name: "H1di Hunted", requiredTitle: "H1di [1 in 9,890,089]", requiredRarityClass: "h1diBgImg" },
  { name: "902.. released.. wilderness..", requiredTitle: "Experiment [1 in 100,000/10th]", requiredRarityClass: "expBgImg" },
  { name: "Abomination Wrangler", requiredTitle: "Abomination [1 in 1,000,000/20th]", requiredRarityClass: "aboBgImg" },
  { name: "Veiled Visionary", requiredTitle: "Veil [1 in 50,000/5th]", requiredRarityClass: "veilBgImg" },
  { name: "Iridocyclitis Survivor", requiredTitle: "Iridocyclitis Veil [1 in 5,000/50th]", requiredRarityClass: "iriBgImg" },
  { name: "Cherry Grove Champion", requiredTitle: "LubbyJubby's Cherry Grove [1 in 5,666]", requiredRarityClass: "lubjubBgImg" },
  { name: "Firestarter", requiredTitle: "FireCraze [1 in 4,200/69th]", requiredRarityClass: "crazeBgImg" },
  { name: "Orbital Dreamer", requiredTitle: "ORB [1 in 55,555/30th]", requiredRarityClass: "orbBgImg" },
  { name: "The Hunter of All Souls", requiredTitle: "MSFU [1 in 333/333rd]", requiredRarityClass: "msfuBgImg" },
  { name: "Glitched Reality", requiredTitle: "Gl1tch3d [1 in 12,404/40,404th]", requiredRarityClass: "glitchedBgImg" },
  { name: "Gregarious Encounter", requiredTitle: "Greg [1 in 50,000,000]", requiredRarityClass: "gregBgImg" },
  { name: "Mint Condition", requiredTitle: "Mintllie [1 in 500,000,000]", requiredRarityClass: "mintllieBgImg" },
  { name: "Geezer Whisperer", requiredTitle: "Geezer [1 in 5,000,000,000]", requiredRarityClass: "geezerBgGif" },
  { name: "Polar Lights", requiredTitle: "Polarr [1 in 50,000,000,000]", requiredRarityClass: "polarrBgImg" },
  { name: "Mythical Gamer!!!!", requiredTitle: "MythicWall [1 in 170,017]", requiredRarityClass: "mythicwallBgImg" },
  { name: "Master of your Mind", requiredTitle: "Mastermind [1 in 110,010]", requiredRarityClass: "mastermindBgImg" },
  { name: "The Descendant", requiredTitle: "Descended Title [1 in ƐƐƐ]", requiredRarityClass: "destitBgImg" },
  { name: "The Unknown", requiredTitle: "UnKnOwN [1 in ᔦᔦᔦ]", requiredRarityClass: "unknownBgImg" },
  {
    name: "T̴̻͐͆h̶̠̄e̶̦͐̽ ̶̱͠Ă̵̪̠͝ĺ̸̠̪͑i̴̱͆̎ê̸̦͙n̴͖̍͋ ̸̖͌͗Í̷̫̓s̶͕͑ ̴̨̻̌H̶̪̝̍͊ë̸͍r̷̯͇̍ẹ̵͋̈",
    requiredTitle: "Alien [1 in 6̴̩͚͂5̶̯̝̓3̷̝̎,̸̝̞̽͑8̸̨̛͜8̴͕̔̑2̴͉̦̇]",
    requiredRarityClass: "alienBgImg",
  },
  // Event exclusives
  {
    name: "Spooky Spectator",
    requiredEventBucket: "eventTitleHalloween24",
    unobtainable: true,
  },
  {
    name: "Winter Wonderland",
    requiredEventBucket: "eventTitleXmas24",
    unobtainable: true,
  },
  {
    name: "Festival Firecracker",
    requiredEventBucket: "eventTitleNew25",
    unobtainable: true,
  },
  {
    name: "Valentine's Sweetheart",
    requiredEventBucket: "eventV25",
    unobtainable: true,
  },
  {
    name: "Spring & Easter",
    requiredEventBucket: "eventE25",
    unobtainable: true,
  },
  {
    name: "Summer Vibes",
    requiredEventBucket: "eventS25",
    unobtainable: true,
  },
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

function isAchievementCurrentlyAvailable(
  achievement,
  stats = latestAchievementStats,
  context = {}
) {
  if (!achievement) {
    return true;
  }

  const { isUnlocked = false } = context;
  const hasProgress = hasEventAchievementProgress(achievement, stats);

  if (achievement.unobtainable) {
    return Boolean(isUnlocked) || hasProgress;
  }

  if (hasProgress) {
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
  { name: "Achievements...", count: 200, unobtainable: true },
];

COLLECTOR_ACHIEVEMENTS.forEach((achievement) => {
  ACHIEVEMENT_DATA_BY_NAME.set(achievement.name, achievement);
});

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

const ACHIEVEMENT_TOAST_DURATION = 4400;
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

  handlePotionTransactionCheckoutReturn();
  const storedPendingTransactionId = storage.get(
    PENDING_POTION_TRANSACTION_STORAGE_KEY,
    null,
  );
  if (typeof storedPendingTransactionId === "string" && storedPendingTransactionId) {
    startPotionTransactionStatusPolling();
  }

  initEventCountdown();

  if (pendingEquinoxPulseState !== null || equinoxPulseActive) {
    const desiredState = pendingEquinoxPulseState !== null ? pendingEquinoxPulseState : equinoxPulseActive;
    syncEquinoxPulseOnBody(desiredState);
  }

  if (pendingReducedAnimationsState !== null || reducedAnimationsEnabled) {
    const desiredReducedState = pendingReducedAnimationsState !== null ? pendingReducedAnimationsState : reducedAnimationsEnabled;
    syncReducedAnimationsOnBody(desiredReducedState);
  }

  if (rollButton) {
    setRollButtonEnabled(false, { force: true });
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
  const normalized = normalizeAchievementNameList(Array.from(unlocked));
  storage.set("unlockedAchievements", normalized);
  setUnlockedAchievementsCache(normalized);
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
  const unlocked = getUnlockedAchievementsSnapshot();
  const rarityBuckets = context && context.rarityBuckets instanceof Set
    ? context.rarityBuckets
    : new Set(storage.get("rolledRarityBuckets", []));
  const {
    qualifyingInventoryCount,
    inventoryTitleSet,
    inventoryRarityClassSet,
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
      achievement.requiredRarityClass &&
      inventoryRarityClassSet.has(achievement.requiredRarityClass)
    ) {
      unlockAchievement(achievement.name, unlocked);
    }

    if (
      Array.isArray(achievement.requiredRarityClasses) &&
      achievement.requiredRarityClasses.every((rarityClass) =>
        inventoryRarityClassSet.has(rarityClass)
      )
    ) {
      unlockAchievement(achievement.name, unlocked);
    }

    if (
      Array.isArray(achievement.anyRarityClass) &&
      achievement.anyRarityClass.some((rarityClass) =>
        inventoryRarityClassSet.has(rarityClass)
      )
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
  const unlocked = getUnlockedAchievementsSnapshot();
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
    const isActive = isAchievementCurrentlyAvailable(achievement, stats, {
      isUnlocked,
    });
    const hasProgress = hasEventAchievementProgress(achievement, stats);
    const isEventAchievement = Boolean(
      achievement && (
        achievement.requiredEventBucket ||
        (Array.isArray(achievement.requiredEventBuckets) && achievement.requiredEventBuckets.length) ||
        typeof achievement.minDistinctEventBuckets === "number" ||
        typeof achievement.minEventTitleCount === "number"
      )
    );
    const isUnobtainable = Boolean(achievement?.unobtainable);

    if (isEventAchievement) {
      if (!item.dataset.eventHint) {
        const baseHint = item.getAttribute("data-event");
        if (baseHint) {
          item.dataset.eventHint = baseHint;
        }
      }

      const baseHint = item.dataset.eventHint || "";

      if (isUnobtainable) {
        if (baseHint) {
          item.setAttribute("data-event", `${baseHint} (Unobtainable)`);
        } else {
          item.setAttribute("data-event", "This achievement is unobtainable.");
        }
      } else if (!isUnlocked && !isActive && !hasProgress) {
        if (baseHint) {
          item.setAttribute(
            "data-event",
            `${baseHint} (Currently unavailable)`
          );
        }
      } else if (baseHint) {
        item.setAttribute("data-event", baseHint);
      }

      if (!isUnlocked && !isActive && !hasProgress) {
        item.classList.add("achievement--inactive");
        item.setAttribute(
          "data-availability",
          isUnobtainable ? "unobtainable" : "inactive"
        );
      } else {
        item.classList.remove("achievement--inactive");
        item.removeAttribute("data-availability");
      }
    } else {
      if (isUnobtainable && !isUnlocked) {
        item.classList.add("achievement--inactive");
        item.setAttribute("data-availability", "unobtainable");
      } else {
        item.classList.remove("achievement--inactive");
        item.removeAttribute("data-availability");
      }
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

    if (cutsceneActive || pendingCutsceneRarity || !isChangeEnabled) {
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
    rarity.type === "MythicWall [1 in 170,017]" ||
    rarity.type === "The Scarecrow's Sigil [1 in 1,031]" ||
    rarity.type === "Pumpkin Hollow [1 in 3,110]" ||
    rarity.type === "Hollow Hill Manor [1 in 10,031]" ||
    rarity.type === "The Phantom Moon [1 in 10,031]" ||
    rarity.type === "The Void's Veil [1 in 10,031]" ||
    rarity.type === "Wailing Shade [1 in 31,010]" ||
    rarity.type === "Alien [1 in 6̴̩͚͂5̶̯̝̓3̷̝̎,̸̝̞̽͑8̸̨̛͜8̴͕̔̑2̴͉̦̇]" ||
    isDescendedTitleType(rarity.type)
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
    } else if (isDescendedTitleType(rarity.type)) {
      if (rarity.type === UNKNOWN_TITLE_TYPE) {
        unknownAudio.play();
      } else {
        destitAudio.play();
      }
    } else if (rarity.type === "Gl1tch3d [1 in 12,404/40,404th]") {
      glitchedAudio.play();
    } else if (rarity.type === "Gargantua [1 in 143]") {
      gargantuaAudio.play();
    } else if (rarity.type === "Heart [1 in ♡♡♡]") {
      bigSuspenceAudio.play();
    } else if (rarity.type === "Qbear [1 in 35,555]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Alien [1 in 6̴̩͚͂5̶̯̝̓3̷̝̎,̸̝̞̽͑8̸̨̛͜8̴͕̔̑2̴͉̦̇]") {
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
    } else if (rarity.type === "MythicWall [1 in 170,017]") {
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
    } else if (rarity.type === "Alien [1 in 6̴̩͚͂5̶̯̝̓3̷̝̎,̸̝̞̽͑8̸̨̛͜8̴͕̔̑2̴͉̦̇]") {
      if (skipCutscene1M) {
        document.body.className = "blackBg";
        disableChange();
        startAnimationA5H();
      
        const container1 = document.getElementById("squareContainer");
        const container = document.getElementById("starContainer");
      
        function createSquare() {
          const square = document.createElement("div");
          square.className = "animated-square-lime";
  
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
            "lime-star",
            "green-star"
          ];
          star.className = starClasses[Math.floor(Math.random() * starClasses.length)];
      
          star.innerHTML = "!!!";
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
            alienAudio.play();
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
        alienAudio.play();
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
    } else if (isDescendedTitleType(rarity.type)) {
      disableChange();
      const cutscenePlayer = rarity.type === UNKNOWN_TITLE_TYPE
        ? playUnknownTitleCutscene
        : playDescendedTitleCutscene;
      cutscenePlayer({
        title,
        rarity,
        titleContainer: titleCont,
        setPendingRarity: false,
        onComplete: ({ container }) => {
          try {
            addToInventory(title, rarity.class);
            updateRollingHistory(title, rarity.type);
            displayResult(title, rarity.type);
            changeBackground(rarity.class, title, {
              force: true,
              preservePendingAutoEquip: true,
            });
            setRollButtonEnabled(true);
            rollCount++;
            rollCount1++;
            if (container) {
              container.style.visibility = "visible";
            }
          } catch (error) {
            console.error("Failed to finalize Descended Title roll", error);
          } finally {
            enableChange();
          }

          return true;
        },
      });
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
    } else if (rarity.type === "MythicWall [1 in 170,017]") {
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
      if (skipCutsceneHalloween25) {
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
        thescarecrowssigilAudio.play();
      }
    } else if (rarity.type === "Pumpkin Hollow [1 in 3,110]") {
      if (skipCutsceneHalloween25) {
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
        pumpkinhollowAudio.play();
      }
    } else if (rarity.type === "Hollow Hill Manor [1 in 10,031]") {
      if (skipCutsceneHalloween25) {
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
        hollowhillmanorAudio.play();
      }
    } else if (rarity.type === "The Phantom Moon [1 in 10,031]") {
      if (skipCutsceneHalloween25) {
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
        thephantommoonAudio.play();
      }
    } else if (rarity.type === "The Void's Veil [1 in 10,031]") {
      if (skipCutsceneHalloween25) {
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
        thevoidsveilAudio.play();
      }
    } else if (rarity.type === "Wailing Shade [1 in 31,010]") {
      if (skipCutsceneHalloween25) {
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
        wailingshadeAudio.play();
      }
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
      type: "MythicWall [1 in 170,017]",
      class: "mythicwallBgImg",
      chance: 0.00058817647,
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
    },
    {
      type: "Alien [1 in 6̴̩͚͂5̶̯̝̓3̷̝̎,̸̝̞̽͑8̸̨̛͜8̴͕̔̑2̴͉̦̇]",
      class: "alienBgImg",
      chance: 0.00015293279,
      titles: ["Catien", "Another Species"]
    }
  ];

  const {
    total: activeLuckPercent,
    permanent: activePermanentLuckPercent,
    potion: activePotionLuckPercent,
  } = getActiveLuckPercentBreakdown();
  capturePendingRollLuckSnapshot(activeLuckPercent);
  const luckMultiplier = 1 + activeLuckPercent / 100;
  const shouldRollDescendedTitle = shouldRollDescendedTitleThisRoll();
  let rolledDescendedDefinition = null;

  if (shouldRollDescendedTitle) {
    const roll = Math.random();
    const defaultDescendedDefinition =
      getDescendedDefinitionByType(DESCENDED_TITLE_TYPE) ||
      DESCENDED_TITLE_DEFINITIONS[0] ||
      null;
    if (roll < UNKNOWN_TITLE_REWARD_CHANCE) {
      rolledDescendedDefinition =
        getDescendedDefinitionByType(UNKNOWN_TITLE_TYPE) || defaultDescendedDefinition;
    } else if (roll < UNKNOWN_TITLE_REWARD_CHANCE + DESCENDED_POTION_REWARD_CHANCE) {
      rolledDescendedDefinition = defaultDescendedDefinition;
    }
  }
  consumeSingleUseBuffs();
  if (rolledDescendedDefinition) {
    return createDescendedRarityPayload(rolledDescendedDefinition);
  }
  const luckThreshold = computeLuckThreshold(
    activePermanentLuckPercent,
    activePotionLuckPercent,
  );
  const adjustedRarities = rarities.map((rarity) => {
    const affected = isRarityClassAffectedByLuck(rarity.class);
    const effectiveChance = rarity.chance * (affected ? luckMultiplier : 1);
    return { ...rarity, effectiveChance };
  });

  let availableRarities = adjustedRarities.filter((rarity) =>
    isRarityEligibleForLuck(rarity.type, luckThreshold)
  );

  if (!availableRarities.length) {
    availableRarities = adjustedRarities;
  }

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
    chance: 0.00001,
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
    if (rollCount % gate !== 0) {
      continue;
    }

    if (!isRarityEligibleForLuck(data.type, luckThreshold)) {
      continue;
    }

    const affected = isRarityClassAffectedByLuck(data.class);
    const adjustedChance = data.chance * (affected ? luckMultiplier : 1);
    const clampedChance = Math.min(1, adjustedChance);

    if (Math.random() < clampedChance) {
      return data;
    }
  }

  const total = availableRarities.reduce((sum, r) => sum + r.effectiveChance, 0);
  let pick = Math.random() * total;

  for (const r of availableRarities) {
    if ((pick -= r.effectiveChance) <= 0) {
      return r;
    }
  }

  return availableRarities[availableRarities.length - 1];
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

function navigateInCurrentTab(url) {
  if (typeof window === "undefined" || !window.location) {
    return;
  }

  try {
    if (typeof window.location.assign === "function") {
      window.location.assign(url);
    } else {
      window.location.href = url;
    }
  } catch (error) {
    try {
      window.location.href = url;
    } catch (secondaryError) {
      /* no-op */
    }
  }
}

function openDiscord() {
  navigateInCurrentTab("https://discord.gg/m6k7Jagm3v");
}

function openGithub() {
  navigateInCurrentTab("https://github.com/The-Unnamed-Official/Unnamed-RNG/tree/published");
}

function openRollingSimulator() {
  navigateInCurrentTab("https://the-unnamed-official.github.io/Sols-Rolling-Calculator/");
}

function selectTitle(rarity) {
  const titles = Array.isArray(rarity?.titles) && rarity.titles.length
    ? rarity.titles
    : [rarity?.type || "Unknown Title"];
  return titles[Math.floor(Math.random() * titles.length)];
}

function getCurrentLuckValue() {
  if (buffsDisabled) {
    return 1;
  }

  const permanentPercent = getPermanentLuckBonusPercent();
  const potionPercent = getActivePotionLuckBonusPercent();
  const totalPercent =
    (Number.isFinite(permanentPercent) ? permanentPercent : 0) +
    (Number.isFinite(potionPercent) ? potionPercent : 0);

  return computeLuckValueFromPercent(totalPercent);
}

function computeLuckValueFromPercent(totalPercent) {
  const normalizedPercent = Number.isFinite(totalPercent) ? totalPercent : 0;
  const value = 1 + normalizedPercent / 100;
  return value > 0 ? value : 0;
}

function computeLuckThreshold(permanentPercent, potionPercent) {
  const normalizedPermanent = Number.isFinite(permanentPercent)
    ? Math.max(0, permanentPercent)
    : 0;
  const normalizedPotion = Number.isFinite(potionPercent) ? Math.max(0, potionPercent) : 0;

  const totalPercent = normalizedPermanent + normalizedPotion;
  const threshold = computeLuckValueFromPercent(totalPercent);

  return threshold >= 1 ? threshold : 1;
}

function capturePendingRollLuckSnapshot(totalPercent) {
  pendingRollLuckValue = computeLuckValueFromPercent(totalPercent);
  return pendingRollLuckValue;
}

function consumePendingRollLuckSnapshot() {
  const snapshot = pendingRollLuckValue;
  pendingRollLuckValue = null;
  if (typeof snapshot === "number" && Number.isFinite(snapshot)) {
    return snapshot >= 0 ? snapshot : 0;
  }
  return null;
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
  const pendingLuckOverride = consumePendingRollLuckSnapshot();
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

  const luckValue = pendingLuckOverride !== null ? pendingLuckOverride : getCurrentLuckValue();

  const { record: newRecord } = normalizeInventoryRecord({
    title,
    rarityClass,
    rolledAt,
    luckValue,
  });
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
  if (cls === "theDescended") return "theDescended";
  if (["under100", "under1k", "under10k", "under100k", "under1m", "transcendent", "special", "theDescended"].includes(cls)) {
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
        normalizedLabel === "theDescended" ||
        normalizedLabel.startsWith("under")
      ) {
        return normalizedLabel;
      }
    }
  }

  const fallbackBucket = getClassForRarity(cls);
  if (fallbackBucket) {
    return fallbackBucket;
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

  const toggleBuffsSwitch = document.getElementById("toggleBuffsSwitch");
  if (toggleBuffsSwitch) {
    updateBuffsSwitchControl();
    toggleBuffsSwitch.addEventListener("change", () => {
      setBuffsDisabled(!toggleBuffsSwitch.checked);
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
  destitBgImg: { image: "files/backgrounds/destit.png", audio: "destitAudio" },
  unknownBgImg: { image: "files/backgrounds/unknown.png", audio: "unknownAudio" },
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
  alienBgImg: { image: "files/backgrounds/alien.png", audio: "alienAudio" },
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

function normalizeInventorySortMode(mode) {
  if (typeof mode !== "string") {
    return INVENTORY_SORT_MODES.DEFAULT;
  }

  const normalized = mode.trim().toLowerCase();
  return Object.values(INVENTORY_SORT_MODES).includes(normalized)
    ? normalized
    : INVENTORY_SORT_MODES.DEFAULT;
}

function getLockedItemsMap() {
  try {
    const stored = localStorage.getItem("lockedItems");
    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function getRaritySortRank(item) {
  const bucket = normalizeRarityBucket(item && item.rarityClass);

  if (bucket === "special" || bucket === "theDescended") {
    return 0;
  }

  if (bucket === "transcendent") {
    return 1;
  }

  if (bucket && bucket.startsWith("event")) {
    return 2;
  }

  if (bucket === "under1m") {
    return 3;
  }

  if (bucket === "under100k") {
    return 4;
  }

  if (bucket === "under10k") {
    return 5;
  }

  if (bucket === "under1k") {
    return 6;
  }

  if (bucket === "under100") {
    return 7;
  }

  if (bucket) {
    return 8;
  }

  return 9;
}

function getSortedInventoryEntries(lockedItems = getLockedItemsMap()) {
  const entries = inventory.map((item, index) => ({ item, index }));

  if (!entries.length) {
    return entries;
  }

  if (inventorySortMode === INVENTORY_SORT_MODES.LOCKED) {
    return entries.sort((a, b) => {
      const aLocked = Boolean(lockedItems && lockedItems[a.item.title]);
      const bLocked = Boolean(lockedItems && lockedItems[b.item.title]);

      if (aLocked !== bLocked) {
        return aLocked ? -1 : 1;
      }

      return a.index - b.index;
    });
  }

  if (inventorySortMode === INVENTORY_SORT_MODES.RARITY) {
    return entries.sort((a, b) => {
      const rankA = getRaritySortRank(a.item);
      const rankB = getRaritySortRank(b.item);

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return a.index - b.index;
    });
  }

  return entries;
}

function applyInventorySortModeToButtons() {
  const buttons = document.querySelectorAll(".inventory-sort__button");
  if (!buttons.length) {
    return;
  }

  buttons.forEach((button) => {
    const buttonMode = normalizeInventorySortMode(button.dataset.sortMode);
    const isActive = buttonMode === inventorySortMode;
    button.classList.toggle("inventory-sort__button--active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setInventorySortMode(mode) {
  const normalized = normalizeInventorySortMode(mode);
  if (normalized === inventorySortMode) {
    return;
  }

  inventorySortMode = normalized;

  if (inventorySortMode === INVENTORY_SORT_MODES.DEFAULT) {
    storage.remove(INVENTORY_SORT_MODE_KEY);
  } else {
    storage.set(INVENTORY_SORT_MODE_KEY, inventorySortMode);
  }

  currentPage = 1;
  renderInventory();
}

function setupInventorySortControls() {
  const container = document.querySelector(".inventory-sort");
  if (!container) {
    return;
  }

  const buttons = Array.from(container.querySelectorAll(".inventory-sort__button"));
  if (!buttons.length) {
    return;
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      setInventorySortMode(button.dataset.sortMode);
    });
  });

  applyInventorySortModeToButtons();
}

function setupInventorySearchControls() {
  const searchInput = document.getElementById("inventorySearchInput");
  if (!searchInput) {
    return;
  }

  const handleInput = (event) => {
    const value = typeof event.target.value === "string" ? event.target.value : "";
    inventorySearchQuery = value;
    currentPage = 1;
    renderInventory();
  };

  searchInput.addEventListener("input", handleInput);
  searchInput.addEventListener("search", handleInput);
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

function getInventoryItemKey(item, index) {
  if (item && typeof item.inventoryId === "string" && item.inventoryId.trim()) {
    return item.inventoryId;
  }

  if (item && Number.isFinite(item?.rolledAt)) {
    return `${item.title || "item"}::${item.rolledAt}`;
  }

  return `idx-${index}`;
}

function closeOtherDropdownMenus(exceptKey = null) {
  document.querySelectorAll(".dropdown-menu.open").forEach((menu) => {
    if (exceptKey && menu.dataset.itemKey === exceptKey) {
      return;
    }

    menu.style.display = "none";
    menu.classList.remove("open");
    const parentItem = menu.closest(".inventory-item");
    if (parentItem) {
      parentItem.classList.remove("inventory-item--menu-open");
    }
  });
}

function ensureInventoryListHandlers() {
  if (inventoryListHandlersInitialized) {
    return;
  }

  const inventoryList = document.getElementById("inventoryList");
  if (!inventoryList) {
    return;
  }

  const handleDropdownToggle = (toggleElement) => {
    const listItem = toggleElement.closest(".inventory-item");
    if (!listItem) {
      return;
    }

    const dropdownMenu = toggleElement.querySelector(".dropdown-menu");
    if (!dropdownMenu) {
      return;
    }

    const willOpen = dropdownMenu.style.display !== "block";
    closeOtherDropdownMenus(willOpen ? dropdownMenu.dataset.itemKey || null : null);

    dropdownMenu.style.display = willOpen ? "block" : "none";
    dropdownMenu.classList.toggle("open", willOpen);
    listItem.classList.toggle("inventory-item--menu-open", willOpen);
  };

  const handleInventoryAction = (button, event) => {
    const action = button.dataset.action;
    if (!action) {
      return;
    }

    const listItem = button.closest(".inventory-item");
    if (!listItem) {
      return;
    }

    if (action === "equip-toggle") {
      event.stopPropagation();
      if (cutsceneActive) {
        return;
      }

      const index = Number.parseInt(button.dataset.absoluteIndex, 10);
      const item = Number.isFinite(index) ? inventory[index] : null;
      if (!item) {
        return;
      }

      if (isItemCurrentlyEquipped(item)) {
        unequipItem();
      } else {
        equipItem(item);
      }
      return;
    }

    if (action === "delete") {
      event.stopPropagation();
      if (cutsceneActive || listItem.dataset.locked === "true") {
        return;
      }

      const index = Number.parseInt(button.dataset.absoluteIndex, 10);
      if (Number.isFinite(index)) {
        deleteFromInventory(index);
      }
      return;
    }

    if (action === "lock-toggle") {
      event.stopPropagation();
      const title = listItem.dataset.itemTitle || "";
      toggleLock(title, listItem, button);
    }
  };

  inventoryList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (actionButton && inventoryList.contains(actionButton)) {
      handleInventoryAction(actionButton, event);
      return;
    }

    if (event.target.closest(".dropdown-menu")) {
      return;
    }

    const toggleElement = event.target.closest(".burger-bar");
    if (toggleElement && inventoryList.contains(toggleElement)) {
      event.stopPropagation();
      handleDropdownToggle(toggleElement);
    }
  });

  inventoryListHandlersInitialized = true;
}

function buildInventoryListItem(existingElement, item, originalIndex, lockedItems, previousStateEntry) {
  const itemKey = getInventoryItemKey(item, originalIndex);
  const bucket = normalizeRarityBucket(item.rarityClass);
  const locked = Boolean(lockedItems && lockedItems[item.title]);
  const isEquipped = isItemCurrentlyEquipped(item);
  const rolledText = typeof item.rolledAt === "number"
    ? (typeof formatRollCount === "function" ? formatRollCount(item.rolledAt) : item.rolledAt.toLocaleString())
    : "Unknown";
  const luckValue = typeof item.luckValue === "number" && Number.isFinite(item.luckValue)
    ? item.luckValue
    : 1;
  const formattedLuck = luckValue.toFixed(2);

  const rarityLabelClasses = getLabelClassForRarity(item.rarityClass, bucket);

  const listItem = existingElement || document.createElement("li");
  listItem.className = item.rarityClass || "";
  listItem.classList.add("inventory-item");
  listItem.dataset.itemKey = itemKey;
  listItem.dataset.absoluteIndex = String(originalIndex);
  listItem.dataset.itemTitle = item.title;
  listItem.dataset.locked = locked ? "true" : "false";
  listItem.dataset.equipped = isEquipped ? "true" : "false";

  if (bucket) {
    listItem.dataset.bucket = bucket;
  } else {
    delete listItem.dataset.bucket;
  }

  listItem.classList.toggle("inventory-item--equipped", Boolean(isEquipped));

  let itemTitle = listItem.querySelector(".rarity-text");
  let rarityText = listItem.querySelector(".inventory-item__rarity");
  let burgerBar = listItem.querySelector(".burger-bar");
  let dropdownMenu = burgerBar ? burgerBar.querySelector(".dropdown-menu") : null;

  if (!itemTitle) {
    itemTitle = document.createElement("span");
    itemTitle.className = "rarity-text";
    listItem.appendChild(itemTitle);
  }

  if (!rarityText) {
    rarityText = document.createElement("span");
    rarityText.className = "inventory-item__rarity";
    listItem.appendChild(rarityText);
  }

  if (!burgerBar) {
    burgerBar = document.createElement("div");
    burgerBar.className = "burger-bar";
    burgerBar.textContent = "☰";
    listItem.appendChild(burgerBar);
  }

  if (!dropdownMenu) {
    dropdownMenu = document.createElement("div");
    dropdownMenu.className = "dropdown-menu";
    dropdownMenu.style.display = "none";
    dropdownMenu.dataset.itemKey = itemKey;
    burgerBar.appendChild(dropdownMenu);

    const header = document.createElement("div");
    header.className = "dropdown-header";
    header.innerHTML = `
      <div class="info-title"></div>
      <div class="info-sub">
        <span class="info-sub__rolled"></span>
        <span class="info-sub__luck"></span>
      </div>
    `;
    dropdownMenu.appendChild(header);

    const divider = document.createElement("div");
    divider.className = "dropdown-divider";
    dropdownMenu.appendChild(divider);

    const equipButton = document.createElement("button");
    equipButton.className = "dropdown-item";
    equipButton.dataset.action = "equip-toggle";
    dropdownMenu.appendChild(equipButton);

    const deleteButton = document.createElement("button");
    deleteButton.className = "dropdown-item danger";
    deleteButton.dataset.action = "delete";
    dropdownMenu.appendChild(deleteButton);

    const lockButton = document.createElement("button");
    lockButton.dataset.action = "lock-toggle";
    dropdownMenu.appendChild(lockButton);
  }

  const defaultTitle = item.title.toUpperCase();
  itemTitle.className = "rarity-text";
  if (rarityLabelClasses.length) {
    itemTitle.classList.add(...rarityLabelClasses);
  }

  if (previousStateEntry && typeof previousStateEntry.rarityLabel === "string") {
    itemTitle.textContent = previousStateEntry.rarityLabel;
  } else if (!itemTitle.textContent || !existingElement) {
    itemTitle.textContent = defaultTitle;
  }

  const headerTitleElement = dropdownMenu.querySelector(".info-title");
  if (headerTitleElement) {
    if (previousStateEntry && previousStateEntry.headerTitle != null) {
      headerTitleElement.textContent = previousStateEntry.headerTitle;
    } else {
      headerTitleElement.textContent = item.title;
    }
  }

  const rolledElement = dropdownMenu.querySelector(".info-sub__rolled");
  if (rolledElement) {
    rolledElement.textContent = `Rolled at: ${rolledText}`;
  }

  const luckElement = dropdownMenu.querySelector(".info-sub__luck");
  if (luckElement) {
    luckElement.textContent = `Luck: ${formattedLuck}`;
  }

  dropdownMenu.dataset.itemKey = itemKey;

  const equipButton = dropdownMenu.querySelector('[data-action="equip-toggle"]');
  if (equipButton) {
    equipButton.dataset.absoluteIndex = String(originalIndex);
    equipButton.textContent = isEquipped ? "Unequip" : "Equip";
    equipButton.classList.toggle("dropdown-item--unequip", Boolean(isEquipped));
    setEquipToggleButtonDisabled(equipButton, cutsceneActive);
  }

  const deleteButton = dropdownMenu.querySelector('[data-action="delete"]');
  if (deleteButton) {
    deleteButton.dataset.absoluteIndex = String(originalIndex);
    deleteButton.textContent = "Delete";
    setInventoryDeleteButtonDisabled(deleteButton, cutsceneActive);
  }

  const lockButton = dropdownMenu.querySelector('[data-action="lock-toggle"]');
  if (lockButton) {
    lockButton.textContent = locked ? "Unlock" : "Lock";
    lockButton.style.backgroundColor = locked ? "darkgray" : "";
  }

  if (previousStateEntry && previousStateEntry.dropdownOpen) {
    dropdownMenu.style.display = "block";
    dropdownMenu.classList.add("open");
    listItem.classList.add("inventory-item--menu-open");
    if (typeof previousStateEntry.dropdownScrollTop === "number" && previousStateEntry.dropdownScrollTop > 0) {
      dropdownMenu.scrollTop = previousStateEntry.dropdownScrollTop;
    }
  } else {
    dropdownMenu.style.display = "none";
    dropdownMenu.classList.remove("open");
    listItem.classList.remove("inventory-item--menu-open");
  }

  return listItem;
}

function getInventorySearchCandidates(item) {
  if (!item || typeof item !== "object") {
    return [];
  }

  const seen = new Set();
  const candidates = [];

  const addCandidate = (value) => {
    if (typeof value !== "string") {
      return;
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    candidates.push(normalized);
  };

  const addTitleCandidates = (value) => {
    if (typeof value !== "string") {
      return;
    }

    addCandidate(value);

    const bracketIndex = value.indexOf("[");
    if (bracketIndex > 0) {
      addCandidate(value.slice(0, bracketIndex));
    }

    const withoutBrackets = value.replace(/\[[^\]]*\]/g, "");
    if (withoutBrackets !== value) {
      addCandidate(withoutBrackets);
    }
  };

  addTitleCandidates(item.title);
  addTitleCandidates(item.displayTitle);

  return candidates;
}

function renderInventory() {
  const inventoryList = document.getElementById("inventoryList");
  if (!inventoryList) {
    return;
  }

  ensureInventoryListHandlers();

  const previousState = new Map();
  inventoryList.querySelectorAll(".inventory-item").forEach((element) => {
    const key = element.dataset.itemKey;
    if (!key) {
      return;
    }

    const dropdownMenu = element.querySelector(".dropdown-menu");
    const rarityTextElement = element.querySelector(".rarity-text");
    const infoTitleElement = dropdownMenu?.querySelector(".info-title");
    previousState.set(key, {
      dropdownOpen: Boolean(
        dropdownMenu && (dropdownMenu.classList.contains("open") || dropdownMenu.style.display === "block")
      ),
      dropdownScrollTop: dropdownMenu ? dropdownMenu.scrollTop : 0,
      rarityLabel: rarityTextElement ? rarityTextElement.textContent : null,
      headerTitle: infoTitleElement ? infoTitleElement.textContent : null,
    });
  });

  applyInventorySortModeToButtons();

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

  const lockedItems = getLockedItemsMap();
  const sortedEntries = getSortedInventoryEntries(lockedItems);
  const normalizedQuery = (inventorySearchQuery || "").trim().toLowerCase();
  const filteredEntries = normalizedQuery
    ? sortedEntries.filter(({ item }) => {
        if (!item) {
          return false;
        }

        return getInventorySearchCandidates(item).some((candidate) =>
          candidate.includes(normalizedQuery),
        );
      })
    : sortedEntries;

  filteredInventoryLength = filteredEntries.length;

  const totalPages = Math.max(1, Math.ceil(filteredInventoryLength / itemsPerPage));

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedEntries = filteredEntries.slice(start, end);

  const existingElements = new Map();
  inventoryList.querySelectorAll(".inventory-item").forEach((element) => {
    const key = element.dataset.itemKey;
    if (key) {
      existingElements.set(key, element);
    }
  });

  const newOrder = [];

  paginatedEntries.forEach(({ item, index: originalIndex }) => {
    const itemKey = getInventoryItemKey(item, originalIndex);
    const previous = previousState.get(itemKey);
    const existingElement = existingElements.get(itemKey) || null;
    const listItem = buildInventoryListItem(existingElement, item, originalIndex, lockedItems, previous);
    existingElements.delete(itemKey);
    newOrder.push(listItem);
  });

  existingElements.forEach((element) => {
    element.remove();
  });

  let anchor = inventoryList.firstChild;
  newOrder.forEach((element) => {
    if (element === anchor) {
      anchor = anchor ? anchor.nextSibling : null;
      return;
    }
    inventoryList.insertBefore(element, anchor);
  });

  updatePagination();
  checkAchievements();
  renderPotionCrafting();
}

function toggleLock(itemTitle, listItem, lockButton) {
  const lockedItems = getLockedItemsMap();
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

  if (inventorySortMode === INVENTORY_SORT_MODES.LOCKED) {
    renderInventory();
  }
}

function deleteFromInventory(absoluteIndex) {
  const lockedItems = getLockedItemsMap();
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

  const totalPages = Math.max(1, Math.ceil(filteredInventoryLength / itemsPerPage));
  pageNumber.textContent = `Page ${currentPage} of ${totalPages}`;

  backPageButton.disabled = currentPage === 1;
  prevPageButton.disabled = currentPage === 1;
  nextPageButton.disabled = currentPage === totalPages;
  lastPageButton.disabled = currentPage === totalPages;
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
  const totalPages = Math.max(1, Math.ceil(filteredInventoryLength / itemsPerPage));
  if (currentPage < totalPages) {
    currentPage++;
    renderInventory();
  }
}

function lastPage() {
  const totalPages = Math.max(1, Math.ceil(filteredInventoryLength / itemsPerPage));
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
  const potionMenu = document.getElementById("potionCraftingMenu");
  const potionHeader = potionMenu?.querySelector(".potion-menu__header");
  const dragStates = [];

  function registerDraggableMenu(menu, handles, closeSelector) {
    const dragHandles = (handles || []).filter(Boolean);
    if (!menu || dragHandles.length === 0) {
      return;
    }

    const state = {
      menu,
      handles: dragHandles,
      closeSelector,
      dragging: false,
      offsetX: 0,
      offsetY: 0,
    };

    dragHandles.forEach((handle) => {
      handle.addEventListener("mousedown", (event) => {
        if (event.button !== 0) {
          return;
        }

        if (closeSelector && event.target.closest(closeSelector)) {
          return;
        }

        const rect = menu.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.top}px`;
        menu.style.transform = "none";

        state.offsetX = event.clientX - rect.left;
        state.offsetY = event.clientY - rect.top;
        state.dragging = true;
        state.handles.forEach((dragHandle) => dragHandle.classList.add("is-dragging"));
        event.preventDefault();
      });
    });

    dragStates.push(state);
  }

  registerDraggableMenu(settingsMenu, [settingsHeader], ".settings-close-btn");
  registerDraggableMenu(achievementsMenu, [achievementsHeader], ".achievements-close-btn");
  registerDraggableMenu(statsMenu, [statsHeader, statsDragHandle], ".stats-close-btn");
  registerDraggableMenu(potionMenu, [potionHeader], ".potion-menu__close");

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
    dragStates.forEach((state) => {
      if (!state.dragging) {
        return;
      }

      state.menu.style.left = `${event.clientX - state.offsetX}px`;
      state.menu.style.top = `${event.clientY - state.offsetY}px`;
    });
  });

  document.addEventListener("mouseup", () => {
    dragStates.forEach((state) => {
      if (!state.dragging) {
        return;
      }

      state.dragging = false;
      state.handles.forEach((dragHandle) => dragHandle.classList.remove("is-dragging"));
    });
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
  const potionButton = document.getElementById("potionCraftingButton");
  const potionMenu = document.getElementById("potionCraftingMenu");
  const closePotion = document.getElementById("closePotionCrafting");

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

  if (potionButton && potionMenu) {
    potionButton.addEventListener("click", () => {
      potionMenu.style.display = "flex";
      renderPotionCrafting();
    });
  }

  if (closePotion && potionMenu) {
    closePotion.addEventListener("click", () => {
      potionMenu.style.display = "none";
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

    if (autoRollActive) {
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

function getRelativeTime() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function getAutoRollDelay() {
  const baseCooldown = Number.isFinite(cooldownTime) ? cooldownTime : BASE_COOLDOWN_TIME;
  const desiredDelay = Math.max(5, baseCooldown + 5);

  if (autoRollLastExecution === null) {
    return desiredDelay;
  }

  const elapsed = getRelativeTime() - autoRollLastExecution;
  if (!Number.isFinite(elapsed)) {
    return desiredDelay;
  }

  const remaining = desiredDelay - elapsed;
  return Math.max(5, Math.round(remaining));
}

function scheduleAutoRollTick(delayOverride = null) {
  if (!autoRollActive) {
    return;
  }

  if (autoRollInterval) {
    clearTimeout(autoRollInterval);
    autoRollInterval = null;
  }

  const nextDelay = Number.isFinite(delayOverride) ? Math.max(5, Math.round(delayOverride)) : getAutoRollDelay();

  autoRollInterval = setTimeout(() => {
    autoRollInterval = null;

    if (!autoRollActive) {
      return;
    }

    const rollButton = document.getElementById("rollButton");
    if (!rollButton || rollButton.disabled) {
      scheduleAutoRollTick();
      return;
    }

    rollButton.click();
    autoRollLastExecution = getRelativeTime();

    scheduleAutoRollTick();
  }, nextDelay);
}

function startAutoRoll() {
  if (!autoRollButtonElement || autoRollActive || !isAutoRollUnlocked()) {
    return;
  }

  autoRollActive = true;
  const baseCooldown = Number.isFinite(cooldownTime) ? cooldownTime : BASE_COOLDOWN_TIME;
  const initialDesiredDelay = Math.max(5, baseCooldown + 5);
  autoRollLastExecution = getRelativeTime() - initialDesiredDelay;
  scheduleAutoRollTick(5);
  localStorage.setItem("autoRollEnabled", "true");
  updateAutoRollAvailability();
}

function stopAutoRoll() {
  if (!autoRollButtonElement) {
    return;
  }

  autoRollActive = false;
  if (autoRollInterval) {
    clearTimeout(autoRollInterval);
    autoRollInterval = null;
  }
  autoRollLastExecution = null;
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
      clearTimeout(autoRollInterval);
      autoRollInterval = null;
    }
    autoRollActive = false;
    autoRollLastExecution = null;
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
  if (autoRollActive) {
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
    ["deleteAllTheDescendedButton", "theDescended"],
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
      'Cursed Mirage [1 in 11,111]': 'cursedmirageBgImg',
      'Celestial Dawn [1 in 12,000]': 'under100k',
      'Blodhest [1 in 25,252]': 'under100k',
      'Unnamed [1 in 30,303]': 'under100k',
      "Fate's Requiem [1 in 15,000]": 'under100k',
      'Eonbreak [1 in 20,000]': 'under100k',
      'Overture [1 in 25,641]': 'under100k',
      'HARV [1 in 33,333]': 'under100k',
      "Devil's Heart [1 in 66,666]": 'under100k',
      'Arcane Pulse [1 in 77,777]': 'under100k',
      'Impeached [1 in 101,010]': 'under1m',
      'Celestial Chorus [1 in 202,020]': 'under1m',
      'Silly Car :3 [1 in 1,000,000]': 'transcendent',
      'H1di [1 in 9,890,089]': 'transcendent',
      'BlindGT [1 in 2,000,000/15th]': 'special',
      'MSFU [1 in 333/333rd]': 'special',
      'ORB [1 in 55,555/30th]': 'special',
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
      'Mastermind [1 in 110,010]': 'under1m',
      'Alien [1 in 6̴̩͚͂5̶̯̝̓3̷̝̎,̸̝̞̽͑8̸̨̛͜8̴͕̔̑2̴͉̦̇]': 'under1m',
      "MythicWall [1 in 170,017]": 'under100k',
      "The Scarecrow's Sigil [1 in 1,031]": 'eventTitleHalloween25',
      "Pumpkin Hollow [1 in 3,110]": 'eventTitleHalloween25',
      "Wailing Shade [1 in 31,010]": 'eventTitleHalloween25',
      "Hollow Hill Manor [1 in 10,031]": 'eventTitleHalloween25',
      "The Void's Veil [1 in 10,031]": 'eventTitleHalloween25',
      "The Phantom Moon [1 in 10,031]": 'eventTitleHalloween25',
      "Descended Title [1 in ƐƐƐ]": 'theDescended',
      "UnKnOwN [1 in ᔦᔦᔦ]": 'theDescended'
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
  .getElementById("deleteAllAlienButton")
  .addEventListener("click", () => deleteAllByRarity("alienBgImg"));
document
  .getElementById("deleteAllHypernovaButton")
  .addEventListener("click", () => deleteAllByRarity("hypernovaBgImg"));
document
  .getElementById("deleteAllNebulaButton")
  .addEventListener("click", () => deleteAllByRarity("nebulaBgImg"));
document
  .getElementById("deleteAllDescendedTitleButton")
  .addEventListener("click", () => deleteAllByRarity("destitBgImg"));

document
  .getElementById("deleteAllUnknownTitleButton")
  .addEventListener("click", () => deleteAllByRarity("unknownBgImg"));

document
  .getElementById("deleteAllTheDescendedButton")
  .addEventListener("click", () => {
    renderInventory();
    DESCENDED_TITLE_CLASS_SET.forEach((rarityClass) => {
      deleteAllByRarity(rarityClass);
    });
  });


document
  .getElementById("deleteAllUnder1mButton")
  .addEventListener("click", () => {
    renderInventory();
    const raritiesUnder10k = [
      "impeachedBgImg",
      "celestialchorusBgImg",
      "x1staBgImg",
      "astraldBgImg",
      "mastermindBgImg",
      "alienBgImg"
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
  const normalizedOptions =
    typeof options === "object" && options !== null ? options : { force: Boolean(options) };

  const force = Boolean(normalizedOptions.force);
  const preservePendingAutoEquip = Boolean(normalizedOptions.preservePendingAutoEquip);

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
    if (!force || preservePendingAutoEquip) {
      applyPendingAutoEquip();
    } else {
      pendingAutoEquipRecord = null;
    }
  }
}