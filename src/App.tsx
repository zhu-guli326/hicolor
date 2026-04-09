/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, ChangeEvent } from 'react';
import heic2any from 'heic2any';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  RefreshCw,
  ChevronDown,
  Trash2,
  Palette,
  Pipette,
  X,
  Download,
  Target,
  Circle,
  Square,
  Star,
  Droplet,
  Snowflake,
  Heart,
  Plus,
  Dices,
  AlignStartVertical,
  AlignStartHorizontal,
  AlignEndVertical,
  AlignEndHorizontal,
  SlidersHorizontal,
  Images,
  Image as ImageIcon,
  Sparkles,
  Sun,
  Triangle,
  Type,
  Shuffle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// --- Types & Constants ---

type BottomNavTab = 'background' | 'elements';

type CompositionMode = 'block-bottom' | 'block-top' | 'block-left' | 'block-right';
/** 纯色 | 双拼色(条纹) | 渐变 | 图片 */
type BackgroundType = 'solid' | 'split' | 'gradient' | 'image';
type CreationMode = 'auto' | 'manual';
type DistributionMode = 'sync' | 'scatter';
/** 元素面板内：形状挖空 / 画布叠字 */
type ElementsPanelTab = 'shape' | 'overlay';
type ShapeKind =
  | 'circle'
  | 'square'
  | 'star'
  | 'drop'
  | 'snowflake'
  | 'heart'
  | 'symbol'
  /** 每个挖空随机 A–Z，位置仍走自动生成/手动/打散 */
  | 'randomLetters'
  | 'random';

interface Cutout {
  id: string;
  x: number; // 0 to 1
  y: number; // 0 to 1
  sizeFactor: number; // -0.5 to 0.5
  angle: number;
  char?: string;
  shapeKind?: ShapeKind;
}

/** 画布叠字字体预设（已在 index.html 中加载） */
const TEXT_FONT_PRESETS: { value: string; label: string }[] = [
  { value: '"Noto Sans SC", sans-serif', label: '黑体' },
  { value: '"Oswald", sans-serif', label: 'Oswald' },
  { value: '"Bebas Neue", sans-serif', label: 'Bebas' },
  { value: '"Anton", sans-serif', label: 'Anton' },
  { value: '"Playfair Display", serif', label: 'Playfair' },
  { value: '"Permanent Marker", cursive', label: '手写' },
  { value: '"Press Start 2P", cursive', label: '像素' },
  { value: '"Righteous", sans-serif', label: 'Righteous' },
  { value: '"Dancing Script", cursive', label: 'Dancing' },
  { value: '"Satisfy", cursive', label: 'Satisfy' },
  { value: '"Great Vibes", cursive', label: 'Great Vibes' },
  { value: '"Monoton", cursive', label: 'Monoton' },
  { value: '"Russo One", sans-serif', label: 'Russo' },
  { value: '"Bungee", cursive', label: 'Bungee' },
  { value: '"Black Ops One", cursive', label: 'Black Ops' },
  { value: '"Staatliches", cursive', label: 'Staatliches' },
  { value: '"Abril Fatface", cursive', label: 'Abril' },
  { value: '"Alfa Slab One", cursive', label: 'Alfa Slab' },
  { value: '"Paytone One", sans-serif', label: 'Paytone' },
  { value: '"Syncopate", sans-serif', label: 'Syncopate' },
  { value: '"Poiret One", cursive', label: 'Poiret' },
  { value: '"Comfortaa", cursive', label: 'Comfortaa' },
  { value: '"Cinzel", serif', label: 'Cinzel' },
  { value: '"Yeseva One", cursive', label: 'Yeseva' },
  { value: '"Lobster", cursive', label: 'Lobster' },
  { value: '"Orbitron", sans-serif', label: 'Orbitron' },
  { value: '"Acme", sans-serif', label: 'Acme' },
  { value: '"Boogaloo", cursive', label: 'Boogaloo' },
  { value: '"Fredoka One", cursive', label: 'Fredoka' },
  { value: '"Lilita One", cursive', label: 'Lilita One' },
  { value: '"Big Shoulders Display", cursive', label: 'Big Shoulders' },
  { value: '"Arvo", serif', label: 'Arvo' },
  { value: '"Lato", sans-serif', label: 'Lato' },
  { value: '"Rajdhani", sans-serif', label: 'Rajdhani' },
  { value: '"Rubik Mono One", sans-serif', label: 'Rubik Mono' },
  { value: '"Rubik Bubbles", cursive', label: 'Rubik Bubbles' },
  { value: '"Shojumaru", cursive', label: 'Shojumaru' },
  { value: '"Bungee Inline", cursive', label: 'Bungee Inline' },
  { value: '"Spirax", cursive', label: 'Spirax' },
  { value: '"Knewave", cursive', label: 'Knewave' },
];

const SHAPE_OPTIONS: { value: ShapeKind; icon: LucideIcon; title: string; caption: string }[] = [
  { value: 'circle', icon: Circle, title: '圆形', caption: '圆形' },
  { value: 'square', icon: Square, title: '正方形', caption: '正方形' },
  { value: 'star', icon: Star, title: '五角星', caption: '五角星' },
  { value: 'drop', icon: Droplet, title: '水滴', caption: '水滴' },
  { value: 'snowflake', icon: Snowflake, title: '雪花', caption: '雪花' },
  { value: 'heart', icon: Heart, title: '爱心', caption: '爱心' },
  { value: 'randomLetters', icon: Dices, title: '随机字母', caption: '随机字母' },
  { value: 'random', icon: Shuffle, title: '随机', caption: '随机形状' },
  { value: 'symbol', icon: Plus, title: '自定义符号', caption: '自定义' },
];

function pickRandomSymbolChar(s: string): string {
  const g = [...s].filter(Boolean);
  return g.length > 0 ? g[Math.floor(Math.random() * g.length)] : '★';
}

function randomUpperLetter(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return letters[Math.floor(Math.random() * letters.length)];
}

/** 散布子点用：按挖空 id + 序号固定字母，避免每帧重绘随机闪烁 */
function stableRandomUpperLetter(cutoutId: string, scatterIndex: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let h = 0;
  for (let i = 0; i < cutoutId.length; i++) {
    h = (h * 33 + cutoutId.charCodeAt(i)) >>> 0;
  }
  const idx = (h + scatterIndex * 0x9e3779b9) >>> 0;
  return letters[idx % 26];
}

function stableSymbolFromPool(pool: string, cutoutId: string, scatterIndex: number): string {
  const g = [...pool].filter(Boolean);
  if (g.length === 0) return '★';
  let h = 0;
  for (let i = 0; i < cutoutId.length; i++) {
    h = (h * 33 + cutoutId.charCodeAt(i)) >>> 0;
  }
  const idx = (h + scatterIndex * 0x9e3779b9) >>> 0;
  return g[idx % g.length];
}

function glyphCharForScatterSlice(
  c: Cutout,
  sliceIndex: number,
  customSymbolPool: string
): string {
  if (c.shapeKind === 'randomLetters') return stableRandomUpperLetter(c.id, sliceIndex);
  if (c.shapeKind === 'symbol') return stableSymbolFromPool(customSymbolPool, c.id, sliceIndex);
  return cutoutGlyphChar(c, customSymbolPool);
}

/** 归一化坐标下与画面中心的距离（0–1 空间，最大约 0.707） */
function distFromNormCenter(x: number, y: number): number {
  const dx = x - 0.5;
  const dy = y - 0.5;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 自动/兜底生成时尽量避开中心（避免挡脸）；不再强制落在 (0.5,0.5)。
 * minDistFromCenter：小于此距离的点一律不采用（0 表示仅走随机采样）。
 */
function createFallbackCutout(kind: ShapeKind, symbolPool: string, minDistFromCenter: number): Cutout {
  const build = (x: number, y: number, sizeFactor = 0): Cutout => {
    const base = {
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      sizeFactor,
      angle: Math.random() * Math.PI * 2,
    };
    if (kind === 'symbol') {
      return { ...base, shapeKind: 'symbol', char: pickRandomSymbolChar(symbolPool) };
    }
    if (kind === 'randomLetters') {
      return { ...base, shapeKind: 'randomLetters', char: randomUpperLetter() };
    }
    return { ...base, shapeKind: kind };
  };

  const minD = Math.max(0, minDistFromCenter);
  for (let t = 0; t < 160; t++) {
    const x = Math.random();
    const y = Math.random();
    if (minD > 0 && distFromNormCenter(x, y) < minD) continue;
    return build(x, y, Math.random() - 0.5);
  }
  const edgePoints: [number, number][] = [
    [0.12 + Math.random() * 0.76, 0.06],
    [0.12 + Math.random() * 0.76, 0.94],
    [0.06, 0.12 + Math.random() * 0.76],
    [0.94, 0.12 + Math.random() * 0.76],
  ];
  const [ex, ey] = edgePoints[Math.floor(Math.random() * edgePoints.length)];
  return build(ex, ey, 0);
}

function cutoutGlyphChar(c: Cutout, customSymbolPool: string): string {
  if (c.shapeKind === 'randomLetters') return c.char || randomUpperLetter();
  return c.char || pickRandomSymbolChar(customSymbolPool);
}

function isGlyphShapeKind(kind: ShapeKind | undefined): boolean {
  return kind === 'symbol' || kind === 'randomLetters';
}

/** iOS / iPadOS：Safari 对 <a download>、data: 新窗口支持差，需分享或新开 blob 页长按保存 */
function isLikelyIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/** 2D 绘制/导出尽量保持原图画质（避免默认低质量插值） */
function applyHighFidelity2d(ctx: CanvasRenderingContext2D) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
}

/**
 * canvas 使用 CSS object-fit: cover 时，将屏幕坐标映射到画布像素坐标。
 * 等比铺满容器、不拉伸变形；可能裁切边缘，但无 letterbox 灰边。
 */
function getCanvasCoverParams(el: HTMLCanvasElement) {
  const rect = el.getBoundingClientRect();
  const rw = rect.width;
  const rh = rect.height;
  const cw = el.width;
  const ch = el.height;
  if (rw <= 0 || rh <= 0 || cw <= 0 || ch <= 0) {
    return {
      rect,
      rw,
      rh,
      cw,
      ch,
      dispW: rw,
      dispH: rh,
      offX: 0,
      offY: 0,
      scaleCanvasPerCss: cw / Math.max(rw, 1),
    };
  }
  const sc = Math.max(rw / cw, rh / ch);
  const dispW = cw * sc;
  const dispH = ch * sc;
  const offX = (rw - dispW) / 2;
  const offY = (rh - dispH) / 2;
  return {
    rect,
    rw,
    rh,
    cw,
    ch,
    dispW,
    dispH,
    offX,
    offY,
    scaleCanvasPerCss: dispW / cw,
  };
}

function clientToCanvasPixels(el: HTMLCanvasElement, clientX: number, clientY: number) {
  const { rect, cw, ch, dispW, dispH, offX, offY } = getCanvasCoverParams(el);
  const lx = clientX - rect.left - offX;
  const ly = clientY - rect.top - offY;
  return {
    x: (lx / dispW) * cw,
    y: (ly / dispH) * ch,
  };
}

/**
 * 主图画布始终等于完整原图尺寸；色块画布只取分栏条带的裁剪区域。
 *
 *  - mainW/mainH：原图完整尺寸（不变）
 *  - blockW/blockH：色块条带的像素宽高
 *  - cropX/cropY/sw/sh：色块条带在原图中的裁剪矩形
 */
function getLayoutDimensions(
  composition: CompositionMode,
  r: number,
  iw: number,
  ih: number
): {
  mainW: number;
  mainH: number;
  blockW: number;
  blockH: number;
  cropX: number;
  cropY: number;
  sw: number;
  sh: number;
} {
  const mainW = iw;
  const mainH = ih;

  let blockW: number;
  let blockH: number;
  let cropX = 0;
  let cropY = 0;

  switch (composition) {
    case 'block-bottom':
      blockW = iw;
      blockH = Math.round(ih * r);
      cropX = 0;
      cropY = ih - blockH; // 底部条带
      break;
    case 'block-top':
      blockW = iw;
      blockH = Math.round(ih * r);
      cropX = 0;
      cropY = 0; // 顶部条带
      break;
    case 'block-right':
      blockW = Math.round(iw * r);
      blockH = ih;
      cropX = iw - blockW; // 右侧条带
      cropY = 0;
      break;
    case 'block-left':
      blockW = Math.round(iw * r);
      blockH = ih;
      cropX = 0; // 左侧条带
      cropY = 0;
      break;
    default:
      blockW = 0;
      blockH = 0;
  }

  return { mainW, mainH, blockW, blockH, cropX, cropY, sw: blockW, sh: blockH };
}

function wrapOverlayLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const parts = text.split('\n');
  for (const para of parts) {
    let line = '';
    for (const ch of [...para]) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line.length > 0) lines.push(line);
  }
  return lines.length > 0 ? lines : [''];
}

function computeOverlayLineLayout(
  ctx: CanvasRenderingContext2D,
  text: string,
  imgWidth: number,
  imgHeight: number,
  baseFontCanvasPx: number,
  fontFamily: string,
  ox: number,
  oy: number
): { fontSize: number; lines: string[]; lh: number; startY: number; cx: number } {
  const cx = ox * imgWidth;
  const maxW = imgWidth * 0.88;
  const maxBlockH = imgHeight * 0.4;
  let fontSize = Math.max(14, baseFontCanvasPx);
  let lines: string[] = [];
  let lh = fontSize * 1.3;
  for (let guard = 0; guard < 48; guard++) {
    ctx.font = `800 ${fontSize}px ${fontFamily}, sans-serif`;
    lines = wrapOverlayLines(ctx, text, maxW);
    lh = fontSize * 1.3;
    const tooWide = lines.some((l) => ctx.measureText(l).width > maxW);
    const tooTall = lines.length * lh > maxBlockH;
    if (!tooWide && !tooTall) break;
    fontSize *= 0.9;
    if (fontSize < 11) break;
  }
  const cy = oy * imgHeight;
  const startY = cy - ((lines.length - 1) * lh) / 2;
  return { fontSize, lines, lh, startY, cx };
}

