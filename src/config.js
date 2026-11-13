const VIEW_W = 960;
const VIEW_H = 540;
const PPM = 40;
const WORLD_W = VIEW_W / PPM;
const WORLD_H = VIEW_H / PPM;
const STEP = 1 / 60;
const GRAVITY = 9.8;
const MAX_HP = 5;
const GROUND_Y = WORLD_H - 0.45;

const CAT = {
  PLANE: 0x0001,
  BULLET: 0x0002,
  TARGET: 0x0004,
  PENDULUM: 0x0008,
  REFLECTED: 0x0010,
  MAGNET: 0x0020,
  STONE: 0x0040,
  GROUND: 0x0080,
};

const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const easeOutQuart = (t) => 1 - (1 - t) ** 4;

const PLANE_COLORS = {
  k: "#0b1026",
  b: "#3d6bff",
  l: "#8fb4ff",
  c: "#7ef9ff",
  r: "#ff5a5f",
  y: "#ffd166",
};

const BALLOON_COLORS = {
  k: "#0b1026",
  r: "#ff5a5f",
  l: "#ffb3b5",
  y: "#ffd166",
};

const GAS_BALLOON_COLORS = {
  k: "#0b1026",
  r: "#a05cff",
  l: "#dcc2ff",
  y: "#ffd166",
};

const CLAY_BALLOON_COLORS = {
  k: "#0b1026",
  r: "#c98b5e",
  l: "#ecd3b3",
  y: "#a86a3c",
};

const SPRING_BALLOON_COLORS = {
  k: "#0b1026",
  r: "#ff8f3f",
  l: "#ffd0a1",
  y: "#ffd166",
};

const SPRING_BOMB_COLORS = {
  k: "#0b1026",
  d: "#26304a",
  w: "#6f86b8",
  s: "#b9c8dd",
  y: "#ffd166",
};

const PENDULUM_BALLOON_COLORS = {
  k: "#0b1026",
  r: "#55658c",
  l: "#c6d5f2",
  y: "#ffd166",
};

const PENDULUM_COLORS = {
  k: "#0b1026",
  s: "#8fa6cc",
  w: "#eaf2ff",
  y: "#ffd166",
};

const MAGNET_BALLOON_COLORS = {
  k: "#0b1026",
  r: "#3f6fe0",
  l: "#cfe0ff",
  y: "#ffd166",
};

const MAGNET_COLORS = {
  k: "#0b1026",
  s: "#9fb0cc",
  d: "#66789a",
  r: "#ff4d6d",
  b: "#4d7dff",
  w: "#eaf2ff",
  y: "#ffd166",
};

const WHITE_BALLOON_COLORS = {
  k: "#0b1026",
  w: "#ffffff",
  g: "#d5e0f0",
  d: "#a9bcd6",
};

const GEM_COLORS = {
  k: "#0b1026",
  c: "#7ef9ff",
  w: "#ffffff",
};

const BULLET_COLORS = {
  y: "#ffd166",
  w: "#fff6d0",
};

const POWER_BULLET_COLORS = {
  y: "#7ef9ff",
  w: "#eafeff",
};

const CLOUD_COLORS = {
  w: "rgba(255,255,255,0.55)",
  g: "rgba(160,195,255,0.38)",
};

const CHAIN_COLOR = "#8aa0c8";

const BOMBER_COLORS = {
  k: "#0b1026",
  r: "#a855f7",
  l: "#e9c7ff",
  y: "#ffd166",
};

const BOMB_COLORS = {
  k: "#141a2e",
  w: "#6f86b8",
  y: "#ffd166",
};

const DUO_BALLOON_COLORS = {
  k: "#0b1026",
  r: "#2ec4b6",
  l: "#c9fff2",
  y: "#ffd166",
};

const COMMANDER_BALLOON_COLORS = {
  k: "#0b1026",
  r: "#ff2ec4",
  l: "#ffc2ef",
  y: "#ffd166",
};

const ALLY_COMMANDER_BALLOON_COLORS = {
  k: "#0b1026",
  r: "#2f7bff",
  l: "#bfe0ff",
  y: "#7ef9ff",
};

const COMMANDER_HALO_PALETTE = [
  "rgba(255,46,196,0.08)",
  "rgba(255,46,196,0.12)",
  "rgba(255,92,222,0.16)",
  "rgba(255,170,238,0.22)",
  "rgba(255,122,224,0.85)",
  "rgba(255,198,242,0.7)",
  "rgba(255,214,246,0.75)",
];

const ALLY_HALO_PALETTE = [
  "rgba(47,123,255,0.08)",
  "rgba(47,123,255,0.12)",
  "rgba(92,157,255,0.16)",
  "rgba(170,214,255,0.22)",
  "rgba(122,190,255,0.85)",
  "rgba(198,232,255,0.7)",
  "rgba(214,242,255,0.75)",
];

