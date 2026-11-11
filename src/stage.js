import { VIEW_W, VIEW_H } from "./config.js";
const Stage = window.Stage;

const root = Stage.mount({ canvas: "stage" });
root.viewbox({ width: VIEW_W, height: VIEW_H, mode: "fill" });
if (root.context) root.context.imageSmoothingEnabled = false;

const bgLayer = Stage.component().pin({ width: VIEW_W, height: VIEW_H }).appendTo(root);
const gameLayer = Stage.component().pin({ width: VIEW_W, height: VIEW_H }).appendTo(root);
const fogLayer = Stage.component().pin({ width: VIEW_W, height: VIEW_H }).appendTo(root);

const lensCanvas = document.getElementById("lens");
const lensCtx = lensCanvas ? lensCanvas.getContext("2d") : null;
if (lensCanvas) {
  lensCanvas.width = VIEW_W;
  lensCanvas.height = VIEW_H;
}

export { root, bgLayer, gameLayer, fogLayer, lensCanvas, lensCtx };