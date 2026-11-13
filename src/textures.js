import { VIEW_W, VIEW_H, PLANE_COLORS, BALLOON_COLORS, GAS_BALLOON_COLORS, CLAY_BALLOON_COLORS, SPRING_BALLOON_COLORS, SPRING_BOMB_COLORS, PENDULUM_BALLOON_COLORS, PENDULUM_COLORS, MAGNET_BALLOON_COLORS, MAGNET_COLORS, WHITE_BALLOON_COLORS, GEM_COLORS, BULLET_COLORS, POWER_BULLET_COLORS, CLOUD_COLORS, BOMBER_COLORS, BOMB_COLORS, DUO_BALLOON_COLORS, COMMANDER_BALLOON_COLORS, ALLY_COMMANDER_BALLOON_COLORS, COMMANDER_HALO_PALETTE, ALLY_HALO_PALETTE, CONVERTED_TINT, CONVERTED_GLOW, POWER_HALO_PALETTE, MINE_BALLOON_COLORS, STEEL_BALLOON_COLORS, GALE_BALLOON_COLORS, GALE_FAN_COLORS, SOAP_BALLOON_COLORS, STEEL_PLATE_COLORS, PARACHUTE_COLORS, PLANE_ROWS, BALLOON_ROWS, STEEL_BALLOON_ROWS, COMMANDER_ROWS, WHITE_BALLOON_ROWS, GEM_ROWS, BULLET_ROWS, CLOUD_ROWS, BOMB_ROWS, PARACHUTE_ROWS, BOMBER_ROWS, BARRIER_ROWS, BARRIER_COLORS, STONE_ROWS, STONE_COLORS } from "./config.js";
const Stage = window.Stage;

function makeTexture(rows, colors, scale = 3) {
  const cols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const canvas = document.createElement("canvas");
  canvas.width = cols * scale;
  canvas.height = rows.length * scale;
  const ctx = canvas.getContext("2d");

  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    for (let x = 0; x < row.length; x += 1) {
      const color = colors[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  return new Stage.ImageTexture(canvas);
}

const convertedTextureCache = new WeakMap();

function convertedSpriteTexture(texture) {
  if (!texture || !texture._source) return texture;
  const cached = convertedTextureCache.get(texture);
  if (cached) return cached;

  const source = texture._source;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = CONVERTED_TINT;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = CONVERTED_GLOW;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";

  const tinted = new Stage.ImageTexture(canvas);
  convertedTextureCache.set(texture, tinted);
  return tinted;
}

function solidTexture(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 4, 4);
  return new Stage.ImageTexture(canvas);
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mixColor(from, to, t) {
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ];
}

function drawPixelDisc(ctx, cx, cy, radius, color, cell) {
  ctx.fillStyle = color;
  const startX = Math.floor((cx - radius) / cell) * cell;
  const startY = Math.floor((cy - radius) / cell) * cell;
  for (let x = startX; x <= cx + radius; x += cell) {
    for (let y = startY; y <= cy + radius; y += cell) {
      const dx = x + cell / 2 - cx;
      const dy = y + cell / 2 - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        ctx.fillRect(x, y, cell, cell);
      }
    }
  }
}

function makeSmokeTexture() {
  const size = 600;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const random = mulberry32(882211);

  const puffs = [{ x: 0.5, y: 0.5, r: 0.27 }];
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2 + random() * 0.4;
    const dist = 0.11 + random() * 0.1;
    puffs.push({
      x: 0.5 + Math.cos(angle) * dist,
      y: 0.5 + Math.sin(angle) * dist * 0.9,
      r: 0.14 + random() * 0.09,
    });
  }

  const layers = [
    { color: "rgba(190,206,228,0.42)", scale: 1.0 },
    { color: "rgba(214,226,242,0.62)", scale: 0.9 },
    { color: "rgba(233,241,252,0.84)", scale: 0.78 },
    { color: "rgba(248,251,255,0.94)", scale: 0.62 },
    { color: "rgba(255,255,255,1)", scale: 0.44 },
  ];

  const cell = 10;
  for (const layer of layers) {
    for (const puff of puffs) {
      drawPixelDisc(
        ctx,
        puff.x * size,
        puff.y * size,
        puff.r * size * layer.scale,
        layer.color,
        cell,
      );
    }
  }

  return new Stage.ImageTexture(canvas);
}

