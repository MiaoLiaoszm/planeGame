const planck = window.planck;
const Stage = window.Stage;

if (!planck || !Stage) {
  const subtitle = document.getElementById("subtitle");
  const button = document.getElementById("actionBtn");
  if (subtitle) {
    subtitle.textContent =
      "引擎库加载失败：请先在项目目录执行 npm install，再执行 npm start 并访问 http://localhost:5173。";
  }
  if (button) {
    button.disabled = true;
    button.textContent = "缺少依赖";
  }
  throw new Error("Sky Patrol 启动失败：缺少 planck 或 stage-js");
}

import {
  PPM,
  WORLD_W,
  WORLD_H,
  STEP,
  GRAVITY,
  MAX_HP,
  GROUND_Y,
  CAT,
  clamp,
  rand,
  easeOutQuart,
  CHAIN_COLOR,
  CONVERTED_AURA_SCALE,
  POWER_UP_CONFIG,
  BOMBER_CHAIN_PATTERN,
  DUO_CHAIN_PATTERN,
} from "./config.js";
import {
  convertedSpriteTexture,
  solidTexture,
  PENDULUM_TEX,
  MAGNET_TEX,
  SPRING_BOMB_TEX,
  planeTexture,
  clayBlobTexture,
  smokeTexture,
  bulletTexture,
  powerBulletTexture,
  bombTexture,
  parachuteTexture,
  pendulumTexture,
  magnetTexture,
  springBombTexture,
  steelPlateTexture,
  gasTexture,
  commanderHaloTexture,
  allyHaloTexture,
  powerHaloTexture,
  dotTexture,
  soapBubbleTexture,
  BARRIER_TEXTURE,
  stoneTexture,
} from "./textures.js";
import { gameLayer, fogLayer } from "./stage.js";
import { updateScroll } from "./background.js";
import {
  TARGET_CONFIG,
  PENDULUM_CONFIG,
  MAGNET_CONFIG,
  STEEL_PLATE_CONFIG,
  GALE_CONFIG,
  SOAP_CONFIG,
  CLAY_CONFIG,
  BOMBER_CONFIG,
  DUO_CONFIG,
  SPRING_BOMB_CONFIG,
  COMMANDER_CONFIG,
  ALLY_COMMANDER_CONFIG,
  HOMING_CONFIG,
  SNAKE_CONFIG,
  INVISIBLE_CONFIG,
  GAS_CONFIG,
  AUTOPILOT_CONFIG,
  BARRIER_CONFIG,
  SPECIAL_BALLOON_CONFIG,
  GEM_SPAWN_CONFIG,
  STONE_CONFIG,
} from "./entityConfig.js";
import {
  ensureAudio,
  soundShoot,
  soundHit,
  soundPuff,
  soundExplosion,
  soundHurt,
  soundConvert,
  soundPowerUp,
  soundClank,
  soundMagnet,
  soundHeal,
  soundGameOver,
} from "./audio.js";
import {
  actionBtn,
  appEl,
  hintEl,
  updateHud as renderHud,
  showOverlay,
  hideOverlay,
} from "./hud.js";
import {
  spawnParticles,
  spawnExplosion,
  spawnSparks,
  updateParticles,
  clearParticles,
} from "./fx.js";
import { drawInvisibleLenses } from "./lens.js";

function barrierRegion() {
  return {
    minX: WORLD_W * BARRIER_CONFIG.regionMinX,
    maxX: WORLD_W * BARRIER_CONFIG.regionMaxX,
    minY: WORLD_H * BARRIER_CONFIG.regionMinY,
    maxY: WORLD_H * BARRIER_CONFIG.regionMaxY,
  };
}

function nextBarrierPoint() {
  const region = barrierRegion();
  return { x: rand(region.minX, region.maxX), y: rand(region.minY, region.maxY) };
}

function spawnBarrierBalloon() {
  if (!world) return null;
  if (barrierBalloon && !barrierBalloon.dead) return barrierBalloon;

  const config = BARRIER_CONFIG;
  const region = barrierRegion();
  // 在屏幕右上角随机生成，确保完整显示
  const x = rand(region.maxX - config.radius, region.maxX);
  const y = rand(region.minY + config.radius, region.maxY - config.radius);

  const body = world.createBody({
    type: "kinematic",
    position: planck.Vec2(x, y),
    fixedRotation: true,
  });
  const fixture = body.createFixture(planck.Circle(config.radius), {
    density: 1.2,
    restitution: 0,
    friction: 0,
    filterCategoryBits: CAT.TARGET,
    filterMaskBits: CAT.PLANE | CAT.BULLET,
  });

  const sprite = Stage.sprite(BARRIER_TEXTURE).appendTo(gameLayer);
  sprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

  const entity = createEntity("barrierBalloon", body, fixture, sprite, {
    targetType: "barrierBalloon",
    hp: config.hp,
    points: config.points,
    speed: config.speed + wave * config.speedPerWave,
    age: 0,
    phase: rand(0, Math.PI * 2),
    flash: 0,
    tiltAngle: 0,
    wander: { x: rand(region.minX, region.maxX), y: rand(region.minY, region.maxY) },
    bursting: true,
    burstShots: 0,
    throwTimer: rand(config.burstFirstDelayMin, config.burstFirstDelayMax),
    pauseTimer: 0,
  });

  barrierBalloon = entity;
  return entity;
}

function galeRegion() {
  return {
    minX: WORLD_W * GALE_CONFIG.regionMinX,
    maxX: WORLD_W * GALE_CONFIG.regionMaxX,
    minY: WORLD_H * GALE_CONFIG.regionMinY,
    maxY: WORLD_H * GALE_CONFIG.regionMaxY,
  };
}

function nextGalePoint() {
  const region = galeRegion();
  return { x: rand(region.minX, region.maxX), y: rand(region.minY, region.maxY) };
}

function galeWindInfo() {
  if (!galeBalloon || galeBalloon.dead || galeBalloon.converted) return null;
  if (!galeBalloon.windActive) return null;
  const position = galeBalloon.body.getPosition();
  return {
    x: position.x + GALE_CONFIG.fanOffsetX,
    y: position.y + GALE_CONFIG.fanOffsetY,
    range: GALE_CONFIG.windRange * GALE_CONFIG.windRangeScale,
    cos: Math.cos(GALE_CONFIG.windHalfAngle),
  };
}

function inGaleWind(x, y) {
  const info = galeWindInfo();
  if (!info) return false;
  const dx = x - info.x;
  const dy = y - info.y;
  const distance = Math.hypot(dx, dy);
  if (distance > info.range) return false;
  if (distance < 0.001) return true;
  return -dx / distance >= info.cos;
}

function spawnGaleBalloon(forcedY) {
  if (!world) return null;
  if (galeBalloon && !galeBalloon.dead && !galeBalloon.converted) return galeBalloon;

  const config = GALE_CONFIG;
  const region = galeRegion();
  // 在屏幕右上角随机生成，确保完整显示
  const x = rand(region.maxX - config.radius, region.maxX);
  const y = clamp(
    typeof forcedY === "number" ? forcedY : rand(region.minY + config.radius, region.maxY - config.radius),
    region.minY + config.radius,
    region.maxY - config.radius,
  );

  const body = world.createBody({
    type: "kinematic",
    position: planck.Vec2(x, y),
    fixedRotation: true,
  });
  const fixture = body.createFixture(planck.Circle(config.radius), {
    density: 1.2,
    restitution: 0,
    friction: 0,
    filterCategoryBits: CAT.TARGET,
    filterMaskBits: CAT.PLANE | CAT.BULLET,
  });

  const sprite = Stage.sprite(config.texture).appendTo(gameLayer);
  sprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

  const fanSprite = Stage.sprite(config.fanTexture).appendTo(gameLayer);
  fanSprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

  const windSprite = Stage.sprite(config.windTexture).appendTo(fogLayer);
  windSprite.pin({ pivotX: 1, pivotY: 0.5, handleX: 1, handleY: 0.5, alpha: 0.12 });

  const entity = createEntity("target", body, fixture, sprite, {
    targetType: "galeBalloon",
    hp: config.hp,
    points: config.points,
    heal: 0,
    speed: config.speed + wave * config.speedPerWave,
    bob: config.bob,
    phase: rand(0, Math.PI * 2),
    age: 0,
    flash: 0,
    fanSprite,
    windSprite,
    fanAngle: rand(0, Math.PI * 2),
    fanOffsetX: config.fanOffsetX,
    fanOffsetY: config.fanOffsetY,
    wander: { x: rand(region.minX, region.maxX), y: rand(region.minY, region.maxY) },
    windActive: true,
    windTimer: config.windOnDuration,
  });

  galeBalloon = entity;
  return entity;
}

function soapRegion() {
  return {
    minX: WORLD_W * SOAP_CONFIG.regionMinX,
    maxX: WORLD_W * SOAP_CONFIG.regionMaxX,
    minY: WORLD_H * SOAP_CONFIG.regionMinY,
    maxY: WORLD_H * SOAP_CONFIG.regionMaxY,
  };
}

function nextSoapPoint() {
  const region = soapRegion();
  return { x: rand(region.minX, region.maxX), y: rand(region.minY, region.maxY) };
}

function spawnSoapBalloon(forcedY) {
  if (!world) return null;
  if (soapBalloon && !soapBalloon.dead && !soapBalloon.converted) return soapBalloon;

  const config = SOAP_CONFIG;
  const region = soapRegion();
  const x = rand(region.maxX - config.radius, region.maxX);
  const y = clamp(
    typeof forcedY === "number" ? forcedY : rand(region.minY + config.radius, region.maxY - config.radius),
    region.minY + config.radius,
    region.maxY - config.radius,
  );

  const body = world.createBody({
    type: "kinematic",
    position: planck.Vec2(x, y),
    fixedRotation: true,
  });
  const fixture = body.createFixture(planck.Circle(config.radius), {
    density: 1.2,
    restitution: 0,
    friction: 0,
    filterCategoryBits: CAT.TARGET,
    filterMaskBits: CAT.PLANE | CAT.BULLET,
  });

  const sprite = Stage.sprite(config.texture).appendTo(gameLayer);
  sprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

  const entity = createEntity("target", body, fixture, sprite, {
    targetType: "soapBalloon",
    hp: config.hp,
    points: config.points,
    heal: 0,
    speed: config.speed + wave * config.speedPerWave,
    bob: config.bob,
    phase: rand(0, Math.PI * 2),
    age: 0,
    flash: 0,
    wander: { x: rand(region.minX, region.maxX), y: rand(region.minY, region.maxY) },
    sprayTimer: rand(0, config.sprayInterval * 0.5),
  });

  soapBalloon = entity;
  return entity;
}

function spawnSoapBubble(originX, originY, burstLife) {
  const config = SOAP_CONFIG;
  if (soapBubbles.length >= config.maxBubbles) return null;

  const angle = rand(-config.spraySpread, config.spraySpread);
  const speed = rand(config.spraySpeedMin, config.spraySpeedMax);
  const radius = config.bubbleRadius * rand(0.75, 1.35);
  const scale = (radius * 2 * PPM) / soapBubbleTexture.getWidth();

  const sprite = Stage.sprite(soapBubbleTexture).appendTo(fogLayer);
  sprite.pin({
    pivotX: 0.5,
    pivotY: 0.5,
    handleX: 0.5,
    handleY: 0.5,
    scaleX: scale,
    scaleY: scale,
    alpha: 0.85,
  });

  const bubble = {
    x: originX + rand(-config.sprayRadius, config.sprayRadius),
    y: originY + rand(-config.sprayRadius * 1.3, config.sprayRadius * 1.3),
    vx: -Math.cos(angle) * speed,
    vy: -rand(config.sprayUpMin, config.sprayUpMax) + Math.sin(angle) * speed * 0.3,
    radius,
    scale,
    age: 0,
    life: Math.max(0.6, burstLife + rand(-0.25, 0.25)),
    stuck: false,
    stuckAge: 0,
    offsetX: 0,
    offsetY: 0,
    pop: false,
    popT: 0,
    sprite,
  };

  soapBubbles.push(bubble);
  return bubble;
}

function spraySoapBubbles(entity) {
  if (!entity || entity.dead) return;
  const config = SOAP_CONFIG;
  const position = entity.body.getPosition();
  const originX = position.x + config.sprayOffsetX;
  const originY = position.y + config.sprayOffsetY;
  const burstLife = config.bubbleLife;

  for (let i = 0; i < config.sprayCount; i += 1) {
    spawnSoapBubble(originX, originY, burstLife);
  }
}

function spawnStone(originX, originY, targetX, upSpeed, refFlight, balloonEntity) {
  if (!world) return null;
  if (stones.length >= STONE_CONFIG.maxActive) return null;

  const config = STONE_CONFIG;
  const halfWidth = config.width / 2;
  const halfHeight = config.height / 2;
  const startX = originX + rand(-config.spreadX, config.spreadX);
  const startY = originY + rand(-config.spreadY, config.spreadY);

  const body = world.createBody({
    type: "dynamic",
    position: planck.Vec2(startX, startY),
    angularDamping: config.angularDamping,
    linearDamping: config.linearDamping,
    gravityScale: config.gravityScale,
  });
  const fixture = body.createFixture(planck.Box(halfWidth, halfHeight), {
    density: config.density,
    friction: config.friction,
    restitution: config.restitution,
    filterCategoryBits: CAT.STONE,
    filterMaskBits: CAT.PLANE | CAT.BULLET | CAT.GROUND,
  });

  const texture = stoneTexture;
  const scaleX = (config.width * PPM) / texture.getWidth();
  const scaleY = (config.height * PPM) / texture.getHeight();
  const sprite = Stage.sprite(texture).appendTo(gameLayer);
  sprite.pin({
    pivotX: 0.5,
    pivotY: 0.5,
    handleX: 0.5,
    handleY: 0.5,
    scaleX,
    scaleY,
  });

  const stone = createEntity("stone", body, fixture, sprite, {
    targetType: "stone",
    hp: 1,
    points: 0,
    age: 0,
    phase: rand(0, Math.PI * 2),
    scaleX,
    scaleY,
    balloon: balloonEntity || null,
    landed: false,
  });

  const gravity = GRAVITY * config.gravityScale;
  const drop = Math.max(0.05, GROUND_Y - startY - halfHeight);
  const flightTime =
    (upSpeed + Math.sqrt(upSpeed * upSpeed + 2 * gravity * drop)) / gravity;
  const driftSpeed = scrollSpeed() / PPM;
  const converge = driftSpeed * (refFlight - flightTime);
  const offset = ((rand(-1, 1) + rand(-1, 1)) / 2) * config.landSpread;
  const landX = targetX + offset + converge;
  const flightX = ((landX - startX) / flightTime) * config.throwSpeedScale;

  body.setLinearVelocity(planck.Vec2(flightX, -upSpeed));
  const spinDir = rand(0, 1) < 0.5 ? -1 : 1;
  body.setAngularVelocity(spinDir * rand(config.spinMin, config.spinMax));
  stones.push(stone);
  return stone;
}

function throwStoneVolley(entity) {
  const config = BARRIER_CONFIG;
  const stoneConfig = STONE_CONFIG;
  const position = entity.body.getPosition();
  const gravity = GRAVITY * stoneConfig.gravityScale;
  const drop = Math.max(0.05, GROUND_Y - position.y - stoneConfig.height / 2);
  const base = Math.max(1, config.stoneCount);
  const count = Math.max(1, Math.round(rand(base - 1, base + 1)));
  const targetX =
    position.x - rand(stoneConfig.targetDistanceMin, stoneConfig.targetDistanceMax);

  const shots = [];
  let refFlight = 0;
  for (let i = 0; i < count; i += 1) {
    const upSpeed = rand(stoneConfig.throwUpMin, stoneConfig.throwUpMax);
    const flightTime =
      (upSpeed + Math.sqrt(upSpeed * upSpeed + 2 * gravity * drop)) / gravity;
    shots.push({ upSpeed, flightTime });
    if (flightTime > refFlight) refFlight = flightTime;
  }

  for (const shot of shots) {
    if (stones.length >= stoneConfig.maxActive) return;
    spawnStone(position.x, position.y, targetX, shot.upSpeed, refFlight, entity);
  }
}

function updateBarrierBalloon(dt) {
  const entity = barrierBalloon;
  if (!entity || entity.dead) return;

  const config = BARRIER_CONFIG;
  entity.age += dt;
  entity.flash = Math.max(0, entity.flash - dt);

  const position = entity.body.getPosition();
  const region = barrierRegion();

  const toWander = Math.hypot(
    entity.wander.x - position.x,
    entity.wander.y - position.y,
  );

  if (toWander < config.retargetDistance) entity.wander = nextBarrierPoint();
  if (
    position.x < region.minX ||
    position.x > region.maxX ||
    position.y < region.minY ||
    position.y > region.maxY
  ) {
    entity.wander = nextBarrierPoint();
  }

  const dx = entity.wander.x - position.x;
  const dy = entity.wander.y - position.y;
  const length = Math.hypot(dx, dy) || 1;
  // 补偿屏幕向左滚动，不跟随屏幕离开
  const drift = scrollSpeed() / PPM;
  let vx = (dx / length) * entity.speed + drift;
  let vy = (dy / length) * entity.speed;
  // 边界约束：防止飞离屏幕
  if (position.x < region.minX + config.radius) vx = Math.max(0.2, vx);
  if (position.x > region.maxX - config.radius) vx = Math.min(-0.2, vx);
  if (position.y < region.minY + config.radius) vy = Math.max(0.2, vy);
  if (position.y > region.maxY - config.radius) vy = Math.min(-0.2, vy);
  entity.body.setLinearVelocity(planck.Vec2(vx, vy));

  if (entity.bursting) {
    entity.throwTimer -= dt;
    if (entity.throwTimer > 0) return;

    entity.throwTimer = config.burstVolleyInterval;
    entity.burstShots += 1;
    throwStoneVolley(entity);

    if (entity.burstShots >= config.burstVolleys) {
      entity.bursting = false;
      entity.pauseTimer = config.pauseDuration;
      entity.wander = nextBarrierPoint();
    }
    return;
  }

  entity.pauseTimer -= dt;
  if (entity.pauseTimer > 0) return;

  entity.bursting = true;
  entity.burstShots = 0;
  entity.throwTimer = 0;
}

function updateStones(dt) {
  const config = STONE_CONFIG;
  const groundY = GROUND_Y;
  const driftX = -scrollSpeed() / PPM;

  for (let i = stones.length - 1; i >= 0; i -= 1) {
    const stone = stones[i];
    if (!stone) {
      stones.splice(i, 1);
      continue;
    }
    if (stone.dead) {
      stones.splice(i, 1);
      continue;
    }

    stone.age += dt;
    const position = stone.body.getPosition();
    const velocity = stone.body.getLinearVelocity();

    if (
      !stone.landed &&
      position.y > groundY - config.settleBand &&
      Math.abs(velocity.y) < config.settleSpeed
    ) {
      stone.landed = true;
      // 落地后切换为运动学刚体：脱离动力学求解，逐帧物理开销大幅下降
      stone.body.setType("kinematic");
      stone.body.setLinearVelocity(planck.Vec2(driftX, 0));
      stone.body.setAngularVelocity(0);
    }

    if (stone.landed) {
      stone.body.setLinearVelocity(planck.Vec2(driftX, 0));
    }

    if (position.x < config.despawnX || position.y > WORLD_H + 2) {
      markDead(stone);
      stones.splice(i, 1);
    }
  }
}

function specialBalloonAlive() {
  if (barrierBalloon && !barrierBalloon.dead) return true;
  if (galeBalloon && !galeBalloon.dead && !galeBalloon.converted) return true;
  if (soapBalloon && !soapBalloon.dead && !soapBalloon.converted) return true;
  if (commander && !commander.dead) return true;
  return false;
}

function spawnSpecialBalloon() {
  const r = Math.random();
  const barrierChance = SPECIAL_BALLOON_CONFIG.barrierChance;
  const commanderChance = barrierChance + SPECIAL_BALLOON_CONFIG.commanderChance;
  const soapChance = commanderChance + SPECIAL_BALLOON_CONFIG.soapChance;
  if (r < barrierChance) return spawnBarrierBalloon();
  if (r < commanderChance) return spawnCommander();
  if (r < soapChance) return spawnSoapBalloon();
  return spawnGaleBalloon();
}

function updateGaleBalloon(dt) {
  if (state !== "playing") return;

  if (!galeBalloon || galeBalloon.dead || galeBalloon.converted) return;

  galeBalloon.windTimer -= dt;
  if (galeBalloon.windTimer > 0) return;
  galeBalloon.windActive = !galeBalloon.windActive;
  galeBalloon.windTimer = galeBalloon.windActive
    ? GALE_CONFIG.windOnDuration
    : GALE_CONFIG.windOffDuration;
}

function updateSoapBalloon(dt) {
  if (state !== "playing") return;
  if (!soapBalloon || soapBalloon.dead || soapBalloon.converted) return;

  soapBalloon.sprayTimer -= dt;
  if (soapBalloon.sprayTimer > 0) return;
  soapBalloon.sprayTimer = SOAP_CONFIG.sprayInterval;
  spraySoapBubbles(soapBalloon);
}

function popSoapBubble(bubble) {
  if (bubble.sprite) {
    bubble.sprite.remove();
    bubble.sprite = null;
  }
}

function clearSoapBubbles() {
  for (const bubble of soapBubbles) popSoapBubble(bubble);
  soapBubbles = [];
}

