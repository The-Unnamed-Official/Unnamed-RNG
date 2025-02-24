let inventory = JSON.parse(localStorage.getItem("inventory")) || [];
let currentPage = 1;
const itemsPerPage = 10;
let rollCount = parseInt(localStorage.getItem("rollCount")) || 0;
let rollCount1 = parseInt(localStorage.getItem("rollCount")) || 0;
let cooldownTime = 690;
let timeoutId;
let countdownInterval;
let tabbedOutTime = null;
let currentAudio = null;
let isChangeEnabled = true;
let autoRollInterval = null;
let audioVolume = 1;
let isMuted = false;
let previousVolume = audioVolume;

document.addEventListener("DOMContentLoaded", () => {
  const rollButton = document.getElementById("rollButton");
  const startButton = document.getElementById("startButton");
  const loadingScreen = document.getElementById("loadingScreen");
  const menuScreen = document.getElementById("menuScreen");

  rollButton.disabled = true;

  startButton.addEventListener("click", () => {
    mainAudio.play();
    menuScreen.style.display = "none";
    loadingScreen.style.display = "flex";
    load();
    setTimeout(() => {
      load();
      loadContent();
    }, 1000);
    setTimeout(() => {
      rollButton.disabled = false;
      loadingScreen.style.display = "none";
      formatRollCount();
      loadToggledStates();
    }, 2000);
  });
});

function loadContent() {
  const storedInventory = localStorage.getItem("inventory");
  if (storedInventory) {
    inventory = JSON.parse(storedInventory);
  }
  renderInventory();
  musicLoad();
  loadToggledStates();
  updateRollCount();
  document.getElementById("rollCountDisplay").innerText = formatRollCount(rollCount);
  document.getElementById("rollCountDisplay1").innerText = rollCount1;
}

function load() {
  document.addEventListener("DOMContentLoaded", (event) => {
    const storedInventory = localStorage.getItem("inventory");
    if (storedInventory) {
      inventory = JSON.parse(storedInventory);
    }
    renderInventory();
    musicLoad();
    loadToggledStates();
    updateRollCount();
    formatRollCount();
  });
}