/**
 * 在条带画布上绘制叠字（与 blockCanvas 上 x,y 归一化一致）。
 * photoInText：条带区域对应原图裁剪时用 crop；导出整幅色块面时用 stretch-full。
 */
function drawOverlayTextOnContext(
  targetCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
  image: HTMLImageElement,
  overlayTrim: string,
  fontFamily: string,
  fontSizeUi: number,
  ox: number,
  oy: number,
  fillColor: string,
  strokeColor: string,
  shapeColor: string,
  photoInText:
    | { mode: 'stretch-full' }
    | { mode: 'crop'; sx: number; sy: number; sw: number; sh: number }
) {
  if (!overlayTrim || w <= 0 || h <= 0) return;
  const scaleRef = w / 800;
  const basePx = fontSizeUi * scaleRef;
  const lineLayout = computeOverlayLineLayout(
    targetCtx,
    overlayTrim,
    w,
    h,
    basePx,
    fontFamily,
    ox,
    oy
  );

  lineLayout.lines.forEach((line, i) => {
    if (!line) return;
    const y = lineLayout.startY + i * lineLayout.lh;
    targetCtx.save();
    targetCtx.font = `800 ${lineLayout.fontSize}px ${fontFamily}, sans-serif`;
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    targetCtx.lineWidth = Math.max(1, lineLayout.fontSize * 0.065);
    targetCtx.lineJoin = 'round';
    targetCtx.strokeStyle = strokeColor;
    targetCtx.strokeText(line, lineLayout.cx, y);
    targetCtx.fillStyle = fillColor;
    targetCtx.fillText(line, lineLayout.cx, y);
    targetCtx.restore();
  });

  const tc = document.createElement('canvas');
  tc.width = w;
  tc.height = h;
  const tctx = tc.getContext('2d');
  if (!tctx) return;
  applyHighFidelity2d(tctx);
  tctx.font = `800 ${lineLayout.fontSize}px ${fontFamily}, sans-serif`;
  tctx.textAlign = 'center';
  tctx.textBaseline = 'middle';
  lineLayout.lines.forEach((line, i) => {
    if (!line) return;
    tctx.fillStyle = shapeColor;
    tctx.fillText(line, lineLayout.cx, lineLayout.startY + i * lineLayout.lh);
  });
  tctx.globalCompositeOperation = 'source-in';
  if (photoInText.mode === 'stretch-full') {
    tctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, w, h);
  } else {
    const { sx, sy, sw, sh } = photoInText;
    tctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
  }
  targetCtx.drawImage(tc, 0, 0);
}

