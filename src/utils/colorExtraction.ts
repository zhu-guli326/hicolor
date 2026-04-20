export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function extractDominantImageColors(
  img: HTMLImageElement
): { primary: string; secondary: string } {
  const sampleCanvas = document.createElement('canvas');
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!sampleCtx) {
    return { primary: '#e63946', secondary: '#a8dadc' };
  }

  const targetW = 64;
  const targetH = Math.max(1, Math.round((img.height / img.width) * targetW));
  sampleCanvas.width = targetW;
  sampleCanvas.height = targetH;
  sampleCtx.drawImage(img, 0, 0, targetW, targetH);

  const { data } = sampleCtx.getImageData(0, 0, targetW, targetH);
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 200) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;
    if (brightness < 18 || brightness > 245) continue;

    const qr = Math.round(r / 24) * 24;
    const qg = Math.round(g / 24) * 24;
    const qb = Math.round(b / 24) * 24;
    const key = `${qr},${qg},${qb}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.r += r;
      existing.g += g;
      existing.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  const ranked = [...buckets.values()]
    .map((bucket) => ({
      count: bucket.count,
      r: bucket.r / bucket.count,
      g: bucket.g / bucket.count,
      b: bucket.b / bucket.count,
    }))
    .sort((a, b) => b.count - a.count);

  if (ranked.length === 0) {
    return { primary: '#e63946', secondary: '#a8dadc' };
  }

  const primary = ranked[0];
  const secondary =
    ranked.find((color) => colorDistance(color, primary) > 90) ||
    ranked.find((color) => colorDistance(color, primary) > 50) ||
    ranked[Math.min(1, ranked.length - 1)] ||
    primary;

  return {
    primary: rgbToHex(primary.r, primary.g, primary.b),
    secondary: rgbToHex(secondary.r, secondary.g, secondary.b),
  };
}