function musicLoad() {
  let suspenseAudio = document.getElementById("suspenseAudio");
  let expOpeningAudio = document.getElementById("expOpeningAudio");
  let geezerSuspenceAudio = document.getElementById("geezerSuspenceAudio");
  let polarrSuspenceAudio = document.getElementById("polarrSuspenceAudio");
  let scareSuspenceAudio = document.getElementById("scareSuspenceAudio");
  let bigSuspenceAudio = document.getElementById("bigSuspenceAudio");
  let astblaAudio = document.getElementById("astblaAudio");
  let iriAudio = document.getElementById("iriAudio");
  let heartAudio = document.getElementById("heartAudio");
  let tuonAudio = document.getElementById("tuonAudio");
  let aboAudio = document.getElementById("aboAudio");
  let lubjubAudio = document.getElementById("lubjubAudio");
  let plabreAudio = document.getElementById("plabreAudio");
  let isekaiAudio = document.getElementById("isekaiAudio");
  let fircraAudio = document.getElementById("fircraAudio");
  let emerAudio = document.getElementById("emerAudio");
  let shadAudio = document.getElementById("shadAudio");
  let samuraiAudio = document.getElementById("samuraiAudio");
  let contAudio = document.getElementById("contAudio");
  let unstoppableAudio = document.getElementById("unstoppableAudio");
  let gargantuaAudio = document.getElementById("gargantuaAudio");
  let spectralAudio = document.getElementById("spectralAudio");
  let starfallAudio = document.getElementById("starfallAudio");
  let memAudio = document.getElementById("memAudio");
  let oblAudio = document.getElementById("oblAudio");
  let phaAudio = document.getElementById("phaAudio");
  let frightAudio = document.getElementById("frightAudio");
  let unnamedAudio = document.getElementById("unnamedAudio");
  let overtureAudio = document.getElementById("overtureAudio");
  let impeachedAudio = document.getElementById("impeachedAudio");
  let eonbreakAudio = document.getElementById("eonbreakAudio");
  let ethAudio = document.getElementById("ethAudio");
  let celAudio = document.getElementById("celAudio");
  let serAudio = document.getElementById("serAudio");
  let arcAudio = document.getElementById("arcAudio");
  let silcarAudio = document.getElementById("silcarAudio");
  let gregAudio = document.getElementById("gregAudio");
  let mintllieAudio = document.getElementById("mintllieAudio");
  let geezerAudio = document.getElementById("geezerAudio");
  let polarrAudio = document.getElementById("polarrAudio");
  let oppAudio = document.getElementById("oppAudio");
  let curAudio = document.getElementById("curAudio");
  let wanspiAudio = document.getElementById("wanspiAudio");
  let nighAudio = document.getElementById("nighAudio");
  let mysAudio = document.getElementById("mysAudio");
  let voiAudio = document.getElementById("voiAudio");
  let endAudio = document.getElementById("endAudio");
  let shaAudio = document.getElementById("shadAudio");
  let twiligAudio = document.getElementById("twiligAudio");
  let specAudio = document.getElementById("specAudio");
  let silAudio = document.getElementById("silAudio");
  let froAudio = document.getElementById("froAudio");
  let forgAudio = document.getElementById("forgAudio");
  let ghoAudio = document.getElementById("ghoAudio");
  let curartAudio = document.getElementById("curartAudio");
  let abysAudio = document.getElementById("abysAudio");
  let hellAudio = document.getElementById("hellAudio");
  let eniAudio = document.getElementById("eniAudio");
  let griAudio = document.getElementById("griAudio");
  let fatreAudio = document.getElementById("fatreAudio");
  let fearAudio = document.getElementById("fearAudio");
  let hauAudio = document.getElementById("hauAudio");
  let celdawAudio = document.getElementById("celdawAudio");
  let lostsAudio = document.getElementById("lostsAudio");
  let hauntAudio = document.getElementById("hauntAudio");
  let devilAudio = document.getElementById("devilAudio");
  let darAudio = document.getElementById("darAudio");
  let h1diAudio = document.getElementById("h1diAudio");
  let pumpkinAudio = document.getElementById("pumpkinAudio");
  let foundsAudio = document.getElementById("foundsAudio");
  let ethpulAudio = document.getElementById("ethpulAudio");
  let norstaAudio = document.getElementById("norstaAudio");
  let sanclaAudio = document.getElementById("sanclaAudio");
  let silnigAudio = document.getElementById("silnigAudio");
  let reidasAudio = document.getElementById("reidasAudio");
  let frogarAudio = document.getElementById("frogarAudio");
  let cancansymAudio = document.getElementById("cancansymAudio");
  let ginharAudio = document.getElementById("ginharAudio");
  let jolbelAudio = document.getElementById("jolbelAudio");
  let harvAudio = document.getElementById("harvAudio");
  let expAudio = document.getElementById("expAudio");
  let veilAudio = document.getElementById("veilAudio");
  let demsoAudio = document.getElementById("demsoAudio");
  let blindAudio = document.getElementById("blindAudio");
  let msfuAudio = document.getElementById("msfuAudio");
  let blodAudio = document.getElementById("blodAudio");
  let orbAudio = document.getElementById("orbAudio");
  let astredAudio = document.getElementById("astredAudio");
  let crazeAudio = document.getElementById("crazeAudio");

  suspenseAudio.pause();
  expOpeningAudio.pause();
  geezerSuspenceAudio.pause();
  polarrSuspenceAudio.pause();
  scareSuspenceAudio.pause();
  astblaAudio.pause();
  heartAudio.pause();
  tuonAudio.pause();
  blindAudio.pause();
  iriAudio.pause();
  aboAudio.pause();
  shaAudio.pause();
  lubjubAudio.pause();
  demsoAudio.pause();
  fircraAudio.pause();
  plabreAudio.pause();
  harvAudio.pause();
  norstaAudio.pause();
  sanclaAudio.pause();
  silnigAudio.pause();
  reidasAudio.pause();
  frogarAudio.pause();
  cancansymAudio.pause();
  ginharAudio.pause();
  jolbelAudio.pause();
  eniAudio.pause();
  darAudio.pause();
  nighAudio.pause();
  specAudio.pause();
  twiligAudio.pause();
  silAudio.pause();
  isekaiAudio.pause();
  emerAudio.pause();
  samuraiAudio.pause();
  contAudio.pause();
  unstoppableAudio.pause();
  gargantuaAudio.pause();
  spectralAudio.pause();
  starfallAudio.pause();
  memAudio.pause();
  oblAudio.pause();
  phaAudio.pause();
  frightAudio.pause();
  unnamedAudio.pause();
  overtureAudio.pause();
  impeachedAudio.pause();
  eonbreakAudio.pause();
  celAudio.pause();
  silcarAudio.pause();
  gregAudio.pause();
  mintllieAudio.pause();
  geezerAudio.pause();
  polarrAudio.pause();
  oppAudio.pause();
  serAudio.pause();
  arcAudio.pause();
  ethAudio.pause();
  curAudio.pause();
  hellAudio.pause();
  wanspiAudio.pause();
  mysAudio.pause();
  voiAudio.pause();
  endAudio.pause();
  shadAudio.pause();
  froAudio.pause();
  forgAudio.pause();
  curartAudio.pause();
  ghoAudio.pause();
  abysAudio.pause();
  ethpulAudio.pause();
  griAudio.pause();
  celdawAudio.pause();
  fatreAudio.pause();
  fearAudio.pause();
  hauAudio.pause();
  foundsAudio.pause();
  lostsAudio.pause();
  hauntAudio.pause();
  devilAudio.pause();
  pumpkinAudio.pause();
  h1diAudio.pause();
  bigSuspenceAudio.pause();
  expAudio.pause();
  veilAudio.pause();
  msfuAudio.pause();
  blodAudio.pause();
  orbAudio.pause();
  astredAudio.pause();
  crazeAudio.pause();

  suspenseAudio.currentTime = 0;
  expOpeningAudio.currentTime = 0;
  geezerSuspenceAudio.currentTime = 0;
  polarrSuspenceAudio.currentTime = 0;
  scareSuspenceAudio.currentTime = 0;
  tuonAudio.currentTime = 0;
  astblaAudio.currentTime = 0;
  heartAudio.currentTime = 0;
  iriAudio.currentTime = 0;
  blindAudio.currentTime = 0;
  aboAudio.currentTime = 0;
  shaAudio.currentTime = 0;
  demsoAudio.currentTime = 0;
  lubjubAudio.currentTime = 0;
  fircraAudio.currentTime = 0;
  plabreAudio.currentTime = 0;
  harvAudio.currentTime = 0;
  h1diAudio.currentTime = 0;
  jolbelAudio.currentTime = 0;
  ginharAudio.currentTime = 0;
  cancansymAudio.currentTime = 0;
  frogarAudio.currentTime = 0;
  reidasAudio.currentTime = 0;
  silnigAudio.currentTime = 0;
  sanclaAudio.currentTime = 0;
  norstaAudio.currentTime = 0;
  nighAudio.currentTime = 0;
  pumpkinAudio.currentTime = 0;
  devilAudio.currentTime = 0;
  hauntAudio.currentTime = 0;
  lostsAudio.currentTime = 0;
  foundsAudio.currentTime = 0;
  hauAudio.currentTime = 0;
  fatreAudio.currentTime = 0;
  fearAudio.currentTime = 0;
  celdawAudio.currentTime = 0;
  griAudio.currentTime = 0;
  eniAudio.currentTime = 0;
  curartAudio.currentTime = 0;
  ethpulAudio.currentTime = 0;
  ghoAudio.currentTime = 0;
  froAudio.currentTime = 0;
  silAudio.currentTime = 0;
  shadAudio.currentTime = 0;
  specAudio.currentTime = 0;
  twiligAudio.currentTime = 0;
  isekaiAudio.currentTime = 0;
  emerAudio.currentTime = 0;
  samuraiAudio.currentTime = 0;
  contAudio.currentTime = 0;
  unstoppableAudio.currentTime = 0;
  gargantuaAudio.currentTime = 14.5;
  spectralAudio.currentTime = 0;
  starfallAudio.currentTime = 0;
  memAudio.currentTime = 0;
  oblAudio.currentTime = 0;
  phaAudio.currentTime = 0;
  frightAudio.currentTime = 0;
  unnamedAudio.currentTime = 0;
  overtureAudio.currentTime = 0;
  impeachedAudio.currentTime = 0;
  eonbreakAudio.currentTime = 2;
  celAudio.currentTime = 0;
  silcarAudio.currentTime = 0;
  gregAudio.currentTime = 0;
  mintllieAudio.currentTime = 37;
  geezerAudio.currentTime = 0;
  polarrAudio.currentTime = 0;
  oppAudio.currentTime = 0;
  serAudio.currentTime = 0;
  arcAudio.currentTime = 0;
  ethAudio.currentTime = 0;
  curAudio.currentTime = 0;
  hellAudio.currentTime = 0;
  wanspiAudio.currentTime = 0;
  mysAudio.currentTime = 0;
  voiAudio.currentTime = 0;
  endAudio.currentTime = 0;
  forgAudio.currentTime = 0;
  darAudio.currentTime = 0;
  abysAudio.currentTime = 0;
  bigSuspenceAudio.currentTime = 0;
  expAudio.currentTime = 0;
  veilAudio.currentTime = 0;
  msfuAudio.currentTime = 0;
  blodAudio.currentTime = 0;
  orbAudio.currentTime = 0;
  astredAudio.currentTime = 0;
  crazeAudio.currentTime = 0;
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

function updateRollCount(increment = 1) {
  rollCount += increment;
  rollCount1 += increment;
  const display = document.getElementById('rollCountDisplay');
  const display1 = document.getElementById('rollCountDisplay');
  display.textContent = formatRollCount(rollCount);
  display1.textContent = rollCount1;
}

document.getElementById("rollButton").addEventListener("click", function () {
  let rollButton = document.getElementById("rollButton");

  mainAudio.pause();

  if (rollCount < 1) {
    rollCount++;
  }

  suspenseAudio.pause();
  geezerSuspenceAudio.pause();
  polarrSuspenceAudio.pause();
  scareSuspenceAudio.pause();
  astblaAudio.pause();
  tuonAudio.pause();
  iriAudio.pause();
  aboAudio.pause();
  shaAudio.pause();
  lubjubAudio.pause();
  plabreAudio.pause();
  demsoAudio.pause();
  harvAudio.pause();
  norstaAudio.pause();
  sanclaAudio.pause();
  silnigAudio.pause();
  reidasAudio.pause();
  frogarAudio.pause();
  cancansymAudio.pause();
  ginharAudio.pause();
  jolbelAudio.pause();
  eniAudio.pause();
  darAudio.pause();
  nighAudio.pause();
  specAudio.pause();
  twiligAudio.pause();
  silAudio.pause();
  isekaiAudio.pause();
  emerAudio.pause();
  samuraiAudio.pause();
  contAudio.pause();
  unstoppableAudio.pause();
  gargantuaAudio.pause();
  spectralAudio.pause();
  starfallAudio.pause();
  memAudio.pause();
  oblAudio.pause();
  phaAudio.pause();
  frightAudio.pause();
  unnamedAudio.pause();
  overtureAudio.pause();
  impeachedAudio.pause();
  eonbreakAudio.pause();
  celAudio.pause();
  silcarAudio.pause();
  gregAudio.pause();
  mintllieAudio.pause();
  geezerAudio.pause();
  polarrAudio.pause();
  oppAudio.pause();
  serAudio.pause();
  arcAudio.pause();
  ethAudio.pause();
  curAudio.pause();
  hellAudio.pause();
  wanspiAudio.pause();
  mysAudio.pause();
  voiAudio.pause();
  endAudio.pause();
  shadAudio.pause();
  froAudio.pause();
  forgAudio.pause();
  curartAudio.pause();
  ghoAudio.pause();
  abysAudio.pause();
  ethpulAudio.pause();
  griAudio.pause();
  celdawAudio.pause();
  fatreAudio.pause();
  fearAudio.pause();
  hauAudio.pause();
  foundsAudio.pause();
  lostsAudio.pause();
  hauntAudio.pause();
  devilAudio.pause();
  pumpkinAudio.pause();
  h1diAudio.pause();
  bigSuspenceAudio.pause();
  expAudio.pause();
  expOpeningAudio.pause();
  veilAudio.pause();
  fircraAudio.pause();
  blindAudio.pause();
  msfuAudio.pause();
  blodAudio.pause();
  orbAudio.pause();
  heartAudio.pause();
  astredAudio.pause();
  crazeAudio.pause();

  suspenseAudio.currentTime = 0;
  geezerSuspenceAudio.currentTime = 0;
  polarrSuspenceAudio.currentTime = 0;
  scareSuspenceAudio.currentTime = 0;
  heartAudio.currentTime = 0;
  iriAudio.currentTime = 0;
  aboAudio.currentTime = 0;
  shaAudio.currentTime = 0;
  lubjubAudio.currentTime = 0;
  demsoAudio.currentTime = 0;
  astblaAudio.currentTime = 0;
  plabreAudio.currentTime = 0;
  harvAudio.currentTime = 0;
  h1diAudio.currentTime = 0;
  jolbelAudio.currentTime = 0;
  ginharAudio.currentTime = 0;
  cancansymAudio.currentTime = 0;
  frogarAudio.currentTime = 0;
  reidasAudio.currentTime = 0;
  silnigAudio.currentTime = 0;
  sanclaAudio.currentTime = 0;
  norstaAudio.currentTime = 0;
  nighAudio.currentTime = 0;
  pumpkinAudio.currentTime = 0;
  tuonAudio.currentTime = 0;
  devilAudio.currentTime = 0;
  hauntAudio.currentTime = 0;
  lostsAudio.currentTime = 0;
  foundsAudio.currentTime = 0;
  hauAudio.currentTime = 0;
  fatreAudio.currentTime = 0;
  fearAudio.currentTime = 0;
  celdawAudio.currentTime = 0;
  griAudio.currentTime = 0;
  eniAudio.currentTime = 0;
  curartAudio.currentTime = 0;
  ethpulAudio.currentTime = 0;
  ghoAudio.currentTime = 0;
  froAudio.currentTime = 0;
  silAudio.currentTime = 0;
  shadAudio.currentTime = 0;
  specAudio.currentTime = 0;
  twiligAudio.currentTime = 0;
  isekaiAudio.currentTime = 0;
  emerAudio.currentTime = 0;
  samuraiAudio.currentTime = 0;
  contAudio.currentTime = 0;
  unstoppableAudio.currentTime = 0;
  gargantuaAudio.currentTime = 14.5;
  spectralAudio.currentTime = 0;
  starfallAudio.currentTime = 0;
  memAudio.currentTime = 0;
  oblAudio.currentTime = 0;
  phaAudio.currentTime = 0;
  frightAudio.currentTime = 0;
  unnamedAudio.currentTime = 0;
  overtureAudio.currentTime = 0;
  impeachedAudio.currentTime = 0;
  eonbreakAudio.currentTime = 2;
  celAudio.currentTime = 0;
  silcarAudio.currentTime = 0;
  gregAudio.currentTime = 0;
  mintllieAudio.currentTime = 37;
  geezerAudio.currentTime = 0;
  polarrAudio.currentTime = 0;
  oppAudio.currentTime = 0;
  serAudio.currentTime = 0;
  arcAudio.currentTime = 0;
  ethAudio.currentTime = 0;
  curAudio.currentTime = 0;
  hellAudio.currentTime = 0;
  wanspiAudio.currentTime = 0;
  mysAudio.currentTime = 0;
  voiAudio.currentTime = 0;
  endAudio.currentTime = 0;
  forgAudio.currentTime = 0;
  darAudio.currentTime = 0;
  abysAudio.currentTime = 0;
  bigSuspenceAudio.currentTime = 0;
  expAudio.currentTime = 0;
  expOpeningAudio.currentTime = 0;
  veilAudio.currentTime = 0;
  fircraAudio.currentTime = 0;
  blindAudio.currentTime = 0;
  msfuAudio.currentTime = 0;
  blodAudio.currentTime = 0;
  orbAudio.currentTime = 0;
  astredAudio.currentTime = 0;
  crazeAudio.currentTime = 0;

  let rarity = rollRarity();
  let title = selectTitle(rarity);

  rollButton.disabled = true;

  document.getElementById("rollCountDisplay").innerText = formatRollCount(rollCount);
  document.getElementById("rollCountDisplay1").innerText = rollCount1;

  if (
    rarity.type === "Cursed Mirage [1 in 11,111]" ||
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
    rarity.type === "FireCraze [1 in 4,200/69th]"
  ) {
    document.getElementById("result").innerText = "";
    const titleCont = document.querySelector(".container");

    titleCont.style.visibility = "hidden";

    if (rarity.type === "Fright [1 in 1,075]") {
      frightAudio.play();
    } else if (rarity.type === "Gargantua [1 in 143]") {
      gargantuaAudio.play();
    } else if (rarity.type === "Heart [1 in ♡♡♡]") {
      bigSuspenceAudio.play();
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
    } else if (rarity.type === "Cursed Mirage [1 in 11,111]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "ORB [1 in 55,555/30th]") {
      hugeSuspenceAudio.play();
    } else if (rarity.type === "Grim Destiny [1 in 8,500]") {
      griAudio.play();
    } else if (rarity.type === "Isekai [1 in 300]") {
      scareSuspenceAudio.play();
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
        createGravitySquare();
      }, 100);
    
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
    } else if (rarity.type === "Tuon [1 in 50,000]") {
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
        createGravitySquare();
      }, 100);
    
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
        createGravitySquare();
      }, 100);
    
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
    } else if (rarity.type === "LubbyJubby's Cherry Grove [1 in 5,666]") {
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
        createGravitySquare();
      }, 100);
    
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
    } else if (rarity.type === "Rad [1 in 6,969]") {
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
        createGravitySquare();
      }, 100);
    
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
    } else if (rarity.type === "Blodhest [1 in 25,252]") {
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
        createGravitySquare();
      }, 100);
    
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
        createGravitySquare();
      }, 100);
    
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
        createGravitySquare();
      }, 100);
    
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
    } else if (rarity.type === "Overture [1 in 25,641]") {
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
        createGravitySquare();
        createBurstStar();
      }, 100);
    
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
    } else if (rarity.type === "Celestial Chorus [1 in 202,020]") {
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
    } else if (rarity.type === "Devil's Heart [1 in 66,666]") {
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
    } else if (rarity.type === "Demon Soul [1 in 9,999]") {
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
    } else if (rarity.type === "GD Addict [1 in ###]") {
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
    } else if (rarity.type === "Hellish Fire [1 in 6,666]") {
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
      }, 20350); // Stop after 20.35 seconds

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
      }, 23800); // Wait for 23.8 seconds
    } else if (rarity.type === "Impeached [1 in 101,010]") {
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
    } else if (rarity.type === "Oblivion [1 in 200]") {
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
    } else if (rarity.type === "Eonbreak [1 in 20,000]") {
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
    } else if (rarity.type === "Isekai [1 in 300]") {
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
    } else if (rarity.type === "Emergencies [1 in 500]") {
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
    } else if (rarity.type === "Samurai [1 in 800]") {
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
    } else if (rarity.type === "Contortions [1 in 999]") {
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
    } else if (rarity.type === "Fright [1 in 1,075]") {
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
      }, 27400); // Wait for 27.4 seconds
    } else if (rarity.type === "Phantom Stride [1 in 990]") {
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
    } else if (rarity.type === "Unnamed [1 in 30,303]") {
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
        createGravitySquare();
        createBurstStar();
      }, 100);
    
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
    } else if (rarity.type === "Cursed Mirage [1 in 11,111]") {
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
        createGravitySquare();
        createBurstStar();
      }, 100);
    
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
    } else if (rarity.type === "Celestial Dawn [1 in 12,000]") {
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
    } else if (rarity.type === "Fate's Requiem [1 in 15,000]") {
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
        createGravitySquare();
        createBurstStar();
      }, 100);
    
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
    } else if (rarity.type === "Wandering Spirit [1 in 150]") {
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
    } else if (rarity.type === "Spectral Whisper [1 in 288]") {
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
    } else if (rarity.type === "Starfall [1 in 600]") {
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
    } else if (rarity.type === "Cursed Artifact [1 in 700]") {
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
    } else if (rarity.type === "Forgotten Whisper [1 in 450]") {
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
    } else if (rarity.type === "Spectral Glare [1 in 850]") {
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
    } else if (rarity.type === "Mysterious Echo [1 in 300]") {
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
    } else if (rarity.type === "Frozen Fate [1 in 200]") {
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

    } else if (rarity.type === "Shadow Veil [1 in 1,000]") {
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

    } else if (rarity.type === "Nightfall [1 in 1,200]") {
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

    } else if (rarity.type === "Void Walker [1 in 1,500]") {
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

    } else if (rarity.type === "Silent Listener [1 in 2,200]") {
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

    } else if (rarity.type === "Ghostly Embrace [1 in 2,800]") {
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

    } else if (rarity.type === "Endless Twilight [1 in 3,000]") {
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

    } else if (rarity.type === "Abyssal Shade [1 in 3,500]") {
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

    } else if (rarity.type === "Darkened Sky [1 in 4,200]") {
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
          froAudio.play();
        }, 100);
        enableChange();
      }, 4400); // Wait for 4.4 seconds

    } else if (rarity.type === "Twisted Light [1 in 5,000]") {
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
          froAudio.play();
        }, 100);
        enableChange();
      }, 4400); // Wait for 4.4 seconds

    } else if (rarity.type === "Ethereal Pulse [1 in 6,000]") {
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
          froAudio.play();
        }, 100);
        enableChange();
      }, 4400); // Wait for 4.4 seconds

    } else if (rarity.type === "Enigmatic Dream [1 in 7,500]") {
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
          froAudio.play();
        }, 100);
        enableChange();
      }, 4400); // Wait for 4.4 seconds

    } else if (rarity.type === "Fear [1 in 1,250]") {
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
          froAudio.play();
        }, 100);
        enableChange();
      }, 4400); // Wait for 4.4 seconds

    } else if (rarity.type === "Haunted Soul [1 in 2,000]") {
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
          froAudio.play();
        }, 100);
        enableChange();
      }, 4400); // Wait for 4.4 seconds

    } else if (rarity.type === "Lost Soul [1 in 3,333]") {
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
          froAudio.play();
        }, 100);
        enableChange();
      }, 4400); // Wait for 4.4 seconds

    } else if (rarity.type === "Found Soul [1 in 5,000]") {
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
          froAudio.play();
        }, 100);
        enableChange();
      }, 4400); // Wait for 4.4 seconds

    } else if (rarity.type === "Haunted Reality [1 in 5,000]") {
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

    } else if (rarity.type === "Ether Shift [1 in 5,540]") {
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

    } else if (rarity.type === "Serap's Wing [1 in 1,333]") {
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

function rollRarity() {
  const rarities = [
    {
      type: "Common [1 in 2.5]",
      class: "commonBgImg",
      chance: 40,
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
    }
  ];

  const abominationRarity = {
    type: "Abomination [1 in 1,000,000/20th]",
    class: "aboBgImg",
    chance: 0,
    titles: ["Chaos", "Experiment: 902", "Damaged", "Assistance"],
  };

  const iridocyclitisVeilRarity = {
    type: "Iridocyclitis Veil [1 in 5,000/50th]",
    class: "iriBgImg",
    chance: 0,
    titles: ["Cyclithe", "Veilborne", "Hemovail", "Abomination: 902"],
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
    chance: 0,
    titles: ["1106", "1073", "1105", "905", "302", "1130", "1263", "1005", "1473", "1748",
            "899", "1157", "1288", "1203", "1024", "1702", "786", "1684", "1337", "912",
            "1987", "1405", "771", "1883", "1294", "1772", "902", "1526", "1759", "666"],
  };

  const veilRarity = {
    type: "Veil [1 in 50,000/5th]",
    class: "veilBgImg",
    chance: 0,
    titles: ["Fight", "Peace", "MSFU: 902"],
  };

  const blindRarity = {
    type: "BlindGT [1 in 2,000,000/15th]",
    class: "blindBgImg",
    chance: 0,
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
    chance: 0.01,
    titles: ["Fire", "Craze", "Iridocyclitis: 902"],
  };

  let randomNum = Math.random() * 200;
  let cumulativeChance = 0.04;

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

function displayResult(title, rarity) {
  const resultDiv = document.getElementById("result");
  resultDiv.innerText = `You rolled a ${rarity}
    Item: ${title}!`;
}

function changeBackground(rarityClass) {
  const body = document.body;
  body.className = "";
  body.classList.add(rarityClass);
}

function addToInventory(title, rarityClass) {
  const excludedRarities = new Set(
    Array.from(document.querySelectorAll('.rarity-button.active')).map(btn => btn.dataset.rarity)
  );

  for (const category in rarityCategories) {
    if (excludedRarities.has(category) && rarityCategories[category].includes(rarityClass)) {
      return;
    }
  }

  inventory.push({ title, rarityClass });
  localStorage.setItem("inventory", JSON.stringify(inventory));
  renderInventory();
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
      this.textContent = "Show Roll & Display";
    } else {
      inventorySection.style.visibility = "visible";
      this.textContent = "Hide Roll & Display";
    }
});