function makeGasTexture() {
  const size = 240;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const random = mulberry32(604731);
  const center = size / 2;

  const lobes = [{ x: center, y: center, r: size * 0.3 }];
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2 + random() * 0.6;
    const dist = size * (0.08 + random() * 0.13);
    lobes.push({
      x: center + Math.cos(angle) * dist,
      y: center + Math.sin(angle) * dist * 0.88,
      r: size * (0.12 + random() * 0.12),
    });
  }

  const layers = [
    { color: "rgba(104,52,196,0.30)", scale: 1.0 },
    { color: "rgba(138,76,232,0.34)", scale: 0.9 },
    { color: "rgba(172,110,255,0.36)", scale: 0.76 },
    { color: "rgba(210,168,255,0.34)", scale: 0.6 },
  ];

  const cell = 8;
  for (const layer of layers) {
    for (const lobe of lobes) {
      drawPixelDisc(ctx, lobe.x, lobe.y, lobe.r * layer.scale, layer.color, cell);
    }
  }

  for (let i = 0; i < 28; i += 1) {
    const angle = random() * Math.PI * 2;
    const dist = random() * size * 0.28;
    const radius = size * (0.02 + random() * 0.03);
    drawPixelDisc(
      ctx,
      center + Math.cos(angle) * dist,
      center + Math.sin(angle) * dist,
      radius,
      "rgba(232,208,255,0.42)",
      cell,
    );
  }

  return new Stage.ImageTexture(canvas);
}

function makeClayBlobTexture() {
  const size = 84;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const random = mulberry32(317429);
  const center = size / 2;

  const lobes = [{ x: center, y: center, r: size * 0.25 }];
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2 + random() * 0.8;
    const dist = size * (0.09 + random() * 0.13);
    lobes.push({
      x: center + Math.cos(angle) * dist,
      y: center + Math.sin(angle) * dist,
      r: size * (0.08 + random() * 0.12),
    });
  }

  const layers = [
    { color: "#5c3a20", scale: 1.0, dx: 0, dy: 0 },
    { color: "#a86a3c", scale: 0.9, dx: 0, dy: 0 },
    { color: "#c98b5e", scale: 0.78, dx: 0, dy: 0 },
    { color: "#ecd3b3", scale: 0.42, dx: -size * 0.045, dy: -size * 0.06 },
  ];

  const cell = 2;
  for (const layer of layers) {
    for (const lobe of lobes) {
      drawPixelDisc(
        ctx,
        lobe.x + layer.dx,
        lobe.y + layer.dy,
        lobe.r * layer.scale,
        layer.color,
        cell,
      );
    }
  }

  for (let i = 0; i < 14; i += 1) {
    const angle = random() * Math.PI * 2;
    const dist = random() * size * 0.2;
    const radius = size * (0.015 + random() * 0.025);
    drawPixelDisc(
      ctx,
      center + Math.cos(angle) * dist,
      center + Math.sin(angle) * dist,
      radius,
      "rgba(92,58,32,0.55)",
      cell,
    );
  }

  return new Stage.ImageTexture(canvas);
}

function makeCommanderHaloTexture(palette = COMMANDER_HALO_PALETTE) {
  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const center = size / 2;
  const cell = 4;

  drawPixelDisc(ctx, center, center, 72, palette[0], cell);
  drawPixelDisc(ctx, center, center, 58, palette[1], cell);
  drawPixelDisc(ctx, center, center, 44, palette[2], cell);
  drawPixelDisc(ctx, center, center, 30, palette[3], cell);

  const outerDots = 26;
  for (let i = 0; i < outerDots; i += 1) {
    if (i % 3 === 0) continue;
    const angle = (i / outerDots) * Math.PI * 2;
    drawPixelDisc(
      ctx,
      center + Math.cos(angle) * 66,
      center + Math.sin(angle) * 66,
      4,
      palette[4],
      cell,
    );
  }

  const innerDots = 16;
  for (let i = 0; i < innerDots; i += 1) {
    if (i % 2 !== 0) continue;
    const angle = (i / innerDots) * Math.PI * 2;
    drawPixelDisc(
      ctx,
      center + Math.cos(angle) * 48,
      center + Math.sin(angle) * 48,
      3.5,
      palette[5],
      cell,
    );
  }

  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2;
    for (let distance = 46; distance <= 72; distance += 9) {
      drawPixelDisc(
        ctx,
        center + Math.cos(angle) * distance,
        center + Math.sin(angle) * distance,
        3.5,
        palette[6],
        cell,
      );
    }
  }

  return new Stage.ImageTexture(canvas);
}

