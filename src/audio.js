let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) {
      try {
        audioCtx = new Ctor();
      } catch {
        audioCtx = null;
      }
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

function playTone({ freq, freqEnd, duration, type = "square", volume = 0.05, delay = 0 }) {
  if (!audioCtx) return;
  const start = audioCtx.currentTime + delay;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, start);
  if (freqEnd) {
    oscillator.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);
  }
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function soundShoot() {
  playTone({ freq: 900, freqEnd: 520, duration: 0.07, volume: 0.035 });
}

function soundHit() {
  playTone({ freq: 260, freqEnd: 180, duration: 0.06, type: "triangle", volume: 0.05 });
}

function soundPuff() {
  playTone({ freq: 340, freqEnd: 120, duration: 0.24, type: "sine", volume: 0.05 });
  playTone({ freq: 170, freqEnd: 70, duration: 0.34, type: "triangle", volume: 0.035, delay: 0.07 });
}

function soundExplosion(isGem) {
  if (isGem) {
    playTone({ freq: 660, freqEnd: 990, duration: 0.12, type: "triangle", volume: 0.05 });
    playTone({ freq: 990, freqEnd: 1320, duration: 0.1, type: "triangle", volume: 0.04, delay: 0.08 });
    return;
  }
  playTone({ freq: 170, freqEnd: 48, duration: 0.26, type: "sawtooth", volume: 0.07 });
  playTone({ freq: 90, freqEnd: 40, duration: 0.18, type: "square", volume: 0.04, delay: 0.02 });
}

function soundHurt() {
  playTone({ freq: 140, freqEnd: 60, duration: 0.3, type: "sawtooth", volume: 0.09 });
}

function soundConvert() {
  playTone({ freq: 520, freqEnd: 780, duration: 0.16, type: "triangle", volume: 0.05 });
  playTone({ freq: 780, freqEnd: 1170, duration: 0.18, type: "triangle", volume: 0.045, delay: 0.12 });
  playTone({ freq: 1170, freqEnd: 1560, duration: 0.22, type: "triangle", volume: 0.04, delay: 0.26 });
}

function soundPowerUp() {
  playTone({ freq: 420, freqEnd: 840, duration: 0.14, type: "triangle", volume: 0.05 });
  playTone({ freq: 840, freqEnd: 1260, duration: 0.16, type: "triangle", volume: 0.045, delay: 0.1 });
  playTone({ freq: 1260, freqEnd: 1680, duration: 0.2, type: "square", volume: 0.035, delay: 0.22 });
}

function soundClank() {
  playTone({ freq: 1320, freqEnd: 880, duration: 0.05, type: "square", volume: 0.03 });
  playTone({ freq: 880, freqEnd: 640, duration: 0.08, type: "triangle", volume: 0.025, delay: 0.03 });
}

function soundMagnet() {
  playTone({ freq: 160, freqEnd: 420, duration: 0.18, type: "sine", volume: 0.05 });
  playTone({ freq: 420, freqEnd: 220, duration: 0.22, type: "triangle", volume: 0.035, delay: 0.12 });
}

function soundHeal(restored) {
  if (!restored) {
    playTone({ freq: 720, freqEnd: 880, duration: 0.09, type: "triangle", volume: 0.04 });
    return;
  }
  playTone({ freq: 520, freqEnd: 780, duration: 0.12, type: "triangle", volume: 0.05 });
  playTone({ freq: 780, freqEnd: 1040, duration: 0.12, type: "triangle", volume: 0.05, delay: 0.1 });
  playTone({ freq: 1040, freqEnd: 1300, duration: 0.14, type: "triangle", volume: 0.04, delay: 0.2 });
}

function soundGameOver() {
  playTone({ freq: 440, freqEnd: 220, duration: 0.5, type: "triangle", volume: 0.07 });
  playTone({ freq: 220, freqEnd: 90, duration: 0.7, type: "triangle", volume: 0.06, delay: 0.35 });
}

export { audioCtx, ensureAudio, playTone, soundShoot, soundHit, soundPuff, soundExplosion, soundHurt, soundConvert, soundPowerUp, soundClank, soundMagnet, soundHeal, soundGameOver };