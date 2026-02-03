import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const floatArrayToWav = (
  audioData: Float32Array,
  sampleRate: number = 16000,
  format: "wav" | "mp3" | "ogg" = "wav"
): Blob => {
  const buffer = new ArrayBuffer(44 + audioData.length * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  const dataSize =
    format === "wav" ? 36 + audioData.length * 2 : 44 + audioData.length * 2;
  view.setUint32(4, dataSize, true);
  writeString(8, format === "wav" ? "WAVE" : "FORM");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, audioData.length * 2, true);

  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: `audio/${format}` });
};

// Check whether a captured screenshot image is likely invalid (blocked by permissions).
// This draws the image to a small canvas and computes pixel variance; very low variance
// usually indicates a blocked/blank/placeholder capture (or a completely solid-color image).
export const isLikelyInvalidScreenshot = async (base64Png: string) => {
  return new Promise<boolean>((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const size = 64; // downscale for fast processing
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(false);
          ctx.drawImage(img, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;
          let sum = 0;
          let sumSq = 0;
          const n = size * size;
          for (let i = 0; i < data.length; i += 4) {
            // use luminance approximation
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            sum += lum;
            sumSq += lum * lum;
          }
          const mean = sum / n;
          const variance = sumSq / n - mean * mean;
          // If variance is very small, the image is likely blank/placeholder
          const threshold = 50; // tuned empirically
          resolve(variance < threshold);
        } catch (e) {
          resolve(false);
        }
      };
      img.onerror = () => resolve(false);
      img.src = `data:image/png;base64,${base64Png}`;
    } catch (e) {
      resolve(false);
    }
  });
};
