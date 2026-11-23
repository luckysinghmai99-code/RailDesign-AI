import { createRequire } from 'node:module';
import type { AnimationFrame } from '../../shared/types.ts';

const require = createRequire(import.meta.url);
const { GIFEncoder, applyPalette, quantize } = require('gifenc') as typeof import('gifenc');

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) || 15,
      parseInt(clean[1] + clean[1], 16) || 23,
      parseInt(clean[2] + clean[2], 16) || 42,
    ];
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [Number.isNaN(r) ? 15 : r, Number.isNaN(g) ? 23 : g, Number.isNaN(b) ? 42 : b];
}

function fillRect(
  rgba: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: [number, number, number]
): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.floor(x + w));
  const y1 = Math.min(height, Math.floor(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const idx = (py * width + px) * 4;
      rgba[idx] = rgb[0];
      rgba[idx + 1] = rgb[1];
      rgba[idx + 2] = rgb[2];
      rgba[idx + 3] = 255;
    }
  }
}

function fillCircle(
  rgba: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  r: number,
  rgb: [number, number, number]
): void {
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(width - 1, Math.ceil(cx + r));
  const y1 = Math.min(height - 1, Math.ceil(cy + r));
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy <= r2) {
        const idx = (py * width + px) * 4;
        rgba[idx] = rgb[0];
        rgba[idx + 1] = rgb[1];
        rgba[idx + 2] = rgb[2];
        rgba[idx + 3] = 255;
      }
    }
  }
}

export function encodeFramesToGifBuffer(frames: AnimationFrame[], width = 360, height = 200): Buffer {
  const gif = GIFEncoder();

  const list = frames.length > 0 ? frames : [
    {
      id: 'f1',
      label: 'Frame 1',
      durationMs: 180,
      backgroundColor: '#0B1120',
      accentColor: '#3B82F6',
      headline: 'RailDesign Motion',
      subline: 'Sequence 1',
      shape: 'train' as const,
      progress: 0.25,
    },
  ];

  for (let i = 0; i < list.length; i++) {
    const frame = list[i];
    const rgba = new Uint8Array(width * height * 4);
    const bg = hexToRgb(frame.backgroundColor || '#0B1120');
    const accent = hexToRgb(frame.accentColor || '#3B82F6');
    const light: [number, number, number] = [241, 245, 249];
    const track: [number, number, number] = [51, 65, 85];

    // Fill background
    fillRect(rgba, width, height, 0, 0, width, height, bg);

    // Subtle geometric railway track baseline
    fillRect(rgba, width, height, 16, height - 34, width - 32, 3, track);
    for (let sx = 20; sx < width - 24; sx += 18) {
      fillRect(rgba, width, height, sx, height - 29, 8, 3, track);
    }

    const t = typeof frame.progress === 'number' ? frame.progress : i / Math.max(1, list.length - 1);

    // Animated locomotive / graphic motif
    if (frame.shape === 'bars') {
      for (let b = 0; b < 6; b++) {
        const bh = 28 + Math.round(Math.abs(Math.sin(t * Math.PI * 2 + b * 0.7)) * 84);
        fillRect(rgba, width, height, 42 + b * 48, height - 50 - bh, 28, bh, b % 2 === 0 ? accent : light);
      }
    } else if (frame.shape === 'orbit' || frame.shape === 'pulse') {
      const cx = width / 2 + Math.cos(t * Math.PI * 2) * 70;
      const cy = height / 2 - 12 + Math.sin(t * Math.PI * 2) * 28;
      fillCircle(rgba, width, height, width / 2, height / 2 - 12, 38, track);
      fillCircle(rgba, width, height, cx, cy, 18, accent);
      fillCircle(rgba, width, height, width / 2, height / 2 - 12, 12, light);
    } else {
      // High-speed streamlined train gliding across the track
      const trainX = -80 + t * (width + 40);
      const trainY = height - 68;
      // Carriages
      fillRect(rgba, width, height, trainX - 96, trainY + 4, 44, 24, track);
      fillRect(rgba, width, height, trainX - 48, trainY + 4, 44, 24, track);
      // Locomotive body + nose
      fillRect(rgba, width, height, trainX, trainY, 64, 28, accent);
      fillRect(rgba, width, height, trainX + 58, trainY + 6, 16, 22, accent);
      // Windows
      fillRect(rgba, width, height, trainX + 10, trainY + 7, 14, 7, light);
      fillRect(rgba, width, height, trainX + 30, trainY + 7, 14, 7, light);
      fillRect(rgba, width, height, trainX + 50, trainY + 9, 12, 6, light);
      // Wheels
      fillCircle(rgba, width, height, trainX + 12, trainY + 29, 4, light);
      fillCircle(rgba, width, height, trainX + 50, trainY + 29, 4, light);
    }

    // Header bar indicator representing headline energy
    const barW = Math.max(40, Math.round((width - 64) * (0.25 + t * 0.75)));
    fillRect(rgba, width, height, 32, 28, barW, 8, accent);
    fillRect(rgba, width, height, 32, 44, Math.round(barW * 0.6), 5, light);

    const palette = quantize(rgba, 64);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, width, height, {
      palette,
      delay: Math.max(40, frame.durationMs || 160),
    });
  }

  gif.finish();
  return Buffer.from(gif.bytes());
}

export function encodeFramesToGifDataUrl(frames: AnimationFrame[], width = 360, height = 200): string {
  const buf = encodeFramesToGifBuffer(frames, width, height);
  return `data:image/gif;base64,${buf.toString('base64')}`;
}
