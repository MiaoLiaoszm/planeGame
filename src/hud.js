import { MAX_HP } from "./config.js";

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const hpEl = document.getElementById("hp");
const waveEl = document.getElementById("wave");
const powerEl = document.getElementById("power");
const overlayEl = document.getElementById("overlay");
const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");
const actionBtn = document.getElementById("actionBtn");
const appEl = document.getElementById("app");
const hintEl = document.getElementById("hint");

const hudCache = { score: null, best: null, hp: null, wave: null, power: null };

function updateHud(hud) {
  if (hudCache.score !== hud.score) {
    hudCache.score = hud.score;
    scoreEl.textContent = String(hud.score);
  }
  if (hudCache.best !== hud.best) {
    hudCache.best = hud.best;
    bestEl.textContent = String(hud.best);
  }
  if (hudCache.hp !== hud.hp) {
    hudCache.hp = hud.hp;
    hpEl.textContent = "♥".repeat(Math.max(0, hud.hp)) + "♡".repeat(Math.max(0, MAX_HP - hud.hp));
  }
  if (hudCache.wave !== hud.wave) {
    hudCache.wave = hud.wave;
    waveEl.textContent = String(hud.wave);
  }
  if (powerEl) {
    const active = hud.powerTimer > 0;
    const label = active ? `${Math.ceil(hud.powerTimer)}s` : "—";
    if (hudCache.power !== label) {
      hudCache.power = label;
      powerEl.textContent = label;
      powerEl.classList.toggle("on", active);
    }
  }
}

function showOverlay(title, subtitle, buttonLabel) {
  titleEl.textContent = title;
  subtitleEl.textContent = subtitle;
  actionBtn.textContent = buttonLabel;
  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

export { scoreEl, bestEl, hpEl, waveEl, powerEl, overlayEl, titleEl, subtitleEl, actionBtn, appEl, hintEl, updateHud, showOverlay, hideOverlay };