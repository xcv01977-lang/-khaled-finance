import { parseReceipt, type Receipt } from "./receipt";

/** Grayscale and stretch the contrast in place (2nd to 98th percentile). Thermal-paper photos are often grey and flat. */
export function preprocess(rgba: Uint8ClampedArray): void {
  const grey = new Uint8Array(rgba.length / 4);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    const g = Math.round(rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114);
    grey[j] = g;
    hist[g]++;
  }
  const cut = (frac: number) => {
    let acc = 0;
    const target = grey.length * frac;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) return v; }
    return 255;
  };
  const lo = cut(0.02);
  const hi = Math.max(lo + 1, cut(0.98));
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    const v = Math.max(0, Math.min(255, Math.round(((grey[j] - lo) / (hi - lo)) * 255)));
    rgba[i] = rgba[i + 1] = rgba[i + 2] = v;
    rgba[i + 3] = 255;
  }
}

// Reading is sensitive to how big the text is: one size can miss a line another size gets, so try several
// and stop as soon as a total is printed and trusted.
const WIDTHS = [800, 600, 1000];

export type ScanProgress = { step: number; of: number; percent: number; label: string };

export type Scan = { receipt: Receipt; text: string };

async function toBlob(bitmap: ImageBitmap, width: number): Promise<Blob> {
  const scale = width / bitmap.width;
  const w = Math.round(bitmap.width * scale);
  const h = Math.min(4000, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  preprocess(img.data);
  ctx.putImageData(img, 0, 0);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("canvas"))), "image/png"));
}

/** Read a receipt photo entirely on the device; the engine and language data are served from this app's own origin. */
export async function scanReceipt(file: File, today: string, onProgress: (p: ScanProgress) => void): Promise<Scan> {
  const { createWorker } = await import("tesseract.js");
  let pass = 0;
  const worker = await createWorker(["ara", "eng"], 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/lang",
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress({ step: pass, of: WIDTHS.length, percent: Math.round(m.progress * 100), label: "أقرأ الإيصال" });
      else onProgress({ step: pass, of: WIDTHS.length, percent: Math.round((m.progress ?? 0) * 100), label: "أجهّز القارئ (أول مرة أبطأ)" });
    },
  });
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    let text = "";
    let receipt = parseReceipt("", { today });
    for (const width of WIDTHS) {
      pass++;
      const { data } = await worker.recognize(await toBlob(bitmap, width));
      text += `\n${data.text}`;
      receipt = parseReceipt(text, { today });
      if (receipt.confidence === "high") break;
    }
    bitmap.close();
    return { receipt, text };
  } finally {
    await worker.terminate();
  }
}
