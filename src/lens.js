import { VIEW_W, VIEW_H, PPM } from "./config.js";
import { invisibleSilhouette } from "./textures.js";
import { root, lensCanvas, lensCtx } from "./stage.js";
import { INVISIBLE_CONFIG } from "./entityConfig.js";

let lensDrawn = false;

function drawInvisibleLenses(entities, shakeOffsetX, shakeOffsetY) {
  if (!lensCtx || !lensCanvas) return;
  const stageCanvas = root.canvas || document.getElementById("stage");
  if (!stageCanvas || !stageCanvas.width) return;
  const stageCtx = stageCanvas.getContext("2d");
  if (!stageCtx) return;

  const targets = entities.filter(
    (entity) =>
      entity.kind === "target" &&
      entity.targetType === "invisible" &&
      !entity.dead &&
      !entity.puffed &&
      !entity.escaped,
  );

  if (targets.length === 0) {
    if (lensDrawn) {
      lensCtx.clearRect(0, 0, lensCanvas.width, lensCanvas.height);
      lensDrawn = false;
    }
    return;
  }

  if (lensCanvas.width !== stageCanvas.width || lensCanvas.height !== stageCanvas.height) {
    lensCanvas.width = stageCanvas.width;
    lensCanvas.height = stageCanvas.height;
  }

  lensDrawn = true;
  lensCtx.clearRect(0, 0, lensCanvas.width, lensCanvas.height);

  const scaleX = stageCanvas.width / VIEW_W;
  const scaleY = stageCanvas.height / VIEW_H;
  const config = INVISIBLE_CONFIG;
  const silhouette = invisibleSilhouette;
  const texW = silhouette.width;
  const texH = silhouette.height;
  const halfW = texW / 2;
  const halfH = texH / 2;
  const reach = Math.ceil(Math.hypot(halfW, halfH)) + 2;
  const cellSize = silhouette.scale;

  for (const entity of targets) {
    const position = entity.body.getPosition();
    const cx = (position.x * PPM + shakeOffsetX) * scaleX;
    const cy = (position.y * PPM + shakeOffsetY) * scaleY;
    const tilt = entity.tiltAngle || 0;
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);

    const reachX = reach * scaleX;
    const reachY = reach * scaleY;
    const left = Math.max(0, Math.floor(cx - reachX));
    const top = Math.max(0, Math.floor(cy - reachY));
    const right = Math.min(stageCanvas.width, Math.ceil(cx + reachX));
    const bottom = Math.min(stageCanvas.height, Math.ceil(cy + reachY));
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) continue;

    const source = stageCtx.getImageData(left, top, width, height);
    const output = lensCtx.createImageData(width, height);
    const src = source.data;
    const dst = output.data;

    const strength =
      config.bulgeStrength +
      (entity.charging ? config.bulgeChargeBoost * (entity.chargeBlend || 0) : 0);
    const bodyCx = config.bodyCenterX;
    const bodyCy = config.bodyCenterY;
    const bodyRx = config.bodyRadiusX;
    const bodyRy = config.bodyRadiusY;
    const feather = config.edgeFeather;

    for (let y = 0; y < height; y += 1) {
      const offsetY = (top + y + 0.5 - cy) / scaleY;
      for (let x = 0; x < width; x += 1) {
        const offsetX = (left + x + 0.5 - cx) / scaleX;

        const texX = offsetX * cos + offsetY * sin + halfW;
        const texY = -offsetX * sin + offsetY * cos + halfH;
        const maskX = Math.floor(texX);
        const maskY = Math.floor(texY);
        if (maskX < 0 || maskX >= texW || maskY < 0 || maskY >= texH) continue;
        const maskIndex = maskY * texW + maskX;
        if (silhouette.alpha[maskIndex] === 0) continue;

        const edge = Math.min(1, silhouette.distance[maskIndex] / feather);
        const nx = (texX - bodyCx) / bodyRx;
        const ny = (texY - bodyCy) / bodyRy;
        const radial = Math.max(0, 1 - (nx * nx + ny * ny));
        const scale = 1 - strength * edge * radial;

        const srcTexX = bodyCx + (texX - bodyCx) * scale;
        const srcTexY = bodyCy + (texY - bodyCy) * scale;
        const srcOffsetX = srcTexX - halfW;
        const srcOffsetY = srcTexY - halfH;
        const screenX = cx + (srcOffsetX * cos - srcOffsetY * sin) * scaleX;
        const screenY = cy + (srcOffsetX * sin + srcOffsetY * cos) * scaleY;

        let sampleX = Math.floor(screenX - left);
        let sampleY = Math.floor(screenY - top);
        if (sampleX < 0) sampleX = 0;
        else if (sampleX >= width) sampleX = width - 1;
        if (sampleY < 0) sampleY = 0;
        else if (sampleY >= height) sampleY = height - 1;

        const si = (sampleY * width + sampleX) * 4;
        const di = (y * width + x) * 4;
        dst[di] = src[si];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = 255;
      }
    }

    lensCtx.putImageData(output, left, top);

    lensCtx.save();
    lensCtx.fillStyle = entity.converted
      ? config.convertedRimColor
      : entity.charging
        ? config.chargeRimColor
        : config.rimColor;
    for (const cell of silhouette.edgeCells) {
      const offsetX = (cell.x + 0.5) * cellSize - halfW;
      const offsetY = (cell.y + 0.5) * cellSize - halfH;
      const screenX = cx + (offsetX * cos - offsetY * sin) * scaleX;
      const screenY = cy + (offsetX * sin + offsetY * cos) * scaleY;
      lensCtx.fillRect(
        screenX - (cellSize * scaleX) / 2,
        screenY - (cellSize * scaleY) / 2,
        cellSize * scaleX,
        cellSize * scaleY,
      );
    }

    lensCtx.fillStyle = config.highlightColor;
    for (const cell of silhouette.highlightCells) {
      const offsetX = (cell.x + 0.5) * cellSize - halfW;
      const offsetY = (cell.y + 0.5) * cellSize - halfH;
      const screenX = cx + (offsetX * cos - offsetY * sin) * scaleX;
      const screenY = cy + (offsetX * sin + offsetY * cos) * scaleY;
      lensCtx.fillRect(
        screenX - (cellSize * scaleX) / 2,
        screenY - (cellSize * scaleY) / 2,
        cellSize * scaleX,
        cellSize * scaleY,
      );
    }
    lensCtx.restore();
  }
}

export { lensDrawn, drawInvisibleLenses };