const PENDULUM_TEX = {
  width: 100,
  height: 66,
  pivotX: 50,
  pivotY: 8,
  armLength: 36,
  arcRadius: 16,
  arcThickness: 7,
  arcHalfSpan: (32 * Math.PI) / 180,
  cell: 2,
};

function makePendulumTexture() {
  const { width, height, pivotX, pivotY, armLength, arcRadius, arcThickness, arcHalfSpan, cell } =
    PENDULUM_TEX;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const arcCenterY = pivotY + armLength;

  ctx.fillStyle = PENDULUM_COLORS.k;
  ctx.fillRect(pivotX - 5, pivotY - 2, 10, armLength + 5);
  ctx.fillStyle = PENDULUM_COLORS.s;
  ctx.fillRect(pivotX - 3, pivotY, 6, armLength);

  const steps = 14;
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = -arcHalfSpan + (i / steps) * arcHalfSpan * 2;
    points.push({
      x: pivotX + Math.sin(angle) * arcRadius,
      y: arcCenterY + Math.cos(angle) * arcRadius,
    });
  }

  for (const point of points) {
    drawPixelDisc(ctx, point.x, point.y, arcThickness / 2 + 1.8, PENDULUM_COLORS.k, cell);
  }
  for (const point of points) {
    drawPixelDisc(ctx, point.x, point.y, arcThickness / 2 + 0.2, PENDULUM_COLORS.s, cell);
  }
  for (const point of points) {
    drawPixelDisc(ctx, point.x, point.y - 1.4, 1.3, PENDULUM_COLORS.w, cell);
  }

  drawPixelDisc(ctx, pivotX, pivotY, 4, PENDULUM_COLORS.k, cell);
  drawPixelDisc(ctx, pivotX, pivotY, 2.4, PENDULUM_COLORS.y, cell);

  return new Stage.ImageTexture(canvas);
}

const MAGNET_TEX = {
  width: 100,
  height: 78,
  pivotX: 50,
  pivotY: 8,
  armLength: 40,
  halfWidth: 12,
  baseThickness: 6,
  prongLength: 18,
  prongThickness: 6,
  cell: 2,
};

function makeMagnetTexture() {
  const {
    width,
    height,
    pivotX,
    pivotY,
    armLength,
    halfWidth,
    baseThickness,
    prongLength,
    prongThickness,
    cell,
  } = MAGNET_TEX;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const baseTop = pivotY + armLength;
  const left = pivotX - halfWidth;
  const right = pivotX + halfWidth;
  const prongBottom = baseTop + prongLength;

  ctx.fillStyle = MAGNET_COLORS.k;
  ctx.fillRect(pivotX - 5, pivotY - 2, 10, armLength + 5);
  ctx.fillStyle = MAGNET_COLORS.s;
  ctx.fillRect(pivotX - 3, pivotY, 6, armLength);

  ctx.fillStyle = MAGNET_COLORS.k;
  ctx.fillRect(left - 2, baseTop - 2, halfWidth * 2 + 4, baseThickness + 2);
  ctx.fillRect(left - 2, baseTop, prongThickness + 2, prongLength + 2);
  ctx.fillRect(right - prongThickness, baseTop, prongThickness + 2, prongLength + 2);

  ctx.fillStyle = MAGNET_COLORS.d;
  ctx.fillRect(left, baseTop, halfWidth * 2, baseThickness);

  ctx.fillStyle = MAGNET_COLORS.r;
  ctx.fillRect(left, baseTop, prongThickness, prongLength);
  ctx.fillStyle = MAGNET_COLORS.b;
  ctx.fillRect(right - prongThickness, baseTop, prongThickness, prongLength);

  ctx.fillStyle = MAGNET_COLORS.w;
  ctx.fillRect(left, baseTop, 2, prongLength);
  ctx.fillRect(right - prongThickness, baseTop, 2, prongLength);

  drawPixelDisc(ctx, left + prongThickness / 2, prongBottom, 3.4, "rgba(255,120,150,0.55)", cell);
  drawPixelDisc(ctx, right - prongThickness / 2, prongBottom, 3.4, "rgba(120,160,255,0.55)", cell);

  drawPixelDisc(ctx, pivotX, pivotY, 4, MAGNET_COLORS.k, cell);
  drawPixelDisc(ctx, pivotX, pivotY, 2.4, MAGNET_COLORS.y, cell);

  return new Stage.ImageTexture(canvas);
}