const CONVERTED_TINT = "rgba(47,123,255,0.6)";
const CONVERTED_GLOW = "rgba(126,249,255,0.22)";
const CONVERTED_AURA_SCALE = 3.1;

const POWER_HALO_PALETTE = [
  "rgba(255,209,102,0.06)",
  "rgba(255,209,102,0.10)",
  "rgba(126,249,255,0.14)",
  "rgba(126,249,255,0.20)",
  "rgba(255,225,150,0.85)",
  "rgba(200,250,255,0.7)",
  "rgba(255,240,200,0.75)",
];

const POWER_UP_CONFIG = {
  scoreStep: 200,
  duration: 8.0,
  spread: 0.42,
  intervalScale: 0.72,
  glowScale: 2.8,
};

const MINE_BALLOON_COLORS = {
  k: "#0b1026",
  r: "#39e04a",
  l: "#c2ffb4",
  y: "#ffd166",
};

const STEEL_BALLOON_COLORS = {
  k: "#0b1026",
  r: "#5f7085",
  l: "#cfdcec",
  y: "#ffd166",
};

const GALE_BALLOON_COLORS = {
  k: "#0b1026",
  r: "#2f8f9d",
  l: "#bff0ff",
  y: "#ffd166",
};

const SOAP_BALLOON_COLORS = {
  k: "#0b1026",
  r: "#7fd8f5",
  l: "#eafeff",
  y: "#ffd166",
};

const GALE_FAN_COLORS = {
  k: "#0b1026",
  m: "#5c6d85",
  l: "#c3d2e4",
  a: "#7ef9ff",
  y: "#ffd166",
};

const STEEL_PLATE_COLORS = {
  edge: "#0b1026",
  dark: "#26303c",
  mid: "#7d8ea3",
  light: "#c3d2e4",
  shine: "#ffffff",
  rivet: "#ffd166",
};

const PARACHUTE_COLORS = {
  k: "#0b1026",
  w: "#eaf2ff",
};

const PLANE_ROWS = [
  ".............kkkkkk.....",
  "..........kkkbbbbbbkkk..",
  "........kkkbbbbbbbbbbk..",
  "......kkkbbbbbbbbbbbbbk.",
  "....kkkbbbbbbbbbbbbbbbk.",
  "...kkbbbbbbbbbbbbbbbbbk.",
  "kkkbbbbbbbbbbbbbbbbbbbbk",
  "kbbbbbbbbbbbbbbccbbbbbbk",
  "kbbbbbbbbbbbbbbccbbbbbbk",
  "kkkbbbbbbbrrrbbbbbbbbbbk",
  "...kkbbbbbbbbbbbbbbbbbk.",
  "....kkkbbbbbbbbbbbbbbbk.",
  "......kkkbbbbbbbbbbbbbk.",
  "........kkkbbbbbbbbbbk..",
  "..........kkkbbbbbbkkk..",
  ".............kkkkkk.....",
];

const BALLOON_ROWS = [
  "....kkkk....",
  "...krrrrk...",
  "..krrrrrrk..",
  ".krrllrrrrk.",
  ".krrllrrrrk.",
  ".krrrrrrrrk.",
  "..krrrrrrk..",
  "...kkrrkk...",
  "....k..k....",
  "....k..k....",
  "....k..k....",
  "...kyyyyk...",
];

const STEEL_BALLOON_ROWS = [
  "......kkk......",
  "....kkrrrkk....",
  "...krrrrrrrk...",
  "..krrllrrrrrk..",
  "..krrllrrrrrk..",
  ".krrllrrrrrrrk.",
  ".krrrrrrrrrrrk.",
  ".krrrrrrrrrrrk.",
  "..krrrrrrrrrk..",
  "...krrrrrrrk...",
  "....kkrrrkk....",
  "......kkk......",
  "......k.k......",
  "......k.k......",
  ".....kyyyk.....",
];

const BARRIER_ROWS = STEEL_BALLOON_ROWS;

const BARRIER_COLORS = STEEL_BALLOON_COLORS;

const STONE_COLORS = {
  k: "#7a2b1a",
  L: "#d97757",
  B: "#b8482c",
  d: "#8f3620",
};

const STONE_ROWS = [
  "kkkkkkkkkk",
  "kLLBBBBBBk",
  "kBBBBBBBBk",
  "kBBBBBBddk",
  "kkkkkkkkkk",
];

const COMMANDER_ROWS = [
  "......yy......",
  "......kk......",
  ".....kkkk.....",
  "...kkrrrrkk...",
  "..krrllrrrrk..",
  ".krrllrrrrrrk.",
  ".krrrrrrrrrrk.",
  "kyrrrrrrrrrryk",
  ".krrrrrrrrrrk.",
  "..krrrrrrrrk..",
  "...kkrrrrkk...",
  ".....k..k.....",
  ".....k..k.....",
  ".....k..k.....",
  "....kyyyyyk...",
];