/** 在 (0,0) 中心绘制形状路径，size 为外接直径 */
function addShapePath(ctx: CanvasRenderingContext2D, kind: ShapeKind, size: number) {
  const r = size / 2;
  switch (kind) {
    case 'circle':
    case 'random':
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      break;
    case 'square':
      ctx.rect(-r, -r, size, size);
      break;
    case 'star': {
      const spikes = 5;
      const outerR = r;
      const innerR = r * 0.38;
      for (let i = 0; i < spikes * 2; i++) {
        const rad = (i * Math.PI) / spikes - Math.PI / 2;
        const rr = i % 2 === 0 ? outerR : innerR;
        const x = Math.cos(rad) * rr;
        const y = Math.sin(rad) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'drop': {
      // 底部控制点与底点同高，保证底部切线水平 → 圆润水滴底；否则会出现上下双尖菱形
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.78, -r * 0.38, r * 0.92, r, 0, r);
      ctx.bezierCurveTo(-r * 0.92, r, -r * 0.78, -r * 0.38, 0, -r);
      ctx.closePath();
      break;
    }
    case 'snowflake': {
      // 六角雪花轮廓：主尖角 + 两臂间凹谷 + 主枝两侧凸棱（避免与「六角星」混淆）
      const tipR = r;
      const valleyR = r * 0.26;
      const sideR = r * 0.86;
      const arms = 6;
      for (let k = 0; k < arms; k++) {
        const a = -Math.PI / 2 + k * (Math.PI / 3);
        const v0 = a - Math.PI / 6;
        const v1 = a + Math.PI / 6;
        const sideA1 = a - Math.PI / 11;
        const sideA2 = a + Math.PI / 11;
        const x0 = Math.cos(v0) * valleyR;
        const y0 = Math.sin(v0) * valleyR;
        const xs1 = Math.cos(sideA1) * sideR;
        const ys1 = Math.sin(sideA1) * sideR;
        const xt = Math.cos(a) * tipR;
        const yt = Math.sin(a) * tipR;
        const xs2 = Math.cos(sideA2) * sideR;
        const ys2 = Math.sin(sideA2) * sideR;
        const x1 = Math.cos(v1) * valleyR;
        const y1 = Math.sin(v1) * valleyR;
        if (k === 0) ctx.moveTo(x0, y0);
        else ctx.lineTo(x0, y0);
        ctx.lineTo(xs1, ys1);
        ctx.lineTo(xt, yt);
        ctx.lineTo(xs2, ys2);
        ctx.lineTo(x1, y1);
      }
      ctx.closePath();
      break;
    }
    case 'heart': {
      ctx.moveTo(0, r * 0.25);
      ctx.bezierCurveTo(0, -r * 0.35, -r * 0.65, -r * 0.35, -r * 0.65, 0);
      ctx.bezierCurveTo(-r * 0.65, r * 0.42, 0, r * 0.95, 0, r);
      ctx.bezierCurveTo(0, r * 0.95, r * 0.65, r * 0.42, r * 0.65, 0);
      ctx.bezierCurveTo(r * 0.65, -r * 0.35, 0, -r * 0.35, 0, r * 0.25);
      ctx.closePath();
      break;
    }
    case 'randomLetters':
    case 'symbol':
      break;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function rgbToCss(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/** 与 block 画布绘制规则一致，在像素坐标采样颜色（供逻辑复用） */
function sampleBlockPatternColor(
  px: number,
  py: number,
  width: number,
  height: number,
  composition: CompositionMode,
  bg: { type: BackgroundType; color1: string; color2: string; stripeSize: number; gradientAngle: number }
): string {
  const x = Math.min(width - 1e-6, Math.max(0, px));
  const y = Math.min(height - 1e-6, Math.max(0, py));
  if (bg.type === 'solid') return bg.color1;
  if (bg.type === 'gradient') {
    const angle = bg.gradientAngle * (Math.PI / 180);
    const cx = width / 2;
    const cy = height / 2;
    const length = Math.max(width, height);
    const x1 = cx - (Math.cos(angle) * length) / 2;
    const y1 = cy - (Math.sin(angle) * length) / 2;
    const x2 = cx + (Math.cos(angle) * length) / 2;
    const y2 = cy + (Math.sin(angle) * length) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - x1) * dx + (y - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const a = hexToRgb(bg.color1);
    const b = hexToRgb(bg.color2);
    return rgbToCss(
      a.r + (b.r - a.r) * t,
      a.g + (b.g - a.g) * t,
      a.b + (b.b - a.b) * t
    );
  }
  if (bg.type === 'split') {
    const s = Math.max(1, bg.stripeSize);
    const isVertical = composition === 'block-left' || composition === 'block-right';
    if (isVertical) {
      const band = Math.floor(x / s) % 2;
      return band === 0 ? bg.color2 : bg.color1;
    }
    const band = Math.floor(y / s) % 2;
    return band === 0 ? bg.color2 : bg.color1;
  }
  return bg.color1;
}

/** 在原点绘制挖空形状（调用方已 translate + rotate） */
function fillCutoutShapeAtOrigin(
  ctx: CanvasRenderingContext2D,
  c: Cutout,
  currentSize: number,
  fillStyle: string,
  customSymbolPool: string
) {
  ctx.fillStyle = fillStyle;
  if (isGlyphShapeKind(c.shapeKind)) {
    ctx.font = `bold ${currentSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cutoutGlyphChar(c, customSymbolPool), 0, 0);
  } else if (c.shapeKind) {
    ctx.beginPath();
    addShapePath(ctx, c.shapeKind, currentSize);
    ctx.fill();
  } else {
    ctx.font = `bold ${currentSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.char || 'A', 0, 0);
  }
}

/** 与主画布 / 导出色块面一致：整幅 w×h 上铺背景（条纹方向随 composition） */
function paintBlockFillOnContext(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bgConfig: {
    type: BackgroundType;
    color1: string;
    color2: string;
    stripeSize: number;
    gradientAngle: number;
    bgImage: HTMLImageElement | null;
  },
  composition: CompositionMode
) {
  if (bgConfig.type === 'image' && bgConfig.bgImage) {
    const img = bgConfig.bgImage;
    const pattern = ctx.createPattern(img, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (bgConfig.type === 'gradient') {
    const angle = bgConfig.gradientAngle * (Math.PI / 180);
    const cx = w / 2;
    const cy = h / 2;
    const length = Math.max(w, h);
    const x1 = cx - (Math.cos(angle) * length) / 2;
    const y1 = cy - (Math.sin(angle) * length) / 2;
    const x2 = cx + (Math.cos(angle) * length) / 2;
    const y2 = cy + (Math.sin(angle) * length) / 2;
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, bgConfig.color1);
    gradient.addColorStop(1, bgConfig.color2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  } else if (bgConfig.type === 'split') {
    const s = Math.max(1, bgConfig.stripeSize);
    const isVertical = composition === 'block-left' || composition === 'block-right';
    if (isVertical) {
      for (let x = 0; x < w; x += s * 2) {
        ctx.fillStyle = bgConfig.color1;
        ctx.fillRect(x, 0, Math.min(s, w - x), h);
        ctx.fillStyle = bgConfig.color2;
        ctx.fillRect(x + s, 0, Math.min(s, w - x - s), h);
      }
    } else {
      for (let y = 0; y < h; y += s * 2) {
        ctx.fillStyle = bgConfig.color1;
        ctx.fillRect(0, y, w, Math.min(s, h - y));
        ctx.fillStyle = bgConfig.color2;
        ctx.fillRect(0, y + s, w, Math.min(s, h - y - s));
      }
    }
  } else {
    ctx.fillStyle = bgConfig.color1;
    ctx.fillRect(0, 0, w, h);
  }
}

/** 在已有底图上绘制「形状内清除为透明」（用于色块面板导出：洞里露底色条纹，不填图片） */
function drawCutoutsAsHoles(
  ctx: CanvasRenderingContext2D,
  mainW: number,
  mainH: number,
  cutouts: Cutout[],
  cutoutConfig: {
    baseSize: number;
    variation: number;
    scatterCount: number;
    distributionMode: DistributionMode;
    creationMode: CreationMode;
    customShapeSymbol: string;
  },
  selectedId: string | null,
  showSelectionHighlight: boolean
) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const isSyncMode =
    cutoutConfig.distributionMode === 'sync' || cutoutConfig.creationMode === 'manual';

  cutouts.forEach((c, index) => {
    const currentSize =
      (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (mainW / 800);
    const count = isSyncMode ? 1 : cutoutConfig.scatterCount;

    if (count <= 1) {
      ctx.save();
      let dx = c.x * mainW;
      let dy = c.y * mainH;
      if (!isSyncMode) {
        dx = ((Math.sin(index * 123.456) + 1) / 2) * mainW;
        dy = ((Math.cos(index * 789.012) + 1) / 2) * mainH;
      }
      ctx.translate(dx, dy);
      ctx.rotate(c.angle);
      ctx.fillStyle = 'white';
      if (isGlyphShapeKind(c.shapeKind)) {
        ctx.font = `bold ${currentSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cutoutGlyphChar(c, cutoutConfig.customShapeSymbol), 0, 0);
      } else if (c.shapeKind) {
        ctx.beginPath();
        addShapePath(ctx, c.shapeKind, currentSize);
        ctx.fill();
      } else {
        ctx.font = `bold ${currentSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.char || 'A', 0, 0);
      }
      ctx.restore();

      if (showSelectionHighlight && c.id === selectedId) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.translate(dx, dy);
        ctx.rotate(c.angle);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        if (isGlyphShapeKind(c.shapeKind)) {
          const char = cutoutGlyphChar(c, cutoutConfig.customShapeSymbol);
          ctx.font = `bold ${currentSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const metrics = ctx.measureText(char);
          ctx.strokeRect(-metrics.width / 2 - 4, -currentSize / 2 - 4, metrics.width + 8, currentSize + 8);
        } else if (c.shapeKind) {
          ctx.beginPath();
          addShapePath(ctx, c.shapeKind, currentSize + 6);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else {
      ctx.save();
      let baseX: number;
      let baseY: number;
      if (isSyncMode) {
        baseX = c.x * mainW;
        baseY = c.y * mainH;
      } else {
        baseX = ((Math.sin(index * 123.456) + 1) / 2) * mainW;
        baseY = ((Math.cos(index * 789.012) + 1) / 2) * mainH;
      }
      ctx.translate(baseX, baseY);
      ctx.rotate(c.angle);

      const rng = (seed: number) => Math.abs(Math.sin(seed * 9301 + 49297) * 233280) % 1;
      const kind = c.shapeKind;

      for (let s = 0; s < count; s++) {
        const r1 = rng(index * 100 + s * 7 + 1);
        const r2 = rng(index * 100 + s * 13 + 2);
        const r3 = rng(index * 100 + s * 17 + 3);
        const r4 = rng(index * 100 + s * 19 + 4);
        const angle = r1 * Math.PI * 2;
        const dist = r2 * currentSize * 0.8;
        const offx = Math.cos(angle) * dist;
        const offy = Math.sin(angle) * dist;
        const scale = 0.3 + r3 * 0.7;
        const scSize = currentSize * scale;

        ctx.save();
        ctx.translate(offx, offy);
        ctx.rotate(r4 * Math.PI * 2);
        ctx.fillStyle = 'white';
        if (isGlyphShapeKind(kind)) {
          ctx.font = `bold ${scSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const ch = glyphCharForScatterSlice(c, s, cutoutConfig.customShapeSymbol);
          ctx.fillText(ch, 0, 0);
        } else if (kind) {
          ctx.beginPath();
          addShapePath(ctx, kind, scSize);
          ctx.fill();
        } else {
          ctx.font = `bold ${scSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(c.char || 'A', 0, 0);
        }
        ctx.restore();
      }

      if (showSelectionHighlight && c.id === selectedId) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.translate(baseX, baseY);
        ctx.rotate(c.angle);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, currentSize + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
  });
  ctx.restore();
}

/** 在已有底图上绘制「形状内透出原图」；色块侧用 revealPhoto=true。主图侧应用 false，保留条带采样色的实体形状，仅可选绘制选中框。 */
function drawCutoutsWithPhotoReveal(
  mainCtx: CanvasRenderingContext2D,
  mainW: number,
  mainH: number,
  image: HTMLImageElement,
  cutouts: Cutout[],
  cutoutConfig: {
    baseSize: number;
    variation: number;
    scatterCount: number;
    distributionMode: DistributionMode;
    creationMode: CreationMode;
    customShapeSymbol: string;
    shapeColor: string;
  },
  selectedId: string | null,
  showSelectionHighlight: boolean,
  revealPhoto = true
) {
  const isSyncMode =
    cutoutConfig.distributionMode === 'sync' || cutoutConfig.creationMode === 'manual';

  cutouts.forEach((c, index) => {
    const currentSize =
      (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (mainW / 800);
    const count = isSyncMode ? 1 : cutoutConfig.scatterCount;

    if (count <= 1) {
      mainCtx.save();
      let dx = c.x * mainW;
      let dy = c.y * mainH;

      if (!isSyncMode) {
        const seedX = index * 123.456;
        const seedY = index * 789.012;
        dx = ((Math.sin(seedX) + 1) / 2) * mainW;
        dy = ((Math.cos(seedY) + 1) / 2) * mainH;
      }

      mainCtx.translate(dx, dy);
      mainCtx.rotate(c.angle);
      if (revealPhoto) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = currentSize * 2;
        tempCanvas.height = currentSize * 2;
        const tctx = tempCanvas.getContext('2d');
        if (tctx) {
          applyHighFidelity2d(tctx);
          tctx.save();
          tctx.translate(currentSize, currentSize);
          if (isGlyphShapeKind(c.shapeKind)) {
            tctx.font = `bold ${currentSize}px sans-serif`;
            tctx.textAlign = 'center';
            tctx.textBaseline = 'middle';
            tctx.fillStyle = cutoutConfig.shapeColor;
            tctx.fillText(cutoutGlyphChar(c, cutoutConfig.customShapeSymbol), 0, 0);
          } else if (c.shapeKind) {
            tctx.beginPath();
            addShapePath(tctx, c.shapeKind, currentSize);
            tctx.fillStyle = cutoutConfig.shapeColor;
            tctx.fill();
          } else {
            tctx.font = `bold ${currentSize}px sans-serif`;
            tctx.textAlign = 'center';
            tctx.textBaseline = 'middle';
            tctx.fillStyle = cutoutConfig.shapeColor;
            tctx.fillText(c.char || 'A', 0, 0);
          }
          tctx.restore();
          tctx.globalCompositeOperation = 'source-in';
          tctx.drawImage(
            image,
            dx - currentSize,
            dy - currentSize,
            currentSize * 2,
            currentSize * 2,
            0,
            0,
            currentSize * 2,
            currentSize * 2
          );
          mainCtx.drawImage(tempCanvas, -currentSize, -currentSize);
        }
      }
      mainCtx.restore();

      if (showSelectionHighlight && c.id === selectedId) {
        mainCtx.save();
        mainCtx.translate(dx, dy);
        mainCtx.rotate(c.angle);
        mainCtx.strokeStyle = '#22c55e';
        mainCtx.lineWidth = 3;
        mainCtx.setLineDash([6, 4]);
        if (isGlyphShapeKind(c.shapeKind)) {
          const char = cutoutGlyphChar(c, cutoutConfig.customShapeSymbol);
          mainCtx.font = `bold ${currentSize}px sans-serif`;
          mainCtx.textAlign = 'center';
          mainCtx.textBaseline = 'middle';
          const metrics = mainCtx.measureText(char);
          mainCtx.strokeRect(
            -metrics.width / 2 - 4,
            -currentSize / 2 - 4,
            metrics.width + 8,
            currentSize + 8
          );
        } else if (c.shapeKind) {
          mainCtx.beginPath();
          addShapePath(mainCtx, c.shapeKind, currentSize + 6);
          mainCtx.stroke();
        }
        mainCtx.restore();
      }
    } else {
      mainCtx.save();
      let baseX: number;
      let baseY: number;
      if (isSyncMode) {
        baseX = c.x * mainW;
        baseY = c.y * mainH;
      } else {
        baseX = ((Math.sin(index * 123.456) + 1) / 2) * mainW;
        baseY = ((Math.cos(index * 789.012) + 1) / 2) * mainH;
      }
      mainCtx.translate(baseX, baseY);
      mainCtx.rotate(c.angle);

      const rng = (seed: number) => Math.abs(Math.sin(seed * 9301 + 49297) * 233280) % 1;

      for (let s = 0; s < count; s++) {
        const r1 = rng(index * 100 + s * 7 + 1);
        const r2 = rng(index * 100 + s * 13 + 2);
        const r3 = rng(index * 100 + s * 17 + 3);
        const r4 = rng(index * 100 + s * 19 + 4);
        const angle = r1 * Math.PI * 2;
        const dist = r2 * currentSize * 0.8;
        const offx = Math.cos(angle) * dist;
        const offy = Math.sin(angle) * dist;
        const scale = 0.3 + r3 * 0.7;
        const sc = currentSize * scale * 0.5;
        const scSize = currentSize * scale;
        const kind = c.shapeKind;

        mainCtx.save();
        mainCtx.translate(offx, offy);
        mainCtx.rotate(r4 * Math.PI * 2);

        if (revealPhoto) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = sc * 2;
          tempCanvas.height = sc * 2;
          const tctx = tempCanvas.getContext('2d');
          if (tctx) {
            applyHighFidelity2d(tctx);
            tctx.save();
            tctx.translate(sc, sc);
            tctx.fillStyle = cutoutConfig.shapeColor;
            if (isGlyphShapeKind(kind)) {
              tctx.font = `bold ${scSize}px sans-serif`;
              tctx.textAlign = 'center';
              tctx.textBaseline = 'middle';
              const ch = glyphCharForScatterSlice(c, s, cutoutConfig.customShapeSymbol);
              tctx.fillText(ch, 0, 0);
            } else if (kind) {
              tctx.beginPath();
              addShapePath(tctx, kind, scSize);
              tctx.fill();
            } else {
              tctx.font = `bold ${scSize}px sans-serif`;
              tctx.textAlign = 'center';
              tctx.textBaseline = 'middle';
              tctx.fillText(c.char || 'A', 0, 0);
            }
            tctx.restore();
            tctx.globalCompositeOperation = 'source-in';
            tctx.drawImage(
              image,
              baseX + offx - sc,
              baseY + offy - sc,
              sc * 2,
              sc * 2,
              0,
              0,
              sc * 2,
              sc * 2
            );
            mainCtx.drawImage(tempCanvas, -sc, -sc);
          }
        }
        mainCtx.restore();
      }

      if (showSelectionHighlight && c.id === selectedId) {
        mainCtx.save();
        mainCtx.translate(baseX, baseY);
        mainCtx.rotate(c.angle);
        mainCtx.strokeStyle = '#22c55e';
        mainCtx.lineWidth = 3;
        mainCtx.setLineDash([6, 4]);
        mainCtx.beginPath();
        mainCtx.arc(0, 0, currentSize + 10, 0, Math.PI * 2);
        mainCtx.stroke();
        mainCtx.restore();
      }
      mainCtx.restore();
    }
  });
}

const COMPOSITIONS: { value: CompositionMode; label: string; icon: React.FC<{ size?: number; strokeWidth?: number }> }[] = [
  { value: 'block-bottom', label: '色块在下方', icon: AlignEndHorizontal },
  { value: 'block-top', label: '色块在上方', icon: AlignStartHorizontal },
  { value: 'block-left', label: '色块在左侧', icon: AlignStartVertical },
  { value: 'block-right', label: '色块在右侧', icon: AlignEndVertical },
];

// --- Main Application ---

export default function App() {
  // --- State ---
  const [activeTab, setActiveTab] = useState<BottomNavTab | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cutouts, setCutouts] = useState<Cutout[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pickingTarget, setPickingTarget] = useState<string | null>(null);
  const pickingTargetRef = useRef<string | null>(null);
  pickingTargetRef.current = pickingTarget;
  const [elementsPanelTab, setElementsPanelTab] = useState<ElementsPanelTab>('shape');

  const [expandedSlider, setExpandedSlider] = useState<string | null>(null);

  // 1. Canvas Configuration
  const [composition, setComposition] = useState<CompositionMode>('block-bottom');
  const [zoom, setZoom] = useState(0.6);
  /** 色块在「主图+色块」整条里所占比例，20%–100%（100% 内部按 99% 计算避免除零） */
  /** 默认 100%：主图区与色块区各一整格原图尺寸（总预览为原图 2 倍宽或 2 倍高） */
  const [blockAreaPercent, setBlockAreaPercent] = useState(100);
  const blockStripRatio = Math.min(0.99, Math.max(0.2, blockAreaPercent / 100));

  useEffect(() => {
    setPickingTarget(null);
  }, [activeTab]);

  const settingsPanelOpen = activeTab === 'background' || activeTab === 'elements';

  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const bottomNavRef = useRef<HTMLElement>(null);

  /** 预览容器的 object-fit contain 尺寸（固定像素，不含 zoom 缩放） */
  const [contain, setContain] = useState({
    w: 0,
    h: 0,
    ox: 0,
    oy: 0,
    mainW: 0,
    mainH: 0,
    blockW: 0,
    blockH: 0,
  });
  /** 主内容区（有稳定宽高），用于测量；勿用预览自身 0×0 盒子做唯一尺寸来源 */
  const previewStageRef = useRef<HTMLDivElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);

  /** 点击面板、底栏、顶栏以外的区域时收起设置面板（含取色、展开滑块） */
  useEffect(() => {
    if (!settingsPanelOpen) return;
    const onPointerDownCapture = (e: PointerEvent) => {
      const t = e.target as Node;
      if (settingsPanelRef.current?.contains(t)) return;
      if (bottomNavRef.current?.contains(t)) return;
      const headerEl = document.querySelector('header');
      if (headerEl?.contains(t)) return;
      // 取色模式：点击主图/色块画布由各自 mousedown 读像素并 setBg；若在此清空 picking，画布收不到 pickingTarget
      if (pickingTargetRef.current) {
        if (mainCanvasRef.current?.contains(t)) return;
        if (blockCanvasRef.current?.contains(t)) return;
      }
      setActiveTab(null);
      setPickingTarget(null);
      setExpandedSlider(null);
    };
    document.addEventListener('pointerdown', onPointerDownCapture, true);
    return () => document.removeEventListener('pointerdown', onPointerDownCapture, true);
  }, [settingsPanelOpen]);

  const fitToScreen = useCallback(() => {
    if (!image) return;
    
    // Calculate available space more accurately
    const headerHeight = 64;
    const navHeight = 64;
    const padding = 40;
    
    // We want to fit in the space between header and bottom nav
    // If settings panel is open, it takes up more space
    const settingsPanelHeight = settingsPanelOpen ? window.innerHeight * 0.32 : 0;
    
    const availableWidth = window.innerWidth - padding;
    const availableHeight = window.innerHeight - headerHeight - navHeight - settingsPanelHeight - padding;
    
    // 预览为「主图 + 色块」2 倍宽或 2 倍高，按此估算缩放
    const isVert = composition === 'block-bottom' || composition === 'block-top';
    const totalWidth = isVert ? image.width : image.width * 2;
    const totalHeight = isVert ? image.height * 2 : image.height;

    const scaleX = availableWidth / totalWidth;
    const scaleY = availableHeight / totalHeight;

    const newZoom = Math.min(scaleX, scaleY, 1);
    setZoom(newZoom);
  }, [image, composition, settingsPanelOpen]);

  useEffect(() => {
    fitToScreen();
    window.addEventListener('resize', fitToScreen);
    return () => window.removeEventListener('resize', fitToScreen);
  }, [image, composition, settingsPanelOpen, fitToScreen]);

  const measurePreviewContain = useCallback(() => {
    const img = image;
    if (!img || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;

    const stage = previewStageRef.current;
    let av = stage?.clientWidth ?? 0;
    let ah = stage?.clientHeight ?? 0;
    if (stage) {
      const rect = stage.getBoundingClientRect();
      if (av <= 0) av = Math.round(rect.width);
      if (ah <= 0) ah = Math.round(rect.height);
    }

    if (av <= 0 || ah <= 0) {
      const padding = 40;
      const headerHeight = 64;
      const navHeight = 64;
      const settingsPanelHeight = settingsPanelOpen ? window.innerHeight * 0.32 : 0;
      av = Math.max(120, window.innerWidth - padding);
      ah = Math.max(
        120,
        window.innerHeight - headerHeight - navHeight - settingsPanelHeight - padding
      );
    }

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const isVertical = composition === 'block-bottom' || composition === 'block-top';
    // 整块预览：竖排 宽×(2高)，横排 (2宽)×高
    const scale = isVertical
      ? Math.min(av / iw, ah / (ih * 2))
      : Math.min(av / (iw * 2), ah / ih);
    const cw = iw * scale;
    const ch = ih * scale;
    /** 预览内色块区占「一整格原图」的比例（导出仍用 blockStripRatio） */
    const rPrev = Math.min(1, Math.max(0.2, blockAreaPercent / 100));
    let mainW: number;
    let mainH: number;
    let blockW: number;
    let blockH: number;
    if (isVertical) {
      blockH = ch * rPrev;
      mainH = ch * 2 - blockH;
      mainW = cw;
      blockW = cw;
      setContain({
        w: cw,
        h: ch * 2,
        ox: (av - cw) / 2,
        oy: (ah - ch * 2) / 2,
        mainW,
        mainH,
        blockW,
        blockH,
      });
    } else {
      blockW = cw * rPrev;
      mainW = cw * 2 - blockW;
      mainH = ch;
      blockH = ch;
      setContain({
        w: cw * 2,
        h: ch,
        ox: (av - cw * 2) / 2,
        oy: (ah - ch) / 2,
        mainW,
        mainH,
        blockW,
        blockH,
      });
    }
  }, [image, composition, blockAreaPercent, settingsPanelOpen]);

  useLayoutEffect(() => {
    if (!image) return;
    measurePreviewContain();
    const id = requestAnimationFrame(() => measurePreviewContain());
    return () => cancelAnimationFrame(id);
  }, [image, composition, blockAreaPercent, settingsPanelOpen, measurePreviewContain]);

  useEffect(() => {
    if (!image) return;
    const stage = previewStageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(() => measurePreviewContain());
    ro.observe(stage);
    return () => ro.disconnect();
  }, [image, measurePreviewContain]);

  // 2. Background Configuration
  const [bgConfig, setBgConfig] = useState({
    type: 'split' as BackgroundType,
    color1: '#e63946',
    color2: '#a8dadc',
    stripeSize: 48,
    gradientAngle: 90, // 渐变角度（度）
    bgImage: null as HTMLImageElement | null,
  });

  // 3. Shape Configuration
  const [cutoutConfig, setCutoutConfig] = useState({
    baseSize: 24,
    variation: 2,
    autoCount: 24,
    creationMode: 'auto' as CreationMode,
    distributionMode: 'sync' as DistributionMode,
    defaultShapeKind: 'random' as ShapeKind,
    /** 形状类型为「符号」时：可输入多个字符，生成时随机取其一 */
    customShapeSymbol: '★♥●',
    /** 形状挖空后填入的颜色（全局统一） */
    shapeColor: '#ffffff',
    /** 每个元素位置散落的形状数量（>=1，1=单个形状） */
    scatterCount: 3,
    /** 自动排布时禁止落入画面中心的比例（归一化距离，约 0.22≈挡脸区，0 为关闭硬禁区） */
    centerSafeRadius: 0.22,
  });

  const [overlayTextConfig, setOverlayTextConfig] = useState({
    content: '',
    fontSize: 52,
    fontFamily: '"Noto Sans SC", sans-serif',
    fillColor: '#ffffff',
    strokeColor: '#000000',
    /** 叠字在画面中的相对位置 (0–1)，默认居中 */
    x: 0.5,
    y: 0.5,
  });

  const overlayTextConfigRef = useRef(overlayTextConfig);
  overlayTextConfigRef.current = overlayTextConfig;

  /** 叠字面板内部 Tab：字体 / 样式 */
  const [overlayPanelTab, setOverlayPanelTab] = useState<'font' | 'style'>('font');

  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
  const [isResizingOverlay, setIsResizingOverlay] = useState(false);
  const overlayDragStartRef = useRef({ mouseX: 0, mouseY: 0, ox: 0, oy: 0 });
  const overlayResizeStartRef = useRef({ mouseY: 0, fontSize: 0 });

  // --- Refs ---
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const blockCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const resizeDragRef = useRef<{
    startDist: number;
    startSizeCanvas: number;
    cutoutId: string;
    centerX: number;
    centerY: number;
    scale: number;
    baseSize: number;
    variation: number;
    imgW: number;
  } | null>(null);

  // Logic
  const generateAutoCutouts = useCallback(
    (opts?: { defaultShapeKind?: ShapeKind; autoCount?: number; imageOverride?: HTMLImageElement }) => {
    const img = opts?.imageOverride ?? image;
    if (!img) return;
    const { autoCount, baseSize, variation, centerSafeRadius } = cutoutConfig;
    const count = Math.max(1, Math.round(opts?.autoCount ?? autoCount));
    const dkForGen = opts?.defaultShapeKind ?? cutoutConfig.defaultShapeKind;
    const newCutouts: Cutout[] = [];
    const maxAttempts = 100;
    const safeR = Math.max(0, Math.min(0.42, centerSafeRadius));
    const stripR = Math.min(0.99, Math.max(0.2, blockAreaPercent / 100));
    const { mainW, mainH } = getLayoutDimensions(composition, stripR, img.width, img.height);

    // 碰撞参考尺寸：与主图区宽高比一致（主图区坐标 0–1）
    const refW = 800;
    const refH = (mainH / mainW) * refW;

    for (let i = 0; i < count; i++) {
      let placed = false;
      let attempts = 0;
      
      while (!placed && attempts < maxAttempts) {
        let x = Math.random();
        let y = Math.random();
        
        const distFromCenter = distFromNormCenter(x, y);

        // 硬禁区：保护区内的点一律不要（全程生效，避免后半段采样堆到人脸）
        if (safeR > 0 && distFromCenter < safeR) {
          attempts++;
          continue;
        }

        // 软偏好：越靠边越容易保留（全程生效）
        const keepProb = Math.pow(Math.min(distFromCenter, 0.707) / 0.5, 1.65);
        if (Math.random() > keepProb) {
          attempts++;
          continue;
        }

        const sizeFactor = Math.random() - 0.5;
        const currentSize = baseSize + sizeFactor * variation * 10;
        const angle = Math.random() * Math.PI * 2;
        
        // Check collision with existing shapes
        const collision = newCutouts.some(other => {
          const otherSize = baseSize + other.sizeFactor * variation * 10;
          const dx = (x - other.x) * refW;
          const dy = (y - other.y) * refH;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = (currentSize + otherSize) / 2 + 20; // 20px padding
          return distance < minDistance;
        });

        if (!collision) {
          const base = {
            id: Math.random().toString(36).substr(2, 9),
            x,
            y,
            sizeFactor,
            angle,
          };
          // 随机选择形状类型（排除 symbol 和 randomLetters，这两个由全局配置控制）
          const shapeKinds: Exclude<ShapeKind, 'symbol' | 'randomLetters'>[] = [
            'circle', 'square', 'star', 'drop', 'snowflake', 'heart'
          ];
          // 仅「随机形状」时从几何库里抽；符号 / 随机字母必须保留 dk，否则会错生成圆星等
          const dk =
            dkForGen === 'random'
              ? shapeKinds[Math.floor(Math.random() * shapeKinds.length)]
              : dkForGen;
          if (dk === 'symbol') {
            newCutouts.push({
              ...base,
              shapeKind: 'symbol',
              char: pickRandomSymbolChar(cutoutConfig.customShapeSymbol),
            });
          } else if (dk === 'randomLetters') {
            newCutouts.push({
              ...base,
              shapeKind: 'randomLetters',
              char: randomUpperLetter(),
            });
          } else {
            newCutouts.push({
              ...base,
              shapeKind: dk,
            });
          }
          placed = true;
        }
        attempts++;
      }
    }
    if (newCutouts.length === 0 && count >= 1) {
      newCutouts.push(
        createFallbackCutout(dkForGen, cutoutConfig.customShapeSymbol, Math.max(safeR, 0.12))
      );
    }
    setCutouts(newCutouts);
    setSelectedId(null);
  },
  [cutoutConfig, image, composition, blockAreaPercent]);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileInput = e.currentTarget;

    let blobToLoad: Blob;

    const isHeic = file.type === 'image/heic'
      || file.type === 'image/heif'
      || file.name.toLowerCase().endsWith('.heic')
      || file.name.toLowerCase().endsWith('.heif');

    if (isHeic) {
      try {
        const converted = await heic2any({
          blob: file,
          toType: 'image/png',
        });
        blobToLoad = Array.isArray(converted) ? converted[0] : converted;
      } catch {
        alert('无法读取此图片（HEIC/Live Photos 格式），请尝试先在手机相册中将图片另存为 JPG/PNG 格式。');
        return;
      }
    } else {
      blobToLoad = file;
    }

    const objectUrl = URL.createObjectURL(blobToLoad);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      setImage(img);
      setImagePos({ x: 0, y: 0 }); // Reset position
      // Auto-set composition based on aspect ratio
      if (img.height > img.width) {
        setComposition('block-right'); // Portrait -> Horizontal layout
      } else {
        setComposition('block-bottom'); // Landscape -> Vertical layout
      }
      generateAutoCutouts({ imageOverride: img });
      setTimeout(fitToScreen, 100);
      fileInput.value = '';
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      alert('无法读取此图片，请换一张或检查文件是否损坏。');
    };
    img.src = objectUrl;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.stopPropagation(); // 阻止冒泡到 preview stage 的 pointerdown 捕获监听器（后者会清 pickingTarget）
    if (!mainCanvasRef.current || !image) return;

    const canvasEl = mainCanvasRef.current;
    const canvasW = canvasEl.width;
    const canvasH = canvasEl.height;
    const { x, y } = clientToCanvasPixels(canvasEl, e.clientX, e.clientY);

    const imgWidth = canvasW;
    const imgHeight = canvasH;

    // 背景取色优先：避免点到形状时无法取色、或手动模式误加元素
    if (pickingTarget) {
      const ctx = mainCanvasRef.current.getContext('2d');
      const xi = Math.max(0, Math.min(imgWidth - 1, Math.floor(x)));
      const yi = Math.max(0, Math.min(imgHeight - 1, Math.floor(y)));
      if (ctx && imgWidth > 0 && imgHeight > 0) {
        try {
          const pixel = ctx.getImageData(xi, yi, 1, 1).data;
          const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
          setBgConfig((prev) => ({ ...prev, [pickingTarget]: hex }));
        } catch {
          /* 跨域图污染画布时 getImageData 会失败 */
        }
        setPickingTarget(null);
      }
      return;
    }

    // 1. Check if clicking on a shape
    const nx = x / imgWidth;
    const ny = y / imgHeight;
    
    let clickedId: string | null = null;
    for (let i = cutouts.length - 1; i >= 0; i--) {
      const c = cutouts[i];
      const currentSize = (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (canvasW / 800);
      const dx = (nx - c.x) * imgWidth;
      const dy = (ny - c.y) * imgHeight;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < currentSize / 2 + 5) {
        clickedId = c.id;
        break;
      }
    }

    if (clickedId) {
      setSelectedId(clickedId);
      // Only open panel if it was closed or if we want to show the edit controls
      setActiveTab('elements');
      return;
    }

    // Clicked on background
    const wasPanelOpen = activeTab !== null;
    setSelectedId(null);
    
    // If manual mode, add shape
    // 形状类型解析：处理 random/symbol/randomLetters
    const shapeKinds: Exclude<ShapeKind, 'symbol' | 'randomLetters' | 'random'>[] = [
      'circle', 'square', 'star', 'drop', 'snowflake', 'heart'
    ];
    const resolveKind = (dk: ShapeKind) => {
      if (dk === 'symbol') return { shapeKind: 'symbol' as const, char: pickRandomSymbolChar(cutoutConfig.customShapeSymbol) };
      if (dk === 'randomLetters') return { shapeKind: 'randomLetters' as const, char: randomUpperLetter() };
      if (dk === 'random') return { shapeKind: shapeKinds[Math.floor(Math.random() * shapeKinds.length)] as Cutout['shapeKind'] };
      return { shapeKind: dk };
    };

    if (cutoutConfig.creationMode === 'manual') {
      const { shapeKind, char } = resolveKind(cutoutConfig.defaultShapeKind);
      const newCutout: Cutout = {
        id: Math.random().toString(36).substr(2, 9),
        x: nx,
        y: ny,
        sizeFactor: Math.random() - 0.5,
        angle: Math.random() * Math.PI * 2,
        ...(char !== undefined ? { char } : {}),
        ...(shapeKind !== undefined ? { shapeKind } : {}),
      };
      setCutouts((prev) => [...prev, newCutout]);
      setSelectedId(newCutout.id);
      // If the panel was already open, keep it open. If it was closed, keep it closed.
      if (wasPanelOpen) {
        setActiveTab('elements');
      }
    } else {
      // In auto mode, clicking background closes the panel
      setActiveTab(null);
    }
  };

  /** 色块区域（blockCanvas）点击：选中/新建挖空 */
  const handleBlockCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    if (!blockCanvasRef.current || !image) return;

    const bel = blockCanvasRef.current;
    const canvasW = bel.width;
    const canvasH = bel.height;
    const { x: bx, y: by } = clientToCanvasPixels(bel, e.clientX, e.clientY);
    const bw = canvasW;
    const bh = canvasH;

    if (pickingTarget) {
      const ctx = bel.getContext('2d');
      const xi = Math.max(0, Math.min(canvasW - 1, Math.floor(bx)));
      const yi = Math.max(0, Math.min(canvasH - 1, Math.floor(by)));
      if (ctx && canvasW > 0 && canvasH > 0) {
        try {
          const pixel = ctx.getImageData(xi, yi, 1, 1).data;
          const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
          setBgConfig((prev) => ({ ...prev, [pickingTarget]: hex }));
        } catch {
          /* tainted */
        }
        setPickingTarget(null);
      }
      return;
    }

    // 1. Check if clicking on an existing shape hitbox
    const nx = bx / bw;
    const ny = by / bh;

    let clickedId: string | null = null;
    for (let i = cutouts.length - 1; i >= 0; i--) {
      const c = cutouts[i];
      const currentSize =
        (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) *
        (canvasW / 800);
      const dx = (nx - c.x) * bw;
      const dy = (ny - c.y) * bh;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < currentSize / 2 + 5) {
        clickedId = c.id;
        break;
      }
    }

    if (clickedId) {
      setSelectedId(clickedId);
      setActiveTab('elements');
      return;
    }

    const wasPanelOpen = activeTab !== null;
    setSelectedId(null);

    // 形状类型解析：处理 random/symbol/randomLetters
    const shapeKinds: Exclude<ShapeKind, 'symbol' | 'randomLetters' | 'random'>[] = [
      'circle', 'square', 'star', 'drop', 'snowflake', 'heart'
    ];
    const resolveKind = (dk: ShapeKind) => {
      if (dk === 'symbol') return { shapeKind: 'symbol' as const, char: pickRandomSymbolChar(cutoutConfig.customShapeSymbol) };
      if (dk === 'randomLetters') return { shapeKind: 'randomLetters' as const, char: randomUpperLetter() };
      if (dk === 'random') return { shapeKind: shapeKinds[Math.floor(Math.random() * shapeKinds.length)] as Cutout['shapeKind'] };
      return { shapeKind: dk };
    };

    if (cutoutConfig.creationMode === 'manual') {
      const { shapeKind, char } = resolveKind(cutoutConfig.defaultShapeKind);
      const newCutout: Cutout = {
        id: Math.random().toString(36).substr(2, 9),
        x: nx,
        y: ny,
        sizeFactor: Math.random() - 0.5,
        angle: Math.random() * Math.PI * 2,
        ...(char !== undefined ? { char } : {}),
        ...(shapeKind !== undefined ? { shapeKind } : {}),
      };
      setCutouts((prev) => [...prev, newCutout]);
      setSelectedId(newCutout.id);
      if (wasPanelOpen) {
        setActiveTab('elements');
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingImage) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      const el = mainCanvasRef.current;
      if (!el) return;
      const scale = getCanvasCoverParams(el).scaleCanvasPerCss;

      setImagePos(prev => ({
        x: prev.x + dx * scale,
        y: prev.y + dy * scale
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingImage(false);
    setIsDraggingOverlay(false);
    setIsResizingOverlay(false);
  };

  // ---- Overlay Text: drag (move) ----
  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!blockCanvasRef.current || !image || !overlayTextConfig.content.trim()) return;
    e.stopPropagation();
    const bel = blockCanvasRef.current;
    const cx = overlayTextConfig.x * bel.width;
    const cy = overlayTextConfig.y * bel.height;
    const { x: mx, y: my } = clientToCanvasPixels(bel, e.clientX, e.clientY);
    const dist = Math.hypot(mx - cx, my - cy);
    const approxW = overlayTextConfig.fontSize * getCanvasCoverParams(bel).scaleCanvasPerCss * 3;
    if (dist < Math.max(approxW, 30)) {
      setIsDraggingOverlay(true);
      overlayDragStartRef.current = { mouseX: mx, mouseY: my, ox: overlayTextConfig.x, oy: overlayTextConfig.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingOverlay || !blockCanvasRef.current || !image) return;
    e.stopPropagation();
    const bel = blockCanvasRef.current;
    const { x: mx, y: my } = clientToCanvasPixels(bel, e.clientX, e.clientY);
    const dx = mx - overlayDragStartRef.current.mouseX;
    const dy = my - overlayDragStartRef.current.mouseY;
    setOverlayTextConfig((prev) => ({
      ...prev,
      x: Math.max(0.05, Math.min(0.95, overlayDragStartRef.current.ox + dx / blockCanvasRef.current!.width)),
      y: Math.max(0.05, Math.min(0.95, overlayDragStartRef.current.oy + dy / blockCanvasRef.current!.height)),
    }));
  };

  // ---- Overlay Text: resize (drag vertically) ----
  const handleOverlayResizeMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayTextConfig.content.trim()) return;
    e.stopPropagation();
    setIsResizingOverlay(true);
    overlayResizeStartRef.current = { mouseY: e.clientY, fontSize: overlayTextConfig.fontSize };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleOverlayResizeMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isResizingOverlay) return;
    e.stopPropagation();
    const dy = overlayResizeStartRef.current.mouseY - e.clientY;
    const newSize = Math.max(24, Math.min(160, overlayResizeStartRef.current.fontSize + dy * 0.4));
    setOverlayTextConfig((prev) => ({ ...prev, fontSize: Math.round(newSize) }));
  };

  const beginCutoutResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!mainCanvasRef.current || !image || !selectedId) return;
    const el = mainCanvasRef.current;
    const { rect, offX, offY, dispW, dispH, cw } = getCanvasCoverParams(el);
    const c = cutouts.find((x) => x.id === selectedId);
    if (!c) return;
    const cx = rect.left + offX + c.x * dispW;
    const cy = rect.top + offY + c.y * dispH;
    const startDist = Math.hypot(e.clientX - cx, e.clientY - cy);
    const startSizeCanvas =
      (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (cw / 800);
    resizeDragRef.current = {
      startDist: Math.max(startDist, 4),
      startSizeCanvas,
      cutoutId: c.id,
      centerX: cx,
      centerY: cy,
      scale: getCanvasCoverParams(el).scaleCanvasPerCss,
      baseSize: cutoutConfig.baseSize,
      variation: cutoutConfig.variation,
      imgW: cw,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onCutoutResizePointerMove = (e: React.PointerEvent) => {
    const d = resizeDragRef.current;
    if (!d) return;
    e.preventDefault();
    const dist = Math.hypot(e.clientX - d.centerX, e.clientY - d.centerY);
    const deltaDisplay = dist - d.startDist;
    const deltaCanvas = deltaDisplay * d.scale;
    const newSize = Math.max(8, d.startSizeCanvas + 2 * deltaCanvas);
    const denom = d.variation * 10 + 1e-6;
    const newSF = (newSize / (d.imgW / 800) - d.baseSize) / denom;
    const clamped = Math.max(-0.5, Math.min(1.5, newSF));
    setCutouts((prev) =>
      prev.map((c) => (c.id === d.cutoutId ? { ...c, sizeFactor: clamped } : c))
    );
  };

  const endCutoutResize = (e: React.PointerEvent) => {
    if (!resizeDragRef.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    resizeDragRef.current = null;
  };

  const deleteSelectedCutout = () => {
    if (!selectedId) return;
    setCutouts((prev) => prev.filter((c) => c.id !== selectedId));
    setSelectedId(null);
  };



  useEffect(() => {
    if (!image || !mainCanvasRef.current || !blockCanvasRef.current) return;

    const mainCtx = mainCanvasRef.current.getContext('2d');
    const blockCtx = blockCanvasRef.current.getContext('2d');
    if (!mainCtx || !blockCtx) return;
    applyHighFidelity2d(mainCtx);
    applyHighFidelity2d(blockCtx);

    const r = blockStripRatio;
    const { mainW, mainH, blockW, blockH, cropX, cropY, sw: cropW, sh: cropH } =
      getLayoutDimensions(composition, r, image.width, image.height);

    mainCanvasRef.current.width = mainW;
    mainCanvasRef.current.height = mainH;
    blockCanvasRef.current.width = blockW;
    blockCanvasRef.current.height = blockH;

    const overlayTrim = overlayTextConfig.content.trim();

    // 1. 离屏条带同尺寸：按 (nx,ny) 在 blockW×blockH 上采样，与右侧色块画布像素一致（勿用 mainW 铺条带，否则竖条相位与窄列不符）
    const sampleC = document.createElement('canvas');
    sampleC.width = blockW;
    sampleC.height = blockH;
    const sampleCtx = sampleC.getContext('2d', { willReadFrequently: true });
    if (!sampleCtx) return;
    applyHighFidelity2d(sampleCtx);
    paintBlockFillOnContext(sampleCtx, blockW, blockH, bgConfig, composition);
    const blockImageData = sampleCtx.getImageData(0, 0, blockW, blockH);
    const blockData = blockImageData.data;

    function sampleFromBlockData(nx: number, ny: number): string {
      const px = Math.round(nx * (blockW - 1));
      const py = Math.round(ny * (blockH - 1));
      const idx = (py * blockW + px) * 4;
      return `rgba(${blockData[idx]},${blockData[idx + 1]},${blockData[idx + 2]},${blockData[idx + 3] / 255})`;
    }

    // 2. 主图画布：全图 + 条带采样色形状（叠字在条带画布上绘制，与拖拽框一致）
    mainCtx.clearRect(0, 0, mainW, mainH);
    mainCtx.drawImage(image, 0, 0, mainW, mainH);

    cutouts.forEach((c) => {
      const currentSize =
        (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) *
        (mainW / 800);
      const holeColor = sampleFromBlockData(c.x, c.y);
      mainCtx.save();
      mainCtx.translate(c.x * mainW, c.y * mainH);
      mainCtx.rotate(c.angle);
      fillCutoutShapeAtOrigin(
        mainCtx,
        c,
        currentSize,
        holeColor,
        cutoutConfig.customShapeSymbol
      );
      mainCtx.restore();
    });

    // 3. 主图仅保留条带采样色形状；透出原图只在条带画布
    drawCutoutsWithPhotoReveal(
      mainCtx,
      mainW,
      mainH,
      image,
      cutouts,
      cutoutConfig,
      selectedId,
      true,
      false
    );

    // 4. 条带预览画布：条纹 → 洞中照片 → 叠字（最上层）
    blockCtx.clearRect(0, 0, blockW, blockH);
    paintBlockFillOnContext(blockCtx, blockW, blockH, bgConfig, composition);
    drawCutoutsWithPhotoReveal(
      blockCtx,
      blockW,
      blockH,
      image,
      cutouts,
      cutoutConfig,
      null,
      false
    );
    if (overlayTrim) {
      drawOverlayTextOnContext(
        blockCtx,
        blockW,
        blockH,
        image,
        overlayTrim,
        overlayTextConfig.fontFamily,
        overlayTextConfig.fontSize,
        overlayTextConfig.x,
        overlayTextConfig.y,
        overlayTextConfig.fillColor,
        overlayTextConfig.strokeColor,
        cutoutConfig.shapeColor,
        { mode: 'crop', sx: cropX, sy: cropY, sw: cropW, sh: cropH }
      );
    }
  }, [
    image,
    cutouts,
    composition,
    zoom,
    bgConfig,
    cutoutConfig,
    selectedId,
    imagePos,
    overlayTextConfig,
    blockAreaPercent,
  ]);

  const handleSave = async () => {
    if (!mainCanvasRef.current || !image) return;

    const mainCanvas = mainCanvasRef.current;
    const iw = image.width;
    const ih = image.height;

    const blockPanel = document.createElement('canvas');
    blockPanel.width = iw;
    blockPanel.height = ih;
    const bctx = blockPanel.getContext('2d');
    if (!bctx) return;
    applyHighFidelity2d(bctx);
    paintBlockFillOnContext(bctx, iw, ih, bgConfig, composition);
    drawCutoutsWithPhotoReveal(bctx, iw, ih, image, cutouts, cutoutConfig, null, false);

    const saveOverlayTrim = overlayTextConfig.content.trim();
    if (saveOverlayTrim) {
      drawOverlayTextOnContext(
        bctx,
        iw,
        ih,
        image,
        saveOverlayTrim,
        overlayTextConfig.fontFamily,
        overlayTextConfig.fontSize,
        overlayTextConfig.x,
        overlayTextConfig.y,
        overlayTextConfig.fillColor,
        overlayTextConfig.strokeColor,
        cutoutConfig.shapeColor,
        { mode: 'stretch-full' }
      );
    }

    const saveCanvas = document.createElement('canvas');
    const sctx = saveCanvas.getContext('2d');
    if (!sctx) return;
    applyHighFidelity2d(sctx);

    const horiz = composition === 'block-left' || composition === 'block-right';
    saveCanvas.width = horiz ? iw * 2 : iw;
    saveCanvas.height = horiz ? ih : ih * 2;

    if (composition === 'block-right') {
      sctx.drawImage(mainCanvas, 0, 0, iw, ih);
      sctx.drawImage(blockPanel, iw, 0, iw, ih);
    } else if (composition === 'block-left') {
      sctx.drawImage(blockPanel, 0, 0, iw, ih);
      sctx.drawImage(mainCanvas, iw, 0, iw, ih);
    } else if (composition === 'block-bottom') {
      sctx.drawImage(mainCanvas, 0, 0, iw, ih);
      sctx.drawImage(blockPanel, 0, ih, iw, ih);
    } else {
      sctx.drawImage(blockPanel, 0, 0, iw, ih);
      sctx.drawImage(mainCanvas, 0, ih, iw, ih);
    }

    const filename = `hicolor-${Date.now()}.png`;
    const blob = await new Promise<Blob | null>((resolve) => {
      saveCanvas.toBlob((b) => resolve(b), 'image/png');
    });
    if (!blob) return;

    // 1) Web Share + 文件：移动端保存到相册/微信最可靠（async 仍常保留用户激活）
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const file = new File([blob], filename, { type: 'image/png' });
        const payload: ShareData = { files: [file], title: 'hicolor' };
        if (!navigator.canShare || navigator.canShare(payload)) {
          await navigator.share(payload);
          return;
        }
      } catch (e) {
        const name = e instanceof DOMException ? e.name : '';
        if (name === 'AbortError') return;
      }
    }

    const objectUrl = URL.createObjectURL(blob);

    // 2) iOS：download 常无效；新开标签展示 PNG，用户可长按 → 存储图像，或用 Safari 分享
    if (isLikelyIOS()) {
      const w = window.open(objectUrl, '_blank', 'noopener,noreferrer');
      if (w) {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
        return;
      }
    }

    // 3) 桌面 / Android：Blob + download
    try {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.rel = 'noopener';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    }
  };

  const selectedCutoutExists = Boolean(selectedId && cutouts.some((c) => c.id === selectedId));

  const elementSelectedEditor =
    selectedCutoutExists ? (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3 shadow-sm"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-gray-900 uppercase tracking-wider">正在编辑选中形状</span>
          </div>
          <button
            type="button"
            onClick={deleteSelectedCutout}
            className="p-1.5 bg-white text-red-500 rounded-lg hover:bg-red-50 transition-colors shadow-sm border border-red-50"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">大小缩放</label>
              <span className="text-[9px] font-mono font-bold text-gray-900">
                {Math.round((0.5 + (cutouts.find((c) => c.id === selectedId)?.sizeFactor || 0)) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="-0.5"
              max="1.5"
              step="0.01"
              value={cutouts.find((c) => c.id === selectedId)?.sizeFactor || 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setCutouts((prev) =>
                  prev.map((c) => (c.id === selectedId ? { ...c, sizeFactor: val } : c))
                );
              }}
              className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">旋转角度</label>
              <span className="text-[9px] font-mono font-bold text-gray-900">
                {Math.round((((cutouts.find((c) => c.id === selectedId)?.angle || 0) * 180) / Math.PI) % 360)}°
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.PI * 2}
              step="0.01"
              value={cutouts.find((c) => c.id === selectedId)?.angle || 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setCutouts((prev) =>
                  prev.map((c) => (c.id === selectedId ? { ...c, angle: val } : c))
                );
              }}
              className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
            />
          </div>
        </div>
      </motion.div>
    ) : null;

  const elementOverlayTextPanel = (
    <div className="space-y-4">
      {/* 第一行：输入文字 */}
      <textarea
        value={overlayTextConfig.content}
        onChange={(e) =>
          setOverlayTextConfig((prev) => ({ ...prev, content: e.target.value }))
        }
        rows={3}
        className="w-full min-h-[5rem] px-4 py-3 rounded-2xl border border-gray-100 text-sm font-bold text-gray-900 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none bg-white shadow-sm resize-y"
        placeholder="写一句话…可换行"
      />

      {/* Tab 切换：字体 / 样式 */}
      <div className="flex gap-1 rounded-2xl border border-gray-100 bg-gray-50/90 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
        <button
          type="button"
          onClick={() => setOverlayPanelTab('font')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black transition-all ${
            overlayPanelTab === 'font'
              ? 'bg-white text-emerald-800 shadow-sm ring-1 ring-emerald-200/70'
              : 'text-gray-500 hover:bg-white/50 hover:text-gray-700'
          }`}
        >
          <Type size={15} strokeWidth={2.25} className="shrink-0 opacity-90" aria-hidden />
          字体
        </button>
        <button
          type="button"
          onClick={() => setOverlayPanelTab('style')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black transition-all ${
            overlayPanelTab === 'style'
              ? 'bg-white text-emerald-800 shadow-sm ring-1 ring-emerald-200/70'
              : 'text-gray-500 hover:bg-white/50 hover:text-gray-700'
          }`}
        >
          <SlidersHorizontal size={15} strokeWidth={2.25} className="shrink-0 opacity-90" aria-hidden />
          样式
        </button>
      </div>

      {/* 字体 Tab */}
      {overlayPanelTab === 'font' && (
        <div className="flex flex-wrap gap-2">
          {TEXT_FONT_PRESETS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setOverlayTextConfig((prev) => ({ ...prev, fontFamily: f.value }))}
              className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                overlayTextConfig.fontFamily === f.value
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-200/70'
                  : 'bg-white border-gray-100 text-gray-600 hover:border-gray-300'
              }`}
              style={{ fontFamily: f.value.replace(/"/g, '') }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* 样式 Tab：三列并列 — 标题 + 滑块/取色，无图标；点开「样式」即可直接调 */}
      {overlayPanelTab === 'style' && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-gray-400 tracking-[0.2em]">文字样式</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4">
            <div className="min-w-0 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-black text-gray-500">字号</span>
                <span className="text-[11px] font-mono font-bold tabular-nums text-gray-900">
                  {overlayTextConfig.fontSize}
                </span>
              </div>
              <input
                type="range"
                min={24}
                max={160}
                value={overlayTextConfig.fontSize}
                onChange={(e) =>
                  setOverlayTextConfig((prev) => ({ ...prev, fontSize: Number(e.target.value) }))
                }
                className="w-full h-2 rounded-full bg-gray-100 appearance-none cursor-pointer accent-emerald-600"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <span className="block text-[10px] font-black text-gray-500">字体颜色</span>
              <div
                className="relative h-10 w-full overflow-hidden rounded-xl border border-gray-200 shadow-inner"
                style={{ backgroundColor: overlayTextConfig.fillColor }}
              >
                <input
                  type="color"
                  value={overlayTextConfig.fillColor}
                  onChange={(e) => setOverlayTextConfig((prev) => ({ ...prev, fillColor: e.target.value }))}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="字体颜色"
                />
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <span className="block text-[10px] font-black text-gray-500">描边</span>
              <div
                className="relative h-10 w-full overflow-hidden rounded-xl border border-gray-200 shadow-inner"
                style={{ backgroundColor: overlayTextConfig.strokeColor }}
              >
                <input
                  type="color"
                  value={overlayTextConfig.strokeColor}
                  onChange={(e) => setOverlayTextConfig((prev) => ({ ...prev, strokeColor: e.target.value }))}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="描边颜色"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const elementSharedFooter = (
    <>
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">基础大小</label>
            <span className="text-[10px] font-mono font-bold text-gray-900">{cutoutConfig.baseSize}</span>
          </div>
          <input
            type="range"
            min="4"
            max="200"
            value={cutoutConfig.baseSize}
            onChange={(e) => setCutoutConfig((prev) => ({ ...prev, baseSize: Number(e.target.value) }))}
            className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
          />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">随机差异</label>
            <span className="text-[10px] font-mono font-bold text-gray-900">{cutoutConfig.variation}</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={cutoutConfig.variation}
            onChange={(e) => setCutoutConfig((prev) => ({ ...prev, variation: Number(e.target.value) }))}
            className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
          />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">每槽散落数量</label>
            <span className="text-[10px] font-mono font-bold text-gray-900">{cutoutConfig.scatterCount}</span>
          </div>
          <input
            type="range"
            min="1"
            max="12"
            step="1"
            value={cutoutConfig.scatterCount}
            onChange={(e) => setCutoutConfig((prev) => ({ ...prev, scatterCount: Number(e.target.value) }))}
            className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
          />
          <p className="text-[9px] text-gray-400 font-bold">1=单形状，&gt;1=散落小形状群</p>
        </div>

        <div className={`space-y-3 ${cutoutConfig.creationMode === 'manual' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-end">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">形状数量</label>
            <span className="text-[10px] font-mono font-bold text-gray-900">{cutoutConfig.autoCount}</span>
          </div>
          <input
            type="range"
            min="1"
            max="80"
            step="1"
            value={cutoutConfig.autoCount}
            onChange={(e) => {
              const next = Number(e.target.value);
              setCutoutConfig((prev) => ({ ...prev, autoCount: next }));
              if (cutoutConfig.creationMode === 'auto' && image) {
                generateAutoCutouts({ autoCount: next });
              }
            }}
            className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
          />
          {cutoutConfig.creationMode === 'manual' && (
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">自动模式下可调</p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">避开中心</label>
            <span className="text-[10px] font-mono font-bold text-gray-900">
              {Math.round(cutoutConfig.centerSafeRadius * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="38"
            step="1"
            value={Math.round(cutoutConfig.centerSafeRadius * 100)}
            onChange={(e) => {
              const pct = Number(e.target.value);
              const v = Math.min(0.42, Math.max(0, pct / 100));
              setCutoutConfig((prev) => ({ ...prev, centerSafeRadius: v }));
              if (cutoutConfig.creationMode === 'auto' && image) {
                generateAutoCutouts();
              }
            }}
            className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
          />
          <p className="text-[9px] text-gray-400 font-bold leading-snug">
            自动排布时禁止形状落在画面中央一带；调高更靠边，可减少挡住人像主体。设为 0% 则关闭硬禁区（仍略偏好边缘）。
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">形状颜色</label>
        <div
          className="relative h-11 rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
          style={{ backgroundColor: cutoutConfig.shapeColor }}
        >
          <input
            type="color"
            value={cutoutConfig.shapeColor}
            onChange={(e) => setCutoutConfig((prev) => ({ ...prev, shapeColor: e.target.value }))}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>
        <p className="text-[9px] text-gray-400 font-bold leading-snug">
          形状颜色控制色块侧散落形状群内部的填色（主图形状颜色自动跟随条纹/纯色底色）。
        </p>
      </div>

      <div className="space-y-4 pt-4 border-t border-gray-50">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">分布模式</label>
        <div className="flex p-1 bg-gray-100 rounded-2xl">
          {(['sync', 'scatter'] as DistributionMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setCutoutConfig((prev) => ({ ...prev, distributionMode: mode }))}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                cutoutConfig.distributionMode === mode
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {mode === 'sync' ? '对称' : '打散'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-gray-50">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">生成方式</label>
        <div className="flex p-1 bg-gray-100 rounded-2xl">
          {(['auto', 'manual'] as CreationMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setCutoutConfig((prev) => ({ ...prev, creationMode: mode }));
                if (mode === 'auto' && cutouts.length === 0) generateAutoCutouts();
              }}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                cutoutConfig.creationMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {mode === 'auto' ? '自动生成' : '手动点击'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={generateAutoCutouts}
          className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 text-white py-3 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/25 hover:bg-emerald-700 active:scale-95"
        >
          <RefreshCw size={14} />
          <span>重新生成</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setCutouts([]);
            setSelectedId(null);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-600 py-3 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest active:scale-95"
        >
          <Trash2 size={14} />
          <span>清空形状</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => setActiveTab(null)}
        className="w-full py-2.5 bg-gray-50 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-gray-100 hover:text-gray-600 transition-all flex items-center justify-center gap-2"
      >
        <ChevronDown size={16} />
        <span>收起设置面板</span>
      </button>
    </>
  );

  // --- Render Helpers ---

  const renderTabButton = (id: BottomNavTab, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(activeTab === id ? null : id)}
      className={`flex-1 flex flex-col items-center py-3 space-y-1 transition-all relative ${
        activeTab === id ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {activeTab === id && (
        <motion.div layoutId="tab-indicator" className="absolute bottom-0 w-8 h-1 bg-green-500 rounded-t-full" />
      )}
    </button>
  );

  const renderHeader = () => (
    <header className="fixed top-0 left-0 right-0 z-50 flex min-h-14 items-center justify-between border-b border-gray-100 bg-white/80 px-3 pt-[max(0px,env(safe-area-inset-top))] pb-2 backdrop-blur-xl sm:min-h-16 sm:px-6 sm:pb-0">
      <div className="flex items-center">
        <h1 className="text-lg font-black tracking-tighter text-gray-900 italic leading-none sm:text-xl">hicolor</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full bg-gray-50 p-2 text-gray-600 transition-all hover:bg-gray-100 active:scale-90 sm:p-2.5"
          title="上传图片"
        >
          <Upload size={20} />
        </button>
        {image && (
          <button 
            onClick={handleSave}
            className="group flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-700 active:scale-95 sm:gap-2 sm:px-6 sm:py-2.5"
            title="保存作品"
          >
            <Download size={18} className="transition-transform group-hover:translate-y-0.5 sm:size-5" />
            <span className="text-[11px] font-black uppercase tracking-widest sm:text-[13px]">保存</span>
            <span className="hidden text-[13px] font-black uppercase tracking-widest sm:inline">作品</span>
          </button>
        )}
      </div>
    </header>
  );

  const renderBottomNav = () => (
    <nav ref={bottomNavRef} className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-gray-100 pb-safe z-50">
      <div className="flex justify-around items-center h-14 px-4">
        {renderTabButton('background', <Palette size={22} />, '背景')}
        {renderTabButton('elements', <Target size={22} />, '元素')}
      </div>
    </nav>
  );

  const renderSettingsPanel = () => {
    if (!settingsPanelOpen) return null;
    return (
    <div ref={settingsPanelRef} className="fixed bottom-16 left-0 right-0 z-40 max-h-[min(38dvh,20rem)] overflow-y-auto border-t border-gray-50 bg-white/95 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl custom-scrollbar sm:max-h-[30vh]">
      <div className="relative mx-auto max-w-2xl space-y-4 px-4 pb-6 pt-3 sm:space-y-5 sm:p-5 sm:pb-8">
        <button 
          onClick={() => setActiveTab(null)}
          className="absolute right-2 top-3 z-10 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-800 sm:right-4 sm:top-4"
          title="收起面板"
        >
          <X size={20} />
        </button>
        <AnimatePresence mode="wait">
          {activeTab === 'background' && (
            <motion.div
              key="background"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              {/* 版面：排版 + 色块占比 */}
              <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/50 p-3 pr-10">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">排版模式</label>
                  <div className="grid w-full grid-cols-4 gap-1.5">
                    {COMPOSITIONS.map((c) => {
                      const Icon = c.icon;
                      const active = composition === c.value;
                      return (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setComposition(c.value)}
                          className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-0.5 py-2 shadow-sm transition-all ${
                            active
                              ? 'border-emerald-400 bg-white text-emerald-900 ring-1 ring-emerald-200/70'
                              : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                          }`}
                        >
                          <Icon size={16} strokeWidth={active ? 2.5 : 1.5} className="shrink-0" />
                          <span className="line-clamp-2 text-center text-[7px] font-bold leading-tight">{c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2 border-t border-gray-100/80 pt-3">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">色块占比</label>
                    <span className="text-[10px] font-mono font-bold text-gray-900">{Math.round(blockAreaPercent)}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    step={1}
                    value={blockAreaPercent}
                    onChange={(e) => setBlockAreaPercent(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
                  />
                  <p className="text-[8px] font-bold text-gray-400 leading-snug">
                    调整色块在整版中的高度或宽度占比（20%–100%），与自动适配一起生效，导出一致
                  </p>
                </div>
              </div>

              {/* 底图：四选一 */}
              <div className="space-y-2 pr-10">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">底图类型</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      { type: 'solid' as const, label: '纯色' },
                      { type: 'split' as const, label: '双拼色' },
                      { type: 'gradient' as const, label: '渐变' },
                      { type: 'image' as const, label: '图片' },
                    ] as const
                  ).map(({ type, label }) => {
                    const active = bgConfig.type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setBgConfig((prev) => ({ ...prev, type }))}
                        className={`rounded-xl border py-2.5 text-center text-[11px] font-black shadow-sm transition-all sm:text-xs ${
                          active
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/70'
                            : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 色彩：随类型显示 */}
              {bgConfig.type !== 'image' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    {bgConfig.type === 'solid' ? '背景颜色' : '色彩配置'}
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {bgConfig.type !== 'solid' && (
                        <span className="text-[8px] font-black text-gray-400">颜色一</span>
                      )}
                      <div className="group relative">
                        <div
                          className="w-full h-11 rounded-xl border border-gray-100 relative overflow-hidden shadow-inner"
                          style={{ backgroundColor: bgConfig.color1 }}
                        >
                          <input
                            type="color"
                            value={bgConfig.color1}
                            onChange={(e) => setBgConfig((prev) => ({ ...prev, color1: e.target.value }))}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setPickingTarget(pickingTarget === 'color1' ? null : 'color1')}
                          className={`absolute -top-1.5 -right-1.5 p-1 rounded-md shadow-md border transition-all ${
                            pickingTarget === 'color1'
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-300 scale-110'
                              : 'bg-white text-gray-400 border-gray-100 hover:text-emerald-700'
                          }`}
                        >
                          <Pipette size={11} />
                        </button>
                      </div>
                    </div>
                    {(bgConfig.type === 'gradient' || bgConfig.type === 'split') && (
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <span className="text-[8px] font-black text-gray-400">颜色二</span>
                        <div className="group relative">
                          <div
                            className="w-full h-11 rounded-xl border border-gray-100 relative overflow-hidden shadow-inner"
                            style={{ backgroundColor: bgConfig.color2 }}
                          >
                            <input
                              type="color"
                              value={bgConfig.color2}
                              onChange={(e) => setBgConfig((prev) => ({ ...prev, color2: e.target.value }))}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setPickingTarget(pickingTarget === 'color2' ? null : 'color2')}
                            className={`absolute -top-1.5 -right-1.5 p-1 rounded-md shadow-md border transition-all ${
                              pickingTarget === 'color2'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300 scale-110'
                                : 'bg-white text-gray-400 border-gray-100 hover:text-emerald-700'
                            }`}
                          >
                            <Pipette size={11} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 渐变角度 */}
                  {bgConfig.type === 'gradient' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">渐变角度</label>
                        <span className="text-[10px] font-mono font-bold text-gray-900">{bgConfig.gradientAngle}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={bgConfig.gradientAngle}
                        onChange={(e) => setBgConfig((prev) => ({ ...prev, gradientAngle: Number(e.target.value) }))}
                        className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>
                  )}

                  {pickingTarget && (
                    <p className="text-[9px] text-center text-black font-black animate-pulse uppercase tracking-widest">
                      请点击画面中的位置进行取色...
                    </p>
                  )}
                </div>
              )}

              {bgConfig.type === 'split' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">条纹宽度</label>
                    <span className="text-[10px] font-mono font-bold text-gray-900">{bgConfig.stripeSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="128"
                    step="4"
                    value={bgConfig.stripeSize}
                    onChange={(e) => setBgConfig((prev) => ({ ...prev, stripeSize: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>
              )}

              {bgConfig.type === 'gradient' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">渐变角度</label>
                    <span className="text-[10px] font-mono font-bold text-gray-900">{bgConfig.gradientAngle}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={bgConfig.gradientAngle}
                    onChange={(e) => setBgConfig((prev) => ({ ...prev, gradientAngle: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>
              )}

              {bgConfig.type === 'image' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">背景图片</label>
                  <input
                    type="file"
                    accept="image/*"
                    ref={bgImageInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                          setBgConfig((prev) => ({ ...prev, bgImage: img }));
                        };
                        img.src = event.target?.result as string;
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => bgImageInputRef.current?.click()}
                    className="w-full py-2.5 px-4 rounded-2xl border border-gray-100 bg-white text-gray-700 text-xs font-black hover:border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Upload size={16} />
                    {bgConfig.bgImage ? '更换图片' : '上传图片'}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'elements' && (
            <motion.div
              key="elements"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {elementsPanelTab === 'shape' && elementSelectedEditor}

              {/* 形状/叠字切换标签栏 */}
              <div className="-mx-6 px-6 py-2 bg-white/95 border-b border-gray-100">
                <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-2xl mr-11 sm:mr-12">
                  {(
                    [
                      { tab: 'shape' as const, label: '形状' },
                      { tab: 'overlay' as const, label: '叠字' },
                    ] as const
                  ).map(({ tab, label }) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setElementsPanelTab(tab)}
                      className={`py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[12px] font-black transition-all ${
                        elementsPanelTab === tab
                          ? 'bg-white text-gray-900 shadow-md'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

                {/* 形状类型：单行横向排列，可左右滑动 */}
                {elementsPanelTab === 'shape' && (
                  <div className="pt-2 border-t border-gray-100/90">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">形状类型</label>
                    <div className="-mx-1 flex flex-nowrap items-start gap-2 overflow-x-auto overflow-y-visible px-1 pt-1.5 pb-1 sm:mx-0 sm:px-0">
                      {SHAPE_OPTIONS.map(({ value, icon: ShapeIcon, title, caption }) => {
                        const selectedCutout = selectedId ? cutouts.find((c) => c.id === selectedId) : undefined;
                        let activeShapeKind: ShapeKind | null = cutoutConfig.defaultShapeKind;
                        if (selectedCutout) activeShapeKind = selectedCutout.shapeKind ?? null;
                        const active = activeShapeKind !== null && activeShapeKind === value;
                        return (
                          <div key={value} className="flex w-[3.25rem] min-w-[3.25rem] shrink-0 flex-col items-center gap-0.5">
                            <button
                              type="button"
                              title={title}
                              aria-label={title}
                              onClick={() => {
                                if (cutoutConfig.creationMode === 'auto') {
                                  if (value === 'symbol') {
                                    setCutoutConfig((prev) => ({ ...prev, defaultShapeKind: 'symbol' }));
                                    generateAutoCutouts({ defaultShapeKind: 'symbol' });
                                  } else if (value === 'randomLetters') {
                                    setCutoutConfig((prev) => ({ ...prev, defaultShapeKind: 'randomLetters' }));
                                    generateAutoCutouts({ defaultShapeKind: 'randomLetters' });
                                  } else {
                                    setCutoutConfig((prev) => ({ ...prev, defaultShapeKind: value }));
                                    generateAutoCutouts({ defaultShapeKind: value });
                                  }
                                  return;
                                }
                                const pool = cutoutConfig.customShapeSymbol;
                                if (value === 'symbol') {
                                  setCutoutConfig((prev) => ({ ...prev, defaultShapeKind: 'symbol' }));
                                  setCutouts((prev) =>
                                    image && prev.length === 0
                                      ? [
                                          createFallbackCutout(
                                            'symbol',
                                            pool,
                                            Math.max(cutoutConfig.centerSafeRadius, 0.12)
                                          ),
                                        ]
                                      : prev.map((c) => ({
                                          ...c,
                                          shapeKind: 'symbol' as ShapeKind,
                                          char: pickRandomSymbolChar(pool),
                                        }))
                                  );
                                } else if (value === 'randomLetters') {
                                  setCutoutConfig((prev) => ({ ...prev, defaultShapeKind: 'randomLetters' }));
                                  setCutouts((prev) =>
                                    image && prev.length === 0
                                      ? [
                                          createFallbackCutout(
                                            'randomLetters',
                                            pool,
                                            Math.max(cutoutConfig.centerSafeRadius, 0.12)
                                          ),
                                        ]
                                      : prev.map((c) => ({
                                          ...c,
                                          shapeKind: 'randomLetters' as ShapeKind,
                                          char: randomUpperLetter(),
                                        }))
                                  );
                                } else {
                                  setCutoutConfig((prev) => ({ ...prev, defaultShapeKind: value }));
                                  setCutouts((prev) =>
                                    image && prev.length === 0
                                      ? [
                                          createFallbackCutout(
                                            value,
                                            pool,
                                            Math.max(cutoutConfig.centerSafeRadius, 0.12)
                                          ),
                                        ]
                                      : prev.map((c) => ({
                                          ...c,
                                          shapeKind: value as ShapeKind,
                                          char: undefined,
                                        }))
                                  );
                                }
                              }}
                              className={`h-9 w-9 flex items-center justify-center rounded-full transition-all ${
                                active
                                  ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/25'
                                  : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'
                              }`}
                            >
                              <ShapeIcon size={15} strokeWidth={active ? 2.25 : 1.65} aria-hidden />
                            </button>
                            <span
                              className={`text-[7px] font-black leading-snug tracking-tight text-center ${
                                active ? 'text-emerald-800' : 'text-gray-600'
                              }`}
                            >
                              {caption}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* 符号池输入框（在符号类型选中时显示在同一行） */}
                    {cutoutConfig.defaultShapeKind === 'symbol' && (
                      <div className="flex items-center gap-2 pt-1.5">
                        <input
                          type="text"
                          value={cutoutConfig.customShapeSymbol}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCutoutConfig((prev) => ({ ...prev, customShapeSymbol: val }));
                            const g = [...val].filter(Boolean);
                            setCutouts((prev) =>
                              prev.map((c) =>
                                c.shapeKind === 'symbol'
                                  ? { ...c, char: g.length ? pickRandomSymbolChar(val) : '★' }
                                  : c
                              )
                            );
                          }}
                          className="flex-1 h-8 px-3 rounded-full border border-gray-200 text-xs font-black text-center focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none bg-white shadow-sm"
                          placeholder="输入符号，如 ★♥●"
                          aria-label="自定义符号池"
                        />
                      </div>
                    )}

                    {/* 取消形状按钮 */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        title="取消形状"
                        aria-label="取消形状"
                        onClick={() => {
                          setCutouts([]);
                          setSelectedId(null);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-black hover:bg-red-50 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={12} />
                        <span>清空形状</span>
                      </button>
                    </div>

                    {/* 形状调整：6个圆形控制按钮 */}
                    <div className="space-y-2 pt-2">
                      <p className="text-[10px] font-black text-gray-400 tracking-[0.2em]">形状调整</p>
                      <div className="flex items-start gap-1.5 overflow-x-auto px-1">
                        {/* 形状大小 */}
                        <div className={`flex w-[4rem] min-w-[4rem] shrink-0 flex-col items-center gap-1 ${cutoutConfig.creationMode === 'manual' ? 'opacity-40' : ''}`}>
                          <button type="button" onClick={() => setExpandedSlider(expandedSlider === 'baseSize' ? null : 'baseSize')}
                            className={`h-[3rem] w-[3rem] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all ${expandedSlider === 'baseSize' ? 'bg-emerald-700 text-white' : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'}`}>
                            <Images size={13} strokeWidth={expandedSlider === 'baseSize' ? 2.2 : 1.65} />
                            <span className={`text-[9px] font-mono font-bold tabular-nums leading-none ${expandedSlider === 'baseSize' ? 'text-white' : 'text-gray-400'}`}>{cutoutConfig.baseSize}</span>
                          </button>
                          <span className={`text-[7px] font-black leading-snug tracking-tight ${expandedSlider === 'baseSize' ? 'text-emerald-800' : 'text-gray-700'}`}>形状大小</span>
                        </div>

                        {/* 形状数量 */}
                        <div className={`flex w-[4rem] min-w-[4rem] shrink-0 flex-col items-center gap-1 ${cutoutConfig.creationMode === 'manual' ? 'opacity-40' : ''}`}>
                          <button type="button" onClick={() => cutoutConfig.creationMode !== 'manual' && setExpandedSlider(expandedSlider === 'autoCount' ? null : 'autoCount')}
                            className={`h-[3rem] w-[3rem] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all ${expandedSlider === 'autoCount' && cutoutConfig.creationMode !== 'manual' ? 'bg-emerald-700 text-white' : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'}`}>
                            <ImageIcon size={13} strokeWidth={expandedSlider === 'autoCount' ? 2.2 : 1.65} />
                            <span className={`text-[9px] font-mono font-bold tabular-nums leading-none ${expandedSlider === 'autoCount' && cutoutConfig.creationMode !== 'manual' ? 'text-white' : 'text-gray-400'}`}>{cutoutConfig.autoCount}</span>
                          </button>
                          <span className={`text-[7px] font-black leading-snug tracking-tight ${expandedSlider === 'autoCount' && cutoutConfig.creationMode !== 'manual' ? 'text-emerald-800' : 'text-gray-700'}`}>形状数量</span>
                        </div>

                        {/* 随机差异 */}
                        <div className={`flex w-[4rem] min-w-[4rem] shrink-0 flex-col items-center gap-1 ${cutoutConfig.creationMode === 'manual' ? 'opacity-40' : ''}`}>
                          <button type="button" onClick={() => setExpandedSlider(expandedSlider === 'variation' ? null : 'variation')}
                            className={`h-[3rem] w-[3rem] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all ${expandedSlider === 'variation' ? 'bg-emerald-700 text-white' : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'}`}>
                            <Sun size={13} strokeWidth={expandedSlider === 'variation' ? 2.2 : 1.65} />
                            <span className={`text-[9px] font-mono font-bold tabular-nums leading-none ${expandedSlider === 'variation' ? 'text-white' : 'text-gray-400'}`}>{cutoutConfig.variation}</span>
                          </button>
                          <span className={`text-[7px] font-black leading-snug tracking-tight ${expandedSlider === 'variation' ? 'text-emerald-800' : 'text-gray-700'}`}>随机差异</span>
                        </div>

                        {/* 避开中心 */}
                        <div className={`flex w-[4rem] min-w-[4rem] shrink-0 flex-col items-center gap-1 ${cutoutConfig.creationMode === 'manual' ? 'opacity-40' : ''}`}>
                          <button type="button" onClick={() => cutoutConfig.creationMode !== 'manual' && setExpandedSlider(expandedSlider === 'centerSafe' ? null : 'centerSafe')}
                            className={`h-[3rem] w-[3rem] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all ${expandedSlider === 'centerSafe' && cutoutConfig.creationMode !== 'manual' ? 'bg-emerald-700 text-white' : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'}`}>
                            <Target size={13} strokeWidth={expandedSlider === 'centerSafe' ? 2.2 : 1.65} />
                            <span className={`text-[9px] font-mono font-bold tabular-nums leading-none ${expandedSlider === 'centerSafe' && cutoutConfig.creationMode !== 'manual' ? 'text-white' : 'text-gray-400'}`}>{Math.round(cutoutConfig.centerSafeRadius * 100)}%</span>
                          </button>
                          <span className={`text-[7px] font-black leading-snug tracking-tight ${expandedSlider === 'centerSafe' && cutoutConfig.creationMode !== 'manual' ? 'text-emerald-800' : 'text-gray-700'}`}>避开中心</span>
                        </div>

                        {/* 元素打散 */}
                        <div className="flex w-[4rem] min-w-[4rem] shrink-0 flex-col items-center gap-1">
                          <button type="button" onClick={() => setCutoutConfig((prev) => ({ ...prev, distributionMode: prev.distributionMode === 'sync' ? 'scatter' : 'sync' }))}
                            className={`h-[3rem] w-[3rem] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all ${cutoutConfig.distributionMode === 'scatter' ? 'bg-emerald-700 text-white' : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'}`}>
                            <Sparkles size={13} strokeWidth={cutoutConfig.distributionMode === 'scatter' ? 2.2 : 1.65} />
                            <span className={`text-[9px] font-mono font-bold leading-none ${cutoutConfig.distributionMode === 'scatter' ? 'text-white' : 'text-gray-400'}`}>{cutoutConfig.distributionMode === 'scatter' ? '开' : '关'}</span>
                          </button>
                          <span className={`text-[7px] font-black leading-snug tracking-tight ${cutoutConfig.distributionMode === 'scatter' ? 'text-emerald-800' : 'text-gray-700'}`}>元素打散</span>
                        </div>

                        {/* 手动添加 */}
                        <div className="flex w-[4rem] min-w-[4rem] shrink-0 flex-col items-center gap-1">
                          <button type="button" onClick={() => { const next = cutoutConfig.creationMode === 'manual' ? 'auto' : 'manual'; setCutoutConfig((prev) => ({ ...prev, creationMode: next })); if (next === 'auto' && cutouts.length === 0) generateAutoCutouts(); }}
                            className={`h-[3rem] w-[3rem] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all ${cutoutConfig.creationMode === 'manual' ? 'bg-emerald-700 text-white' : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'}`}>
                            <Triangle size={13} strokeWidth={cutoutConfig.creationMode === 'manual' ? 2.2 : 1.65} />
                            <span className={`text-[9px] font-mono font-bold leading-none ${cutoutConfig.creationMode === 'manual' ? 'text-white' : 'text-gray-400'}`}>{cutoutConfig.creationMode === 'manual' ? '开' : '关'}</span>
                          </button>
                          <span className={`text-[7px] font-black leading-snug tracking-tight ${cutoutConfig.creationMode === 'manual' ? 'text-emerald-800' : 'text-gray-700'}`}>手动添加</span>
                        </div>
                      </div>

                      {/* 展开的滑块 */}
                      <div className="space-y-2 pt-1">
                        {expandedSlider === 'baseSize' && cutoutConfig.creationMode !== 'manual' && (
                          <input type="range" min="4" max="200" value={cutoutConfig.baseSize}
                            onChange={(e) => setCutoutConfig((prev) => ({ ...prev, baseSize: Number(e.target.value) }))}
                            className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600" />
                        )}
                        {expandedSlider === 'autoCount' && cutoutConfig.creationMode !== 'manual' && (
                          <input type="range" min="1" max="80" step="1" value={cutoutConfig.autoCount}
                            onChange={(e) => { const next = Number(e.target.value); setCutoutConfig((prev) => ({ ...prev, autoCount: next })); if (image) generateAutoCutouts({ autoCount: next }); }}
                            className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600" />
                        )}
                        {expandedSlider === 'variation' && cutoutConfig.creationMode !== 'manual' && (
                          <input type="range" min="0" max="10" step="0.5" value={cutoutConfig.variation}
                            onChange={(e) => setCutoutConfig((prev) => ({ ...prev, variation: Number(e.target.value) }))}
                            className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600" />
                        )}
                        {expandedSlider === 'centerSafe' && cutoutConfig.creationMode !== 'manual' && (
                          <input type="range" min="0" max="38" step="1" value={Math.round(cutoutConfig.centerSafeRadius * 100)}
                            onChange={(e) => { const pct = Number(e.target.value); const v = Math.min(0.42, Math.max(0, pct / 100)); setCutoutConfig((prev) => ({ ...prev, centerSafeRadius: v })); if (image) generateAutoCutouts(); }}
                            className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600" />
                        )}
                      </div>
                    </div>

                    {/* 重新生成 */}
                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={generateAutoCutouts}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 text-white py-3 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/25 hover:bg-emerald-700 active:scale-95">
                        <RefreshCw size={14} /><span>重新生成</span>
                      </button>
                    </div>
                  </div>
                )}

                {elementsPanelTab === 'overlay' && (
                  <div className="pt-2 border-t border-gray-100/90 pr-10 sm:pr-12">
                    {elementOverlayTextPanel}
                  </div>
                )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-emerald-100 selection:text-emerald-900 overflow-hidden">
      {renderHeader()}
      
      <main
        className={`fixed inset-0 overflow-hidden pb-16 pt-14 flex items-center justify-center sm:pt-16 ${
          pickingTarget ? 'cursor-crosshair' : ''
        }`}
      >
        <div
          ref={previewStageRef}
          className={`custom-scrollbar flex h-full w-full max-w-[100vw] flex-col items-center justify-center overflow-auto p-2 sm:p-4 md:p-12`}
          style={{ maxHeight: 'calc(100dvh - 7rem - env(safe-area-inset-top, 0px))' }}
        >
          {image && cutoutConfig.creationMode === 'manual' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 px-4 py-1.5 bg-emerald-50/80 backdrop-blur-md rounded-full border border-emerald-100/80 flex items-center gap-2"
            >
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">手动点击模式: 点击画布添加元素</span>
            </motion.div>
          )}
          {!image ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-10"
            >
              <div className="relative inline-block">
                <div className="absolute -inset-10 bg-emerald-100/30 blur-3xl rounded-full" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="relative mx-auto flex h-52 w-full max-w-sm flex-col items-center justify-center space-y-5 rounded-[2.5rem] border-2 border-dashed border-gray-200 bg-white/80 transition-all duration-500 hover:border-emerald-400 hover:bg-white hover:shadow-2xl group sm:h-56 sm:rounded-[3rem]"
                >
                  <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center text-gray-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 group-hover:rotate-12 transition-all duration-500">
                    <Upload className="w-7 h-7 text-gray-400 group-hover:text-white" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-black text-gray-900 uppercase tracking-widest">上传图片开始创作</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.2em]">Support JPG, PNG, WEBP</p>
                  </div>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 0 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                y: settingsPanelOpen ? -(window.innerHeight * 0.32) / 2 : 0
              }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              ref={previewWrapRef}
              className={`flex ${
                composition === 'block-bottom' ? 'flex-col' :
                composition === 'block-top' ? 'flex-col-reverse' :
                composition === 'block-right' ? 'flex-row' : 'flex-row-reverse'
              } shadow-[0_40px_100px_-20px_rgba(0,0,0,0.2)] items-stretch justify-center gap-0 p-0 overflow-hidden bg-white flex-shrink-0`}
              style={{
                width: contain.w,
                height: contain.h,
              }}
            >
              {/* 主图区：cover 铺满无灰边；位图仍为原图分辨率，仅预览裁边，导出不变 */}
              <div
                className="relative min-h-0 min-w-0 overflow-hidden"
                style={
                  composition === 'block-bottom' || composition === 'block-top'
                    ? {
                        flexGrow: 0,
                        flexShrink: 0,
                        width: '100%',
                        height: contain.mainH,
                        minHeight: 0,
                      }
                    : {
                        flexGrow: 0,
                        flexShrink: 0,
                        height: '100%',
                        width: contain.mainW,
                        minWidth: 0,
                      }
                }
              >
                <canvas
                  ref={mainCanvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  className={`absolute inset-0 block h-full w-full border-none p-0 m-0 ${isDraggingImage ? 'cursor-grabbing' : 'cursor-grab'}`}
                  style={{
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                {selectedId && (() => {
                  const c = cutouts.find((x) => x.id === selectedId);
                  if (!c) return null;
                  const el = mainCanvasRef.current;
                  const cwPx = el?.width ?? image.width;
                  const currentSize =
                    (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (cwPx / 800);
                  let leftPct = c.x * 100;
                  let topPct = c.y * 100;
                  let boxPx = currentSize;
                  if (el && el.width > 0 && el.height > 0) {
                    const { rw, rh, dispW, dispH, offX, offY, cw } = getCanvasCoverParams(el);
                    if (rw > 0 && rh > 0) {
                      leftPct = ((offX + c.x * dispW) / rw) * 100;
                      topPct = ((offY + c.y * dispH) / rh) * 100;
                      boxPx = currentSize * (dispW / cw);
                    }
                  }
                  const handleCls =
                    'absolute w-4 h-4 bg-white border-2 border-emerald-500 rounded-full shadow-md pointer-events-auto touch-none z-20';
                  return (
                    <div className="absolute inset-0 pointer-events-none z-10 overflow-visible">
                      <div
                        className="absolute pointer-events-auto"
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: boxPx,
                          height: boxPx,
                          transform: `translate(-50%, -50%) rotate(${c.angle}rad)`,
                          transformOrigin: 'center center',
                        }}
                      >
                        <div
                          className="absolute inset-0 z-[5] cursor-default"
                          onPointerDown={(e) => e.stopPropagation()}
                          aria-hidden
                        />
                        {/* 虚线边框 */}
                        <div
                          className="absolute inset-0 border-2 border-dashed border-green-500 pointer-events-none z-[6]"
                          style={{
                            boxSizing: 'border-box',
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.5), 0 0 8px rgba(34,197,94,0.3)',
                          }}
                        />
                        {/* 左上角控制点 */}
                        <div
                          role="presentation"
                          className={`${handleCls} -left-2 -top-2 cursor-nwse-resize`}
                          onPointerDown={(e) => beginCutoutResize(e)}
                          onPointerMove={onCutoutResizePointerMove}
                          onPointerUp={endCutoutResize}
                          onPointerCancel={endCutoutResize}
                        />
                        {/* 右上角控制点 + 删除按钮 */}
                        <div
                          role="presentation"
                          className={`${handleCls} -right-2 -top-2 cursor-nesw-resize`}
                          onPointerDown={(e) => beginCutoutResize(e)}
                          onPointerMove={onCutoutResizePointerMove}
                          onPointerUp={endCutoutResize}
                          onPointerCancel={endCutoutResize}
                        />
                        <button
                          type="button"
                          title="删除"
                          aria-label="删除选中形状"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            deleteSelectedCutout();
                          }}
                          className="absolute z-40 flex items-center justify-center w-6 h-6 rounded-full bg-white text-red-500 shadow-lg pointer-events-auto hover:bg-red-500 hover:text-white active:scale-95 border border-gray-200"
                          style={{ right: -12, top: -12 }}
                        >
                          <X size={14} strokeWidth={3} />
                        </button>
                        {/* 左下角控制点 */}
                        <div
                          role="presentation"
                          className={`${handleCls} -left-2 -bottom-2 cursor-nesw-resize`}
                          onPointerDown={(e) => beginCutoutResize(e)}
                          onPointerMove={onCutoutResizePointerMove}
                          onPointerUp={endCutoutResize}
                          onPointerCancel={endCutoutResize}
                        />
                        {/* 右下角控制点 */}
                        <div
                          role="presentation"
                          className={`${handleCls} -right-2 -bottom-2 cursor-nwse-resize`}
                          onPointerDown={(e) => beginCutoutResize(e)}
                          onPointerMove={onCutoutResizePointerMove}
                          onPointerUp={endCutoutResize}
                          onPointerCancel={endCutoutResize}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div
                className="relative min-h-0 min-w-0 overflow-hidden leading-[0]"
                style={
                  composition === 'block-bottom' || composition === 'block-top'
                    ? {
                        flexGrow: 0,
                        flexShrink: 0,
                        width: '100%',
                        height: contain.blockH,
                        minHeight: 0,
                      }
                    : {
                        flexGrow: 0,
                        flexShrink: 0,
                        height: '100%',
                        width: contain.blockW,
                        minWidth: 0,
                      }
                }
              >
                <canvas
                  ref={blockCanvasRef}
                  onMouseDown={handleBlockCanvasMouseDown}
                  onMouseMove={(e) => {
                    handleOverlayMouseMove(e);
                  }}
                  onMouseUp={() => {
                    if (isDraggingOverlay) setIsDraggingOverlay(false);
                    if (isResizingOverlay) setIsResizingOverlay(false);
                  }}
                  onMouseLeave={() => {
                    if (isDraggingOverlay) setIsDraggingOverlay(false);
                    if (isResizingOverlay) setIsResizingOverlay(false);
                  }}
                  onPointerMove={(e) => {
                    handleOverlayMouseMove(e as unknown as React.MouseEvent<HTMLCanvasElement>);
                    if (isDraggingOverlay) e.preventDefault();
                  }}
                  onPointerUp={() => {
                    if (isDraggingOverlay) setIsDraggingOverlay(false);
                    if (isResizingOverlay) setIsResizingOverlay(false);
                  }}
                  className={`absolute inset-0 block h-full w-full border-none p-0 m-0 ${
                    isDraggingOverlay || isResizingOverlay ? 'cursor-grabbing' : 'cursor-crosshair'
                  }`}
                  style={{
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                {overlayTextConfig.content.trim().length > 0 && !selectedId && (() => {
                  const bel = blockCanvasRef.current;
                  let leftPct = overlayTextConfig.x * 100;
                  let topPct = overlayTextConfig.y * 100;
                  let fsPx = overlayTextConfig.fontSize;
                  if (bel && bel.width > 0 && bel.height > 0) {
                    const { rw, rh, dispW, dispH, offX, offY, cw } = getCanvasCoverParams(bel);
                    if (rw > 0 && rh > 0) {
                      leftPct = ((offX + overlayTextConfig.x * dispW) / rw) * 100;
                      topPct = ((offY + overlayTextConfig.y * dispH) / rh) * 100;
                      fsPx = overlayTextConfig.fontSize * (dispW / cw);
                    }
                  }
                  return (
                  <div className="absolute inset-0 pointer-events-none z-10 overflow-visible">
                    <div
                      className="absolute pointer-events-auto"
                      onMouseDown={handleOverlayMouseDown}
                      onMouseMove={handleOverlayMouseMove}
                      onMouseUp={() => {
                        if (isDraggingOverlay) setIsDraggingOverlay(false);
                      }}
                      onMouseLeave={() => {
                        if (isDraggingOverlay) setIsDraggingOverlay(false);
                      }}
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: '100%',
                        height: '100%',
                        transform: 'translate(-50%, -50%)',
                        cursor: isDraggingOverlay ? 'grabbing' : 'grab',
                      }}
                    />
                    <div
                      className="absolute border-2 border-dashed border-blue-400 pointer-events-none z-[6]"
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        minWidth: 80,
                        minHeight: 24,
                        transform: 'translate(-50%, -50%)',
                        boxShadow: '0 0 8px rgba(59,130,246,0.25)',
                      }}
                    />
                    <div
                      role="presentation"
                      className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow-md pointer-events-auto cursor-ns-resize z-20"
                      style={{
                        left: `${leftPct}%`,
                        top: `calc(${topPct}% + ${fsPx}px)`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      onMouseDown={handleOverlayResizeMouseDown}
                      onMouseMove={handleOverlayResizeMouseMove}
                      onMouseUp={() => setIsResizingOverlay(false)}
                    />
                  </div>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </main>

      {image && renderSettingsPanel()}
      {renderBottomNav()}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #eee; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ddd; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}} />
    </div>
  );
}