const GALE_FAN_TEX = {
  size: 64,
  radius: 29,
  blades: 6,
  hub: 9,
  cell: 2,
};

function makeGaleFanTexture() {
  const { size, radius, blades, hub, cell } = GALE_FAN_TEX;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < blades; i += 1) {
    ctx.save();
    ctx.rotate((i / blades) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(-13, -radius + 2);
    ctx.lineTo(-4, -radius);
    ctx.lineTo(9, -radius + 7);
    ctx.lineTo(7, -12);
    ctx.closePath();
    ctx.fillStyle = GALE_FAN_COLORS.m;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = GALE_FAN_COLORS.k;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = GALE_FAN_COLORS.k;
  ctx.stroke();

  drawPixelDisc(ctx, cx, cy, hub + 3, GALE_FAN_COLORS.k, cell);
  drawPixelDisc(ctx, cx, cy, hub, GALE_FAN_COLORS.l, cell);
  drawPixelDisc(ctx, cx, cy, hub - 3.5, GALE_FAN_COLORS.a, cell);

  return new Stage.ImageTexture(canvas);
}

const GALE_WIND_TEX = {
  width: 480,
  height: 640,
  apexX: 480,
  apexY: 320,
};

function makeGaleWindTexture() {
  const { width, height, apexX, apexY } = GALE_WIND_TEX;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(apexX, apexY, 12, apexX, apexY, width);
  gradient.addColorStop(0, "rgba(126,249,255,0.34)");
  gradient.addColorStop(0.45, "rgba(126,249,255,0.14)");
  gradient.addColorStop(1, "rgba(126,249,255,0)");

  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(0, 0);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.strokeStyle = "rgba(191,240,255,0.32)";
  ctx.lineWidth = 3;
  for (let i = 1; i <= 5; i += 1) {
    const t = i / 6;
    const half = (height / 2) * t;
    ctx.beginPath();
    ctx.moveTo(apexX - width * t, apexY - half);
    ctx.lineTo(apexX - width * t, apexY + half);
    ctx.stroke();
  }

  return new Stage.ImageTexture(canvas);
}

const SOAP_BUBBLE_TEX = {
  size: 48,
};

function makeSoapBubbleTexture() {
  const { size } = SOAP_BUBBLE_TEX;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 1.5;

  const body = ctx.createRadialGradient(
    cx - radius * 0.3,
    cy - radius * 0.32,
    radius * 0.12,
    cx,
    cy,
    radius,
  );
  body.addColorStop(0, "rgba(234,254,255,0.10)");
  body.addColorStop(0.6, "rgba(200,240,255,0.20)");
  body.addColorStop(0.86, "rgba(160,220,255,0.40)");
  body.addColorStop(1, "rgba(127,216,245,0.30)");

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  const rim = ctx.createLinearGradient(0, 0, size, size);
  rim.addColorStop(0, "rgba(255,190,230,0.55)");
  rim.addColorStop(0.35, "rgba(255,240,180,0.45)");
  rim.addColorStop(0.7, "rgba(170,255,220,0.50)");
  rim.addColorStop(1, "rgba(150,200,255,0.55)");

  ctx.beginPath();
  ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = rim;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(
    cx - radius * 0.34,
    cy - radius * 0.36,
    radius * 0.30,
    radius * 0.20,
    -0.7,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx + radius * 0.32, cy + radius * 0.30, radius * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fill();

  return new Stage.ImageTexture(canvas);
}

const SPRING_BOMB_TEX = {
  width: 36,
  height: 48,
  bombCenterY: 15,
  bombRadius: 12,
  springWidth: 16,
  springTop: 28,
  springBottom: 46,
  coils: 3,
  cell: 2,
};

function makeSpringBombTexture() {
  const {
    width,
    height,
    bombCenterY,
    bombRadius,
    springWidth,
    springTop,
    springBottom,
    coils,
    cell,
  } = SPRING_BOMB_TEX;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const cx = width / 2;
  const cy = bombCenterY;
  const springLeft = cx - springWidth / 2;
  const springRight = cx + springWidth / 2;
  const segments = coils * 2;
  const span = springBottom - springTop;
  const points = [{ x: cx, y: springTop }];
  for (let i = 1; i <= segments; i += 1) {
    points.push({
      x: i % 2 === 0 ? springRight : springLeft,
      y: springTop + (span * i) / (segments + 1),
    });
  }
  points.push({ x: cx, y: springBottom });

  const strokeSpring = (lineWidth, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  };

  strokeSpring(7, SPRING_BOMB_COLORS.k);
  strokeSpring(4, SPRING_BOMB_COLORS.s);
  strokeSpring(1.5, SPRING_BOMB_COLORS.w);

  ctx.fillStyle = SPRING_BOMB_COLORS.k;
  ctx.fillRect(cx - 2, 0, 4, 8);
  ctx.fillStyle = SPRING_BOMB_COLORS.y;
  ctx.fillRect(cx - 1, 0, 2, 5);

  drawPixelDisc(ctx, cx, cy, bombRadius + 1.5, SPRING_BOMB_COLORS.k, cell);
  drawPixelDisc(ctx, cx, cy, bombRadius, SPRING_BOMB_COLORS.d, cell);
  drawPixelDisc(ctx, cx - 4, cy - 4, 3.5, SPRING_BOMB_COLORS.w, cell);
  drawPixelDisc(ctx, cx + 5, cy + 5, 2, "rgba(255,255,255,0.18)", cell);

  return new Stage.ImageTexture(canvas);
}

const BARRIER_TEXTURE = makeTexture(BARRIER_ROWS, BARRIER_COLORS, 3);

const stoneTexture = makeTexture(STONE_ROWS, STONE_COLORS, 2);

const STEEL_PLATE_TEX = {
  width: 48,
  height: 132,
  scale: 0.4,
};

function drawMetalBar(ctx, x1, y1, x2, y2, thickness) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const half = length / 2;
  const t = thickness / 2;

  ctx.save();
  ctx.translate(midX, midY);
  ctx.rotate(angle);

  ctx.fillStyle = STEEL_PLATE_COLORS.edge;
  ctx.fillRect(-half - 1, -t - 1, length + 2, thickness + 2);

  const grad = ctx.createLinearGradient(0, -t, 0, t);
  grad.addColorStop(0, STEEL_PLATE_COLORS.dark);
  grad.addColorStop(0.24, STEEL_PLATE_COLORS.mid);
  grad.addColorStop(0.5, STEEL_PLATE_COLORS.light);
  grad.addColorStop(0.74, STEEL_PLATE_COLORS.mid);
  grad.addColorStop(1, STEEL_PLATE_COLORS.dark);
  ctx.fillStyle = grad;
  ctx.fillRect(-half, -t, length, thickness);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(-half + 1, -t * 0.42, length - 2, Math.max(1, thickness * 0.12));

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(-half + 1, t * 0.18, length - 2, Math.max(1, thickness * 0.1));

  ctx.restore();
}

function makeSteelPlateTexture() {
  const { width, height } = STEEL_PLATE_TEX;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const midY = height / 2;

  const upperDir = { x: width, y: 2 - midY };
  const upperLen = Math.hypot(upperDir.x, upperDir.y);
  const upperNorm = { x: -upperDir.y / upperLen, y: upperDir.x / upperLen };

  drawMetalBar(ctx, 0, midY, width, 2, 12);
  drawMetalBar(ctx, 0, midY, width, height - 2, 12);

  drawMetalBar(
    ctx,
    0 + upperNorm.x * 5,
    midY + upperNorm.y * 5,
    width + upperNorm.x * 5,
    2 + upperNorm.y * 5,
    7,
  );
  drawMetalBar(
    ctx,
    0 + upperNorm.x * 5,
    midY - upperNorm.y * 5,
    width + upperNorm.x * 5,
    height - 2 - upperNorm.y * 5,
    7,
  );

  drawPixelDisc(ctx, 2, midY, 3, STEEL_PLATE_COLORS.edge, 1);
  drawPixelDisc(ctx, 2, midY, 2, STEEL_PLATE_COLORS.rivet, 1);
  drawPixelDisc(ctx, width - 3, 3, 3, STEEL_PLATE_COLORS.edge, 1);
  drawPixelDisc(ctx, width - 3, 3, 2, STEEL_PLATE_COLORS.rivet, 1);
  drawPixelDisc(ctx, width - 3, height - 3, 3, STEEL_PLATE_COLORS.edge, 1);
  drawPixelDisc(ctx, width - 3, height - 3, 2, STEEL_PLATE_COLORS.rivet, 1);

  return new Stage.ImageTexture(canvas);
}

function makeSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext("2d");

  const top = [8, 14, 38];
  const mid = [28, 62, 122];
  const low = [86, 142, 196];
  for (let y = 0; y < VIEW_H; y += 6) {
    const t = y / VIEW_H;
    const color = t < 0.6 ? mixColor(top, mid, t / 0.6) : mixColor(mid, low, (t - 0.6) / 0.4);
    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.fillRect(0, y, VIEW_W, 6);
  }

  drawPixelDisc(ctx, 806, 118, 60, "rgba(255,209,102,0.10)", 8);
  drawPixelDisc(ctx, 806, 118, 44, "rgba(255,209,102,0.85)", 8);
  drawPixelDisc(ctx, 806, 118, 34, "#ffe9a8", 8);

  for (let i = 0; i < 6; i += 1) {
    ctx.fillStyle = `rgba(255,196,128,${0.05 - i * 0.007})`;
    ctx.fillRect(0, VIEW_H - 36 + i * 6, VIEW_W, 6);
  }

  return new Stage.ImageTexture(canvas);
}