const WHITE_BALLOON_ROWS = [
  "....kkkk....",
  "...kwwwwk...",
  "..kwwwwwwk..",
  ".kwwggggwwk.",
  ".kwggggggwk.",
  ".kwggggggwk.",
  "..kwwgggwk..",
  "...kkwwkk...",
  "....k..k....",
  "....k..k....",
  "....k..k....",
  "...kdggdk...",
];

const GEM_ROWS = [
  "....k....",
  "...kck...",
  "..kccck..",
  ".kccwcck.",
  "kccccccck",
  ".kccwcck.",
  "..kccck..",
  "...kck...",
  "....k....",
];

const BULLET_ROWS = [".yy.", "yyyy", ".yy."];

const CLOUD_ROWS = [
  "......wwww..........",
  "....wwwwwwww........",
  "..wwwwwwwwwwww......",
  ".wwwwwwwwwwwwwww....",
  "wwwwwwwwwwwwwwwwwww.",
  ".wwwwwwwwwwwwwwwww..",
  "...gggggggggggggg...",
];

const BOMB_ROWS = [
  "....y....",
  "...kyk...",
  "..kkkkk..",
  ".kkkkkkk.",
  "kkwkkkkkk",
  "kkkkkkkkk",
  "kkkkkkkkk",
  ".kkkkkkk.",
  "..kkkkk..",
];

const PARACHUTE_ROWS = [
  "..kkkkkkkk..",
  ".kwwwwwwwwk.",
  "kwwwwwwwwwwk",
  "kkwwwwwwwwkk",
  "..k......k..",
];

const BOMBER_ROWS = [
  ".....kkkkk.....",
  "...kkrrrrrkk...",
  "..krrrrrrrrrk..",
  ".krrrllllrrrrk.",
  ".krrrllllrrrrk.",
  "krrrrrrrrrrrrrk",
  "krrrrrrrrrrrrrk",
  ".krrrrrrrrrrrk.",
  "..kkrrrrrrrkk..",
  "...kkkkkkkkk...",
  ".....k...k.....",
  ".....k...k.....",
  ".....kyyyk.....",
  ".....kyyyk.....",
];

const BOMBER_CHAIN_PATTERN = [];
for (let group = 0; group < 3; group += 1) {
  for (let link = 0; link < 8; link += 1) BOMBER_CHAIN_PATTERN.push("link");
  BOMBER_CHAIN_PATTERN.push("bomb");
}

const DUO_CHAIN_PATTERN = [];
for (let group = 0; group < 4; group += 1) {
  for (let link = 0; link < 4; link += 1) DUO_CHAIN_PATTERN.push("link");
  DUO_CHAIN_PATTERN.push("bomb");
}


export {
  VIEW_W,
  VIEW_H,
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
  pick,
  easeOutQuart,
  PLANE_COLORS,
  BALLOON_COLORS,
  GAS_BALLOON_COLORS,
  CLAY_BALLOON_COLORS,
  SPRING_BALLOON_COLORS,
  SPRING_BOMB_COLORS,
  PENDULUM_BALLOON_COLORS,
  PENDULUM_COLORS,
  MAGNET_BALLOON_COLORS,
  MAGNET_COLORS,
  WHITE_BALLOON_COLORS,
  GEM_COLORS,
  BULLET_COLORS,
  POWER_BULLET_COLORS,
  CLOUD_COLORS,
  CHAIN_COLOR,
  BOMBER_COLORS,
  BOMB_COLORS,
  DUO_BALLOON_COLORS,
  COMMANDER_BALLOON_COLORS,
  ALLY_COMMANDER_BALLOON_COLORS,
  COMMANDER_HALO_PALETTE,
  ALLY_HALO_PALETTE,
  CONVERTED_TINT,
  CONVERTED_GLOW,
  CONVERTED_AURA_SCALE,
  POWER_HALO_PALETTE,
  POWER_UP_CONFIG,
  MINE_BALLOON_COLORS,
  STEEL_BALLOON_COLORS,
  GALE_BALLOON_COLORS,
  GALE_FAN_COLORS,
  SOAP_BALLOON_COLORS,
  STEEL_PLATE_COLORS,
  BARRIER_ROWS,
  BARRIER_COLORS,
  STONE_COLORS,
  STONE_ROWS,
  PARACHUTE_COLORS,
  PLANE_ROWS,
  BALLOON_ROWS,
  STEEL_BALLOON_ROWS,
  COMMANDER_ROWS,
  WHITE_BALLOON_ROWS,
  GEM_ROWS,
  BULLET_ROWS,
  CLOUD_ROWS,
  BOMB_ROWS,
  PARACHUTE_ROWS,
  BOMBER_ROWS,
  BOMBER_CHAIN_PATTERN,
  DUO_CHAIN_PATTERN,
};