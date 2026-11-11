import { PPM, rand, pick } from "./config.js";
import { dotTexture } from "./textures.js";
import { gameLayer } from "./stage.js";
const Stage = window.Stage;

let particles = [];

function spawnParticles(x, y, colors, count, speedMin, speedMax) {
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(speedMin, speedMax);
    const life = rand(0.32, 0.8);
    const sprite = Stage.sprite(dotTexture(pick(colors))).appendTo(gameLayer);
    sprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });
    particles.push({
      sprite,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
    });
  }
}

function spawnExplosion(worldX, worldY, targetType) {
  const x = worldX * PPM;
  const y = worldY * PPM;
  const colors =
    targetType === "gem"
      ? ["#ffffff", "#7ef9ff", "#b388ff"]
      : targetType === "commander"
        ? ["#ffffff", "#ff2ec4", "#ffc2ef", "#ffd166"]
        : targetType === "magnet"
          ? ["#ffffff", "#8fe6ff", "#ff4d6d", "#4d7dff"]
          : targetType === "steelBalloon"
            ? ["#ffffff", "#c3d2e4", "#ffd166", "#7d8ea3"]
            : targetType === "clayBalloon"
              ? ["#ffffff", "#ecd3b3", "#c98b5e", "#8a5a35"]
              : ["#fff3b0", "#ffd166", "#ff8c42", "#ff5a5f"];
  const count = targetType === "commander" ? 28 : targetType === "gasBalloon" ? 22 : 16;
  spawnParticles(x, y, colors, count, 60, 220);
}

function spawnSparks(worldX, worldY) {
  spawnParticles(worldX * PPM, worldY * PPM, ["#fff3b0", "#ffd166"], 5, 30, 90);
}

function updateParticles(dt) {
  for (const particle of particles) {
    particle.life -= dt;
    if (particle.life <= 0) {
      particle.sprite.remove();
      continue;
    }
    particle.vy += 240 * dt;
    particle.vx *= Math.max(0, 1 - 2.2 * dt);
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.sprite.pin({
      offsetX: particle.x,
      offsetY: particle.y,
      alpha: Math.min(1, (particle.life / particle.maxLife) * 1.6),
    });
  }
  particles = particles.filter((particle) => particle.life > 0);
}

function clearParticles() {
  for (const particle of particles) {
    particle.sprite.remove();
  }
  particles = [];
}

export { particles, spawnParticles, spawnExplosion, spawnSparks, updateParticles, clearParticles };