function updateSoapBubbles(dt) {
  if (state !== "playing") return;

  const config = SOAP_CONFIG;
  const planePosition = plane && !plane.dead ? plane.body.getPosition() : null;
  const planeRadius = config.stickRadius;
  let stuckCount = 0;

  for (let i = soapBubbles.length - 1; i >= 0; i -= 1) {
    const bubble = soapBubbles[i];
    bubble.age += dt;

    if (bubble.stuck && planePosition) {
      bubble.stuckAge += dt;
      bubble.x = planePosition.x + bubble.offsetX;
      bubble.y = planePosition.y + bubble.offsetY;
      stuckCount += 1;
    } else {
      if (bubble.stuck) bubble.stuck = false;
      const blend = Math.min(1, dt * config.bubbleDrag * 4);
      bubble.vx += (config.bubbleDriftX - bubble.vx) * blend;
      bubble.vy += (config.bubbleDriftY - bubble.vy) * blend;
      bubble.x += bubble.vx * dt;
      bubble.y += bubble.vy * dt;

      if (
        planePosition &&
        !bubble.stuck &&
        !bubble.pop &&
        Math.hypot(bubble.x - planePosition.x, bubble.y - planePosition.y) <
          planeRadius + bubble.radius
      ) {
        bubble.stuck = true;
        bubble.stuckAge = 0;
        bubble.offsetX = bubble.x - planePosition.x;
        bubble.offsetY = bubble.y - planePosition.y;
        stuckCount += 1;
      }
    }

    // 粘附后改用独立的吸附寿命计时，避免气泡一贴上就因飞行寿命耗尽而爆裂
    const lifeLimit = bubble.stuck ? config.bubbleStickLife : bubble.life;
    const elapsed = bubble.stuck ? bubble.stuckAge : bubble.age;
    if (!bubble.pop && elapsed >= lifeLimit) bubble.pop = true;

    if (bubble.pop) {
      bubble.popT += dt / config.bubblePopStagger;
      const fade = Math.max(0, 1 - bubble.popT);
      if (bubble.sprite) {
        const grow = 1 + bubble.popT * 0.6;
        bubble.sprite.pin({
          offsetX: bubble.x * PPM,
          offsetY: bubble.y * PPM,
          scaleX: bubble.scale * grow,
          scaleY: bubble.scale * grow,
          alpha: 0.85 * fade,
        });
      }
      if (bubble.popT >= 1) {
        popSoapBubble(bubble);
        soapBubbles.splice(i, 1);
      }
      continue;
    }

    if (bubble.sprite) {
      const wobble = Math.sin(bubble.age * 6 + bubble.radius * 20) * 0.08;
      bubble.sprite.pin({
        offsetX: bubble.x * PPM,
        offsetY: bubble.y * PPM,
        scaleX: bubble.scale * (1 + wobble),
        scaleY: bubble.scale * (1 - wobble),
        alpha: bubble.stuck ? 1 : 0.85,
      });
    }

    if (bubble.x < -2 || bubble.y < -2 || bubble.y > WORLD_H + 2) {
      popSoapBubble(bubble);
      soapBubbles.splice(i, 1);
    }
  }

  if (plane && !plane.dead) plane.soapStuck = stuckCount;
}

function updateSpecialBalloons(dt) {
  if (state !== "playing") {
    updateStones(dt);
    return;
  }

  if (
    !specialBalloonAlive() &&
    wave >= SPECIAL_BALLOON_CONFIG.minWave &&
    specialBalloonWave !== wave
  ) {
    const spawned = spawnSpecialBalloon();
    if (spawned) specialBalloonWave = wave;
  }

  if (barrierBalloon && !barrierBalloon.dead) updateBarrierBalloon(dt);
  updateGaleBalloon(dt);
  updateSoapBalloon(dt);
  updateSoapBubbles(dt);
  updateStones(dt);
}

function updateHud() {
  renderHud({ score, best, hp, wave, powerTimer });
}






const keys = new Set();
let pointerDown = false;

const HINT_MANUAL =
  "WASD / 方向键 移动 · 空格或按住鼠标 射击 · 每 200 分强化火力 8 秒 · R 重新开始 · P 自动演示";
const HINT_AUTOPILOT = "自动演示中 · 按 P 返回手动操控";
const AUTOPILOT_RESTART_DELAY = 2.5;
const MAX_STEPS_PER_FRAME = 3;

let autopilot = false;
let autopilotRestart = 0;

function updateHint() {
  if (!hintEl) return;
  hintEl.textContent = autopilot ? HINT_AUTOPILOT : HINT_MANUAL;
}


let world = null;
let plane = null;
let commander = null;
let allyCommander = null;
let allySpawnTimer = 0;
let conversionActive = false;

let barrierBalloon = null;
let galeBalloon = null;
let specialBalloonWave = 0;
let soapBalloon = null;
let soapBubbles = [];
let stones = [];
let entities = [];
let state = "menu";
let score = 0;
let best = loadBest();
let hp = MAX_HP;
let wave = 1;
let gameTime = 0;
let spawnTimer = 1;
let waveGemTimer = 0;
let waveGemSpawned = 0;
let waveScript = null;
let ambientSquadIndex = 0;
let fireTimer = 0;
let powerTimer = 0;
let nextPowerScore = POWER_UP_CONFIG.scoreStep;
let accumulator = 0;
let shake = 0;
let shakeOffsetX = 0;
let shakeOffsetY = 0;

function loadBest() {
  try {
    return Number(localStorage.getItem("skyPatrol.best")) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem("skyPatrol.best", String(value));
  } catch {
    /* storage may be unavailable */
  }
}


function commanderRegion() {
  return {
    minX: WORLD_W * COMMANDER_CONFIG.regionMinX,
    maxX: WORLD_W * COMMANDER_CONFIG.regionMaxX,
    minY: WORLD_H * COMMANDER_CONFIG.regionMinY,
    maxY: WORLD_H * COMMANDER_CONFIG.regionMaxY,
  };
}

function nextWanderPoint() {
  const region = commanderRegion();
  return { x: rand(region.minX, region.maxX), y: rand(region.minY, region.maxY) };
}

function spawnCommander() {
  if (!world) return null;
  const config = COMMANDER_CONFIG;
  const region = commanderRegion();
  // 在屏幕右上角随机生成，确保完整显示
  const x = rand(region.maxX - config.radius, region.maxX);
  const y = rand(region.minY + config.radius, region.maxY - config.radius);

  const body = world.createBody({
    type: "kinematic",
    position: planck.Vec2(x, y),
    fixedRotation: true,
  });
  const fixture = body.createFixture(planck.Circle(config.radius), {
    density: 1.2,
    restitution: 0,
    friction: 0,
    filterCategoryBits: CAT.TARGET,
    filterMaskBits: CAT.PLANE | CAT.BULLET,
  });

  const haloScale = (config.radius * 4.4 * PPM) / commanderHaloTexture.getWidth();
  const halo = Stage.sprite(commanderHaloTexture).appendTo(gameLayer);
  halo.pin({
    pivotX: 0.5,
    pivotY: 0.5,
    handleX: 0.5,
    handleY: 0.5,
    scaleX: haloScale,
    scaleY: haloScale,
    alpha: 0,
  });

  const sprite = Stage.sprite(config.texture).appendTo(gameLayer);
  sprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

  commander = createEntity("target", body, fixture, sprite, {
    targetType: "commander",
    hp: config.hp,
    points: config.points,
    heal: 0,
    speed: config.speed,
    bob: 0,
    phase: rand(0, Math.PI * 2),
    age: 0,
    flash: 0,
    halo,
    haloScale,
    wander: { x: rand(region.minX, region.maxX), y: rand(region.minY, region.maxY) },
  });

  return commander;
}

function moveCommander(entity) {
  const config = COMMANDER_CONFIG;
  const position = entity.body.getPosition();

  const toWander = Math.hypot(
    entity.wander.x - position.x,
    entity.wander.y - position.y,
  );

  if (toWander < config.retargetDistance) entity.wander = nextWanderPoint();

  const dx = entity.wander.x - position.x;
  const dy = entity.wander.y - position.y;
  const length = Math.hypot(dx, dy) || 1;
  // 补偿屏幕向左滚动，不跟随屏幕离开
  const drift = scrollSpeed() / PPM;
  let vx = (dx / length) * config.speed + drift;
  let vy = (dy / length) * config.speed;
  // 边界约束：防止飞离屏幕
  const region = commanderRegion();
  if (position.x < region.minX + config.radius) vx = Math.max(0.2, vx);
  if (position.x > region.maxX - config.radius) vx = Math.min(-0.2, vx);
  if (position.y < region.minY + config.radius) vy = Math.max(0.2, vy);
  if (position.y > region.maxY - config.radius) vy = Math.min(-0.2, vy);
  entity.body.setLinearVelocity(planck.Vec2(vx, vy));
}

function scheduleAllyCommander() {
  if (conversionActive) return;
  if (allyCommander && !allyCommander.dead) return;
  allySpawnTimer = ALLY_COMMANDER_CONFIG.delay;
}

function spawnAllyCommander() {
  if (!world || state !== "playing") return;
  if (allyCommander && !allyCommander.dead) return;

  const config = ALLY_COMMANDER_CONFIG;
  const laneY = GROUND_Y - config.radius - 0.02;
  const body = world.createBody({
    type: "kinematic",
    position: planck.Vec2(WORLD_W + config.spawnX, laneY),
    fixedRotation: true,
  });
  const fixture = body.createFixture(planck.Circle(config.radius), {
    density: 0,
    restitution: 0,
    friction: 0,
    filterCategoryBits: CAT.TARGET,
    filterMaskBits: CAT.PLANE,
  });

  const haloScale =
    (config.radius * config.haloScale * PPM) / config.haloTexture.getWidth();
  const halo = Stage.sprite(config.haloTexture).appendTo(gameLayer);
  halo.pin({
    pivotX: 0.5,
    pivotY: 0.5,
    handleX: 0.5,
    handleY: 0.5,
    scaleX: haloScale,
    scaleY: haloScale,
    alpha: 0,
  });

  const sprite = Stage.sprite(config.texture).appendTo(gameLayer);
  sprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

  allyCommander = createEntity("target", body, fixture, sprite, {
    targetType: "allyCommander",
    hp: 1,
    points: 0,
    heal: 0,
    speed: scrollSpeed() / PPM,
    bob: 0,
    phase: 0,
    age: 0,
    flash: 0,
    halo,
    haloScale,
  });

  body.setLinearVelocity(planck.Vec2(-scrollSpeed() / PPM, 0));
  return allyCommander;
}

function disableEntityCollisions(entity) {
  if (!entity.body) return;
  let fixture = entity.body.getFixtureList();
  while (fixture) {
    fixture.setFilterData({ categoryBits: 0, maskBits: 0, groupIndex: 0 });
    fixture = fixture.getNext();
  }
  entity.fixture = null;
}

function convertTarget(entity) {
  if (!entity || entity.dead || entity.converted || entity.puffed) return;
  const type = entity.targetType;
  if (type === "gem" || type === "commander" || type === "allyCommander") return;
  if (entity.kind !== "target" && entity.kind !== "pendulum" && entity.kind !== "magnet") {
    return;
  }

  entity.converted = true;
  entity.speed = Math.max(entity.speed || 0, 1.6);
  entity.falling = false;
  entity.fallApplied = false;
  entity.charging = false;
  entity.chargeBlend = 0;
  entity.homingMissed = false;
  entity.entering = false;
  entity.escaped = false;
  entity.pulling = false;
  entity.dropDistance = 0;

  if (entity.body) {
    entity.body.setGravityScale(0);
    disableEntityCollisions(entity);
    entity.body.setLinearVelocity(planck.Vec2(entity.speed, 0));
  }

  if (entity.sprite && type !== "invisible") {
    const baseTexture = entity.sprite._image;
    if (baseTexture) entity.sprite.image(convertedSpriteTexture(baseTexture));
  }
  if (entity.plate && entity.plate.sprite) {
    const plateTexture = entity.plate.sprite._image;
    if (plateTexture) entity.plate.sprite.image(convertedSpriteTexture(plateTexture));
  }

  if (entity.fanSprite) {
    entity.fanSprite.remove();
    entity.fanSprite = null;
  }
  if (entity.windSprite) {
    entity.windSprite.remove();
    entity.windSprite = null;
  }

  if (entity.kind === "target") {
    const auraScale =
      (autopilotRadius(entity) * CONVERTED_AURA_SCALE * PPM) / allyHaloTexture.getWidth();
    const aura = Stage.sprite(allyHaloTexture).appendTo(gameLayer);
    aura.pin({
      pivotX: 0.5,
      pivotY: 0.5,
      handleX: 0.5,
      handleY: 0.5,
      scaleX: auraScale,
      scaleY: auraScale,
      alpha: 0,
    });
    entity.convertAura = aura;
    entity.convertAuraScale = auraScale;
  }

  const position = entity.body.getPosition();
  spawnParticles(
    position.x * PPM,
    position.y * PPM,
    ["#7ef9ff", "#bfe0ff", "#2f7bff"],
    10,
    40,
    140,
  );
}

function convertedIntercept(entity, position) {
  const radius = autopilotRadius(entity);
  for (const other of entities) {
    if (other === entity || other.dead || other.converted || other.puffed) continue;
    if (other.kind !== "target" || other.falling) continue;
    const type = other.targetType;
    if (type === "gem" || type === "allyCommander" || type === "commander") continue;
    const otherPosition = other.body.getPosition();
    const reach = radius + autopilotRadius(other) + 0.12;
    const distance = Math.hypot(otherPosition.x - position.x, otherPosition.y - position.y);
    if (distance > reach) continue;

    if (type === "duo") {
      duoBalloonDown(other, { silent: true });
      spawnExplosion(otherPosition.x, otherPosition.y, "duo");
    } else if (type === "springBalloon") {
      springBalloonDown(other, { silent: true });
      if (other.springBomb && !other.springBomb.dead) markDead(other.springBomb);
      spawnExplosion(otherPosition.x, otherPosition.y, "balloon");
    } else {
      markDead(other);
      spawnExplosion(otherPosition.x, otherPosition.y, type);
    }
    shake = Math.max(shake, 4);
    soundExplosion(false);
  }
}

function retireConverted(entity) {
  if (entity.targetType === "duo") {
    duoBalloonDown(entity, { silent: true });
    return;
  }
  if (entity.targetType === "springBalloon") {
    springBalloonDown(entity, { silent: true });
    if (entity.springBomb && !entity.springBomb.dead) markDead(entity.springBomb);
    return;
  }
  entity.dead = true;
}

function startConversion() {
  if (conversionActive) return;
  conversionActive = true;

  for (const entity of entities) {
    if (entity.dead) continue;
    if (entity.kind === "springBomb" || entity.kind === "link" || entity.kind === "bomb") {
      markDead(entity);
      continue;
    }
    if (entity.kind === "pendulum" || entity.kind === "magnet") {
      convertTarget(entity);
      continue;
    }
    if (entity.kind !== "target") continue;
    convertTarget(entity);
  }

  const planePosition = plane && !plane.dead ? plane.body.getPosition() : null;
  if (planePosition) {
    spawnParticles(
      planePosition.x * PPM,
      planePosition.y * PPM,
      ["#ffffff", "#7ef9ff", "#bfe0ff"],
      26,
      60,
      240,
    );
  }

  shake = Math.max(shake, 8);
  soundConvert();
  updateHud();
}

function updateConversionState() {
  if (!conversionActive) return;
  const remaining = entities.some((entity) => !entity.dead && entity.converted);
  if (!remaining) conversionActive = false;
}

function collectAllyCommander(ally) {
  if (!ally || ally.dead) return;
  const position = ally.body.getPosition();
  markDead(ally);
  spawnParticles(
    position.x * PPM,
    position.y * PPM,
    ["#ffffff", "#7ef9ff", "#bfe0ff"],
    24,
    60,
    220,
  );
  shake = Math.max(shake, 6);
}

function newWorld() {
  world = planck.World({ gravity: planck.Vec2(0, GRAVITY) });
  world.on("begin-contact", onBeginContact);
  createGroundBody();
}

function createGroundBody() {
  const body = world.createBody({
    type: "static",
    position: planck.Vec2(WORLD_W / 2, GROUND_Y + 0.6),
  });
  body.createFixture(planck.Box(WORLD_W * 1.5, 0.6), {
    friction: 0.7,
    restitution: 0.02,
    filterCategoryBits: CAT.GROUND,
    filterMaskBits: CAT.STONE,
  });
}

function createEntity(kind, body, fixture, sprite, extra = {}) {
  const entity = {
    kind,
    body,
    fixture,
    sprite,
    dead: false,
    ...extra,
  };
  fixture.setUserData(entity);
  entities.push(entity);
  return entity;
}

function createPlane() {
  const body = world.createBody({
    type: "dynamic",
    position: planck.Vec2(3.6, WORLD_H / 2),
    fixedRotation: true,
    linearDamping: 2.2,
  });
  const fixture = body.createFixture(planck.Box(0.85, 0.32), {
    density: 0.9,
    friction: 0.1,
    restitution: 0,
    isSensor: true,
    filterCategoryBits: CAT.PLANE,
    filterMaskBits: CAT.TARGET | CAT.PENDULUM | CAT.MAGNET | CAT.STONE,
  });
  const pushFixture = body.createFixture(planck.Box(0.85, 0.32), {
    density: 0.5,
    friction: 0.05,
    restitution: 0,
    filterCategoryBits: CAT.PLANE,
    filterMaskBits: CAT.STONE,
  });
  const sprite = Stage.sprite(planeTexture).appendTo(gameLayer);
  sprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

  const gasTint = Stage.sprite(gasTexture).appendTo(fogLayer);
  gasTint.pin({
    pivotX: 0.5,
    pivotY: 0.5,
    handleX: 0.5,
    handleY: 0.5,
    scaleX: 0.5,
    scaleY: 0.5,
    alpha: 0,
  });

  const glowScale = (POWER_UP_CONFIG.glowScale * PPM) / powerHaloTexture.getWidth();
  const powerGlow = Stage.sprite(powerHaloTexture).appendTo(gameLayer);
  powerGlow.pin({
    pivotX: 0.5,
    pivotY: 0.5,
    handleX: 0.5,
    handleY: 0.5,
    scaleX: glowScale,
    scaleY: glowScale,
    alpha: 0,
  });

  const planeEntity = createEntity("plane", body, fixture, sprite, {
    invuln: 0,
    visualAngle: 0,
    age: 0,
    lagX: 0,
    lagY: 0,
    inGas: false,
    gasDebuff: 0,
    gasTint,
    powerGlow,
    powerGlowScale: glowScale,
    clayFall: false,
    clayGrounded: 0,
    clayBasket: null,
    clayBasketOffset: { x: 0, y: 0 },
    clayBasketAge: 0,
    soapStuck: 0,
  });
  pushFixture.setUserData(planeEntity);
  return planeEntity;
}

function shoot(angle = 0) {
  if (!plane || plane.dead) return;
  const origin = plane.body.getPosition();
  const velocity = plane.body.getLinearVelocity();
  const boosted = powerTimer > 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const speed = 17 + Math.max(0, velocity.x) * cos;

  const body = world.createBody({
    type: "dynamic",
    position: planck.Vec2(origin.x + cos * 1.0, origin.y + sin * 1.0),
    bullet: true,
    fixedRotation: true,
    gravityScale: 0,
    linearDamping: 0,
  });
  const fixture = body.createFixture(planck.Circle(0.11), {
    density: 0.4,
    restitution: 0,
    friction: 0,
    filterCategoryBits: CAT.BULLET,
    filterMaskBits: CAT.TARGET | CAT.PENDULUM | CAT.MAGNET,
  });
  body.setLinearVelocity(planck.Vec2(speed * cos, speed * sin + velocity.y * 0.25));

  const sprite = Stage.sprite(boosted ? powerBulletTexture : bulletTexture).appendTo(gameLayer);
  sprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });
  if (angle !== 0) sprite.pin({ rotation: angle });

  createEntity("bullet", body, fixture, sprite, {
    life: 1.3,
    age: 0,
    deflectTimer: 0,
    deflectVX: 0,
    deflectVY: 0,
    windAffected: false,
  });
  soundShoot();
}

function fireVolley() {
  if (powerTimer > 0) {
    shoot(-POWER_UP_CONFIG.spread);
    shoot(0);
    shoot(POWER_UP_CONFIG.spread);
    return;
  }
  shoot(0);
}

function triggerPowerUp() {
  powerTimer = POWER_UP_CONFIG.duration;
  nextPowerScore += POWER_UP_CONFIG.scoreStep;
  soundPowerUp();
  if (plane && !plane.dead) {
    const position = plane.body.getPosition();
    spawnParticles(
      position.x * PPM,
      position.y * PPM,
      ["#7ef9ff", "#eafeff", "#ffd166"],
      26,
      60,
      260,
    );
  }
  shake = Math.max(shake, 5);
}

function spawnTarget() {
  if (!world) return;
  if (entities.filter((entity) => entity.kind === "target").length >= 14) return;

  const roll = Math.random();
  const gemChance = Math.min(0.25, 0.15 + wave * 0.005);
  const spawnGem = roll < gemChance;

  const commanderCount = entities.filter(
    (entity) => entity.targetType === "commander" && !entity.dead,
  ).length;
  if (!spawnGem && wave >= 3 && commanderCount < 1 && Math.random() < 0.05) {
    spawnCommander();
    return;
  }

  const bomberCount = entities.filter((entity) => entity.targetType === "bomber").length;
  if (!spawnGem && wave >= 2 && bomberCount < 2 && Math.random() < 0.18) {
    spawnBomber();
    return;
  }

  const duoCount = entities.filter((entity) => entity.targetType === "duo" && !entity.dead).length;
  if (!spawnGem && wave >= 2 && duoCount < 1 && Math.random() < 0.14) {
    spawnDuo();
    return;
  }

  const springCount = entities.filter(
    (entity) => entity.targetType === "springBalloon" && !entity.dead,
  ).length;
  if (!spawnGem && wave >= 2 && springCount < 1 && Math.random() < 0.14) {
    spawnSpringBombBalloon();
    return;
  }

  const smokeCount = entities.filter((entity) => entity.targetType === "smoke").length;
  const mineCount = entities.filter(
    (entity) => entity.targetType === "mine" && !entity.dead,
  ).length;
  const pendulumCount = entities.filter(
    (entity) => entity.kind === "pendulum" && !entity.dead,
  ).length;
  const magnetCount = entities.filter(
    (entity) => entity.kind === "magnet" && !entity.dead,
  ).length;
  const steelCount = entities.filter(
    (entity) => entity.targetType === "steelBalloon" && !entity.dead,
  ).length;
  const invisibleCount = entities.filter(
    (entity) => entity.targetType === "invisible" && !entity.dead,
  ).length;
  const clayCount = entities.filter(
    (entity) => entity.targetType === "clayBalloon" && !entity.dead,
  ).length;

  let type = "balloon";
  const gasBalloonRoll = Math.random();
  if (spawnGem) {
    type = "gem";
  } else if (wave >= 3 && magnetCount < 1 && Math.random() < 0.08) {
    type = "magnet";
  } else if (wave >= 2 && pendulumCount < 1 && Math.random() < 0.1) {
    type = "pendulum";
  } else if (wave >= 2 && steelCount < 1 && Math.random() < 0.12) {
    type = "steelBalloon";
  } else if (wave >= 2 && invisibleCount < 1 && Math.random() < 0.12) {
    type = "invisible";
  } else if (wave >= 2 && clayCount < 3 && Math.random() < 0.22) {
    type = "clayBalloon";
  } else if (wave >= 2 && mineCount < 1 && Math.random() < 0.1) {
    type = "mine";
  } else if (wave >= 2 && gasBalloonRoll < 0.3) {
    type = "gasBalloon";
  } else if (wave >= 2 && Math.random() < 0.14 && smokeCount < 2) {
    type = "smoke";
  }

  if (
    type === "balloon" &&
    entities.filter((entity) => entity.kind === "target").length <= 10 &&
    Math.random() < 0.35
  ) {
    const ambient = AMBIENT_SQUADS[ambientSquadIndex % AMBIENT_SQUADS.length];
    ambientSquadIndex += 1;
    spawnBalloonSquad(ambient.pattern, { y: ambient.y, maxCount: 3 });
    return;
  }

  createTarget(type);
}