window.addEventListener("resize", function () {
  const container = document.querySelector(".container1");
  const inventory = document.querySelector(".inventory");
  const button = document.getElementById("settingsButton");
  const sliderContainer = document.querySelector(".slider-container");
  const originalParent = document.querySelector(".original-parent");

  if (window.innerWidth < 821) {
    button.style.display = "none";
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
    button.style.display = "inline-block";
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
};

function changeBackground(rarityClass, itemTitle) {
  if (!isChangeEnabled) return;
  const details = backgroundDetails[rarityClass];
  if (details) {
    document.body.style.backgroundImage = `url(${details.image})`;

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    if (details.audio) {
      const newAudio = document.getElementById(details.audio);
      if (newAudio) {
        newAudio.play();
        currentAudio = newAudio;
      }
    } else {
      currentAudio = null;
    }
  }
}

function enableChange() {
  isChangeEnabled = true;
}

function disableChange() {
  isChangeEnabled = false;
}

function renderInventory() {
  const inventoryList = document.getElementById("inventoryList");
  inventoryList.innerHTML = "";

  const lockedItems = JSON.parse(localStorage.getItem("lockedItems")) || {};

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedItems = inventory.slice(start, end);

  paginatedItems.forEach((item, index) => {
    const absoluteIndex = start + index;
    const listItem = document.createElement("li");
    listItem.className = item.rarityClass;
    listItem.dataset.locked = lockedItems[item.title] ? "true" : "false";

    const itemTitle = document.createElement("span");
    itemTitle.className = "rarity-text";
    itemTitle.textContent = item.title.toUpperCase();

    const rarityText = document.createElement("span");
    listItem.appendChild(itemTitle);
    listItem.appendChild(rarityText);

    const burgerBar = document.createElement("div");
    burgerBar.className = "burger-bar";
    burgerBar.innerHTML = "☰";

    const dropdownMenu = document.createElement("div");
    dropdownMenu.className = "dropdown-menu";
    dropdownMenu.style.display = "none";

    const equipButton = document.createElement("button");
    equipButton.textContent = "Equip";
    equipButton.addEventListener("click", (event) => {
      event.stopPropagation();
      equipItem(item);
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

    let isDropdownOpen = false;
    burgerBar.addEventListener("click", (event) => {
      event.stopPropagation();
      isDropdownOpen = !isDropdownOpen;
      dropdownMenu.style.display = isDropdownOpen ? "block" : "none";
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
  equippedItem = item;
  console.log(`Equipped item: ${item.title}`);
  handleEquippedItem(item);
  mainAudio.pause();
}

function handleEquippedItem(item) {
  changeBackground(item.rarityClass, item.title);
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

function createCooldownButton() {
  if (document.getElementById("cooldownButton")) {
    return;
  }

  const button = document.createElement("button");
  button.innerText = "Reduce Cooldown";
  button.id = "cooldownButton";
  button.style.position = "absolute";

  const randomX = Math.floor(Math.random() * (window.innerWidth - 100));
  const randomY = Math.floor(Math.random() * (window.innerHeight - 50));
  button.style.left = `${randomX}px`;
  button.style.top = `${randomY}px`;

  button.addEventListener("click", () => {
    cooldownTime = 100;

    showCooldownEffect(90);

    button.innerText = "Cooldown Reduced!";
    setTimeout(() => {
      document.body.removeChild(button);
    }, 1000);

    setTimeout(() => {
      cooldownTime = 690;
      console.log("Cooldown reset to 690ms");
    }, 90000);

    scheduleButtonAppearance();
  });

  document.body.appendChild(button);
}

function showCooldownEffect(duration) {
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

  document.body.appendChild(countdownDisplay);

  let timeLeft = duration;
  const interval = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(interval);
      countdownDisplay.innerText = "";
      document.body.removeChild(countdownDisplay);
    } else {
      countdownDisplay.innerText = `Roll-Cooldown Effect: ${timeLeft}s`;
    }
    timeLeft--;
  }, 1000);
}

function getRandomTime() {
  const min = 5 * 60 * 1000;
  const max = 7 * 60 * 1000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function scheduleButtonAppearance() {
  const randomTime = getRandomTime();

  setTimeout(() => {
    createCooldownButton();
  }, randomTime);
}

scheduleButtonAppearance();

document.addEventListener("DOMContentLoaded", () => {
  const settingsMenu = document.getElementById("settingsMenu");
  const header = settingsMenu.querySelector("h3");
  let isDragging = false;
  let offsetX, offsetY;

  header.addEventListener("mousedown", (e) => {
      isDragging = true;
      offsetX = e.clientX - settingsMenu.offsetLeft;
      offsetY = e.clientY - settingsMenu.offsetTop;
      header.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      settingsMenu.style.left = e.clientX - offsetX + "px";
      settingsMenu.style.top = e.clientY - offsetY + "px";
  });

  document.addEventListener("mouseup", () => {
      isDragging = false;
      header.style.cursor = "grab";
  });
});

const settingsButton = document.getElementById("settingsButton");
const settingsMenu = document.getElementById("settingsMenu");
const closeSettings = document.getElementById("closeSettings");
const audioSlider = document.getElementById("audioSlider");
const resetDataButton = document.getElementById("resetDataButton");
const autoRollButton = document.getElementById("autoRollButton");
const rollButton = document.getElementById("rollButton");

settingsButton.addEventListener("click", () => {
  settingsMenu.style.display = "block";
});

closeSettings.addEventListener("click", () => {
  settingsMenu.style.display = "none";
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

audioSlider.addEventListener("input", () => {
  audioVolume = parseFloat(audioSlider.value);
  if (audioVolume === 0) {
    isMuted = true;
    setThumbColor(true);
  } else {
    isMuted = false;
    setThumbColor(false);
    previousVolume = audioVolume;
  }
  console.log(`Audio volume set to: ${audioVolume}`);
  localStorage.setItem("audioVolume", audioVolume);
  updateAudioElements(audioVolume);
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
  console.log(`Mute toggled. Audio volume is now: ${audioVolume}`);
  updateAudioElements(audioVolume);
  setThumbColor(isMuted);
});

function updateAudioElements(volume) {
  const audioElements = document.querySelectorAll("audio");
  audioElements.forEach((audio) => (audio.volume = volume));
}

function setThumbColor(muted) {
  if (muted) {
    audioSlider.classList.add("muted");
  } else {
    audioSlider.classList.remove("muted");
  }
}

resetDataButton.addEventListener("click", () => {
  if (confirm("Are you sure you want to reset all data?")) {
    console.log("Data reset!");
    localStorage.clear();
    location.reload();
    setTimeout(() => {
    localStorage.clear();
    location.reload();
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
    console.log("Rolling...");
    document.getElementById("rollButton").click();
  }, 500);
  autoRollButton.textContent = "Auto Roll: On";
  autoRollButton.classList.remove("off");
  autoRollButton.classList.add("on");
  localStorage.setItem("autoRollEnabled", "true");
}

function stopAutoRoll() {
  clearInterval(autoRollInterval);
  autoRollInterval = null;
  autoRollButton.textContent = "Auto Roll: Off";
  autoRollButton.classList.remove("on");
  autoRollButton.classList.add("off");
  localStorage.setItem("autoRollEnabled", "false");
}

const slider = document.getElementById("audioSlider");

slider.addEventListener("input", function () {
  const value = slider.value;

  const startColor = { r: 96, g: 0, b: 126 };
  const endColor = { r: 255, g: 165, b: 0 };

  const r = Math.round(startColor.r + (endColor.r - startColor.r) * value);
  const g = Math.round(startColor.g + (endColor.g - startColor.g) * value);
  const b = Math.round(startColor.b + (endColor.b - startColor.b) * value);

  const thumbColor = `rgb(${r}, ${g}, ${b})`;

  slider.style.setProperty("--thumb-color", thumbColor);
});

slider.dispatchEvent(new Event("input"));

// const heartContainer = document.createElement('div');
// document.body.appendChild(heartContainer);

// function createHeart() {
//     const heart = document.createElement('div');
//     heart.classList.add('heart');
//     heart.textContent = '❤️';
//     heart.style.left = Math.random() * 100 + 'vw';
//     heart.style.top = Math.random() * 100 + 'vh';
//     heart.style.fontSize = Math.random() * 20 + 10 + 'px';

//     heartContainer.appendChild(heart);

//     setTimeout(() => {
//         heart.remove();
//     }, 5000);
// }

// setInterval(createHeart, 333);

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
        listItem.textContent = `${roll.rarity} - ${roll.title}`;

        const rarityClass = getClassForRarity(roll.rarity);
        if (rarityClass) {
            listItem.classList.add(rarityClass);
        }

        historyList.appendChild(listItem);
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
      'Seraph\'s Wing [1 in 1,333]': 'under10k',
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
      'LubbyJubby\'s Cherry Grove [1 in 5,666]': 'under10k',
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
      'Fate\'s Requiem [1 in 15,000]': 'under100k',
      'Eonbreak [1 in 20,000]': 'under100k',
      'Overture  [1 in 25,641]': 'under100k',
      'HARV [1 in 33,333]': 'under100k',
      'Devil\'s Heart [1 in 66,666]': 'under100k',
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
  .getElementById("deleteAllUnder1mButton")
  .addEventListener("click", () => {
    renderInventory();
    const raritiesUnder10k = [
      "impeachedBgImg",
      "celestialchorusBgImg",
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
      'crazeBgImg'
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

const rarityCategories = {
  under100: [
    "commonBgImg", "rareBgImg", "epicBgImg", "legendaryBgImg", "impossibleBgImg",
    "poweredBgImg", "plabreBgImg", "solarpowerBgImg", "belivBgImg", "flickerBgImg", "toxBgImg"
  ],
  under1k: [
    "unstoppableBgImg", "spectralBgImg", "starfallBgImg", "gargBgImg", "memBgImg", "oblBgImg",
    "phaBgImg", "isekaiBgImg", "emerBgImg", "samuraiBgImg", "contBgImg", "wanspiBgImg",
    "froBgImg", "mysBgImg", "forgBgImg", "curartBgImg", "specBgImg"
  ],
  under10k: [
    "ethershiftBgImg", "hellBgImg", "frightBgImg", "seraphwingBgImg", "shadBgImg", "shaBgImg",
    "nighBgImg", "voiBgImg", "silBgImg", "ghoBgImg", "endBgImg", "abysBgImg", "darBgImg",
    "twiligBgImg", "ethpulBgImg", "eniBgImg", "griBgImg", "fearBgImg", "hauntBgImg",
    "foundsBgImg", "lostsBgImg", "hauBgImg", "lubjubBgImg", "radBgImg", "demsoBgImg"
  ],
  under100k: [
    "celdawBgImg", "fatreBgImg", "unnamedBgImg", "eonbreakBgImg", "overtureBgImg",
    "arcanepulseBgImg", "harvBgImg", "devilBgImg", "cursedmirageBgImg", "tuonBgImg", "astblaBgImg"
  ],
  under1m: ["impeachedBgImg", "celestialchorusBgImg"],
  special: ["iriBgImg", "veilBgImg", "expBgImg", "aboBgImg", "blindBgImg", "msfuBgImg", "orbBgImg", "crazeBgImg"]
};

document.querySelectorAll(".rarity-button").forEach(button => {
  button.addEventListener("click", () => {
    button.classList.toggle("active");
    saveToggledStates();
  });
});