const STAR_BAND_H = 340;

function makeStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = VIEW_W;
  canvas.height = STAR_BAND_H;
  const ctx = canvas.getContext("2d");
  const random = mulberry32(20261029);

  for (let i = 0; i < 150; i += 1) {
    const size = random() < 0.16 ? 4 : 2;
    const x = Math.floor((random() * VIEW_W) / size) * size;
    const y = Math.floor((random() * STAR_BAND_H) / size) * size;
    ctx.fillStyle = random() < 0.55 ? "rgba(255,255,255,0.85)" : "rgba(160,200,255,0.6)";
    ctx.fillRect(x, y, size, size);
  }

  return new Stage.ImageTexture(canvas);
}

function makeCityTexture({
  height,
  seed,
  baseColor,
  topColor,
  windowColor,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
  litChance,
  antennaChance,
  haze,
}) {
  const canvas = document.createElement("canvas");
  canvas.width = VIEW_W;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const random = mulberry32(seed);

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, height - 5, VIEW_W, 5);

  let x = 4;
  while (x < VIEW_W) {
    const bw = Math.floor(minWidth + random() * (maxWidth - minWidth));
    const bh = Math.floor(minHeight + random() * (maxHeight - minHeight));
    const top = height - bh;

    const grad = ctx.createLinearGradient(0, top, 0, height);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, baseColor);
    ctx.fillStyle = grad;
    ctx.fillRect(x, top, bw, bh);

    for (let wy = top + 7; wy < height - 8; wy += 8) {
      for (let wx = x + 5; wx < x + bw - 5; wx += 8) {
        if (random() < litChance) {
          ctx.fillStyle = windowColor;
          ctx.fillRect(wx, wy, 3, 3);
        }
      }
    }

    if (random() < antennaChance) {
      ctx.fillStyle = topColor;
      const ax = x + Math.floor(bw / 2);
      ctx.fillRect(ax, Math.max(0, top - 12), 2, 12);
      ctx.fillRect(ax - 2, Math.max(0, top - 12), 6, 2);
    }

    x += bw + Math.floor(4 + random() * 9);
  }

  if (haze > 0) {
    const fade = ctx.createLinearGradient(0, 0, 0, height);
    fade.addColorStop(0, `rgba(0,0,0,${haze})`);
    fade.addColorStop(0.55, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, VIEW_W, height);
    ctx.globalCompositeOperation = "source-over";
  }

  return new Stage.ImageTexture(canvas);
}