function trySpawnWaveGem(dt) {
  if (!waveScript || waveScript.mixed) return;

  waveGemTimer = Math.max(0, waveGemTimer - dt);
  if (waveGemTimer > 0) return;
  if (!world || waveGemSpawned >= GEM_SPAWN_CONFIG.singleWaveQuota) return;
  if (hp > MAX_HP - GEM_SPAWN_CONFIG.singleWaveMinHpMissing) return;
  const gemAlive = entities.some(
    (entity) => entity.kind === "target" && entity.targetType === "gem" && !entity.dead,
  );
  if (gemAlive) return;

  if (!createTarget("gem")) return;
  waveGemSpawned += 1;
  waveGemTimer = GEM_SPAWN_CONFIG.singleWaveInterval;
}

function resolveLaneY(desiredY, radius, options = {}) {
  const { hanging = false, entry = false, minY, maxY, belowExtent = 0 } = options;
  const low = typeof minY === "number" ? minY : entry ? 1.0 : hanging ? 1.4 : 1.3;
  const high =
    typeof maxY === "number"
      ? maxY
      : entry
        ? WORLD_H - 1.0
        : hanging
          ? Math.max(1.4, GROUND_Y - 2.4)
          : WORLD_H - 1.3;
  const clampLane = (value) => clamp(value, low, Math.max(low, high));

  const base = clampLane(desiredY);
  const nearby = entities.filter(
    (entity) =>
      entity.kind === "target" &&
      !entity.dead &&
      entity.body.getPosition().x > WORLD_W * 0.4,
  );

  const conflicts = (value) => {
    for (const entity of nearby) {
      const otherConfig = TARGET_CONFIG[entity.targetType];
      const otherRadius = otherConfig ? otherConfig.radius : 0.42;
      const otherY = entity.body.getPosition().y;
      const gap = radius + otherRadius + 0.35;
      const needed = otherY > value ? gap + belowExtent : gap;
      if (Math.abs(value - otherY) < needed) return true;
    }
    return false;
  };

  if (!conflicts(base)) return base;

  for (let step = 1; step <= 10; step += 1) {
    const offset = step * 0.85;
    for (const candidate of [base - offset, base + offset]) {
      const value = clampLane(candidate);
      if (!conflicts(value)) return value;
    }
  }

  return base;
}

function createTarget(type, options = {}) {
  const config = TARGET_CONFIG[type];
  if (!config) return null;

  const hanging = type === "pendulum" || type === "magnet";
  const entry = options.entry || null;

  let laneY =
    typeof options.y === "number"
      ? options.y
      : hanging
        ? rand(1.4, Math.max(1.4, GROUND_Y - 2.4))
        : rand(1.3, WORLD_H - 1.3);
  laneY = options.exactLane
    ? clamp(laneY, 1.1, WORLD_H - 1.1)
    : resolveLaneY(laneY, config.radius, { hanging, entry });

  const spawnY = entry ? (entry === "top" ? -1.3 : WORLD_H + 1.3) : laneY;
  const spawnX =
    entry ? WORLD_W * 0.62 : typeof options.x === "number" ? options.x : WORLD_W + 1.1;

  const body = world.createBody({
    type: "dynamic",
    position: planck.Vec2(spawnX, spawnY),
    gravityScale: 0,
    fixedRotation: true,
  });
  const fixture = body.createFixture(planck.Circle(config.radius), {
    density: 0.5,
    restitution: 0,
    friction: 0,
    filterCategoryBits: CAT.TARGET,
    filterMaskBits: type === "gem" ? CAT.PLANE : CAT.PLANE | CAT.BULLET,
  });

  const sprite = Stage.sprite(
    type === "invisible" ? solidTexture("rgba(0,0,0,0)") : config.texture,
  ).appendTo(gameLayer);
  sprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

  const target = createEntity("target", body, fixture, sprite, {
    targetType: type,
    hp: config.hp,
    points: config.points,
    heal: config.heal || 0,
    speed:
      typeof options.forceSpeed === "number"
        ? options.forceSpeed
        : (config.speed + wave * config.speedPerWave) * (options.speedMul || 1),
    bob: typeof options.forceBob === "number" ? options.forceBob : config.bob,
    phase: typeof options.phase === "number" ? options.phase : rand(0, Math.PI * 2),
    age: 0,
    flash: 0,
    ...(entry
      ? {
          entering: true,
          entryWaypoint: { x: WORLD_W * 0.42, y: clamp(laneY, 1.0, WORLD_H - 1.0) },
        }
      : {}),
    ...(type === "mine" ? { radius: config.radius, dropDistance: 0 } : {}),
    ...(type === "invisible" || type === "clayBalloon"
      ? { charging: false, chargeBlend: 0 }
      : {}),
    ...(options.snakeSquad
      ? { snakeSquad: options.snakeSquad, snakeIndex: options.snakeIndex || 0 }
      : {}),
    ...(options.formation ? { formation: options.formation } : {}),
  });

  if (type === "pendulum") attachPendulum(target);
  else if (type === "magnet") attachMagnet(target);
  else if (type === "steelBalloon") attachSteelPlate(target);

  return target;
}

const SQUAD_TARGET_LIMIT = 20;
const SQUAD_ROLES = [
  "balloon",
  "steelBalloon",
  "gasBalloon",
  "clayBalloon",
  "invisible",
  "mine",
  "smoke",
];

const SQUAD_FORMATIONS = {
  line: {
    label: "横队",
    slots: [
      { x: 0, y: 0, role: "steelBalloon", minWave: 2 },
      { x: 1, y: 0, role: "balloon" },
      { x: 2, y: 0, role: "gasBalloon", minWave: 2 },
      { x: 3, y: 0, role: "balloon" },
    ],
  },
  column: {
    label: "纵队",
    slots: [
      { x: 0, y: -1.5, role: "balloon" },
      { x: 0, y: -0.5, role: "gasBalloon", minWave: 2 },
      { x: 0, y: 0.5, role: "balloon" },
      { x: 0, y: 1.5, role: "balloon" },
    ],
  },
  diamond: {
    label: "菱形",
    slots: [
      { x: 0, y: 0, role: "steelBalloon", minWave: 2 },
      { x: 0.9, y: -1, role: "balloon" },
      { x: 0.9, y: 0, role: "gasBalloon", minWave: 2 },
      { x: 0.9, y: 1, role: "balloon" },
      { x: 1.8, y: 0, role: "clayBalloon", minWave: 3 },
    ],
  },
  wedge: {
    label: "楔形",
    slots: [
      { x: 0, y: 0, role: "steelBalloon", minWave: 2 },
      { x: 0.9, y: -1, role: "gasBalloon", minWave: 2 },
      { x: 0.9, y: 1, role: "balloon" },
      { x: 1.8, y: -2, role: "invisible", minWave: 4 },
      { x: 1.8, y: 2, role: "clayBalloon", minWave: 3 },
    ],
  },
  echelon: {
    label: "斜梯",
    slots: [
      { x: 0, y: -1.5, role: "steelBalloon", minWave: 2 },
      { x: 0.9, y: -0.5, role: "balloon" },
      { x: 1.8, y: 0.5, role: "gasBalloon", minWave: 2 },
      { x: 2.7, y: 1.5, role: "balloon" },
    ],
  },
  shieldWall: {
    label: "盾墙",
    slots: [
      { x: 0, y: -1.1, role: "steelBalloon", minWave: 2 },
      { x: 0, y: 1.1, role: "steelBalloon", minWave: 2 },
      { x: 1.1, y: 0, role: "gasBalloon", minWave: 2 },
      { x: 1.1, y: -1.1, role: "balloon" },
      { x: 1.1, y: 1.1, role: "balloon" },
    ],
  },
  pincer: {
    label: "钳形",
    slots: [
      { x: 0, y: -2, role: "balloon" },
      { x: 0, y: 2, role: "balloon" },
      { x: 1, y: -1.2, role: "gasBalloon", minWave: 2 },
      { x: 1, y: 1.2, role: "clayBalloon", minWave: 3 },
      { x: 1.9, y: 0, role: "steelBalloon", minWave: 2 },
    ],
  },
  arrow: {
    label: "箭矢",
    slots: [
      { x: 0, y: 0, role: "steelBalloon", minWave: 2 },
      { x: 0.9, y: -0.9, role: "balloon" },
      { x: 0.9, y: 0.9, role: "gasBalloon", minWave: 2 },
      { x: 1.8, y: -1.8, role: "balloon" },
      { x: 1.8, y: 1.8, role: "balloon" },
      { x: 2.7, y: 0, role: "invisible", minWave: 4 },
    ],
  },
  grid: {
    label: "方阵",
    slots: [
      { x: 0, y: -0.9, role: "steelBalloon", minWave: 2 },
      { x: 0, y: 0.9, role: "balloon" },
      { x: 1.2, y: -0.9, role: "gasBalloon", minWave: 2 },
      { x: 1.2, y: 0.9, role: "balloon" },
      { x: 2.4, y: -0.9, role: "clayBalloon", minWave: 3 },
      { x: 2.4, y: 0.9, role: "balloon" },
    ],
  },
  superShield: {
    label: "超级防盾",
    slots: [
      { x: 0, y: -1.1, role: "steelBalloon", minWave: 2 },
      { x: 0, y: 0, role: "steelBalloon", minWave: 2 },
      { x: 0, y: 1.1, role: "steelBalloon", minWave: 2 },
      { x: 1.15, y: -1.1, role: "steelBalloon", minWave: 2 },
      { x: 1.15, y: 0, role: "steelBalloon", minWave: 2 },
      { x: 1.15, y: 1.1, role: "steelBalloon", minWave: 2 },
    ],
  },
  snakeFollow: {
    label: "蛇形跟随",
    motion: "snake",
    slots: [
      { x: 0, y: 0, role: "balloon" },
      { x: 0.72, y: 0, role: "balloon" },
      { x: 1.44, y: 0, role: "balloon" },
      { x: 2.16, y: 0, role: "balloon" },
      { x: 2.88, y: 0, role: "balloon" },
      { x: 3.6, y: 0, role: "balloon" },
      { x: 4.32, y: 0, role: "balloon" },
      { x: 5.04, y: 0, role: "balloon" },
      { x: 5.76, y: 0, role: "balloon" },
      { x: 6.48, y: 0, role: "balloon" },
    ],
  },
};

function resolveSquadRole(slot) {
  if (!SQUAD_ROLES.includes(slot.role)) return "balloon";
  if (typeof slot.minWave === "number" && wave < slot.minWave) return "balloon";
  return slot.role;
}

function spawnBalloonSquad(patternName, options = {}) {
  if (!world) return;
  const pattern = SQUAD_FORMATIONS[patternName];
  if (!pattern) return;

  const spacingX = options.spacingX || 1.6;
  const spacingY = options.spacingY || 1.5;
  const maxCount =
    typeof options.maxCount === "number" ? options.maxCount : pattern.slots.length;
  let slots = pattern.slots
    .slice(0, maxCount)
    .map((slot) => ({ x: slot.x, y: slot.y, type: resolveSquadRole(slot) }));

  const liveCount = entities.filter((entity) => entity.kind === "target").length;
  const available = SQUAD_TARGET_LIMIT - liveCount;
  if (available < 2) return;

  if (slots.length > available) {
    slots = slots
      .slice()
      .sort((a, b) => a.x - b.x || Math.abs(a.y) - Math.abs(b.y))
      .slice(0, available);
  }

  const midY =
    (Math.min(...slots.map((slot) => slot.y)) +
      Math.max(...slots.map((slot) => slot.y))) /
    2;
  const members = slots.map((slot) => {
    const radius = TARGET_CONFIG[slot.type] ? TARGET_CONFIG[slot.type].radius : 0.42;
    const plateMargin = slot.type === "steelBalloon" ? 0.55 : 0;
    return {
      type: slot.type,
      x: slot.x,
      y: slot.y - midY,
      radius: radius + plateMargin,
    };
  });

  const motionPad = pattern.motion === "snake" ? SNAKE_CONFIG.amplitude : 0;
  const extentY =
    Math.max(...members.map((member) => Math.abs(member.y) * spacingY + member.radius)) +
    motionPad;
  const low = 1.2 + extentY;
  const high = Math.max(low, GROUND_Y - 1.2 - extentY);
  const baseX = WORLD_W + 1.2;
  const phase = typeof options.phase === "number" ? options.phase : rand(0, Math.PI * 2);
  const squadSpeed =
    typeof options.forceSpeed === "number"
      ? options.forceSpeed
      : (TARGET_CONFIG.balloon.speed + wave * TARGET_CONFIG.balloon.speedPerWave) *
        (options.speedMul || 1);
  const squadBob = typeof options.forceBob === "number" ? options.forceBob : 0.42;

  const nearby = entities.filter(
    (entity) =>
      entity.kind === "target" &&
      !entity.dead &&
      entity.body.getPosition().x > WORLD_W * 0.4,
  );
  const conflicts = (value) => {
    for (const entity of nearby) {
      const otherConfig = TARGET_CONFIG[entity.targetType];
      const otherRadius = otherConfig ? otherConfig.radius : 0.42;
      const point = entity.body.getPosition();
      for (const member of members) {
        const memberX = baseX + member.x * spacingX;
        const memberY = value + member.y * spacingY;
        if (
          Math.hypot(memberX - point.x, memberY - point.y) <
          member.radius + otherRadius + 0.3
        ) {
          return true;
        }
      }
    }
    return false;
  };

  let centerY = clamp(
    typeof options.y === "number" ? options.y : (low + high) / 2,
    low,
    high,
  );
  if (conflicts(centerY)) {
    for (let step = 1; step <= 10; step += 1) {
      const offset = step * 1.2;
      const candidates = [clamp(centerY - offset, low, high), clamp(centerY + offset, low, high)];
      const free = candidates.find((value) => !conflicts(value));
      if (typeof free === "number") {
        centerY = free;
        break;
      }
    }
  }

  const snakeSquad = pattern.motion === "snake" ? { trail: [], members: [] } : null;

  members.forEach((member, index) => {
    const target = createTarget(member.type, {
      x: baseX + member.x * spacingX,
      y: centerY + member.y * spacingY,
      forceSpeed: squadSpeed,
      forceBob: snakeSquad ? 0 : squadBob,
      phase,
      exactLane: true,
      formation: patternName,
      ...(snakeSquad ? { snakeSquad, snakeIndex: index } : {}),
    });
    if (snakeSquad && target) snakeSquad.members.push(target);
  });
}

const AMBIENT_SQUADS = [
  { pattern: "line", y: 6.6 },
  { pattern: "column", y: 4.0 },
  { pattern: "diamond", y: 9.0 },
  { pattern: "wedge", y: 6.6 },
  { pattern: "echelon", y: 3.4 },
  { pattern: "column", y: 9.6 },
];

const FORMATION_TIERS = [
  {
    label: "横队侦察",
    members: [
      { formation: "line", y: 6.75, delay: 0.9 },
    ],
  },
  {
    label: "纵队压境",
    members: [
      { formation: "column", y: 6.4, delay: 0.9 },
      { type: "steelBalloon", y: 2.6, delay: 1.8, speedMul: 1.6 },
      { type: "clayBalloon", y: 11.4, delay: 2.6, entry: "bottom" },
    ],
  },
  {
    label: "菱形突袭",
    members: [
      { formation: "diamond", y: 6.6, delay: 0.9 },
      { type: "invisible", y: 10.8, delay: 2.4, entry: "bottom" },
    ],
  },
  {
    label: "楔形突破",
    members: [
      { formation: "wedge", y: 6.6, delay: 0.9 },
      { type: "bomber", y: 2.6, delay: 2.2 },
    ],
  },
  {
    label: "盾墙推进",
    members: [
      { formation: "shieldWall", y: 6.6, delay: 0.9 },
      { formation: "echelon", y: 2.6, delay: 2.2 },
      { type: "gasBalloon", y: 11.4, delay: 2.8 },
    ],
  },
  {
    label: "钳形夹击",
    members: [
      { formation: "pincer", y: 6.6, delay: 0.9 },
      { type: "pendulum", y: 2.4, delay: 2.0 },
      { formation: "column", y: 10.6, delay: 2.4 },
    ],
  },
  {
    label: "箭矢冲锋",
    members: [
      { formation: "arrow", y: 6.6, delay: 0.9 },
      { type: "magnet", y: 2.4, delay: 2.0 },
      { type: "springBalloon", y: 10.9, delay: 2.6 },
    ],
  },
  {
    label: "方阵合围",
    members: [
      { formation: "grid", y: 6.4, delay: 0.9 },
      { type: "commander", delay: 1.6 },
      { formation: "line", y: 11.0, delay: 2.6 },
    ],
  },
  {
    label: "超级防盾",
    members: [
      { formation: "superShield", y: 6.4, delay: 0.9 },
      { type: "gasBalloon", y: 2.6, delay: 2.2 },
      { type: "clayBalloon", y: 11.2, delay: 2.8, entry: "bottom" },
    ],
  },
  {
    label: "蛇形跟随",
    members: [
      { formation: "snakeFollow", y: 6.6, delay: 0.9 },
      { type: "steelBalloon", y: 2.8, delay: 2.0, speedMul: 1.5 },
    ],
  },
  {
    label: "总攻编队",
    members: [
      { formation: "arrow", y: 4.0, delay: 0.7 },
      { formation: "echelon", y: 9.6, delay: 1.4 },
      { type: "duo", y: 6.75, delay: 2.4 },
    ],
  },
];

const WAVE_LIVE_LIMIT = 4;
const WAVE_STEP_GAP = 2.2;
const WAVE_CLEAR_DELAY = 1.4;

function waveLine(count, gap) {
  const slots = [];
  for (let i = 0; i < count; i += 1) slots.push({ x: i * gap, y: 0 });
  return slots;
}

function waveColumn(count, gap) {
  const slots = [];
  const offset = ((count - 1) * gap) / 2;
  for (let i = 0; i < count; i += 1) slots.push({ x: 0, y: i * gap - offset });
  return slots;
}

function waveEchelon(count, gapX, gapY) {
  const slots = [];
  const offset = ((count - 1) * gapY) / 2;
  for (let i = 0; i < count; i += 1) slots.push({ x: i * gapX, y: i * gapY - offset });
  return slots;
}

function waveV(count, gapX, gapY) {
  const slots = [];
  for (let i = 0; i < count; i += 1) {
    slots.push({ x: i * gapX, y: -i * gapY });
    slots.push({ x: i * gapX, y: i * gapY });
  }
  return slots;
}

function waveGrid(cols, rows, gapX, gapY) {
  const slots = [];
  const offset = ((rows - 1) * gapY) / 2;
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) slots.push({ x: c * gapX, y: r * gapY - offset });
  }
  return slots;
}

function waveStagger(cols, rows, gapX, gapY) {
  const slots = [];
  const offset = ((rows - 1) * gapY) / 2;
  for (let c = 0; c < cols; c += 1) {
    const shift = c % 2 === 0 ? 0 : gapY / 2;
    for (let r = 0; r < rows; r += 1) {
      slots.push({ x: c * gapX, y: r * gapY - offset + shift });
    }
  }
  return slots;
}

const WAVE_TYPE_BOUNDS = {
  balloon: { radius: 0.42, below: 0.5 },
  smoke: { radius: 0.36, below: 0.45 },
  clayBalloon: { radius: 0.42, below: 0.5 },
  gasBalloon: { radius: 0.5, below: 0.6 },
  invisible: { radius: 0.42, below: 0.5 },
  mine: { radius: 0.46, below: 0.5 },
  steelBalloon: { radius: 0.56, below: 0.6 },
  duo: { radius: 0.38, below: 1.4 },
  bomber: { radius: 0.38, below: 2.1 },
  pendulum: { radius: 0.42, below: 1.4 },
  magnet: { radius: 0.42, below: 1.4 },
  springBalloon: { radius: 0.42, below: 1.6 },
};

const WAVE_TYPE_DEFS = [
  {
    // 最弱：HP1、无特殊能力，靠数量压制
    type: "balloon",
    label: "普通气球",
    formations: [
      { slots: waveLine(6, 0.95) },
      { slots: waveV(4, 0.95, 1.0) },
      { slots: waveGrid(4, 3, 1.0, 1.05) },
    ],
    // 动态蛇形编队：头部气球沿S形路径前进，后续气球跟随前方气球轨迹，
    // 头部被击落后下一位立即接替成为新头部
    finale: { squad: "snakeFollow", count: 10 },
  },
  {
    // 隐形偷袭：分散排列，利用隐形优势难以瞄准
    type: "invisible",
    label: "隐形气球",
    formations: [
      { slots: waveEchelon(5, 0.95, 1.5) },
      { slots: waveV(3, 1.0, 1.6) },
      { slots: waveGrid(3, 3, 1.05, 1.4) },
    ],
    // 超大分散网格：12个隐形气球遍布全屏
    finale: { slots: waveGrid(4, 3, 1.0, 1.3) },
  },
  {
    // 烟雾遮蔽：交错排列最大化烟雾覆盖面积
    type: "smoke",
    label: "烟雾气球",
    formations: [
      { slots: waveStagger(3, 3, 1.1, 1.25) },
      { slots: waveEchelon(5, 0.95, 1.4) },
      { slots: waveColumn(4, 1.2) },
    ],
    // 超大交错队列：16个烟雾气球形成全面遮蔽
    finale: { slots: waveStagger(4, 4, 1.05, 1.2) },
  },
  {
    // 快速冲锋：纵队连续冲锋，速度3.1最快
    type: "clayBalloon",
    label: "粘土气球",
    formations: [
      { slots: waveEchelon(5, 0.9, 1.1), y: 4.6 },
      { slots: waveV(3, 0.95, 0.95), y: 5.0 },
      { slots: waveGrid(3, 2, 1.0, 1.1), y: 3.8 },
    ],
    // 超大横队：8个粘土气球一字排开同时冲锋
    finale: { slots: waveLine(8, 0.9), y: 3.4 },
  },
  {
    // 炸弹投放：横队覆盖整个战场宽度，地毯式轰炸
    type: "mine",
    label: "地雷气球",
    formations: [
      { slots: waveLine(4, 1.35) },
      { slots: waveColumn(3, 1.6) },
      { slots: waveEchelon(4, 1.05, 1.5) },
    ],
    // 超大横队：7个地雷气球覆盖全屏投放炸弹
    finale: { slots: waveLine(7, 1.15) },
  },
  {
    // 连锁爆炸：HP3高血量，密集纵队触发连锁爆炸
    type: "gasBalloon",
    label: "气体气球",
    formations: [
      { slots: waveColumn(4, 1.4) },
      { slots: waveStagger(2, 3, 1.3, 1.35) },
      { slots: waveEchelon(4, 1.15, 1.5) },
    ],
    // 超大纵队：6个气体气球紧密排列连锁爆炸
    finale: { slots: waveColumn(6, 1.35) },
  },
  {
    // 双重火力：两个连体气球+炸弹，网格排列双重覆盖
    type: "duo",
    label: "双人气球",
    formations: [
      { slots: waveColumn(2, 2.4) },
      { slots: waveGrid(2, 2, 2.0, 2.4) },
    ],
    // 超大网格：6个双人气球=12个目标全覆盖
    finale: { slots: waveGrid(2, 3, 2.0, 2.2) },
  },
  {
    // 钢盾防御：HP1+钢板HP5=6层防御，盾墙阵列坚不可摧
    type: "steelBalloon",
    label: "钢盾气球",
    formations: [
      { slots: waveColumn(4, 1.45) },
      { slots: waveStagger(2, 3, 1.5, 1.45) },
      { slots: waveGrid(3, 2, 1.5, 1.45) },
    ],
    // 超大盾墙：6个钢盾气球组成坚不可摧的防线
    finale: { slots: waveGrid(2, 3, 1.5, 1.4) },
  },
  {
    // 持续轰炸：横队排列实现地毯式轰炸覆盖
    type: "bomber",
    label: "轰炸机气球",
    formations: [
      { slots: waveLine(3, 1.6) },
      { slots: waveStagger(2, 2, 1.7, 2.0) },
    ],
    // 超大横队：5个轰炸机组成轰炸编队
    finale: { slots: waveLine(5, 1.4) },
  },
  {
    // 弹跳炸弹：梯形排列，弹跳炸弹覆盖全场高低空
    type: "springBalloon",
    label: "弹簧炸弹气球",
    formations: [
      { slots: waveEchelon(3, 1.2, 1.8) },
      { slots: waveGrid(2, 2, 1.6, 2.0) },
    ],
    // 超大纵队：5个弹簧炸弹气球密集排列弹跳覆盖
    finale: { slots: waveColumn(5, 2.0) },
  },
  {
    // 摆动攻击：纵队排列，摆动攻击覆盖全高度
    type: "pendulum",
    label: "钟摆气球",
    formations: [
      { slots: waveColumn(3, 2.2) },
      { slots: waveGrid(2, 2, 1.7, 2.2) },
    ],
    // 超大纵队：4个钟摆气球连续摆动攻击
    finale: { slots: waveColumn(4, 2.2) },
  },
  {
    // 最强：HP3+磁铁HP4=7层防御+磁力吸引，网格排列磁力场重叠
    type: "magnet",
    label: "磁铁气球",
    formations: [
      { slots: waveColumn(3, 2.2) },
      { slots: waveGrid(2, 2, 1.7, 2.2) },
    ],
    // 超大纵队：4个磁铁气球磁力场重叠覆盖
    finale: { slots: waveColumn(4, 2.2) },
  },
];

