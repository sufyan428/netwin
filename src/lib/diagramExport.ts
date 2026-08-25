import { toPng } from "html-to-image";
import { getTransformForBounds } from "reactflow";
import { NetNode } from "./types";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 110;

function computeBounds(nodes: NetNode[]) {
  const xs = nodes.map((n) => n.position.x);
  const ys = nodes.map((n) => n.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX + NODE_WIDTH,
    height: Math.max(...ys) - minY + NODE_HEIGHT,
  };
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Renders the current React Flow viewport to a PNG and downloads it.
// Reads bounds from the node positions in the store (not the DOM) so it
// works regardless of current pan/zoom.
export async function exportDiagramPng(nodes: NetNode[]) {
  const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport || nodes.length === 0) {
    throw new Error("Canvas is not ready yet — try again in a moment.");
  }

  const imageWidth = 1600;
  const imageHeight = 1000;
  const bounds = computeBounds(nodes);
  const [x, y, zoom] = getTransformForBounds(bounds, imageWidth, imageHeight, 0.2, 2);

  const bgColor =
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#08090d";

  const dataUrl = await toPng(viewport, {
    backgroundColor: bgColor,
    width: imageWidth,
    height: imageHeight,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${x}px, ${y}px) scale(${zoom})`,
    },
  });

  downloadDataUrl(dataUrl, "nettwin-diagram.png");
}