const planeTexture = makeTexture(PLANE_ROWS, PLANE_COLORS, 3);
const balloonTexture = makeTexture(BALLOON_ROWS, BALLOON_COLORS, 3);
const clayBalloonTexture = makeTexture(BALLOON_ROWS, CLAY_BALLOON_COLORS, 3);
const clayBlobTexture = makeClayBlobTexture();
const gasBalloonTexture = makeTexture(BALLOON_ROWS, GAS_BALLOON_COLORS, 3);
const whiteBalloonTexture = makeTexture(WHITE_BALLOON_ROWS, WHITE_BALLOON_COLORS, 3);
const smokeTexture = makeSmokeTexture();
const gemTexture = makeTexture(GEM_ROWS, GEM_COLORS, 3);
const bulletTexture = makeTexture(BULLET_ROWS, BULLET_COLORS, 3);
const powerBulletTexture = makeTexture(BULLET_ROWS, POWER_BULLET_COLORS, 3);
const cloudTexture = makeTexture(CLOUD_ROWS, CLOUD_COLORS, 4);
const bomberTexture = makeTexture(BOMBER_ROWS, BOMBER_COLORS, 2);
const duoBalloonTexture = makeTexture(BALLOON_ROWS, DUO_BALLOON_COLORS, 3);
const commanderBalloonTexture = makeTexture(COMMANDER_ROWS, COMMANDER_BALLOON_COLORS, 3);
const allyCommanderBalloonTexture = makeTexture(
  COMMANDER_ROWS,
  ALLY_COMMANDER_BALLOON_COLORS,
  3,
);
const bombTexture = makeTexture(BOMB_ROWS, BOMB_COLORS, 2);
const parachuteTexture = makeTexture(PARACHUTE_ROWS, PARACHUTE_COLORS, 3);
const mineBalloonTexture = makeTexture(BALLOON_ROWS, MINE_BALLOON_COLORS, 3);
const pendulumBalloonTexture = makeTexture(BALLOON_ROWS, PENDULUM_BALLOON_COLORS, 3);
const pendulumTexture = makePendulumTexture();
const magnetBalloonTexture = makeTexture(BALLOON_ROWS, MAGNET_BALLOON_COLORS, 3);
const magnetTexture = makeMagnetTexture();
const springBalloonTexture = makeTexture(BALLOON_ROWS, SPRING_BALLOON_COLORS, 3);
const springBombTexture = makeSpringBombTexture();
const steelBalloonTexture = makeTexture(STEEL_BALLOON_ROWS, STEEL_BALLOON_COLORS, 3);
const steelPlateTexture = makeSteelPlateTexture();
const galeBalloonTexture = makeTexture(BALLOON_ROWS, GALE_BALLOON_COLORS, 3);
const soapBalloonTexture = makeTexture(BALLOON_ROWS, SOAP_BALLOON_COLORS, 3);
const soapBubbleTexture = makeSoapBubbleTexture();
const galeFanTexture = makeGaleFanTexture();
const galeWindTexture = makeGaleWindTexture();
const gasTexture = makeGasTexture();
const commanderHaloTexture = makeCommanderHaloTexture();
const allyHaloTexture = makeCommanderHaloTexture(ALLY_HALO_PALETTE);
const powerHaloTexture = makeCommanderHaloTexture(POWER_HALO_PALETTE);