function waveTypeBounds(type) {
  return WAVE_TYPE_BOUNDS[type] || { radius: 0.42, below: 0.5 };
}

function spawnWaveTarget(type, x, y, options = {}) {
  if (type === "bomber") return spawnBomber(y, { x, exactLane: true });
  if (type === "duo") return spawnDuo(y, { x, exactLane: true });
  if (type === "springBalloon") return spawnSpringBombBalloon(y, { x, exactLane: true });
  return createTarget(type, {
    x,
    y,
    exactLane: true,
    phase: options.phase,
    formation: options.formation,
    speedMul: options.speedMul,
  });
}

function spawnTypeSquad(type, slots, options = {}) {
  if (!world || slots.length === 0) return false;
  const bounds = waveTypeBounds(type);
  const baseX = WORLD_W + 1.2;
  let top = 0;
  let bottom = 0;
  for (const slot of slots) {
    top = Math.max(top, -slot.y);
    bottom = Math.max(bottom, slot.y);
  }
  const low = 1.2 + top + bounds.radius;
  const high = Math.max(low, GROUND_Y - 0.6 - bottom - bounds.below);
  const centerY = clamp(typeof options.y === "number" ? options.y : rand(low, high), low, high);
  const phase = rand(0, Math.PI * 2);
  for (const slot of slots) {
    spawnWaveTarget(type, baseX + slot.x, centerY + slot.y, {
      phase,
      formation: options.formation,
      speedMul: options.speedMul,
    });
  }
  return true;
}

function buildSingleTypeWave(def) {
  const steps = [];
  for (const formation of def.formations) {
    steps.push({ kind: "typeSquad", type: def.type, slots: formation.slots, y: formation.y });
  }
  if (def.finale.squad) {
    steps.push({
      kind: "finaleSquad",
      type: def.type,
      squad: def.finale.squad,
      count: def.finale.count,
      y: def.finale.y,
    });
  } else {
    steps.push({ kind: "finale", type: def.type, slots: def.finale.slots, y: def.finale.y });
  }
  return { steps, mixed: false };
}

function buildMixedWave(waveNumber) {
  const offset = Math.max(0, waveNumber - WAVE_TYPE_DEFS.length - 1);
  const steps = [];
  const start = (offset * 3) % FORMATION_TIERS.length;
  for (let i = 0; i < 3; i += 1) {
    const tier = FORMATION_TIERS[(start + i) % FORMATION_TIERS.length];
    for (const member of tier.members) steps.push({ kind: "member", member });
  }
  steps.push({ kind: "mixedFinale" });
  return { steps, mixed: true };
}

function beginWave(waveNumber) {
  wave = waveNumber;
  const single = waveNumber <= WAVE_TYPE_DEFS.length;
  const plan = single
    ? buildSingleTypeWave(WAVE_TYPE_DEFS[waveNumber - 1])
    : buildMixedWave(waveNumber);
  waveGemSpawned = 0;
  waveGemTimer = single ? GEM_SPAWN_CONFIG.singleWaveInterval : 0;
  waveScript = {
    steps: plan.steps,
    index: 0,
    timer: 0.9,
    clearTimer: 0,
    mixed: plan.mixed,
    finaleStarted: false,
  };
}

function countWaveEnemies() {
  let live = 0;
  for (const entity of entities) {
    if (entity.dead || entity.kind !== "target" || entity.converted) continue;
    if (entity.targetType === "gem" || entity.targetType === "allyCommander") continue;
    if (entity.targetType === "galeBalloon" || entity.targetType === "barrierBalloon") continue;
    if (entity.targetType === "soapBalloon") continue;
    live += 1;
  }
  return live;
}

function runWaveStep(step) {
  if (!world) return false;
  if (step.kind === "typeSquad" || step.kind === "finale") {
    if (step.kind === "finale" && waveScript) waveScript.finaleStarted = true;
    return spawnTypeSquad(step.type, step.slots, { formation: step.kind, y: step.y });
  }
  if (step.kind === "finaleSquad") {
    if (waveScript) waveScript.finaleStarted = true;
    return spawnBalloonSquad(step.squad, { y: step.y, maxCount: step.count }) !== false;
  }
  if (step.kind === "member") {
    runFormationMember(step.member);
    return true;
  }
  if (step.kind === "mixedFinale") {
    if (waveScript) waveScript.finaleStarted = true;
    runMixedFinale();
    return true;
  }
  return false;
}

function runMixedFinale() {
  spawnBalloonSquad("superShield", { y: 5.2, maxCount: 6 });
  spawnTypeSquad("balloon", waveLine(5, 1.0), { y: 8.4 });
  if (!commander || commander.dead) spawnCommander();
}

function updateWaveProgress(dt) {
  if (!waveScript) return;
  if (waveScript.index >= waveScript.steps.length) {
    waveScript.clearTimer += dt;
    if (waveScript.clearTimer >= WAVE_CLEAR_DELAY && countWaveEnemies() === 0) {
      beginWave(wave + 1);
      updateHud();
    }
    return;
  }
  waveScript.timer -= dt;
  if (waveScript.timer > 0) return;
  if (!waveScript.mixed && countWaveEnemies() > WAVE_LIVE_LIMIT) {
    waveScript.timer = 0.8;
    return;
  }
  const step = waveScript.steps[waveScript.index];
  if (!runWaveStep(step)) {
    waveScript.timer = 0.6;
    return;
  }
  waveScript.index += 1;
  waveScript.timer = WAVE_STEP_GAP;
}

function runFormationMember(member) {
  if (!world) return;
  const targetCount = entities.filter((entity) => entity.kind === "target").length;
  if (targetCount >= (member.formation ? SQUAD_TARGET_LIMIT : 16)) return;

  if (member.formation) {
    spawnBalloonSquad(member.formation, {
      y: member.y,
      speedMul: member.speedMul,
      maxCount: member.maxCount,
    });
    return;
  }

  if (member.type === "commander") {
    if (!commander || commander.dead) spawnCommander();
    return;
  }
  if (member.type === "bomber") {
    spawnBomber(member.y);
    return;
  }
  if (member.type === "duo") {
    spawnDuo(member.y);
    return;
  }
  if (member.type === "springBalloon") {
    spawnSpringBombBalloon(member.y);
    return;
  }

  createTarget(member.type, {
    y: member.y,
    entry: member.entry,
    speedMul: member.speedMul,
  });
}

function dropParachuteBomb(mine) {
  const config = TARGET_CONFIG.mine;
  const position = mine.body.getPosition();

  const body = world.createBody({
    type: "dynamic",
    position: planck.Vec2(position.x, position.y + config.radius + config.chuteSpawnGap),
    fixedRotation: true,
    linearDamping: config.chuteDamping,
  });
  body.setGravityScale(config.chuteGravityScale);

  const fixture = body.createFixture(planck.Circle(config.bombRadius), {
    density: config.bombDensity,
    restitution: 0,
    friction: 0,
    filterCategoryBits: CAT.TARGET,
    filterMaskBits: CAT.PLANE | CAT.BULLET,
  });

  const sprite = Stage.sprite(bombTexture).appendTo(gameLayer);
  sprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

  const chute = Stage.sprite(parachuteTexture).appendTo(gameLayer);
  chute.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

  const bomb = createEntity("bomb", body, fixture, sprite, {
    targetType: "bomb",
    hp: 1,
    points: config.bombPoints,
    heal: 0,
    age: 0,
    flash: 0,
    detached: true,
    phase: rand(0, Math.PI * 2),
    chute,
    chuteOffsetPx: config.chuteOffset * PPM,
  });

  body.setLinearVelocity(
    planck.Vec2(-mine.speed * config.chuteDrift, config.chuteInitialFall),
  );

  return bomb;
}

function attachPendulum(balloon) {
  const config = PENDULUM_CONFIG;
  const balloonPosition = balloon.body.getPosition();
  const pivotX = balloonPosition.x;
  const pivotY = balloonPosition.y + config.pivotOffsetY;

  const body = world.createBody({
    type: "kinematic",
    position: planck.Vec2(pivotX, pivotY + config.armLength),
    fixedRotation: true,
  });

  const fixtures = [];
  for (let i = 0; i < config.fixtureCount; i += 1) {
    const angle = -config.arcHalfSpan + (i / (config.fixtureCount - 1)) * config.arcHalfSpan * 2;
    const fixture = body.createFixture(
      planck.Circle(
        planck.Vec2(Math.sin(angle) * config.arcRadius, Math.cos(angle) * config.arcRadius),
        config.arcThickness / 2,
      ),
      {
        density: 1.2,
        restitution: 0.35,
        friction: 0,
        filterCategoryBits: CAT.PENDULUM,
        filterMaskBits: CAT.PLANE | CAT.BULLET,
      },
    );
    fixtures.push(fixture);
  }

  const sprite = Stage.sprite(pendulumTexture).appendTo(gameLayer);
  const pivotYRatio = PENDULUM_TEX.pivotY / PENDULUM_TEX.height;
  sprite.pin({ pivotX: 0.5, pivotY: pivotYRatio, handleX: 0.5, handleY: pivotYRatio });

  const pendulum = createEntity("pendulum", body, fixtures[0], sprite, {
    balloon,
    armLength: config.armLength,
    pivotOffsetY: config.pivotOffsetY,
    maxAngle: config.maxAngle,
    omega: (Math.PI * 2) / config.period,
    swingTime: 0,
    phase: rand(0, Math.PI * 2),
    angle: 0,
    pivotPxX: pivotX * PPM,
    pivotPxY: pivotY * PPM,
  });

  for (const fixture of fixtures) fixture.setUserData(pendulum);
  return pendulum;
}

function updatePendulums(dt) {
  for (const entity of entities) {
    if (entity.kind !== "pendulum" || entity.dead) continue;
    const balloon = entity.balloon;
    if (!balloon || balloon.dead) {
      const position = entity.body.getPosition();
      spawnSparks(position.x, position.y);
      markDead(entity);
      continue;
    }

    entity.swingTime += dt;
    const angle = entity.maxAngle * Math.sin(entity.swingTime * entity.omega + entity.phase);
    entity.angle = angle;

    const balloonPosition = balloon.body.getPosition();
    const pivotX = balloonPosition.x;
    const pivotY = balloonPosition.y + entity.pivotOffsetY;
    entity.pivotPxX = pivotX * PPM;
    entity.pivotPxY = pivotY * PPM;

    entity.body.setTransform(
      planck.Vec2(
        pivotX + Math.sin(angle) * entity.armLength,
        pivotY + Math.cos(angle) * entity.armLength,
      ),
      -angle,
    );
  }
}

function attachMagnet(balloon) {
  const config = MAGNET_CONFIG;
  const balloonPosition = balloon.body.getPosition();
  const pivotX = balloonPosition.x;
  const pivotY = balloonPosition.y + config.pivotOffsetY;

  const body = world.createBody({
    type: "kinematic",
    position: planck.Vec2(pivotX, pivotY + config.armLength),
    fixedRotation: true,
  });

  const prongCenterX = config.halfWidth - config.prongHalfWidth;
  const prongCenterY = config.baseHalfThickness * 2 + config.prongHalfLength;
  const fixtures = [
    body.createFixture(
      planck.Box(
        config.halfWidth,
        config.baseHalfThickness,
        planck.Vec2(0, config.baseHalfThickness),
      ),
      magnetFixtureOptions(),
    ),
    body.createFixture(
      planck.Box(config.prongHalfWidth, config.prongHalfLength, planck.Vec2(-prongCenterX, prongCenterY)),
      magnetFixtureOptions(),
    ),
    body.createFixture(
      planck.Box(config.prongHalfWidth, config.prongHalfLength, planck.Vec2(prongCenterX, prongCenterY)),
      magnetFixtureOptions(),
    ),
  ];

  const sprite = Stage.sprite(magnetTexture).appendTo(gameLayer);
  const pivotYRatio = MAGNET_TEX.pivotY / MAGNET_TEX.height;
  sprite.pin({ pivotX: 0.5, pivotY: pivotYRatio, handleX: 0.5, handleY: pivotYRatio });

  const pullDots = [];
  for (let i = 0; i < config.dotCount; i += 1) {
    const dot = Stage.sprite(dotTexture(i % 2 === 0 ? "#8fe6ff" : "#ff8fa8")).appendTo(gameLayer);
    dot.pin({
      pivotX: 0.5,
      pivotY: 0.5,
      handleX: 0.5,
      handleY: 0.5,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
    });
    pullDots.push(dot);
  }

  const magnet = createEntity("magnet", body, fixtures[0], sprite, {
    targetType: "magnet",
    balloon,
    hp: config.hp,
    points: config.points,
    flash: 0,
    armLength: config.armLength,
    pivotOffsetY: config.pivotOffsetY,
    maxAngle: config.maxAngle,
    omega: (Math.PI * 2) / config.period,
    swingTime: 0,
    phase: rand(0, Math.PI * 2),
    angle: 0,
    pivotPxX: pivotX * PPM,
    pivotPxY: pivotY * PPM,
    pulling: false,
    pullTimer: 0,
    pullCooldown: rand(0.6, config.pullCooldown),
    pullAge: 0,
    pullDots,
  });

  for (const fixture of fixtures) fixture.setUserData(magnet);
  return magnet;
}

function magnetFixtureOptions() {
  return {
    density: 1.2,
    restitution: 0.2,
    friction: 0,
    filterCategoryBits: CAT.MAGNET,
    filterMaskBits: CAT.PLANE | CAT.BULLET,
  };
}

function updateMagnets(dt) {
  const config = MAGNET_CONFIG;
  const planeAlive = !!plane && !plane.dead;

  for (const entity of entities) {
    if (entity.kind !== "magnet" || entity.dead) continue;
    const balloon = entity.balloon;
    if (!balloon || balloon.dead) {
      const position = entity.body.getPosition();
      spawnSparks(position.x, position.y);
      markDead(entity);
      continue;
    }

    if (entity.flash > 0) entity.flash = Math.max(0, entity.flash - dt);

    entity.swingTime += dt;
    const angle = entity.maxAngle * Math.sin(entity.swingTime * entity.omega + entity.phase);
    entity.angle = angle;

    const balloonPosition = balloon.body.getPosition();
    const pivotX = balloonPosition.x;
    const pivotY = balloonPosition.y + entity.pivotOffsetY;
    entity.pivotPxX = pivotX * PPM;
    entity.pivotPxY = pivotY * PPM;

    const centerX = pivotX + Math.sin(angle) * entity.armLength;
    const centerY = pivotY + Math.cos(angle) * entity.armLength;
    entity.body.setTransform(planck.Vec2(centerX, centerY), -angle);

    if (entity.pullTimer > 0) {
      entity.pullTimer = Math.max(0, entity.pullTimer - dt);
    } else if (entity.pullCooldown > 0) {
      entity.pullCooldown = Math.max(0, entity.pullCooldown - dt);
    }

    if (!planeAlive || entity.converted) {
      entity.pulling = false;
      continue;
    }

    const planePosition = plane.body.getPosition();
    const dx = planePosition.x - centerX;
    const dy = planePosition.y - centerY;
    const distance = Math.hypot(dx, dy) || 1;

    if (entity.pullTimer > 0) {
      const mass = plane.body.getMass();
      const ramp = 1 + 0.55 * (1 - entity.pullTimer / config.pullDuration);
      const force = mass * config.pullAccel * ramp;
      plane.body.applyForceToCenter(
        planck.Vec2((-dx / distance) * force, (-dy / distance) * force),
        true,
      );
      entity.pullAge += dt;
      entity.pulling = true;
      continue;
    }

    entity.pulling = false;

    if (entity.pullCooldown > 0 || distance > config.pullRange) continue;

    const facingX = Math.sin(angle);
    const facingY = Math.cos(angle);
    const alignment = (facingX * dx + facingY * dy) / distance;
    if (alignment < Math.cos(config.pullCone)) continue;

    entity.pullTimer = config.pullDuration;
    entity.pullCooldown = config.pullCooldown;
    entity.pullAge = 0;
    entity.pulling = true;
    entity.flash = 0.2;
    spawnParticles(centerX * PPM, centerY * PPM, ["#ffffff", "#8fe6ff", "#ff8fa8"], 16, 40, 180);
    shake = Math.max(shake, 6);
    soundMagnet();
  }
}

function steelPlateFixtureOptions() {
  return {
    density: 1.5,
    restitution: 0,
    friction: 0,
    filterCategoryBits: CAT.TARGET,
    filterMaskBits: CAT.PLANE | CAT.BULLET,
  };
}

function attachSteelPlate(balloon) {
  const config = STEEL_PLATE_CONFIG;
  const halfLength = config.barLength / 2;
  const halfThickness = config.thickness / 2;
  const fixtures = [
    balloon.body.createFixture(
      planck.Box(
        halfLength,
        halfThickness,
        planck.Vec2(config.centerX, -config.centerY),
        -config.barAngle,
      ),
      steelPlateFixtureOptions(),
    ),
    balloon.body.createFixture(
      planck.Box(
        halfLength,
        halfThickness,
        planck.Vec2(config.centerX, config.centerY),
        config.barAngle,
      ),
      steelPlateFixtureOptions(),
    ),
  ];

  const sprite = Stage.sprite(steelPlateTexture).appendTo(gameLayer);
  sprite.pin({
    pivotX: 0.5,
    pivotY: 0.5,
    handleX: 0.5,
    handleY: 0.5,
    scaleX: config.scale,
    scaleY: config.scale,
  });

  const plate = {
    kind: "steelPlate",
    balloon,
    hp: config.hp,
    maxHp: config.hp,
    fixtures,
    sprite,
    flash: 0,
    dead: false,
    offsetPxX: config.offsetPxX,
  };

  for (const fixture of fixtures) fixture.setUserData(plate);
  balloon.fixture.setFilterData({
    categoryBits: CAT.TARGET,
    maskBits: CAT.PLANE,
    groupIndex: 0,
  });
  balloon.plate = plate;
  return plate;
}

function deflectBulletByPlate(bullet, plate, contact) {
  if (bullet.dead || bullet.deflectTimer > 0) return false;

  const manifold = new planck.WorldManifold();
  contact.getWorldManifold(manifold);
  let nx = manifold.normal.x;
  let ny = manifold.normal.y;
  const nlen = Math.hypot(nx, ny);
  if (nlen < 0.001) return false;
  nx /= nlen;
  ny /= nlen;

  const velocity = bullet.body.getLinearVelocity();
  if (velocity.x * nx + velocity.y * ny > 0) {
    nx = -nx;
    ny = -ny;
  }

  const dot = velocity.x * nx + velocity.y * ny;
  let vx = velocity.x - 2 * dot * nx;
  let vy = velocity.y - 2 * dot * ny;

  vx = Math.min(vx, -Math.max(3, Math.abs(velocity.x) * 0.25));

  bullet.deflectVX = vx;
  bullet.deflectVY = vy;
  bullet.deflectTimer = 0.18;
  bullet.fixture.setFilterData({
    categoryBits: CAT.REFLECTED,
    maskBits: 0,
    groupIndex: 0,
  });
  bullet.body.setLinearVelocity(planck.Vec2(vx, vy));
  bullet.life = Math.max(bullet.life, 0.6);
  return true;
}

function breakSteelPlate(plate) {
  if (plate.dead) return;
  plate.dead = true;
  plate.pendingBreak = true;
  plate.sprite.remove();

  const balloon = plate.balloon;
  if (balloon && balloon.body) {
    const position = balloon.body.getPosition();
    spawnParticles(
      (position.x + STEEL_PLATE_CONFIG.centerX) * PPM,
      position.y * PPM,
      ["#ffffff", "#c3d2e4", "#7d8ea3", "#ffd166"],
      18,
      50,
      210,
    );
    shake = Math.max(shake, 7);
  }
}

function finalizeBrokenPlates() {
  for (const entity of entities) {
    const plate = entity.plate;
    if (!plate || !plate.pendingBreak) continue;
    plate.pendingBreak = false;
    const balloon = plate.balloon;
    if (balloon && balloon.body) {
      for (const fixture of plate.fixtures) {
        balloon.body.destroyFixture(fixture);
      }
      balloon.fixture.setFilterData({
        categoryBits: CAT.TARGET,
        maskBits: CAT.PLANE | CAT.BULLET,
        groupIndex: 0,
      });
    }
    plate.fixtures = [];
  }
}

