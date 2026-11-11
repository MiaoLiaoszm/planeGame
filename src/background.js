import { VIEW_W, VIEW_H, rand } from "./config.js";
import { makeSkyTexture, makeStarTexture, makeCityTexture, cloudTexture } from "./textures.js";
import { bgLayer } from "./stage.js";
const Stage = window.Stage;

Stage.sprite(makeSkyTexture()).appendTo(bgLayer);

const starTexture = makeStarTexture();
const starWidth = starTexture.getWidth();
const starSprites = [];
for (let i = 0; i < 2; i += 1) {
  const sprite = Stage.sprite(starTexture).appendTo(bgLayer);
  sprite.pin({ offsetX: i * starWidth, offsetY: 0, alpha: 0.85 });
  starSprites.push(sprite);
}

const CITY_FAR_H = 138;
const CITY_NEAR_H = 84;
const CITY_FAR_DEPTH = 0.5;
const CITY_NEAR_DEPTH = 1.18;

const farCityTexture = makeCityTexture({
  height: CITY_FAR_H,
  seed: 20261103,
  baseColor: "#2b5486",
  topColor: "#4a7cab",
  windowColor: "rgba(255,226,160,0.5)",
  minWidth: 26,
  maxWidth: 64,
  minHeight: 42,
  maxHeight: 134,
  litChance: 0.32,
  antennaChance: 0.22,
  haze: 0.42,
});
const farCityWidth = farCityTexture.getWidth();
const farCitySprites = [];
for (let i = 0; i < 2; i += 1) {
  const sprite = Stage.sprite(farCityTexture).appendTo(bgLayer);
  sprite.pin({ offsetX: i * farCityWidth, offsetY: VIEW_H - CITY_FAR_H });
  farCitySprites.push(sprite);
}

const clouds = [];
for (let i = 0; i < 9; i += 1) {
  const near = i % 3 === 0;
  const scale = near ? 2 : 1;
  const sprite = Stage.sprite(cloudTexture).appendTo(bgLayer);
  sprite.pin({
    scaleX: scale,
    scaleY: scale,
    alpha: near ? rand(0.5, 0.75) : rand(0.22, 0.45),
  });
  clouds.push({
    sprite,
    width: cloudTexture.getWidth() * scale,
    x: rand(-60, VIEW_W),
    y: near ? rand(VIEW_H - 210, VIEW_H - 40) : rand(20, VIEW_H - 130),
    depth: near ? rand(0.85, 1.15) : rand(0.4, 0.72),
  });
}

const nearCityTexture = makeCityTexture({
  height: CITY_NEAR_H,
  seed: 771204,
  baseColor: "#050a18",
  topColor: "#101f42",
  windowColor: "rgba(126,249,255,0.45)",
  minWidth: 30,
  maxWidth: 76,
  minHeight: 28,
  maxHeight: 82,
  litChance: 0.26,
  antennaChance: 0.4,
  haze: 0,
});
const nearCityWidth = nearCityTexture.getWidth();
const nearCitySprites = [];
for (let i = 0; i < 2; i += 1) {
  const sprite = Stage.sprite(nearCityTexture).appendTo(bgLayer);
  sprite.pin({ offsetX: i * nearCityWidth, offsetY: VIEW_H - CITY_NEAR_H });
  nearCitySprites.push(sprite);
}

let scrollX = 0;
function tileOffset(sprites, width, distance, baseY) {
  const offset = distance % width;
  for (let i = 0; i < sprites.length; i += 1) {
    sprites[i].pin({ offsetX: i * width - offset, offsetY: baseY });
  }
}
function updateScroll(dt, speed) {
  scrollX += speed * dt;

  tileOffset(starSprites, starWidth, scrollX * 0.18, 0);
  tileOffset(farCitySprites, farCityWidth, scrollX * CITY_FAR_DEPTH, VIEW_H - CITY_FAR_H);
  tileOffset(nearCitySprites, nearCityWidth, scrollX * CITY_NEAR_DEPTH, VIEW_H - CITY_NEAR_H);

  for (const cloud of clouds) {
    cloud.x -= speed * cloud.depth * dt;
    if (cloud.x < -cloud.width - 30) {
      cloud.x = VIEW_W + rand(20, 260);
    }
    cloud.sprite.pin({ offsetX: cloud.x, offsetY: cloud.y });
  }
}

export { starTexture, starWidth, starSprites, CITY_FAR_H, CITY_NEAR_H, CITY_FAR_DEPTH, CITY_NEAR_DEPTH, farCityTexture, farCityWidth, farCitySprites, clouds, nearCityTexture, nearCityWidth, nearCitySprites, scrollX, tileOffset, updateScroll };