function makeBalloonSilhouette(rows, scale) {
  const cols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const width = cols * scale;
  const height = rows.length * scale;
  const alpha = new Uint8Array(width * height);
  const cells = [];
  const edgeCells = [];
  const highlightCells = [];

  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    for (let x = 0; x < row.length; x += 1) {
      const key = row[x];
      if (key === "." || key === " ") continue;
      cells.push({ x, y });
      if (key === "l") highlightCells.push({ x, y });
      for (let py = 0; py < scale; py += 1) {
        for (let px = 0; px < scale; px += 1) {
          alpha[(y * scale + py) * width + x * scale + px] = 1;
        }
      }
    }
  }

  for (const cell of cells) {
    const neighbors = [
      { x: cell.x + 1, y: cell.y },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 },
      { x: cell.x, y: cell.y - 1 },
    ];
    const edge = neighbors.some((neighbor) => {
      const row = rows[neighbor.y];
      if (!row) return true;
      const key = row[neighbor.x];
      return key === undefined || key === "." || key === " ";
    });
    if (edge) edgeCells.push(cell);
  }

  const distance = new Uint8Array(width * height);
  const queue = [];
  for (let index = 0; index < alpha.length; index += 1) {
    if (alpha[index] === 0) {
      distance[index] = 0;
      queue.push(index);
    } else {
      distance[index] = 255;
    }
  }

  let head = 0;
  while (head < queue.length) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = (index - x) / width;
    const next = distance[index] + 1;
    const steps = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];
    for (const step of steps) {
      if (step.x < 0 || step.x >= width || step.y < 0 || step.y >= height) continue;
      const nextIndex = step.y * width + step.x;
      if (distance[nextIndex] <= next) continue;
      distance[nextIndex] = next;
      queue.push(nextIndex);
    }
  }

  return { width, height, scale, alpha, edgeCells, highlightCells, distance };
}