function hitSteelPlate(bullet, plate, contact) {
  if (!plate || plate.dead) return;
  if (!deflectBulletByPlate(bullet, plate, contact)) return;

  const position = bullet.body.getPosition();
  plate.hp -= 1;
  plate.flash = STEEL_PLATE_CONFIG.flashDuration;
  spawnParticles(
    position.x * PPM,
    position.y * PPM,
    ["#ffffff", "#ffe9a8", "#ffd166", "#ff8c42"],
    10,
    40,
    150,
  );
  shake = Math.max(shake, 3);
  soundClank();

  if (plate.hp <= 0) breakSteelPlate(plate);
}

function hitPlaneBySteelPlate(plate) {
  if (!plane || plane.dead || plane.invuln > 0 || plate.dead) return;
  const position = plane.body.getPosition();
  spawnSparks(position.x, position.y);
  spawnParticles(position.x * PPM, position.y * PPM, ["#ffffff", "#c3d2e4", "#ffd166"], 14, 50, 200);
  shake = Math.max(shake, 14);
  soundClank();
  hurtPlayer();
}

function markDead(entity) {
  let node = entity.next;
  while (node) {
    node.detached = true;
    node = node.next;
  }
  entity.dead = true;
}

function isHazard(entity) {
  return (
    entity.kind === "target" ||
    entity.kind === "bomb" ||
    entity.kind === "link" ||
    entity.kind === "springBomb"
  );
}

function spawnBomber(forcedY, options = {}) {
  const config = BOMBER_CONFIG;
  const x = typeof options.x === "number" ? options.x : WORLD_W + 1.4;
  const chainLength = BOMBER_CHAIN_PATTERN.length * config.gap;
  const chainDrop = config.radius + chainLength * 1.15;
  const maxY = Math.max(1.1, GROUND_Y - chainDrop - 0.3);
  const y = resolveLaneY(
    typeof forcedY === "number" ? forcedY : rand(1.1, maxY),
    config.radius,
    { minY: 1.1, maxY, belowExtent: chainDrop },
  );

  const balloonBody = world.createBody({
    type: "kinematic",
    position: planck.Vec2(x, y),
    fixedRotation: true,
  });
  const balloonFixture = balloonBody.createFixture(planck.Circle(config.radius), {
    density: 1.2,
    restitution: 0,
    friction: 0,
    filterCategoryBits: CAT.TARGET,
    filterMaskBits: CAT.PLANE | CAT.BULLET,
  });

  const sprite = Stage.sprite(config.texture).appendTo(gameLayer);
  sprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

  const bomber = createEntity("target", balloonBody, balloonFixture, sprite, {
    targetType: "bomber",
    hp: config.hp,
    points: config.points,
    heal: 0,
    speed: config.speed + wave * config.speedPerWave,
    bob: config.bob,
    phase: rand(0, Math.PI * 2),
    age: 0,
    flash: 0,
    falling: false,
    fallApplied: false,
    parts: [],
  });

  let prevBody = balloonBody;
  let prevAnchor = planck.Vec2(0, config.radius);
  let prevPart = null;

  for (let i = 0; i < BOMBER_CHAIN_PATTERN.length; i += 1) {
    const isBomb = BOMBER_CHAIN_PATTERN[i] === "bomb";
    const radius = isBomb ? config.bombRadius : config.linkRadius;
    const body = world.createBody({
      type: "dynamic",
      position: planck.Vec2(x, y + config.gap * (i + 1)),
      fixedRotation: true,
      linearDamping: 0.1,
    });
    const fixture = body.createFixture(planck.Circle(radius), {
      density: isBomb ? config.bombDensity : config.linkDensity,
      restitution: 0,
      friction: 0,
      filterCategoryBits: CAT.TARGET,
      filterMaskBits: CAT.PLANE | CAT.BULLET,
    });

    const partSprite = Stage.sprite(
      isBomb ? bombTexture : dotTexture(CHAIN_COLOR),
    ).appendTo(gameLayer);
    partSprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

    const part = createEntity(isBomb ? "bomb" : "link", body, fixture, partSprite, {
      targetType: isBomb ? "bomb" : "link",
      hp: 1,
      points: isBomb ? config.bombPoints : 0,
      heal: 0,
      bomber,
      age: 0,
      flash: 0,
    });
    bomber.parts.push(part);
    if (prevPart) prevPart.next = part;
    prevPart = part;

    world.createJoint(
      planck.DistanceJoint({
        bodyA: prevBody,
        bodyB: body,
        localAnchorA: prevAnchor,
        localAnchorB: planck.Vec2(0, 0),
        length: config.gap,
        collideConnected: false,
      }),
    );

    prevBody = body;
    prevAnchor = planck.Vec2(0, 0);
  }

  return bomber;
}

function spawnDuo(forcedY, options = {}) {
  const config = DUO_CONFIG;
  const partCount = DUO_CHAIN_PATTERN.length;
  const span = config.radius * 2 + (partCount + 1) * config.gap;
  const x = typeof options.x === "number" ? options.x : WORLD_W + 1.4;
  const chainLength = partCount * config.gap;
  const chainDrop = config.radius + chainLength * 1.15;
  const maxY = Math.max(1.6, GROUND_Y - chainDrop - 0.3);
  const laneY = typeof forcedY === "number" ? forcedY : rand(1.6, maxY);
  const y = options.exactLane
    ? clamp(laneY, 1.6, maxY)
    : resolveLaneY(laneY, config.radius, { minY: 1.6, maxY, belowExtent: chainDrop });
  const phase = rand(0, Math.PI * 2);

  const duo = {
    balloons: [],
    parts: [],
    aliveBalloons: 2,
  };

  const createBalloon = (balloonX) => {
    const body = world.createBody({
      type: "kinematic",
      position: planck.Vec2(balloonX, y),
      fixedRotation: true,
    });
    const fixture = body.createFixture(planck.Circle(config.radius), {
      density: 1.2,
      restitution: 0,
      friction: 0,
      filterCategoryBits: CAT.TARGET,
      filterMaskBits: CAT.PLANE | CAT.BULLET,
    });

    const sprite = Stage.sprite(config.texture).appendTo(gameLayer);
    sprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

    const balloon = createEntity("target", body, fixture, sprite, {
      targetType: "duo",
      hp: config.hp,
      points: config.points,
      heal: 0,
      speed: config.speed + wave * config.speedPerWave,
      bob: config.bob,
      phase,
      age: 0,
      flash: 0,
      duo,
    });
    duo.balloons.push(balloon);
    return balloon;
  };

  const leftBalloon = createBalloon(x);
  const rightBalloon = createBalloon(x + span);

  let prevBody = leftBalloon.body;
  let prevAnchor = planck.Vec2(config.radius, 0);
  let prevPart = null;

  for (let i = 0; i < partCount; i += 1) {
    const isBomb = DUO_CHAIN_PATTERN[i] === "bomb";
    const radius = isBomb ? config.bombRadius : config.linkRadius;
    const body = world.createBody({
      type: "dynamic",
      position: planck.Vec2(x + config.radius + config.gap * (i + 1), y),
      fixedRotation: true,
      linearDamping: 0.1,
    });
    const fixture = body.createFixture(planck.Circle(radius), {
      density: isBomb ? config.bombDensity : config.linkDensity,
      restitution: 0,
      friction: 0,
      filterCategoryBits: CAT.TARGET,
      filterMaskBits: CAT.PLANE | CAT.BULLET,
    });

    const partSprite = Stage.sprite(
      isBomb ? bombTexture : dotTexture(CHAIN_COLOR),
    ).appendTo(gameLayer);
    partSprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

    const part = createEntity(isBomb ? "bomb" : "link", body, fixture, partSprite, {
      targetType: isBomb ? "bomb" : "link",
      hp: 1,
      points: isBomb ? config.bombPoints : 0,
      heal: 0,
      duo,
      age: 0,
      flash: 0,
    });
    duo.parts.push(part);
    if (prevPart) prevPart.next = part;
    prevPart = part;

    world.createJoint(
      planck.DistanceJoint({
        bodyA: prevBody,
        bodyB: body,
        localAnchorA: prevAnchor,
        localAnchorB: planck.Vec2(0, 0),
        length: config.gap,
        collideConnected: false,
      }),
    );

    prevBody = body;
    prevAnchor = planck.Vec2(0, 0);
  }

  world.createJoint(
    planck.DistanceJoint({
      bodyA: prevBody,
      bodyB: rightBalloon.body,
      localAnchorA: planck.Vec2(0, 0),
      localAnchorB: planck.Vec2(-config.radius, 0),
      length: config.gap,
      collideConnected: false,
    }),
  );

  return duo;
}

function spawnSpringBombBalloon(forcedY, options = {}) {
  const config = SPRING_BOMB_CONFIG;
  const x = typeof options.x === "number" ? options.x : WORLD_W + 1.4;
  const drop = config.hangOffset + config.springLength;
  const maxY = Math.max(1.2, GROUND_Y - drop - 0.4);
  const laneY = typeof forcedY === "number" ? forcedY : rand(1.2, maxY);
  const y = options.exactLane
    ? clamp(laneY, 1.2, maxY)
    : resolveLaneY(laneY, config.radius, { minY: 1.2, maxY, belowExtent: drop });

  const body = world.createBody({
    type: "kinematic",
    position: planck.Vec2(x, y),
    fixedRotation: true,
  });
  const fixture = body.createFixture(planck.Circle(config.radius), {
    density: 1.2,
    restitution: 0,
    friction: 0,
    filterCategoryBits: CAT.TARGET,
    filterMaskBits: CAT.PLANE | CAT.BULLET,
  });

  const sprite = Stage.sprite(config.texture).appendTo(gameLayer);
  sprite.pin({ pivotX: 0.5, pivotY: 0.5, handleX: 0.5, handleY: 0.5 });

  const balloon = createEntity("target", body, fixture, sprite, {
    targetType: "springBalloon",
    hp: config.hp,
    points: config.points,
    heal: 0,
    speed: config.speed + wave * config.speedPerWave,
    bob: config.bob,
    phase: rand(0, Math.PI * 2),
    age: 0,
    flash: 0,
  });

  attachSpringBomb(balloon);
  return balloon;
}

function attachSpringBomb(balloon) {
  const config = SPRING_BOMB_CONFIG;
  const position = balloon.body.getPosition();
  const body = world.createBody({
    type: "dynamic",
    position: planck.Vec2(position.x, position.y + config.hangOffset),
    fixedRotation: true,
    gravityScale: 0,
  });
  const fixture = body.createFixture(planck.Circle(config.bombRadius), {
    density: 0.8,
    restitution: 0,
    friction: 0,
    filterCategoryBits: CAT.TARGET,
    filterMaskBits: CAT.PLANE | CAT.BULLET,
  });

  const sprite = Stage.sprite(springBombTexture).appendTo(gameLayer);
  const pivotYRatio = SPRING_BOMB_TEX.bombCenterY / SPRING_BOMB_TEX.height;
  sprite.pin({ pivotX: 0.5, pivotY: pivotYRatio, handleX: 0.5, handleY: pivotYRatio });

  const bomb = createEntity("springBomb", body, fixture, sprite, {
    targetType: "springBomb",
    hp: 1,
    points: config.bombPoints,
    heal: 0,
    springBalloon: balloon,
    attached: true,
    bounces: 0,
    cooldown: 0,
  });

  balloon.springBomb = bomb;
  return bomb;
}

function releaseSpringBomb(bomb) {
  if (!bomb || bomb.dead || !bomb.attached) return;
  bomb.attached = false;
  bomb.body.setGravityScale(1);
  bomb.body.setLinearVelocity(
    planck.Vec2(-SPRING_BOMB_CONFIG.fallLeft, SPRING_BOMB_CONFIG.fallDown),
  );
}

function springBalloonDown(balloon, options = {}) {
  if (!balloon || balloon.dead) return;
  const { silent = false, award = false } = options;
  const position = balloon.body.getPosition();

  markDead(balloon);

  if (!silent) {
    spawnSparks(position.x, position.y);
    shake = Math.max(shake, 6);
    soundHit();
  }

  if (award) {
    score += balloon.points;
    updateHud();
  }
}

function updateSpringBombs(dt) {
  const config = SPRING_BOMB_CONFIG;

  for (const entity of entities) {
    if (entity.kind !== "springBomb" || entity.dead) continue;

    if (entity.cooldown > 0) entity.cooldown = Math.max(0, entity.cooldown - dt);

    const balloon = entity.springBalloon;
    if (entity.attached) {
      if (!balloon || balloon.dead) {
        releaseSpringBomb(entity);
      } else {
        const anchor = balloon.body.getPosition();
        entity.body.setTransform(
          planck.Vec2(anchor.x, anchor.y + config.hangOffset),
          0,
        );
        entity.body.setLinearVelocity(planck.Vec2(0, 0));
        continue;
      }
    }

    const position = entity.body.getPosition();
    const velocity = entity.body.getLinearVelocity();

    if (position.x < -2.2 || position.x > WORLD_W + 2.2 || position.y > WORLD_H + 2) {
      markDead(entity);
      continue;
    }

    const springTip = position.y + config.springLength;
    if (springTip >= GROUND_Y && velocity.y > 0 && entity.cooldown <= 0) {
      entity.bounces += 1;
      const upSpeed = Math.max(
        config.bounceUpMin,
        config.bounceUp - (entity.bounces - 1) * config.bounceUpDecay,
      );
      const leftSpeed = config.bounceLeft + (entity.bounces - 1) * config.bounceLeftGain;
      entity.body.setTransform(
        planck.Vec2(position.x, GROUND_Y - config.springLength),
        0,
      );
      entity.body.setLinearVelocity(planck.Vec2(-leftSpeed, -upSpeed));
      entity.cooldown = config.bounceCooldown;
      spawnSparks(position.x, GROUND_Y);
      shake = Math.max(shake, 4);
      soundClank();
    }
  }
}

function destroyDuoChain(duo, silent) {
  for (const part of duo.parts) {
    if (part.dead) continue;
    const position = part.body.getPosition();
    if (!silent) {
      if (part.kind === "bomb") {
        spawnExplosion(position.x, position.y, "bomb");
      } else {
        spawnSparks(position.x, position.y);
      }
    }
    markDead(part);
  }
  if (!silent) {
    shake = Math.max(shake, 10);
    soundExplosion(false);
  }
}

function duoBalloonDown(balloon, options = {}) {
  if (balloon.dead) return;
  const { silent = false, award = false } = options;
  const duo = balloon.duo;
  const position = balloon.body.getPosition();

  markDead(balloon);
  if (!silent) {
    spawnExplosion(position.x, position.y, "duo");
    shake = Math.max(shake, 7);
    soundExplosion(false);
  }

  if (award) {
    score += balloon.points;
    updateHud();
  }

  if (duo) {
    duo.aliveBalloons = Math.max(0, duo.aliveBalloons - 1);
    if (duo.aliveBalloons <= 0) destroyDuoChain(duo, silent);
  }
}

function startBomberFall(bomber) {
  if (bomber.dead || bomber.falling) return;
  bomber.falling = true;
  bomber.flash = 0.2;
}

function killBomber(bomber) {
  if (bomber.dead) return;
  markDead(bomber);
  for (const part of bomber.parts) {
    if (!part.dead) markDead(part);
  }
}

function explodeBomber(bomber) {
  if (bomber.dead) return;
  const balloon = bomber.body.getPosition();
  spawnExplosion(balloon.x, balloon.y, "bomber");
  for (const part of bomber.parts) {
    if (part.dead) continue;
    const position = part.body.getPosition();
    if (part.kind === "bomb") {
      spawnExplosion(position.x, position.y, "bomb");
    } else {
      spawnSparks(position.x, position.y);
    }
    markDead(part);
  }
  markDead(bomber);
  bomber.falling = false;

  score += bomber.points;
  shake = Math.max(shake, 14);
  soundExplosion(false);
  updateHud();
}

function startGasBalloonFall(balloon) {
  if (balloon.dead || balloon.falling) return;
  balloon.falling = true;
  balloon.flash = 0.2;
}

function spawnGasCloud(x, y) {
  const config = GAS_CONFIG;
  const body = world.createBody({
    type: "kinematic",
    position: planck.Vec2(x, y),
    fixedRotation: true,
  });
  const fixture = body.createFixture(planck.Circle(config.radius), {
    isSensor: true,
    filterCategoryBits: 0,
    filterMaskBits: 0,
  });

  const sprite = Stage.sprite(gasTexture).appendTo(gameLayer);
  const scale = (config.radius * 2 * PPM) / gasTexture.getWidth();
  sprite.pin({
    pivotX: 0.5,
    pivotY: 0.5,
    handleX: 0.5,
    handleY: 0.5,
    scaleX: scale,
    scaleY: scale,
    alpha: config.spriteAlpha,
  });

  const gas = createEntity("gas", body, fixture, sprite, {
    radius: config.radius,
    scale,
    alpha: config.spriteAlpha,
    age: 0,
    phase: rand(0, Math.PI * 2),
  });
  body.setLinearVelocity(planck.Vec2(-scrollSpeed() / PPM, 0));
  return gas;
}

function explodeGasBalloon(balloon) {
  if (balloon.dead) return;
  const position = balloon.body.getPosition();
  const groundY = Math.min(position.y, GROUND_Y);
  spawnExplosion(position.x, groundY, "gasBalloon");
  spawnParticles(position.x * PPM, groundY * PPM, ["#a05cff", "#c89bff", "#7a3cff"], 18, 60, 210);
  spawnGasCloud(position.x, groundY - GAS_CONFIG.radius * 0.4);
  markDead(balloon);
  shake = Math.max(shake, 12);
  soundExplosion(false);
}

function commanderSelfDestruct(commander) {
  for (const entity of entities) {
    if (entity === commander || entity.dead || entity.puffed) continue;
    if (entity.converted) continue;
    if (entity.targetType === "allyCommander") continue;
    if (entity.kind === "springBomb") {
      const bombPosition = entity.body.getPosition();
      spawnExplosion(bombPosition.x, bombPosition.y, "bomb");
      markDead(entity);
      continue;
    }
    if (entity.kind !== "target") continue;
    if (entity.targetType === "gem" || entity.targetType === "commander") continue;

    if (entity.targetType === "duo") {
      duoBalloonDown(entity, { award: true });
      continue;
    }
    if (entity.targetType === "bomber") {
      if (entity.falling) continue;
      explodeBomber(entity);
      continue;
    }
    if (entity.targetType === "gasBalloon" && entity.falling) continue;

    const position = entity.body.getPosition();
    markDead(entity);
    score += entity.points || 0;

    if (entity.targetType === "gasBalloon") {
      spawnExplosion(position.x, position.y, "gasBalloon");
      spawnParticles(position.x * PPM, position.y * PPM, ["#a05cff", "#c89bff", "#7a3cff"], 18, 60, 210);
    } else if (entity.targetType === "smoke") {
      puffBalloon(entity);
      spawnParticles(position.x * PPM, position.y * PPM, ["#ffffff", "#eef4ff"], 14, 40, 160);
    } else {
      spawnExplosion(position.x, position.y, entity.targetType);
    }
  }

  shake = Math.max(shake, 16);
  soundExplosion(true);
  updateHud();
}

function updateGasBalloonFalls() {
  for (const entity of entities) {
    if (entity.kind !== "target" || entity.targetType !== "gasBalloon" || entity.dead) continue;
    if (!entity.falling) continue;

    if (!entity.fallApplied) {
      entity.fallApplied = true;
      entity.body.setGravityScale(1);
      entity.body.setLinearVelocity(planck.Vec2(-entity.speed * 0.35, 0.6));
    }

    const position = entity.body.getPosition();
    if (position.x < -2.4) {
      markDead(entity);
      continue;
    }
    if (position.y > GROUND_Y) explodeGasBalloon(entity);
  }
}

function gasAt(position) {
  for (const entity of entities) {
    if (entity.kind !== "gas" || entity.dead) continue;
    const center = entity.body.getPosition();
    const dx = position.x - center.x;
    const dy = position.y - center.y;
    const limit = entity.radius * 0.92;
    if (dx * dx + dy * dy <= limit * limit) return entity;
  }
  return null;
}

function updateBombers() {
  for (const entity of entities) {
    if (entity.kind === "bomb" || entity.kind === "link") {
      if (entity.dead || !entity.detached) continue;
      const position = entity.body.getPosition();
      if (position.y > GROUND_Y || position.x < -2) {
        markDead(entity);
        if (entity.kind === "bomb") {
          spawnExplosion(position.x, position.y, "bomb");
          shake = Math.max(shake, 5);
          soundExplosion(false);
        } else {
          spawnSparks(position.x, position.y);
        }
      }
      continue;
    }

    if (entity.kind !== "target" || entity.targetType !== "bomber" || entity.dead) continue;

    if (entity.falling && !entity.fallApplied) {
      entity.fallApplied = true;
      entity.body.setType("dynamic");
      entity.body.setGravityScale(1);
      entity.body.setLinearVelocity(planck.Vec2(-entity.speed * 0.3, 1.0));
    }

    if (!entity.falling) continue;

    const balloon = entity.body.getPosition();
    if (balloon.x < -2.4) {
      killBomber(entity);
      continue;
    }

    if (balloon.y > GROUND_Y) explodeBomber(entity);
  }
}

const PUFF_DURATION = 0.28;
const PUFF_START_SCALE = 0.06;

function puffBalloon(target) {
  if (target.dead || target.puffed) return;
  target.puffed = true;
  target.flash = 0;
  target.puffT = 0;

  target.fixture.setFilterData({ categoryBits: 0, maskBits: 0, groupIndex: 0 });

  target.sprite.remove();
  const sprite = Stage.sprite(smokeTexture).appendTo(fogLayer);
  sprite.pin({
    pivotX: 0.5,
    pivotY: 0.5,
    handleX: 0.5,
    handleY: 0.5,
    scaleX: PUFF_START_SCALE,
    scaleY: PUFF_START_SCALE,
    alpha: 0.55,
  });
  target.sprite = sprite;
}

function damageTarget(target, bullet) {
  if (target.dead || target.converted) return;
  if (target.targetType === "allyCommander") return;
  if (bullet) markDead(bullet);
  if (target.falling) return;

  target.hp -= 1;
  const position = target.body.getPosition();

  if (target.hp <= 0) {
    if (target.targetType === "duo") {
      duoBalloonDown(target, { award: true });
      return;
    }
    if (target.targetType === "commander") {
      markDead(target);
      score += target.points;
      spawnExplosion(position.x, position.y, "commander");
      commanderSelfDestruct(target);
      scheduleAllyCommander();
      return;
    }
    if (target.targetType === "bomber") {
      startBomberFall(target);
      spawnSparks(position.x, position.y);
      shake = Math.max(shake, 6);
      soundHit();
      return;
    }
    if (target.kind === "link") {
      markDead(target);
      spawnSparks(position.x, position.y);
      soundHit();
      return;
    }
    if (target.targetType === "smoke") {
      score += target.points;
      puffBalloon(target);
      spawnParticles(position.x * PPM, position.y * PPM, ["#ffffff", "#eef4ff"], 14, 40, 160);
      shake = Math.max(shake, 4);
      soundPuff();
      updateHud();
      return;
    }
    if (target.targetType === "gasBalloon") {
      score += target.points;
      startGasBalloonFall(target);
      spawnSparks(position.x, position.y);
      shake = Math.max(shake, 8);
      soundHit();
      updateHud();
      return;
    }
    if (target.targetType === "springBalloon") {
      springBalloonDown(target, { award: true });
      return;
    }
    if (target.kind === "springBomb") {
      const balloon = target.springBalloon;
      if (balloon) balloon.springBomb = null;
      markDead(target);
      score += target.points;
      spawnExplosion(position.x, position.y, "bomb");
      shake = Math.max(shake, 10);
      soundExplosion(false);
      updateHud();
      return;
    }
    if (target.targetType === "barrierBalloon") {
      destroyBarrierBalloon(target);
      return;
    }
    markDead(target);
    score += target.points;
    spawnExplosion(position.x, position.y, target.targetType);
    shake = Math.max(shake, target.targetType === "gem" ? 8 : 5);
    soundExplosion(target.targetType === "gem");
    updateHud();
  } else {
    target.flash = 0.2;
    spawnSparks(position.x, position.y);
    soundHit();
  }
}

function hitPlane(target, point = null) {
  if (!plane || plane.dead || plane.invuln > 0 || target.dead || target.puffed) return;
  if (target.converted || target.targetType === "allyCommander") return;
  const position = target.body.getPosition();
  if (target.kind === "stone") {
    spawnSparks(position.x, position.y);
    shake = Math.max(shake, 10);
    soundClank();
    hurtPlayer();
    return;
  }
  if (target.kind === "barrierBalloon") {
    hitPlaneByBarrier(target, point);
    return;
  }
  if (target.targetType === "commander") {
    markDead(target);
    score += target.points;
    spawnExplosion(position.x, position.y, "commander");
    commanderSelfDestruct(target);
    scheduleAllyCommander();
    shake = Math.max(shake, 14);
    hurtPlayer();
    return;
  }
  if (target.targetType === "clayBalloon") {
    clayBalloonDown(target, point);
    return;
  }
  if (target.targetType === "smoke") {
    puffBalloon(target);
    spawnSparks(position.x, position.y);
    shake = Math.max(shake, 8);
    hurtPlayer();
    return;
  }
  if (target.targetType === "duo") {
    duoBalloonDown(target);
    shake = Math.max(shake, 10);
    hurtPlayer();
    return;
  }
  if (target.targetType === "bomber") {
    startBomberFall(target);
    spawnSparks(position.x, position.y);
    shake = Math.max(shake, 8);
    hurtPlayer();
    return;
  }
  if (target.targetType === "pendulum" || target.targetType === "magnet") {
    spawnSparks(position.x, position.y);
    shake = Math.max(shake, 8);
    damageTarget(target);
    hurtPlayer();
    return;
  }
  if (target.targetType === "gasBalloon") {
    if (target.falling) return;
    damageTarget(target);
    spawnSparks(position.x, position.y);
    shake = Math.max(shake, 8);
    hurtPlayer();
    return;
  }
  if (target.targetType === "springBalloon") {
    springBalloonDown(target);
    shake = Math.max(shake, 8);
    hurtPlayer();
    return;
  }
  if (target.kind === "springBomb") {
    const balloon = target.springBalloon;
    if (balloon) balloon.springBomb = null;
    markDead(target);
    spawnExplosion(position.x, position.y, "bomb");
    shake = Math.max(shake, 12);
    soundExplosion(false);
    hurtPlayer();
    return;
  }
  markDead(target);
  spawnExplosion(position.x, position.y, "bomb");
  shake = Math.max(shake, 12);
  soundExplosion(false);
  hurtPlayer();
}

function destroyBarrierBalloon(target) {
  if (!target || target.dead) return;
  const position = target.body.getPosition();
  markDead(target);
  score += target.points;
  spawnExplosion(position.x, position.y, "steelBalloon");
  spawnParticles(
    position.x * PPM,
    position.y * PPM,
    ["#ffffff", "#c3d2e4", "#ffd166", "#7d8ea3"],
    20,
    70,
    240,
  );
  shake = Math.max(shake, 10);
  soundExplosion(false);
  updateHud();
}

function hitPlaneByBarrier(barrier, point = null) {
  if (!plane || plane.dead || plane.invuln > 0 || barrier.dead) return;
  const position = point || barrier.body.getPosition();
  spawnSparks(position.x, position.y);
  shake = Math.max(shake, 12);
  soundClank();
  hurtPlayer();
  destroyBarrierBalloon(barrier);
}

function attachClayBasket(point, planePosition) {
  const sprite = Stage.sprite(clayBlobTexture).appendTo(gameLayer);
  sprite.pin({
    pivotX: 0.5,
    pivotY: 0.5,
    handleX: 0.5,
    handleY: 0.5,
    scaleX: CLAY_CONFIG.blobScale,
    scaleY: CLAY_CONFIG.blobScale,
  });

  plane.clayBasket = sprite;
  plane.clayBasketOffset = {
    x: point.x - planePosition.x,
    y: point.y - planePosition.y,
  };
  plane.clayBasketAge = 0;
}

function clayBalloonDown(target, point = null) {
  if (target.dead) return;

  const position = target.body.getPosition();
  const planePosition = plane.body.getPosition();
  const source = point || position;
  const hitPoint = {
    x: clamp(source.x, planePosition.x - 0.85, planePosition.x + 0.85),
    y: clamp(source.y, planePosition.y - 0.32, planePosition.y + 0.32),
  };
  const alreadyAttached = !!plane.clayBasket;

  markDead(target);
  score += target.points || 0;

  spawnExplosion(position.x, position.y, "clayBalloon");
  spawnParticles(hitPoint.x * PPM, hitPoint.y * PPM, ["#ecd3b3", "#c98b5e", "#8a5a35"], 12, 40, 150);
  shake = Math.max(shake, 8);
  soundExplosion(false);

  if (!alreadyAttached) {
    attachClayBasket(hitPoint, planePosition);
    const velocity = plane.body.getLinearVelocity();
    plane.body.setLinearVelocity(planck.Vec2(velocity.x * 0.4, 0));
    plane.body.setGravityScale(CLAY_CONFIG.gravityScale);
    plane.clayFall = true;
    plane.clayGrounded = 0;
    if (hintEl) hintEl.textContent = "粘土黏附：自由落体中，仅可左右机动";
  }

  updateHud();
}

function endClayDebuff() {
  if (!plane || plane.dead) return;
  if (plane.clayBasket) {
    plane.clayBasket.remove();
    plane.clayBasket = null;
  }
  plane.body.setGravityScale(1);
  plane.clayFall = false;
  plane.clayGrounded = 0;
  updateHint();
}

function deflectBullet(bullet, pendulum) {
  if (bullet.dead || bullet.deflectTimer > 0) return;

  const position = bullet.body.getPosition();
  const center = pendulum.body.getPosition();
  const dx = position.x - center.x;
  const dy = position.y - center.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = dx / length;
  const ny = dy / length;

  const velocity = bullet.body.getLinearVelocity();
  const dot = velocity.x * nx + velocity.y * ny;
  let vx = velocity.x - 2 * dot * nx;
  let vy = velocity.y - 2 * dot * ny;

  vx = Math.min(vx, -Math.max(6, Math.abs(velocity.x) * 0.55));
  vy *= 0.7;

  bullet.deflectVX = vx;
  bullet.deflectVY = vy;
  bullet.deflectTimer = 0.18;
  bullet.fixture.setFilterData({
    categoryBits: CAT.REFLECTED,
    maskBits: 0,
    groupIndex: 0,
  });
  bullet.body.setLinearVelocity(planck.Vec2(vx, vy));
  bullet.life = Math.max(bullet.life, 0.6);

  spawnSparks(position.x, position.y);
  shake = Math.max(shake, 2);
  soundClank();
}

function hitPlaneByPendulum(pendulum) {
  if (!plane || plane.dead || plane.invuln > 0 || pendulum.dead) return;
  const position = plane.body.getPosition();
  spawnSparks(position.x, position.y);
  spawnParticles(position.x * PPM, position.y * PPM, ["#ffffff", "#eaf2ff", "#ffd166"], 14, 50, 200);
  shake = Math.max(shake, 14);
  soundHit();
  hurtPlayer();
}

function hitPlaneByMagnet(magnet) {
  if (!plane || plane.dead || plane.invuln > 0 || magnet.dead) return;
  const position = plane.body.getPosition();
  spawnSparks(position.x, position.y);
  spawnParticles(position.x * PPM, position.y * PPM, ["#ffffff", "#8fe6ff", "#ff4d6d"], 14, 50, 200);
  shake = Math.max(shake, 14);
  soundHit();
  damageTarget(magnet);
  hurtPlayer();
}

function collectGem(target) {
  if (!plane || plane.dead || target.dead) return;
  const position = target.body.getPosition();
  markDead(target);

  score += target.points;

  const before = hp;
  hp = Math.min(MAX_HP, hp + (target.heal || 0));
  const restored = hp > before;

  spawnParticles(position.x * PPM, position.y * PPM, ["#ffffff", "#7ef9ff", "#b388ff"], 20, 40, 170);
  shake = Math.max(shake, 3);
  soundHeal(restored);
  updateHud();
}

function hurtPlayer() {
  hp -= 1;
  plane.invuln = 1.5;
  soundHurt();
  updateHud();
  if (hp <= 0) {
    hp = 0;
    endGame();
  }
}

function contactWorldPoint(contact) {
  const manifold = contact.getWorldManifold(null);
  if (!manifold || manifold.pointCount === 0) return null;
  const point = manifold.points[0];
  return { x: point.x, y: point.y };
}

function onBeginContact(contact) {
  const entityA = contact.getFixtureA().getUserData();
  const entityB = contact.getFixtureB().getUserData();
  if (!entityA || !entityB || typeof entityA !== "object" || typeof entityB !== "object") {
    return;
  }

  const planeEntity = entityA.kind === "plane" ? entityA : entityB.kind === "plane" ? entityB : null;
  if (planeEntity) {
    const other = planeEntity === entityA ? entityB : entityA;
    if (other.kind === "pendulum") {
      hitPlaneByPendulum(other);
      return;
    }
    if (other.kind === "magnet") {
      hitPlaneByMagnet(other);
      return;
    }
    if (other.kind === "steelPlate") {
      hitPlaneBySteelPlate(other);
      return;
    }
    if (other.kind === "stone") {
      hitPlane(other, contactWorldPoint(contact));
      return;
    }
    if (other.kind === "barrierBalloon") {
      hitPlaneByBarrier(other, contactWorldPoint(contact));
      return;
    }
    if (other.targetType === "allyCommander") {
      startConversion();
      collectAllyCommander(other);
      return;
    }
    if (isHazard(other)) {
      if (other.targetType === "gem") {
        collectGem(other);
      } else {
        hitPlane(other, contactWorldPoint(contact));
      }
    }
    return;
  }

  const bulletEntity =
    entityA.kind === "bullet" ? entityA : entityB.kind === "bullet" ? entityB : null;
  if (bulletEntity) {
    const other = bulletEntity === entityA ? entityB : entityA;
    if (other.kind === "pendulum") {
      deflectBullet(bulletEntity, other);
      return;
    }
    if (other.kind === "magnet") {
      damageTarget(other, bulletEntity);
      return;
    }
    if (other.kind === "steelPlate") {
      hitSteelPlate(bulletEntity, other, contact);
      return;
    }
    if (other.kind === "barrierBalloon") {
      damageTarget(other, bulletEntity);
      return;
    }
    if (isHazard(other)) damageTarget(other, bulletEntity);
  }
}

function clampPlane() {
  const position = plane.body.getPosition();
  const velocity = plane.body.getLinearVelocity();
  let x = position.x;
  let y = position.y;
  let vx = velocity.x;
  let vy = velocity.y;

  const minX = 0.9;
  const maxX = WORLD_W - 0.7;
  const minY = 0.8;
  const maxY = WORLD_H - 0.8;

  if (x < minX) {
    x = minX;
    vx = Math.max(0, vx);
  } else if (x > maxX) {
    x = maxX;
    vx = Math.min(0, vx);
  }

  if (y < minY) {
    y = minY;
    vy = Math.max(0, vy);
  } else if (y > maxY) {
    y = maxY;
    vy = Math.min(0, vy);
  }

  if (x !== position.x || y !== position.y) {
    plane.body.setTransform(planck.Vec2(x, y), 0);
    plane.body.setLinearVelocity(planck.Vec2(vx, vy));
  }
}

function cleanupDead() {
  for (const entity of entities) {
    if (!entity.dead) continue;
    if (entity === commander) commander = null;
    if (entity === allyCommander) allyCommander = null;
    if (entity === barrierBalloon) barrierBalloon = null;
    if (entity === galeBalloon) galeBalloon = null;
    if (entity === soapBalloon) soapBalloon = null;
    entity.sprite.remove();
    if (entity.chute) entity.chute.remove();
    if (entity.gasTint) entity.gasTint.remove();
    if (entity.halo) entity.halo.remove();
    if (entity.fanSprite) {
      entity.fanSprite.remove();
      entity.fanSprite = null;
    }
    if (entity.windSprite) {
      entity.windSprite.remove();
      entity.windSprite = null;
    }
    if (entity.convertAura) {
      entity.convertAura.remove();
      entity.convertAura = null;
    }
    if (entity.clayBasket) {
      entity.clayBasket.remove();
      entity.clayBasket = null;
    }
    if (entity.plate && !entity.plate.dead) entity.plate.sprite.remove();
    if (entity.pullDots) {
      for (const dot of entity.pullDots) dot.remove();
    }
    if (entity.body && world) {
      world.destroyBody(entity.body);
    }
  }
  entities = entities.filter((entity) => !entity.dead);
}

function manualControls() {
  return {
    up: keys.has("KeyW") || keys.has("ArrowUp"),
    down: keys.has("KeyS") || keys.has("ArrowDown"),
    left: keys.has("KeyA") || keys.has("ArrowLeft"),
    right: keys.has("KeyD") || keys.has("ArrowRight"),
    fire: keys.has("Space") || pointerDown,
  };
}

function autopilotRadius(entity) {
  if (entity.targetType === "commander") return COMMANDER_CONFIG.radius;
  if (entity.targetType === "bomber") return BOMBER_CONFIG.radius;
  if (entity.targetType === "duo") return DUO_CONFIG.radius;
  if (entity.targetType === "springBalloon") return SPRING_BOMB_CONFIG.radius;
  if (entity.targetType === "steelBalloon" && !entity.plate?.dead) return 0.95;
  if (entity.targetType === "galeBalloon") return GALE_CONFIG.radius;
  if (entity.targetType === "soapBalloon") return SOAP_CONFIG.radius;
  const config = TARGET_CONFIG[entity.targetType];
  return config ? config.radius : 0.4;
}

function autopilotSampleY(target, time) {
  const config = AUTOPILOT_CONFIG;
  const future = target.future;
  if (!future || future.length === 0) return target.y;
  if (time <= 0) return future[0].y;
  const stepTime = config.horizon / config.samples;
  const index = Math.min(config.samples, time / stepTime);
  const low = Math.floor(index);
  const high = Math.min(config.samples, low + 1);
  const blend = index - low;
  const a = future[low];
  const b = future[high];
  return a.y + (b.y - a.y) * blend;
}

function autopilotSnakeFuture(entity, leader) {
  const config = AUTOPILOT_CONFIG;
  const point = entity.body.getPosition();
  const leaderPoint = leader.body.getPosition();
  const amplitude = SNAKE_CONFIG.amplitude;
  const frequency = SNAKE_CONFIG.frequency;
  const speed = Math.max(0.4, entity.speed);
  const delay = leader === entity ? 0 : Math.max(0, (point.x - leaderPoint.x) / speed);
  const basePhase = (leader.age - delay) * frequency + leader.phase;
  const baseSin = Math.sin(basePhase);
  const future = [{ x: point.x, y: point.y }];
  for (let i = 1; i <= config.samples; i += 1) {
    const t = config.horizon * (i / config.samples);
    const sway = Math.sin((leader.age + t - delay) * frequency + leader.phase) - baseSin;
    future.push({
      x: point.x - speed * t,
      y: point.y + sway * amplitude,
    });
  }
  return future;
}

function autopilotChargeFuture(entity, chargeConfig, planePosition) {
  const config = AUTOPILOT_CONFIG;
  const point = entity.body.getPosition();
  const velocity = entity.body.getLinearVelocity();
  let dirX = velocity.x;
  let dirY = velocity.y;
  if (Math.hypot(dirX, dirY) < 0.05 && planePosition) {
    dirX = planePosition.x - point.x;
    dirY = planePosition.y - point.y;
  }
  const length = Math.hypot(dirX, dirY) || 1;
  dirX /= length;
  dirY /= length;

  const future = [{ x: point.x, y: point.y }];
  const stepTime = config.horizon / config.samples;
  let travelled = 0;
  for (let i = 1; i <= config.samples; i += 1) {
    const t = config.horizon * (i / config.samples);
    const blend = Math.min(
      1,
      (entity.chargeBlend || 0) + t / Math.max(0.05, chargeConfig.chargeRamp),
    );
    const speed = entity.speed * (1 + (chargeConfig.chargeSpeedScale - 1) * blend);
    travelled += speed * stepTime;
    future.push({ x: point.x + dirX * travelled, y: point.y + dirY * travelled });
  }
  return future;
}

function computeThreat(entity, planePosition) {
  if (!planePosition) return 0;
  const kind = entity.kind;
  const type = entity.targetType;
  if (kind === "plane" || kind === "bullet" || kind === "gas" || kind === "stone") return 0;
  if (type === "allyCommander" || type === "gem") return 0;
  if (entity.dead || entity.converted || entity.puffed) return 0;

  const position = entity.body.getPosition();
  const distance = Math.hypot(position.x - planePosition.x, position.y - planePosition.y);
  const config = TARGET_CONFIG[type];
  const baseHp = config ? config.hp : 1;
  const baseSpeed = config ? config.speed : 1;

  let threat = baseHp * 2 + baseSpeed;
  threat += Math.max(0, 10 - distance) * 1.5;

  if (kind === "magnet" || kind === "pendulum") threat *= 1.5;
  if (kind === "barrierBalloon") threat *= 1.5;
  if (type === "commander") threat *= 2.0;
  if (type === "bomber") threat *= 1.6;
  if (type === "duo") threat *= 1.7;
  if (type === "gasBalloon") threat *= 1.3;
  if (type === "clayBalloon" || type === "invisible") threat *= 1.4;
  if (type === "steelBalloon" && entity.plate && !entity.plate.dead) threat *= 1.3;
  if (type === "springBalloon") threat *= 1.2;
  if (type === "galeBalloon") threat *= 1.6;
  if (type === "soapBalloon") threat *= 1.6;
  if (entity.charging) threat *= 1.6;
  if (entity.falling) threat *= 0.5;
  if (entity.entering) threat *= 0.7;

  return threat;
}

function autopilotScan(px, py) {
  const config = AUTOPILOT_CONFIG;
  const planePosition = { x: px, y: py };
  const threats = [];
  const targets = [];
  let gem = null;
  let gemScore = Infinity;
  let ally = null;

  const linearFuture = (x, y, vx, vy) => {
    const future = [{ x, y }];
    for (let i = 1; i <= config.samples; i += 1) {
      const t = config.horizon * (i / config.samples);
      future.push({ x: x + vx * t, y: y + vy * t });
    }
    return future;
  };

  const ballisticFuture = (x, y, vx, vy) => {
    const future = [{ x, y }];
    for (let i = 1; i <= config.samples; i += 1) {
      const t = config.horizon * (i / config.samples);
      future.push({ x: x + vx * t, y: y + vy * t + 0.5 * GRAVITY * t * t });
    }
    return future;
  };

  const stoneFuture = (x, y, vx, vy) => {
    const restY = GROUND_Y - STONE_CONFIG.height * 0.5;
    const gravity = GRAVITY * STONE_CONFIG.gravityScale;
    const future = [{ x, y }];
    for (let i = 1; i <= config.samples; i += 1) {
      const t = config.horizon * (i / config.samples);
      future.push({
        x: x + vx * t,
        y: Math.min(restY, y + vy * t + 0.5 * gravity * t * t),
      });
    }
    return future;
  };

  const stoneThreats = [];

  const snakeLeaders = new Map();
  for (const entity of entities) {
    if (entity.kind !== "target" || entity.dead || entity.puffed || !entity.snakeSquad) continue;
    const current = snakeLeaders.get(entity.snakeSquad);
    const currentAlive = current && !current.dead && !current.puffed && !current.escaped;
    if (!currentAlive || entity.snakeIndex < current.snakeIndex) {
      snakeLeaders.set(entity.snakeSquad, entity);
    }
  }

  for (const entity of entities) {
    if (entity.dead) continue;
    if (entity.converted) continue;

    if (entity.kind === "pendulum" || entity.kind === "magnet") {
      const balloon = entity.balloon;
      if (!balloon || balloon.dead) continue;
      const balloonPosition = balloon.body.getPosition();
      const balloonVelocity = balloon.body.getLinearVelocity();
      const pivotX = balloonPosition.x;
      const pivotY = balloonPosition.y + entity.pivotOffsetY;
      const future = [];
      for (let i = 0; i <= config.samples; i += 1) {
        const t = config.horizon * (i / config.samples);
        const angle =
          entity.maxAngle * Math.sin((entity.swingTime + t) * entity.omega + entity.phase);
        future.push({
          x: pivotX + balloonVelocity.x * t + Math.sin(angle) * entity.armLength,
          y: pivotY + balloonVelocity.y * t + Math.cos(angle) * entity.armLength,
        });
      }
      threats.push({ future, radius: entity.kind === "magnet" ? 0.6 : 0.5, weight: 1.4 });
      continue;
    }

    if (entity.kind === "bomb" || entity.kind === "link") {
      const point = entity.body.getPosition();
      const velocity = entity.body.getLinearVelocity();
      threats.push({
        future: ballisticFuture(point.x, point.y, velocity.x, velocity.y),
        radius: entity.kind === "bomb" ? 0.26 : 0.14,
        weight: 1,
      });
      continue;
    }

    if (entity.kind === "springBomb") {
      const point = entity.body.getPosition();
      const velocity = entity.body.getLinearVelocity();
      threats.push({
        future: ballisticFuture(point.x, point.y, velocity.x, velocity.y),
        radius: SPRING_BOMB_CONFIG.bombRadius + 0.15,
        weight: 1.2,
      });
      continue;
    }

    if (entity.kind === "gas") {
      const point = entity.body.getPosition();
      const velocity = entity.body.getLinearVelocity();
      threats.push({
        future: linearFuture(point.x, point.y, velocity.x, velocity.y),
        radius: entity.radius * 0.9,
        weight: 0.8,
      });
      continue;
    }

    if (entity.kind === "stone") {
      const point = entity.body.getPosition();
      const velocity = entity.body.getLinearVelocity();
      const distance = Math.hypot(point.x - px, point.y - py);
      const range = entity.landed ? config.stoneGroundScanRange : config.stoneScanRange;
      if (distance > range) continue;
      stoneThreats.push({
        distance,
        ground: !!entity.landed,
        threat: {
          future: stoneFuture(point.x, point.y, velocity.x, velocity.y),
          radius: config.stoneRadius,
          weight: entity.landed ? config.stoneGroundWeight : config.stoneAirWeight,
        },
      });
      continue;
    }

    if (entity.kind !== "target" || entity.puffed) continue;

    const point = entity.body.getPosition();
    const velocity = entity.body.getLinearVelocity();

    if (entity.targetType === "allyCommander") {
      ally = { x: point.x, y: point.y };
      continue;
    }

    if (entity.targetType === "gem") {
      if (
        point.x > px - 1.5 &&
        point.x <= WORLD_W - config.engageMargin &&
        point.x < px + config.gemLookAhead
      ) {
        const score = Math.hypot((point.x - px) * 0.45, point.y - py);
        if (score < gemScore) {
          gemScore = score;
          gem = { x: point.x, y: point.y };
        }
      }
      continue;
    }

    if (point.x > WORLD_W - config.engageMargin) continue;

    const radius = autopilotRadius(entity);
    const shielded =
      entity.targetType === "steelBalloon" && !!entity.plate && !entity.plate.dead;
    const formation = entity.formation || (entity.snakeSquad ? "snakeFollow" : null);
    let future = linearFuture(point.x, point.y, velocity.x, velocity.y);
    let threatWeight = shielded ? 1.1 : 1;
    let danger = 0;

    if (entity.snakeSquad) {
      const leader = snakeLeaders.get(entity.snakeSquad) || entity;
      future = autopilotSnakeFuture(entity, leader);
      threatWeight = 1.15;
    } else if (entity.targetType === "clayBalloon" || entity.targetType === "invisible") {
      const chargeConfig =
        entity.targetType === "clayBalloon" ? CLAY_CONFIG : INVISIBLE_CONFIG;
      const distance = Math.hypot(point.x - px, point.y - py);
      if (entity.charging || distance <= chargeConfig.attackRange) {
        future = autopilotChargeFuture(entity, chargeConfig, planePosition);
        threatWeight = 1.45;
        danger = entity.charging ? config.chargeDanger : config.chargeDanger * 0.6;
      }
    }

    threats.push({ future, radius, weight: threatWeight });
    targets.push({
      x: point.x,
      y: point.y,
      vx: velocity.x,
      vy: velocity.y,
      radius,
      future,
      commander: entity.targetType === "commander",
      shielded,
      plateHp: shielded ? entity.plate.hp : 0,
      formation,
      danger,
      threat: computeThreat(entity, planePosition),
    });
  }

  if (stoneThreats.length > config.stoneThreatLimit) {
    stoneThreats.sort((a, b) => a.distance - b.distance);
    stoneThreats.length = config.stoneThreatLimit;
  }
  for (const entry of stoneThreats) threats.push(entry.threat);
  const groundStones = stoneThreats.reduce((sum, entry) => sum + (entry.ground ? 1 : 0), 0);

  return { threats, targets, gem, ally, groundStones };
}