const invisibleSilhouette = makeBalloonSilhouette(BALLOON_ROWS, 3);

const dotTextures = new Map();
function dotTexture(color) {
  if (!dotTextures.has(color)) dotTextures.set(color, solidTexture(color));
  return dotTextures.get(color);
}

export {
  makeTexture,
  convertedTextureCache,
  convertedSpriteTexture,
  solidTexture,
  mulberry32,
  mixColor,
  drawPixelDisc,
  makeSmokeTexture,
  makeGasTexture,
  makeClayBlobTexture,
  makeCommanderHaloTexture,
  PENDULUM_TEX,
  makePendulumTexture,
  MAGNET_TEX,
  makeMagnetTexture,
  SPRING_BOMB_TEX,
  makeSpringBombTexture,
  STEEL_PLATE_TEX,
  drawMetalBar,
  makeSteelPlateTexture,
  makeSkyTexture,
  STAR_BAND_H,
  makeStarTexture,
  makeCityTexture,
  planeTexture,
  balloonTexture,
  clayBalloonTexture,
  clayBlobTexture,
  gasBalloonTexture,
  whiteBalloonTexture,
  smokeTexture,
  gemTexture,
  bulletTexture,
  powerBulletTexture,
  cloudTexture,
  bomberTexture,
  duoBalloonTexture,
  commanderBalloonTexture,
  allyCommanderBalloonTexture,
  bombTexture,
  parachuteTexture,
  mineBalloonTexture,
  pendulumBalloonTexture,
  pendulumTexture,
  magnetBalloonTexture,
  magnetTexture,
  springBalloonTexture,
  springBombTexture,
  steelBalloonTexture,
  steelPlateTexture,
  GALE_FAN_TEX,
  makeGaleFanTexture,
  GALE_WIND_TEX,
  makeGaleWindTexture,
  galeBalloonTexture,
  galeFanTexture,
  galeWindTexture,
  SOAP_BUBBLE_TEX,
  makeSoapBubbleTexture,
  soapBalloonTexture,
  soapBubbleTexture,
  gasTexture,
  commanderHaloTexture,
  allyHaloTexture,
  powerHaloTexture,
  BARRIER_TEXTURE,
  stoneTexture,
  makeBalloonSilhouette,
  invisibleSilhouette,
  dotTextures,
  dotTexture,
};