function autopilotPathRisk(px, py, targetX, targetY, threats) {
  const config = AUTOPILOT_CONFIG;
  const reach = config.horizon * 5.5;
  const dx = targetX - px;
  const dy = targetY - py;
  const distance = Math.hypot(dx, dy);
  const scale = distance > reach ? reach / distance : 1;
  const endX = px + dx * scale;
  const endY = py + dy * scale;
  let risk = 0;

  for (let i = 1; i <= config.samples; i += 1) {
    const f = i / config.samples;
    const sx = px + (endX - px) * f;
    const sy = py + (endY - py) * f;
    for (const threat of threats) {
      const point = threat.future[i];
      const ex = threat.radius + config.planeRadiusX + config.clearance;
      const ey = threat.radius + config.planeRadiusY + config.clearance;
      const d = Math.hypot((sx - point.x) / ex, (sy - point.y) / ey);
      if (d < 1) risk += threat.weight * (1 + (1 - d) * 4);
      else {
        const gap = (d - 1) * Math.min(ex, ey);
        if (gap < config.safeDistance) {
          risk += threat.weight * (config.safeDistance - gap) * 0.9;
        }
      }
    }
  }

  return risk;
}

function autopilotBlocker(targets, px, py, planeVX, planeVY, chosen) {
  const config = AUTOPILOT_CONFIG;
  let blocker = null;
  let blockerX = Infinity;
  for (const target of targets) {
    if (target === chosen) continue;
    const dx = target.x - px;
    if (dx <= 0.9 || dx >= chosen.x - px) continue;
    const closing = config.bulletSpeed + Math.max(0, planeVX) - Math.min(0, target.vx);
    const flight = Math.max(0.03, (dx - 1) / closing);
    const bulletY = py + planeVY * 0.25 * flight;
    const targetY = autopilotSampleY(target, flight);
    if (Math.abs(targetY - bulletY) < target.radius + config.occlusionPad) {
      if (target.x < blockerX) {
        blockerX = target.x;
        blocker = target;
      }
    }
  }
  return blocker;
}

function autopilotAim(targets, px, py, planeVX, planeVY) {
  const config = AUTOPILOT_CONFIG;
  let best = null;
  let bestScore = -Infinity;
  for (const target of targets) {
    const dx = target.x - px;
    if (dx < 0.4 || dx > config.fireRange) continue;
    const threat = target.threat || 0;
    const shield = target.shielded ? config.shieldPenalty * 2 : 0;
    // 威胁越高、距离越近、越优先被射击
    const score = threat * 2 - dx * 0.05 - shield;
    if (score > bestScore) {
      bestScore = score;
      best = target;
    }
  }
  if (!best) return null;
  const blocker = autopilotBlocker(targets, px, py, planeVX, planeVY, best);
  return blocker || best;
}

function autopilotGoal(px, py, threats, targets, aim, gem, ally, planeVX = 0, groundStones = 0) {
  const config = AUTOPILOT_CONFIG;
  const candidatesX = [px, px + config.retreatStep, config.homeX, px - config.retreatStep];
  if (gem) candidatesX.push(gem.x);
  if (ally) candidatesX.push(ally.x);
  if (aim && aim.shielded && aim.x - px < config.shieldStandoff) {
    candidatesX.push(px - config.retreatStep * 1.5);
  }
  if (aim) {
    candidatesX.push(clamp(aim.x - config.engageStandoff, config.minX, config.maxX));
  }

  const aimY = aim
    ? autopilotSampleY(
        aim,
        Math.max(
          0.05,
          (aim.x - px - 1) /
            (config.bulletSpeed + Math.max(0, planeVX) - Math.min(0, aim.vx)),
        ),
      )
    : py;
  const wantGem = gem && hp < MAX_HP;
  const wantAlly = !!ally;

  let best = { x: px, y: py, cost: Infinity };

  for (const rawX of candidatesX) {
    const cx = clamp(rawX, config.minX, config.maxX);
    for (let step = -config.ySteps; step <= config.ySteps; step += 1) {
      const cy = clamp(py + step * config.yStep, config.minY, config.maxY);
      let cost = autopilotPathRisk(px, py, cx, cy, threats) * config.riskWeight;
      cost += config.travelWeight * Math.hypot((cx - px) * 0.7, cy - py);
      if (cx > config.homeX) cost += config.laneWeight * (cx - config.homeX);
      if (aim) cost += config.aimWeight * Math.min(3, Math.abs(cy - aimY));
      if (groundStones > 0) {
        const low = clamp((cy - (GROUND_Y - config.stoneLowBand)) / config.stoneLowBand, 0, 1);
        cost += config.stoneLowPenalty * low * Math.min(4, groundStones) * 0.7;
      }
      if (wantGem) {
        const d = Math.hypot(cx - gem.x, cy - gem.y);
        if (d < 2.4) cost -= config.gemReward * (1 - d / 2.4);
      }
      if (wantAlly) {
        const d = Math.hypot(cx - ally.x, cy - ally.y);
        if (d < 4) cost -= config.gemReward * 2 * (1 - d / 4);
      }
      if (cost < best.cost) best = { x: cx, y: cy, cost };
    }
  }

  return best;
}

function autopilotControls() {
  const controls = { up: false, down: false, left: false, right: false, fire: false };
  if (!plane || plane.dead) return controls;

  const config = AUTOPILOT_CONFIG;
  const position = plane.body.getPosition();
  const velocity = plane.body.getLinearVelocity();
  const px = position.x;
  const py = position.y;

  const { threats, targets, gem, ally, groundStones } = autopilotScan(px, py);
  const aim = autopilotAim(targets, px, py, velocity.x, velocity.y);
  const goal = autopilotGoal(
    px,
    py,
    threats,
    targets,
    aim,
    gem,
    ally,
    velocity.x,
    groundStones,
  );

  // 预测式回避：沿威胁未来轨迹评估最近接近距离，越近、越早发生越紧急
  let evadeX = 0;
  let evadeY = 0;
  let evadeActive = false;
  const threatStep = config.horizon / config.samples;
  const reactSamples = Math.max(
    1,
    Math.min(config.samples, Math.ceil(config.evadeReactTime / threatStep)),
  );
  for (const threat of threats) {
    const weight = threat.weight || 1;
    const future = threat.future || [];
    const radius = threat.radius || 0;
    let urgency = 0;
    let dirX = 0;
    let dirY = 0;
    for (let i = 0; i <= reactSamples && i < future.length; i += 1) {
      const point = future[i];
      const dx = px - point.x;
      const dy = py - point.y;
      const dist = Math.max(0, Math.hypot(dx, dy) - radius);
      if (dist >= config.evadeDistance) continue;
      const timeFactor = 1 - 0.6 * ((i * threatStep) / config.horizon);
      const local =
        ((config.evadeDistance - dist) / config.evadeDistance) * timeFactor * weight;
      if (local > urgency) {
        urgency = local;
        const length = Math.hypot(dx, dy);
        if (length > 0.01) {
          dirX = dx / length;
          dirY = dy / length;
        }
      }
    }
    if (urgency <= 0) continue;
    evadeX += dirX * urgency;
    evadeY += dirY * urgency;
    if (urgency > config.evadeUrgency) evadeActive = true;
  }

  // 适度的纵向追击：优先对齐射击目标高度
  const targetVy = aim
    ? clamp((aim.y - py) * 4, -4, 5)
    : clamp((goal.y - py) * 4, -4, 5);
  // 紧急回避时改用回避方向，不再朝目标高度靠拢
  const finalVy = evadeActive ? clamp(evadeY * config.evadeBoost, -7, 7) : targetVy;
  if (velocity.y < finalVy - 0.3) controls.down = true;
  else if (velocity.y > finalVy + 0.3) controls.up = true;

  // 保持交战距离：只推进到目标前方 standoff 处，绝不压到右侧边缘
  const engageX = aim
    ? clamp(aim.x - config.engageStandoff, config.minX, config.maxX)
    : goal.x;
  const cruiseVx = clamp((engageX - px) * 2.6, -3.5, 2.6);
  // 紧急回避时叠加回避速度，且禁止继续向右突进
  const finalVx = evadeActive
    ? clamp(evadeX * config.evadeBoost - config.evadeBackBias, -8, 0.8)
    : cruiseVx;
  if (velocity.x < finalVx - 0.25) controls.right = true;
  else if (velocity.x > finalVx + 0.25) controls.left = true;

  if (aim && (!evadeActive || aim.x - px <= config.closeFireRange)) {
    const dx = aim.x - px;
    const closing = config.bulletSpeed + Math.max(0, velocity.x) - Math.min(0, aim.vx);
    const flight = Math.max(0.03, (dx - 1) / closing);
    const targetY = autopilotSampleY(aim, flight);
    const bulletY = py + velocity.y * 0.25 * flight;
    const tolerance = config.fireTolerance + dx * config.fireGain;
    // 对齐后开火，容忍度适中
    if (Math.abs(targetY - bulletY) < tolerance) controls.fire = true;
  }

  return controls;
}

function toggleAutopilot() {
  autopilot = !autopilot;
  autopilotRestart = 0;
  updateHint();
  if (autopilot) {
    if (state !== "playing") startGame();
    return;
  }
  keys.clear();
  pointerDown = false;
}

function startHomingLunge(holder, point, planePosition) {
  if (holder.homingLunged) return false;
  const dx = planePosition.x - point.x;
  if (dx >= 0) return false;
  const dy = planePosition.y - point.y;
  if (Math.hypot(dx, dy) > HOMING_CONFIG.lungeDistance) return false;

  holder.homingLunged = true;
  holder.homingLungeTimer = HOMING_CONFIG.lungeDuration;
  spawnSparks(point.x, point.y);
  return true;
}

function homingDirection(holder, pointX, pointY, planePosition, speed, exactAim = false) {
  if (holder.homingMissed) {
    return { vx: holder.lastVX, vy: holder.lastVY };
  }

  const dx = planePosition.x - pointX;
  const dy = planePosition.y - pointY;

  if (dx > 0) {
    holder.homingMissed = true;
    holder.lastVX = typeof holder.homingVX === "number" ? holder.homingVX : -speed;
    holder.lastVY = typeof holder.homingVY === "number" ? holder.homingVY : 0;
    return { vx: holder.lastVX, vy: holder.lastVY };
  }

  const length = Math.hypot(dx, dy) || 1;
  const vx = exactAim ? (dx / length) * speed : -speed;
  const vy = (dy / length) * speed;
  holder.homingVX = vx;
  holder.homingVY = vy;
  return { vx, vy };
}

function snakeSteer(entity, dt) {
  const squad = entity.snakeSquad;
  if (!squad.trail) squad.trail = [];
  if (!squad.members) squad.members = [];

  let leader = null;
  for (const member of squad.members) {
    if (member.dead || member.escaped || member.puffed) continue;
    if (!leader || member.snakeIndex < leader.snakeIndex) leader = member;
  }

  const position = entity.body.getPosition();
  const minY = 0.9;
  const maxY = WORLD_H - 0.9;

  if (!leader || leader === entity) {
    squad.trail.push({ x: position.x, y: position.y });
    if (squad.trail.length > SNAKE_CONFIG.maxTrail) squad.trail.shift();

    const sway =
      Math.cos(entity.age * SNAKE_CONFIG.frequency + entity.phase) *
      SNAKE_CONFIG.amplitude *
      SNAKE_CONFIG.frequency;
    let vy = clamp(
      sway,
      -SNAKE_CONFIG.maxVerticalSpeed,
      SNAKE_CONFIG.maxVerticalSpeed,
    );
    if ((position.y <= minY && vy < 0) || (position.y >= maxY && vy > 0)) vy = 0;
    return { vx: -entity.speed, vy };
  }

  const leaderPoint = leader.body.getPosition();
  const offset = Math.max(1, entity.snakeIndex - leader.snakeIndex);
  const targetX = leaderPoint.x + SNAKE_CONFIG.gap * offset;

  // 每个气球保持匀速前进，纵向为平滑正弦波动，不急停。
  // 波动按 snakeIndex 相位偏移，首气球的波动传导到每个气球，
  // 即使中间气球被击落，后续气球仍保持各自波动，不会断档。
  const waveOffset = entity.snakeIndex * 0.9;
  const vy = clamp(
    Math.cos(entity.age * SNAKE_CONFIG.frequency + waveOffset) *
      SNAKE_CONFIG.amplitude *
      0.5,
    -SNAKE_CONFIG.maxVerticalSpeed,
    SNAKE_CONFIG.maxVerticalSpeed,
  );
  return { vx: -entity.speed, vy };
}

function stepPhysics(dt) {
  gameTime += dt;

  updateSpecialBalloons(dt);

  if (powerTimer > 0) powerTimer = Math.max(0, powerTimer - dt);
  while (score >= nextPowerScore) triggerPowerUp();

  if (plane && !plane.dead) {
    plane.invuln = Math.max(0, plane.invuln - dt);

    const mass = plane.body.getMass();
    const gravityForce = mass * GRAVITY;
    const controls = autopilot ? autopilotControls() : manualControls();
    const planePoint = plane.body.getPosition();
    plane.inGas = !!gasAt(planePoint);
    if (plane.inGas) {
      plane.gasDebuff = GAS_CONFIG.debuffDuration;
    } else {
      plane.gasDebuff = Math.max(0, plane.gasDebuff - dt);
    }
    const sluggish = plane.gasDebuff > 0;
    const clayLocked = plane.clayFall || plane.clayGrounded > 0;

    let ax = 0;
    let ay = 0;
    if (controls.right) ax += 1;
    if (controls.left) ax -= 1;
    if (controls.down) ay += 1;
    if (controls.up) ay -= 1;

    if (sluggish) {
      const blend = Math.min(1, dt / GAS_CONFIG.sluggishLag);
      plane.lagX += (ax - plane.lagX) * blend;
      plane.lagY += (ay - plane.lagY) * blend;
      ax = plane.lagX;
      ay = plane.lagY;
    } else {
      plane.lagX = ax;
      plane.lagY = ay;
    }

    if (clayLocked) ay = 0;

    // 肥皂泡粘附在机身：抵消玩家的向上操作，并提供额外浮力
    const soapStuck = plane.soapStuck || 0;
    if (soapStuck > 0 && ay < 0) ay = 0;

    const fx = ax * gravityForce * 1.5;
    const fy = ay < 0 ? ay * gravityForce * 2.6 : ay * gravityForce * 1.7;

    if (fx !== 0 || fy !== 0) {
      plane.body.applyForceToCenter(planck.Vec2(fx, fy), true);
    }

    if (soapStuck > 0) {
      const lift = Math.min(1, soapStuck / SOAP_CONFIG.maxStuck);
      plane.body.applyForceToCenter(
        planck.Vec2(0, -mass * SOAP_CONFIG.liftAccel * lift),
        true,
      );
    }

    if (inGaleWind(planePoint.x, planePoint.y)) {
      plane.body.applyForceToCenter(
        planck.Vec2(-mass * GALE_CONFIG.planeAccel, 0),
        true,
      );
    }

    fireTimer -= dt;
    if (controls.fire && fireTimer <= 0) {
      fireVolley();
      const base = plane.inGas ? GAS_CONFIG.fireInterval : 0.16;
      fireTimer = powerTimer > 0 ? base * POWER_UP_CONFIG.intervalScale : base;
    }

    clampPlane();

    if (plane.clayFall) {
      const position = plane.body.getPosition();
      if (position.y >= WORLD_H - 0.82) {
        plane.clayFall = false;
        plane.clayGrounded = CLAY_CONFIG.groundHold;
        plane.body.setGravityScale(1);
        plane.body.setLinearVelocity(
          planck.Vec2(plane.body.getLinearVelocity().x, 0),
        );
        shake = Math.max(shake, 10);
        soundClank();
        if (hintEl) hintEl.textContent = "已落地：粘土仍附着，暂时无法起飞";
      }
    } else if (plane.clayGrounded > 0) {
      plane.clayGrounded = Math.max(0, plane.clayGrounded - dt);
      if (plane.clayGrounded === 0) endClayDebuff();
    }
  }

  const commanderActive = commander && !commander.dead;
  const planePosition = plane && !plane.dead ? plane.body.getPosition() : null;
  const homing = commanderActive && planePosition;
  const homingToken = gameTime;

  for (const entity of entities) {
    if (entity.kind === "target") {
      entity.threat = computeThreat(entity, planePosition);
      entity.age += dt;
      if (entity.flash > 0) entity.flash = Math.max(0, entity.flash - dt);
      if (entity.plate && entity.plate.flash > 0) {
        entity.plate.flash = Math.max(0, entity.plate.flash - dt);
      }
      if (entity.falling) continue;
      if (entity.targetType === "commander") {
        moveCommander(entity);
        continue;
      }
      if (entity.targetType === "allyCommander") {
        const allyPosition = entity.body.getPosition();
        entity.body.setLinearVelocity(planck.Vec2(-scrollSpeed() / PPM, 0));
        if (allyPosition.x < -1.8) {
          entity.dead = true;
          if (!conversionActive) allySpawnTimer = ALLY_COMMANDER_CONFIG.delay * 0.6;
        }
        continue;
      }
      if (entity.converted) {
        const convertedPosition = entity.body.getPosition();
        entity.body.setLinearVelocity(planck.Vec2(entity.speed, 0));
        convertedIntercept(entity, convertedPosition);
        if (convertedPosition.x > WORLD_W + 1.8) retireConverted(entity);
        continue;
      }

      let vx = -entity.speed;
      let vy = Math.sin(entity.age * 3 + entity.phase) * entity.bob;

      const position = entity.body.getPosition();
      if (!entity.entered) {
        if (position.x <= WORLD_W && position.y > 0.4 && position.y < WORLD_H - 0.4) {
          entity.entered = true;
        }
      } else if (position.x < 0 || position.y < 0 || position.y > WORLD_H) {
        entity.escaped = true;
      }

      if (entity.snakeSquad && !entity.puffed) {
        const snakeVelocity = snakeSteer(entity, dt);
        vx = snakeVelocity.vx;
        vy = snakeVelocity.vy;
      } else if (entity.targetType === "galeBalloon" && !entity.puffed) {
        const region = galeRegion();

        if (!entity.wander) entity.wander = nextGalePoint();
        const toWander = Math.hypot(
          entity.wander.x - position.x,
          entity.wander.y - position.y,
        );
        if (
          toWander < GALE_CONFIG.retargetDistance ||
          position.x < region.minX ||
          position.x > region.maxX ||
          position.y < region.minY ||
          position.y > region.maxY
        ) {
          entity.wander = nextGalePoint();
        }
        const dx = entity.wander.x - position.x;
        const dy = entity.wander.y - position.y;
        const length = Math.hypot(dx, dy) || 1;
        // 补偿屏幕向左滚动，不跟随屏幕离开
        const drift = scrollSpeed() / PPM;
        vx = (dx / length) * entity.speed + drift;
        vy = (dy / length) * entity.speed + Math.sin(entity.age * 2.4 + entity.phase) * 0.3;
        // 边界约束：防止飞离屏幕
        if (position.x < region.minX + GALE_CONFIG.radius) vx = Math.max(0.2, vx);
        if (position.x > region.maxX - GALE_CONFIG.radius) vx = Math.min(-0.2, vx);
        if (position.y < region.minY + GALE_CONFIG.radius) vy = Math.max(0.2, vy);
        if (position.y > region.maxY - GALE_CONFIG.radius) vy = Math.min(-0.2, vy);
      } else if (entity.targetType === "soapBalloon" && !entity.puffed) {
        const region = soapRegion();

        if (!entity.wander) entity.wander = nextSoapPoint();
        const toWander = Math.hypot(
          entity.wander.x - position.x,
          entity.wander.y - position.y,
        );
        if (
          toWander < SOAP_CONFIG.retargetDistance ||
          position.x < region.minX ||
          position.x > region.maxX ||
          position.y < region.minY ||
          position.y > region.maxY
        ) {
          entity.wander = nextSoapPoint();
        }
        const dx = entity.wander.x - position.x;
        const dy = entity.wander.y - position.y;
        const length = Math.hypot(dx, dy) || 1;
        // 补偿屏幕向左滚动，不跟随屏幕离开
        const drift = scrollSpeed() / PPM;
        vx = (dx / length) * entity.speed + drift;
        vy = (dy / length) * entity.speed + Math.sin(entity.age * 2.4 + entity.phase) * 0.3;
        // 边界约束：防止飞离屏幕
        if (position.x < region.minX + SOAP_CONFIG.radius) vx = Math.max(0.2, vx);
        if (position.x > region.maxX - SOAP_CONFIG.radius) vx = Math.min(-0.2, vx);
        if (position.y < region.minY + SOAP_CONFIG.radius) vy = Math.max(0.2, vy);
        if (position.y > region.maxY - SOAP_CONFIG.radius) vy = Math.min(-0.2, vy);
      } else if (
        entity.targetType === "invisible" &&
        !entity.puffed &&
        !entity.escaped &&
        !entity.entering
      ) {
        const point = entity.body.getPosition();
        if (!planePosition) {
          entity.charging = false;
          entity.chargeBlend = 0;
        } else {
          const dx = planePosition.x - point.x;
          const dy = planePosition.y - point.y;
          const distance = Math.hypot(dx, dy);
          if (!entity.charging && distance <= INVISIBLE_CONFIG.attackRange) {
            entity.charging = true;
            entity.chargeBlend = 0;
            spawnSparks(point.x, point.y);
          }
          if (entity.charging && dx > 0) {
            entity.charging = false;
            entity.chargeBlend = 0;
          }
          if (entity.charging) {
            entity.chargeBlend = Math.min(
              1,
              entity.chargeBlend + dt / INVISIBLE_CONFIG.chargeRamp,
            );
            const speed =
              entity.speed *
              (1 + (INVISIBLE_CONFIG.chargeSpeedScale - 1) * entity.chargeBlend);
            const length = distance || 1;
            vx = (dx / length) * speed;
            vy = (dy / length) * speed;
          }
        }
      } else if (
        entity.targetType === "clayBalloon" &&
        !entity.puffed &&
        !entity.escaped &&
        !entity.entering
      ) {
        const point = entity.body.getPosition();
        if (!planePosition) {
          entity.charging = false;
          entity.chargeBlend = 0;
        } else {
          const dx = planePosition.x - point.x;
          const dy = planePosition.y - point.y;
          const distance = Math.hypot(dx, dy);
          if (!entity.charging && distance <= CLAY_CONFIG.attackRange) {
            entity.charging = true;
            entity.chargeBlend = 0;
            entity.flash = Math.max(entity.flash, CLAY_CONFIG.chargeFlash);
          }
          if (entity.charging && dx > 0) {
            entity.charging = false;
            entity.chargeBlend = 0;
          }
          if (entity.charging) {
            entity.chargeBlend = Math.min(
              1,
              entity.chargeBlend + dt / CLAY_CONFIG.chargeRamp,
            );
            const speed =
              entity.speed *
              (1 + (CLAY_CONFIG.chargeSpeedScale - 1) * entity.chargeBlend);
            const length = distance || 1;
            vx = (dx / length) * speed;
            vy = (dy / length) * speed;
          }
        }
      } else if (entity.homingMissed) {
        vx = entity.lastVX;
        vy = entity.lastVY;
      } else if (
        homing &&
        !entity.puffed &&
        !entity.escaped &&
        !entity.entering &&
        entity.targetType !== "gem" &&
        entity.targetType !== "invisible"
      ) {
        if (entity.targetType === "duo" && entity.duo) {
          const duo = entity.duo;
          if (duo.homingToken !== homingToken) {
            const live = duo.balloons.filter((balloon) => !balloon.dead && !balloon.escaped);
            let cx = 0;
            let cy = 0;
            if (live.length > 0) {
              for (const balloon of live) {
                const point = balloon.body.getPosition();
                cx += point.x;
                cy += point.y;
              }
              cx /= live.length;
              cy /= live.length;
            } else {
              const point = entity.body.getPosition();
              cx = point.x;
              cy = point.y;
            }
            if (duo.homingLungeTimer > 0) {
              duo.homingLungeTimer = Math.max(0, duo.homingLungeTimer - dt);
            } else if (startHomingLunge(duo, { x: cx, y: cy }, planePosition)) {
              for (const balloon of duo.balloons) {
                if (!balloon.dead) balloon.flash = Math.max(balloon.flash, HOMING_CONFIG.lungeFlash);
              }
            }
            const lunging = duo.homingLungeTimer > 0;
            const speed = lunging ? entity.speed * HOMING_CONFIG.lungeSpeedScale : entity.speed;
            const direction = homingDirection(duo, cx, cy, planePosition, speed, lunging);
            duo.homingVX = direction.vx;
            duo.homingVY = direction.vy;
            duo.homingToken = homingToken;
          }
          vx = duo.homingVX;
          vy = duo.homingVY;
        } else {
          const point = entity.body.getPosition();
          if (entity.homingLungeTimer > 0) {
            entity.homingLungeTimer = Math.max(0, entity.homingLungeTimer - dt);
          } else if (startHomingLunge(entity, point, planePosition)) {
            entity.flash = Math.max(entity.flash, HOMING_CONFIG.lungeFlash);
          }
          const lunging = entity.homingLungeTimer > 0;
          const speed = lunging ? entity.speed * HOMING_CONFIG.lungeSpeedScale : entity.speed;
          const direction = homingDirection(
            entity,
            point.x,
            point.y,
            planePosition,
            speed,
            lunging,
          );
          vx = direction.vx;
          vy = direction.vy;
        }
      }

      if (entity.entering && entity.entryWaypoint) {
        const waypoint = entity.entryWaypoint;
        const dx = waypoint.x - position.x;
        const dy = waypoint.y - position.y;
        const length = Math.hypot(dx, dy) || 1;
        if (length < 0.7) {
          entity.entering = false;
        } else {
          vx = (dx / length) * entity.speed;
          vy = (dy / length) * entity.speed;
        }
      }

      if (!entity.converted && entity.targetType !== "galeBalloon" && inGaleWind(position.x, position.y)) {
        vx -= GALE_CONFIG.balloonPush;
      }

      entity.body.setLinearVelocity(planck.Vec2(vx, vy));

      if (entity.targetType === "mine" && !entity.escaped) {
        entity.dropDistance += Math.hypot(vx, vy) * dt;
        if (entity.dropDistance >= TARGET_CONFIG.mine.dropInterval) {
          entity.dropDistance = 0;
          dropParachuteBomb(entity);
        }
      }

      const offX = entity.puffed ? -7.4 : -1.6;
      if (entity.body.getPosition().x < offX) {
        if (entity.targetType === "bomber") {
          killBomber(entity);
        } else if (entity.targetType === "duo") {
          duoBalloonDown(entity, { silent: true });
        } else {
          entity.dead = true;
        }
      }
    } else if (entity.kind === "bomb" || entity.kind === "link") {
      entity.age += dt;
      if (entity.flash > 0) entity.flash = Math.max(0, entity.flash - dt);
    } else if (entity.kind === "gas") {
      entity.age += dt;
      entity.body.setLinearVelocity(planck.Vec2(-scrollSpeed() / PPM, 0));
      if (entity.body.getPosition().x < -entity.radius - 0.5) entity.dead = true;
    } else if (entity.kind === "bullet") {
      entity.life -= dt;
      if (entity.deflectTimer > 0) {
        entity.deflectTimer = Math.max(0, entity.deflectTimer - dt);
        entity.body.setLinearVelocity(planck.Vec2(entity.deflectVX, entity.deflectVY));
      } else {
        const windPoint = entity.body.getPosition();
        if (inGaleWind(windPoint.x, windPoint.y)) {
          entity.windAffected = true;
          const velocity = entity.body.getLinearVelocity();
          const dragStep = GALE_CONFIG.bulletDrag * dt;
          const vx =
            Math.abs(velocity.x) <= dragStep
              ? 0
              : velocity.x - Math.sign(velocity.x) * dragStep;
          const vy = velocity.y + GALE_CONFIG.bulletFall * dt;
          entity.body.setLinearVelocity(planck.Vec2(vx, vy));
        }
      }
      const position = entity.body.getPosition();
      if (
        entity.life <= 0 ||
        position.x > WORLD_W + 0.8 ||
        position.x < -0.8 ||
        position.y > WORLD_H + 0.8
      )
        entity.dead = true;
      if (entity.windAffected && !entity.dead && position.y >= GROUND_Y - 0.05) {
        spawnSparks(position.x, position.y);
        entity.dead = true;
      }
    }
  }

  updatePendulums(dt);
  updateMagnets(dt);

  world.step(STEP);
  finalizeBrokenPlates();
  updateBombers();
  updateSpringBombs(dt);
  updateGasBalloonFalls();
  cleanupDead();
  updateConversionState();

  updateWaveProgress(dt);

  if (allySpawnTimer > 0) {
    allySpawnTimer -= dt;
    if (allySpawnTimer <= 0) {
      allySpawnTimer = 0;
      if (!conversionActive && (!allyCommander || allyCommander.dead)) spawnAllyCommander();
    }
  }

  trySpawnWaveGem(dt);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    if (waveScript && waveScript.mixed && !waveScript.finaleStarted) spawnTarget();
    spawnTimer = Math.max(0.55, 1.35 - wave * 0.09) + rand(-0.08, 0.12);
  }
}

function syncEntities(dt) {
  for (const entity of entities) {
    const position = entity.body.getPosition();
    const px = position.x * PPM;
    const py = position.y * PPM;

    if (entity.kind === "plane") {
      entity.age += dt;
      const velocity = entity.body.getLinearVelocity();
      const targetAngle = clamp(velocity.y * 0.07, -0.4, 0.4);
      entity.visualAngle += (targetAngle - entity.visualAngle) * Math.min(1, dt * 10);
      const blink = entity.invuln > 0 && Math.floor(entity.invuln * 10) % 2 === 0;
      entity.sprite.pin({
        offsetX: px,
        offsetY: py,
        rotation: entity.visualAngle,
        alpha: blink ? 0.35 : 1,
      });
      if (entity.gasTint) {
        entity.gasTint.pin({
          offsetX: px,
          offsetY: py,
          rotation: entity.age * 0.5,
          alpha: entity.inGas ? GAS_CONFIG.tintAlpha : 0,
        });
      }
      if (entity.powerGlow) {
        const pulse = 0.5 + 0.5 * Math.sin(entity.age * 9);
        const scale = entity.powerGlowScale * (1 + pulse * 0.12);
        entity.powerGlow.pin({
          offsetX: px,
          offsetY: py,
          rotation: -entity.age * 1.6,
          scaleX: scale,
          scaleY: scale,
          alpha: powerTimer > 0 ? 0.24 + pulse * 0.3 : 0,
        });
      }
      if (entity.clayBasket) {
        entity.clayBasketAge += dt;
        const cos = Math.cos(entity.visualAngle);
        const sin = Math.sin(entity.visualAngle);
        const offsetX = entity.clayBasketOffset.x * PPM;
        const offsetY = entity.clayBasketOffset.y * PPM;
        const wobble = Math.sin(entity.clayBasketAge * 9) * CLAY_CONFIG.blobWobble;
        entity.clayBasket.pin({
          offsetX: px + offsetX * cos - offsetY * sin,
          offsetY: py + offsetX * sin + offsetY * cos,
          rotation: entity.visualAngle + wobble * 0.6,
          scaleX: CLAY_CONFIG.blobScale * (1 + wobble),
          scaleY: CLAY_CONFIG.blobScale * (1 - wobble),
        });
      }
    } else if (entity.kind === "target") {
      const tilt = Math.sin(entity.age * 2 + entity.phase) * (entity.puffed ? 0.16 : 0.09);
      entity.tiltAngle = tilt;
      if (entity.converted && entity.convertAura) {
        const pulse = 0.5 + 0.5 * Math.sin(entity.age * 7 + entity.phase);
        const auraScale = entity.convertAuraScale * (1 + pulse * 0.14);
        entity.convertAura.pin({
          offsetX: px,
          offsetY: py,
          rotation: -entity.age * 1.2 + entity.phase,
          scaleX: auraScale,
          scaleY: auraScale,
          alpha: 0.2 + pulse * 0.32,
        });
      }
      if (entity.halo) {
        const signal = 0.5 + 0.5 * Math.sin(entity.age * 8 + entity.phase);
        const haloScale = entity.haloScale * (1 + signal * 0.16);
        entity.halo.pin({
          offsetX: px,
          offsetY: py,
          rotation: entity.age * 0.9 + entity.phase,
          scaleX: haloScale,
          scaleY: haloScale,
          alpha: 0.14 + signal * 0.46,
        });
      }
      if (entity.puffed) {
        entity.puffT += dt;
        const progress = easeOutQuart(clamp(entity.puffT / PUFF_DURATION, 0, 1));
        const scale = PUFF_START_SCALE + (1 - PUFF_START_SCALE) * progress;
        entity.sprite.pin({
          offsetX: px,
          offsetY: py,
          rotation: tilt,
          scaleX: scale,
          scaleY: scale,
          alpha: 0.55 + 0.45 * progress,
        });
      } else {
        entity.sprite.pin({
          offsetX: px,
          offsetY: py,
          rotation: tilt,
          alpha: entity.flash > 0 ? 0.35 : 1,
        });
      }
      if (entity.targetType === "galeBalloon") {
        entity.fanAngle += dt * (entity.windActive ? GALE_CONFIG.fanSpin : GALE_CONFIG.fanSpinIdle);
        const fanPxX = px + entity.fanOffsetX * PPM;
        const fanPxY = py + entity.fanOffsetY * PPM;
        if (entity.fanSprite) {
          entity.fanSprite.pin({
            offsetX: fanPxX,
            offsetY: fanPxY,
            rotation: entity.fanAngle,
            alpha: entity.flash > 0 ? 0.5 : entity.windActive ? 1 : 0.7,
          });
        }
        if (entity.windSprite) {
          const gust = 0.5 + 0.5 * Math.sin(entity.age * 7 + entity.phase);
          entity.windSprite.pin({
            offsetX: fanPxX,
            offsetY: fanPxY,
            scaleX: GALE_CONFIG.windRangeScale,
            scaleY: GALE_CONFIG.windRangeScale,
            alpha: entity.windActive ? 0.08 + gust * 0.14 : 0,
          });
        }
      }
      if (entity.plate && !entity.plate.dead) {
        entity.plate.sprite.pin({
          offsetX: px + entity.plate.offsetPxX,
          offsetY: py,
          scaleX: STEEL_PLATE_CONFIG.scale,
          scaleY: STEEL_PLATE_CONFIG.scale,
          alpha: entity.plate.flash > 0 ? 0.5 : 1,
        });
      }
    } else if (entity.kind === "pendulum") {
      entity.sprite.pin({
        offsetX: entity.pivotPxX,
        offsetY: entity.pivotPxY,
        rotation: -entity.angle,
      });
    } else if (entity.kind === "magnet") {
      const pullPulse = entity.pulling ? 1 + Math.sin(entity.pullAge * 26) * 0.1 : 1;
      entity.sprite.pin({
        offsetX: entity.pivotPxX,
        offsetY: entity.pivotPxY,
        rotation: -entity.angle,
        scaleX: pullPulse,
        scaleY: pullPulse,
        alpha: entity.flash > 0 ? 0.45 : 1,
      });
      syncMagnetDots(entity);
    } else if (entity.kind === "gas") {
      const pulse = 1 + Math.sin(entity.age * 1.7 + entity.phase) * 0.07;
      entity.sprite.pin({
        offsetX: px,
        offsetY: py,
        rotation: entity.age * 0.25 + entity.phase,
        scaleX: entity.scale * pulse,
        scaleY: entity.scale * (2 - pulse),
        alpha: entity.alpha,
      });
    } else if (entity.kind === "stone") {
      entity.sprite.pin({
        offsetX: px,
        offsetY: py,
        rotation: entity.body.getAngle(),
        scaleX: entity.scaleX,
        scaleY: entity.scaleY,
      });
    } else if (entity.kind === "barrierBalloon") {
      const tilt = Math.sin(entity.age * 1.6 + entity.phase) * 0.07;
      entity.tiltAngle = tilt;
      entity.sprite.pin({
        offsetX: px,
        offsetY: py,
        rotation: tilt,
        alpha: entity.flash > 0 ? 0.35 : 1,
      });
    } else {
      if (entity.chute) {
        const sway = Math.sin(entity.age * 2.4 + entity.phase);
        entity.chute.pin({
          offsetX: px + sway * 3,
          offsetY: py - entity.chuteOffsetPx,
          rotation: sway * 0.12,
        });
      }
      entity.sprite.pin({ offsetX: px, offsetY: py });
    }
  }
}

function syncMagnetDots(magnet) {
  const active = magnet.pulling && plane && !plane.dead;
  const dots = magnet.pullDots;

  if (!active) {
    if (magnet.dotsVisible) {
      magnet.dotsVisible = false;
      for (const dot of dots) dot.pin({ alpha: 0 });
    }
    return;
  }

  magnet.dotsVisible = true;
  const planePosition = plane.body.getPosition();
  const center = magnet.body.getPosition();
  const startX = planePosition.x * PPM;
  const startY = planePosition.y * PPM;
  const endX = center.x * PPM;
  const endY = center.y * PPM;
  const count = dots.length;

  for (let i = 0; i < count; i += 1) {
    const flow = (i / count + magnet.pullAge * 0.9) % 1;
    const pulse = 0.5 + 0.5 * Math.sin(magnet.pullAge * 20 - i * 1.1);
    const fade = Math.sin(Math.PI * flow);
    const scale = 2.6 + pulse * 1.8;
    dots[i].pin({
      offsetX: startX + (endX - startX) * flow,
      offsetY: startY + (endY - startY) * flow,
      scaleX: scale,
      scaleY: scale,
      alpha: 0.12 + fade * (0.35 + pulse * 0.55),
    });
  }
}


function scrollSpeed() {
  return state === "playing" ? 86 + wave * 2 : 28;
}



function updateShake(dt) {
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 42);
  }
  const offsetX = shake > 0 ? rand(-shake, shake) : 0;
  const offsetY = shake > 0 ? rand(-shake, shake) : 0;
  shakeOffsetX = offsetX;
  shakeOffsetY = offsetY;
  gameLayer.pin({ offsetX, offsetY });
  fogLayer.pin({ offsetX, offsetY });
}



function cleanupAll() {
  if (plane && plane.clayBasket) {
    plane.clayBasket.remove();
    plane.clayBasket = null;
  }
  for (const entity of entities) {
    entity.sprite.remove();
    if (entity.chute) entity.chute.remove();
    if (entity.gasTint) entity.gasTint.remove();
    if (entity.halo) entity.halo.remove();
    if (entity.fanSprite) entity.fanSprite.remove();
    if (entity.windSprite) entity.windSprite.remove();
    if (entity.convertAura) entity.convertAura.remove();
    if (entity.plate && !entity.plate.dead) entity.plate.sprite.remove();
    if (entity.pullDots) {
      for (const dot of entity.pullDots) dot.remove();
    }
  }
  clearParticles();
  entities = [];
  stones = [];
  barrierBalloon = null;
  galeBalloon = null;
  soapBalloon = null;
  clearSoapBubbles();
  specialBalloonWave = 0;
  plane = null;
  commander = null;
  allyCommander = null;
  allySpawnTimer = 0;
  conversionActive = false;
}

function startGame() {
  ensureAudio();
  cleanupAll();
  newWorld();

  score = 0;
  hp = MAX_HP;
  wave = 1;
  gameTime = 0;
  spawnTimer = 1.0;
  beginWave(1);
  ambientSquadIndex = 0;
  fireTimer = 0;
  powerTimer = 0;
  nextPowerScore = POWER_UP_CONFIG.scoreStep;
  accumulator = 0;
  shake = 0;
  autopilotRestart = 0;
  allySpawnTimer = 0;
  conversionActive = false;
  barrierBalloon = null;
  galeBalloon = null;
  soapBalloon = null;
  clearSoapBubbles();
  specialBalloonWave = 0;
  plane = null;
  stones = [];

  plane = createPlane();
  state = "playing";
  // 第一波立即生成一个随机特殊气球
  if (!specialBalloonAlive() && wave >= SPECIAL_BALLOON_CONFIG.minWave) {
    const spawned = spawnSpecialBalloon();
    if (spawned) specialBalloonWave = wave;
  }
  hideOverlay();
  updateHint();
  updateHud();
}

function endGame() {
  state = "over";
  if (plane) plane.invuln = 0;
  if (score > best) {
    best = score;
    saveBest(best);
  }
  updateHud();
  showOverlay("GAME OVER", `本次得分 ${score} · 最高纪录 ${best}`, "再来一次");
  soundGameOver();
}

gameLayer.tick((elapsed) => {
  const dt = Math.min(elapsed, 100) / 1000;

  if (autopilot) {
    if (state === "over") {
      autopilotRestart += dt;
      if (autopilotRestart >= AUTOPILOT_RESTART_DELAY) startGame();
    } else if (state === "playing") {
      autopilotRestart = 0;
    }
  }

  updateScroll(dt, scrollSpeed());

  if (state === "playing") {
    accumulator = Math.min(accumulator + dt, 0.2);
    let steps = 0;
    while (accumulator >= STEP && state === "playing" && steps < MAX_STEPS_PER_FRAME) {
      stepPhysics(STEP);
      accumulator -= STEP;
      steps += 1;
    }
    // 单帧物理步数封顶，避免卡顿时的追帧雪崩
    if (accumulator >= STEP) accumulator = 0;
    syncEntities(dt);
  } else {
    syncEntities(dt);
  }

  updateParticles(dt);
  updateShake(dt);
  drawInvisibleLenses(entities, shakeOffsetX, shakeOffsetY);
  updateHud();
  return true;
}, true);

const PREVENT_DEFAULT = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

window.addEventListener("keydown", (event) => {
  if (PREVENT_DEFAULT.has(event.code)) event.preventDefault();

  if (event.code === "KeyP") {
    event.preventDefault();
    if (!event.repeat) toggleAutopilot();
    return;
  }

  if (state !== "playing") {
    if (event.code === "Enter" || event.code === "Space" || event.code === "KeyR") {
      event.preventDefault();
      startGame();
      return;
    }
  } else if (event.code === "KeyR") {
    startGame();
    return;
  }

  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => {
  keys.clear();
  pointerDown = false;
});

appEl.addEventListener("pointerdown", () => {
  if (state === "playing") {
    ensureAudio();
    pointerDown = true;
  }
});

window.addEventListener("pointerup", () => {
  pointerDown = false;
});
window.addEventListener("pointercancel", () => {
  pointerDown = false;
});

actionBtn.addEventListener("click", () => {
  startGame();
});

newWorld();
plane = createPlane();
syncEntities(0);
updateHud();
updateHint();