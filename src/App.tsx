/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, ChangeEvent } from 'react';
import heic2any from 'heic2any';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
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
  Video,
  Play,
  CloudRain,
  Maximize,
  ChevronRight,
  Layers,
  Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// --- Types & Constants ---

type BottomNavTab = 'background' | 'elements' | 'video';

type AnimationType = 'pulse' | 'batch' | 'rain' | 'stars' | 'none';

type CompositionMode = 'block-bottom' | 'block-top' | 'block-left' | 'block-right';
/** 纯色 | 双拼色(条纹) | 渐变 | 图片 | 格子 | 笔记本 | 棋盘格 | 点阵 */
type BackgroundType = 'solid' | 'split' | 'gradient' | 'image' | 'grid' | 'diagonal' | 'block' | 'dots';
/** 底图纹理类型：无纹理 | 细腻纸张 | 细腻噪点 | 颗粒纸张 | 粗砂纸 */
type TextureType = 'none' | 'fine-paper' | 'fine-noise' | 'grain-paper' | 'coarse-paper';
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
  { value: '"Cinzel", serif', label: 'Cinzel' },
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
    | { mode: 'crop'; sx: number; sy: number; sw: number; sh: number },
  usePhotoFill: boolean = false
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
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    targetCtx.fillStyle = fillColor;
    targetCtx.fillText(line, lineLayout.cx, y);
    targetCtx.restore();
  });

  if (!usePhotoFill) return;

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
  // 笔记本：条纹
  if (bg.type === 'grid') {
    const s = Math.max(2, bg.stripeSize);
    const lineWidth = Math.max(1, Math.floor(s * 0.08) + 1);
    const band = Math.floor(y / s) % 2;
    const yInBand = y % s;
    return (yInBand < lineWidth) ? bg.color2 : bg.color1;
  }
  // 格子：纯格子边框线
  if (bg.type === 'diagonal') {
    const s = Math.max(4, bg.stripeSize);
    const onBorder = (x % s < 0.5) || (y % s < 0.5);
    return onBorder ? bg.color2 : bg.color1;
  }
  // 棋盘格：标准棋盘格
  if (bg.type === 'block') {
    const s = Math.max(2, bg.stripeSize);
    const xBand = Math.floor(x / s) % 2;
    const yBand = Math.floor(y / s) % 2;
    return (xBand + yBand) % 2 === 0 ? bg.color2 : bg.color1;
  }
  // 点阵：圆点阵列
  if (bg.type === 'dots') {
    const s = Math.max(4, bg.stripeSize);
    const cx = (Math.floor(x / s) + 0.5) * s;
    const cy = (Math.floor(y / s) + 0.5) * s;
    const r = s * 0.35;
    const dx = x - cx;
    const dy = y - cy;
    return (dx * dx + dy * dy < r * r) ? bg.color2 : bg.color1;
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

/**
 * 纸张纹理效果生成器
 * 在已绘制的背景上叠加细微的噪声/颗粒纹理，增强纸张质感
 */
function applyPaperTexture(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  textureType: TextureType,
  strengthMultiplier: number = 1.0
) {
  if (textureType === 'none') return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // 获取平均亮度，用于调整纹理强度
  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  const avgBrightness = totalBrightness / (data.length / 4);
  const brightnessFactor = avgBrightness > 128 ? 1 : 0.7; // 暗色背景纹理要弱一些

  // 根据纹理类型设置参数
  let noiseDensity: number;
  let noiseStrength: number;
  let useColorNoise: boolean;

  switch (textureType) {
    case 'fine-paper':
      // 细腻纸张：极低密度、极低强度，微弱颗粒感
      noiseDensity = 0.15;
      noiseStrength = 6 * brightnessFactor * strengthMultiplier;
      useColorNoise = false;
      break;
    case 'fine-noise':
      // 像素风：使用更大的像素块效果
      noiseDensity = 0.6;
      noiseStrength = 20 * brightnessFactor * strengthMultiplier;
      useColorNoise = true;
      break;
    case 'grain-paper':
      // 颗粒纸张：中高密度、中高强度
      noiseDensity = 0.55;
      noiseStrength = 22 * brightnessFactor * strengthMultiplier;
      useColorNoise = false;
      break;
    case 'coarse-paper':
      // 粗砂纸：最高密度、高强度，明显颗粒感
      noiseDensity = 0.85;
      noiseStrength = 35 * brightnessFactor * strengthMultiplier;
      useColorNoise = false;
      break;
    default:
      return;
  }

  // 使用高质量随机数生成器（线性同余生成器）确保纹理稳定性
  let seed = 12345;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };

  const pixelCount = data.length / 4;

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;

    // 只对一定比例的像素应用噪声，实现纹理感而非全像素噪声
    if (random() > noiseDensity) continue;

    // 生成与位置相关的噪声
    const noiseX = (i % w);
    const noiseY = Math.floor(i / w);
    const noiseVal = (Math.sin(noiseX * 12.9898 + noiseY * 78.233) * 43758.5453) % 1;
    const signedNoise = noiseVal - 0.5;

    // 应用噪声到每个通道
    for (let c = 0; c < 3; c++) {
      let noise = signedNoise * noiseStrength;
      if (useColorNoise) {
        // 为 RGB 各通道添加略微不同的噪声，产生色彩噪点效果
        noise *= (0.8 + random() * 0.4);
      }
      data[idx + c] = Math.min(255, Math.max(0, data[idx + c] + noise));
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// 像素风纹理：使用固定的像素块效果
function applyPixelTexture(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength: number
) {
  const pixelSize = 4; // 像素块大小
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // 使用时间作为种子，每次都有不同的随机效果
  const seed = Date.now() % 1000000;
  let currentSeed = seed;
  const random = () => {
    currentSeed = (currentSeed * 1664525 + 1013904223) & 0xffffffff;
    return (currentSeed >>> 0) / 0xffffffff;
  };

  for (let py = 0; py < h; py += pixelSize) {
    for (let px = 0; px < w; px += pixelSize) {
      // 为每个像素块计算一个随机亮度偏移（-strength 到 +strength）
      const brightnessOffset = (random() - 0.5) * strength * 2;
      // 随机色彩偏移，模拟像素游戏的色彩抖动
      const colorShift = (random() - 0.5) * strength * 0.3;

      // 对像素块内的每个像素应用相同的偏移
      for (let dy = 0; dy < pixelSize && py + dy < h; dy++) {
        for (let dx = 0; dx < pixelSize && px + dx < w; dx++) {
          const idx = ((py + dy) * w + (px + dx)) * 4;
          // RGB分别应用不同的偏移，模拟色彩抖动
          data[idx] = Math.min(255, Math.max(0, data[idx] + brightnessOffset + colorShift * random()));
          data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + brightnessOffset + colorShift * random()));
          data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + brightnessOffset + colorShift * random()));
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
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
    texture: TextureType;
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
  } else if (bgConfig.type === 'grid') {
    // 笔记本风格：条纹
    const s = Math.max(2, bgConfig.stripeSize);
    const lineWidth = Math.max(1, Math.floor(s * 0.08) + 1);
    ctx.fillStyle = bgConfig.color1;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = bgConfig.color2;
    const isVertical = composition === 'block-left' || composition === 'block-right';
    if (isVertical) {
      // 垂直条纹
      for (let x = 0; x < w; x += s) {
        ctx.fillRect(x, 0, lineWidth, h);
      }
    } else {
      // 水平条纹
      for (let y = 0; y < h; y += s) {
        ctx.fillRect(0, y, w, lineWidth);
      }
    }
  } else if (bgConfig.type === 'diagonal') {
    // 格子：纯格子边框线
    const s = Math.max(4, bgConfig.stripeSize);
    ctx.fillStyle = bgConfig.color1;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = bgConfig.color2;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += s) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += s) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  } else if (bgConfig.type === 'block') {
    const s = Math.max(4, bgConfig.stripeSize);
    // 先填满底色 color1
    ctx.fillStyle = bgConfig.color1;
    ctx.fillRect(0, 0, w, h);
    // 棋盘格：交替用 color2 填充
    ctx.fillStyle = bgConfig.color2;
    for (let gy = 0; gy < h; gy += s) {
      for (let gx = 0; gx < w; gx += s) {
        if (((Math.floor(gx / s) + Math.floor(gy / s)) % 2 === 0)) {
          ctx.fillRect(gx, gy, s, s);
        }
      }
    }
  } else if (bgConfig.type === 'dots') {
    const s = Math.max(4, bgConfig.stripeSize);
    const r = s * 0.35;
    ctx.fillStyle = bgConfig.color1;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = bgConfig.color2;
    for (let dy = 0; dy < h; dy += s) {
      for (let dx = 0; dx < w; dx += s) {
        ctx.beginPath();
        ctx.arc(dx + s / 2, dy + s / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    ctx.fillStyle = bgConfig.color1;
    ctx.fillRect(0, 0, w, h);
  }

  // 绘制纹理 - 不同背景类型使用不同纹理强度
  if (bgConfig.texture !== 'none') {
    // 根据背景类型调整纹理强度
    let textureStrengthMultiplier = 1.0;
    switch (bgConfig.type) {
      case 'solid':
        // 纯色：纹理最明显
        textureStrengthMultiplier = 1.2;
        break;
      case 'split':
        // 双拼色：纹理适中
        textureStrengthMultiplier = 1.0;
        break;
      case 'gradient':
        // 渐变：纹理较弱，避免干扰渐变效果
        textureStrengthMultiplier = 0.6;
        break;
      case 'grid':
        // 笔记本：纹理很弱，保持线条清晰
        textureStrengthMultiplier = 0.4;
        break;
      case 'diagonal':
        // 格子：纹理弱，保持格子清晰
        textureStrengthMultiplier = 0.5;
        break;
      case 'block':
        // 棋盘格：纹理适中
        textureStrengthMultiplier = 0.7;
        break;
      case 'dots':
        // 点阵：纹理弱，保持点阵清晰
        textureStrengthMultiplier = 0.4;
        break;
      default:
        textureStrengthMultiplier = 1.0;
    }

    // 像素风使用特殊的像素块效果
    if (bgConfig.texture === 'fine-noise') {
      applyPixelTexture(ctx, w, h, 25 * textureStrengthMultiplier);
    } else {
      applyPaperTexture(ctx, w, h, bgConfig.texture, textureStrengthMultiplier);
    }
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

/** 形状切换动画：在底图上用形状裁剪，只保留形状内的图像 */
function drawCutoutsBatchAnimation(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  image: HTMLImageElement,
  cutouts: Cutout[],
  cutoutConfig: {
    baseSize: number;
    variation: number;
    customShapeSymbol: string;
  },
  batchShapeType: 'circle' | 'square' | 'star' | 'heart' | 'drop' | 'snowflake'
) {
  ctx.save();
  
  // 先绘制底图
  ctx.drawImage(image, 0, 0, w, h);
  
  // 设置裁剪模式：只保留形状内的内容
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = 'white';
  
  cutouts.forEach((c) => {
    const currentSize =
      (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (w / 800);
    const dx = c.x * w;
    const dy = c.y * h;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(c.angle);
    ctx.beginPath();
    addShapePath(ctx, batchShapeType, currentSize);
    ctx.fill();
    ctx.restore();
  });
  
  ctx.restore();
}

/** 基于图像内容分析生成形状位置 */
function analyzeImageForShapes(img: HTMLImageElement, count: number): { x: number; y: number; brightness: number }[] {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  
  canvas.width = 100;
  canvas.height = 100;
  ctx.drawImage(img, 0, 0, 100, 100);
  
  const imageData = ctx.getImageData(0, 0, 100, 100);
  const pixels = imageData.data;
  
  // 分析像素亮度，收集高亮区域
  const brightPoints: { x: number; y: number; brightness: number }[] = [];
  for (let y = 0; y < 100; y += 5) {
    for (let x = 0; x < 100; x += 5) {
      const i = (y * 100 + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      // 计算亮度
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      brightPoints.push({ x: x / 100, y: y / 100, brightness });
    }
  }
  
  // 按亮度排序，取最亮的点作为形状中心
  brightPoints.sort((a, b) => b.brightness - a.brightness);
  
  // 选择形状位置：优先选择亮区
  const result: { x: number; y: number; brightness: number }[] = [];
  for (let i = 0; i < Math.min(count, brightPoints.length); i++) {
    // 添加一些随机性，避免形状太集中
    const point = brightPoints[i];
    const jitterX = (Math.random() - 0.5) * 0.1;
    const jitterY = (Math.random() - 0.5) * 0.1;
    result.push({
      x: Math.max(0.1, Math.min(0.9, point.x + jitterX)),
      y: Math.max(0.1, Math.min(0.9, point.y + jitterY)),
      brightness: point.brightness
    });
  }
  
  // 如果需要更多形状，补充随机位置
  while (result.length < count) {
    result.push({
      x: 0.1 + Math.random() * 0.8,
      y: 0.1 + Math.random() * 0.8,
      brightness: Math.random()
    });
  }
  
  return result;
}

/** 绘制五角星形状 */
function drawStarShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  points: number = 5
) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const radius = i % 2 === 0 ? size : size * 0.4;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
}

/** 形状叠加动画：在底图上用形状裁剪，只显示前 N 个形状内的图像 */
function drawCutoutsPulseReveal(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  image: HTMLImageElement,
  visibleCutouts: Cutout[],
  cutoutConfig: {
    baseSize: number;
    variation: number;
    customShapeSymbol: string;
  }
) {
  ctx.save();
  
  // 先绘制底图
  ctx.drawImage(image, 0, 0, w, h);
  
  // 如果有可见形状，用形状裁剪
  if (visibleCutouts.length > 0) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'white';
    
    visibleCutouts.forEach((c) => {
      const currentSize =
        (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (w / 800);
      const dx = c.x * w;
      const dy = c.y * h;

      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(c.angle);
      ctx.beginPath();
      addShapePath(ctx, c.shapeKind || 'circle', currentSize);
      ctx.fill();
      ctx.restore();
    });
  }
  
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

// TemplateButton 组件
function TemplateButton({ label, icon, active, onClick, onDeselect }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void; onDeselect?: () => void }) {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={`
          w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all text-[11px] font-black uppercase tracking-widest
          ${active
            ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/25'
            : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'}
        `}
      >
        <span className={active ? 'text-white' : 'text-gray-400'}>{icon}</span>
        <span>{label}</span>
      </button>
      {active && onDeselect && (
        <button
          onClick={(e) => { e.stopPropagation(); onDeselect(); }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center text-[10px] font-black hover:bg-gray-900 transition-colors shadow-md"
          title="取消使用模板"
        >
          <X size={10} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

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

  // 视频模块相关状态
  const [activeAnimation, setActiveAnimation] = useState<AnimationType>('none');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showStarsIntro, setShowStarsIntro] = useState(false);
  const [batchShapeType, setBatchShapeType] = useState<'circle' | 'square' | 'star' | 'heart' | 'drop' | 'snowflake'>('circle');
  const [batchPositionOffset, setBatchPositionOffset] = useState(0);
  const [pulseRevealCount, setPulseRevealCount] = useState(0);
  // 慢步雨季效果：雨滴下落百分比 (0-1)
  const [rainfallOffset, setRainfallOffset] = useState(0);
  // 雨滴生成状态：0=初始, 1=生成中, 2=下落中, 3=完成一轮
  const [rainfallPhase, setRainfallPhase] = useState(0);
  // 璀璨星河效果：星星亮度 (0-1)
  const [starBrightness, setStarBrightness] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [videoMimeType, setVideoMimeType] = useState('video/mp4');
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);

  // 初始化 FFmpeg
  useEffect(() => {
    const loadFFmpeg = async () => {
      if (ffmpegRef.current) return;
      const ffmpeg = new FFmpeg();
      ffmpeg.on('progress', ({ progress }) => {
        // FFmpeg 转码进度反馈给 UI
      });
      try {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegRef.current = ffmpeg;
        setFfmpegLoaded(true);
      } catch (err) {
        console.error('FFmpeg 加载失败:', err);
      }
    };
    loadFFmpeg();
  }, []);

  // 形状切换动画：更快频率随机切换形状和角度
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeAnimation === 'batch' && isPlaying) {
      interval = setInterval(() => {
        setBatchPositionOffset(prev => prev + 1);
      }, 300);
    }
    return () => clearInterval(interval);
  }, [activeAnimation, isPlaying]);

      // 形状叠加动画：逐个显现图形，每 0.1 秒显现一个
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeAnimation === 'pulse' && isPlaying && cutouts.length > 0) {
      setPulseRevealCount(0);
      interval = setInterval(() => {
        setPulseRevealCount(prev => {
          if (prev >= 50) {
            // 达到50个后重新开始
            return 0;
          }
          return prev + 1;
        });
      }, 250); // 每0.25秒增加1
    }
    return () => clearInterval(interval);
  }, [activeAnimation, isPlaying, cutouts.length]);

  // 慢步雨季动画：雨滴从画面中央缓缓下落
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if ((activeAnimation === 'rainfall' || activeAnimation === 'rain') && isPlaying) {
      // 阶段0: 初始状态，准备生成雨滴
      // 阶段1: 雨滴生成中（延迟0.5秒）
      // 阶段2: 雨滴下落中
      setRainfallPhase(1);
      setRainfallOffset(0);
      
      interval = setInterval(() => {
        setRainfallOffset(prev => {
          if (prev >= 1) {
            // 一轮完成，重置
            setRainfallPhase(1);
            return 0;
          }
          return prev + 0.01; // 缓慢下落
        });
        
        // 0.5秒后进入下落阶段
        setRainfallPhase(2);
      }, 50); // 50ms * 100 = 5秒完成一轮下落
    }
    return () => clearInterval(interval);
  }, [activeAnimation, isPlaying]);

  // 璀璨星河动画：星星逐渐变亮
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeAnimation === 'stars' && isPlaying) {
      setStarBrightness(0);
      setShowStarsIntro(true);
      
      // 开场动画1.5秒后消失
      setTimeout(() => setShowStarsIntro(false), 1500);
      
      // 星星逐渐变亮
      interval = setInterval(() => {
        setStarBrightness(prev => {
          if (prev >= 1) {
            // 达到最亮后重置循环
            return 0;
          }
          return Math.min(1, prev + 0.02); // 每50ms增加0.02，约2.5秒达到最亮
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [activeAnimation, isPlaying]);

  // 1. Canvas Configuration
  const [composition, setComposition] = useState<CompositionMode>('block-bottom');
  const [zoom, setZoom] = useState(0.6);
  /** 色块在「主图+色块」整条里所占比例，20%–100%（100% 内部按 99% 计算避免除零） */
  /** 主图预览始终一整格原图缩放；色块区为条带「裁剪」宽度/高度（占比仅改变条带，不挤压主图格） */
  const [blockAreaPercent, setBlockAreaPercent] = useState(100);
  const blockStripRatio = Math.min(0.99, Math.max(0.2, blockAreaPercent / 100));

  useEffect(() => {
    setPickingTarget(null);
  }, [activeTab]);

  const settingsPanelOpen = activeTab === 'background' || activeTab === 'elements' || activeTab === 'video';

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
    
    // 与 measurePreviewContain 一致：总尺寸 = 1 格主图 + r 格条带（非固定 2 格）
    const isVert = composition === 'block-bottom' || composition === 'block-top';
    const stripR = Math.min(0.99, Math.max(0.2, blockAreaPercent / 100));
    const totalWidth = isVert ? image.width : image.width * (1 + stripR);
    const totalHeight = isVert ? image.height * (1 + stripR) : image.height;

    const scaleX = availableWidth / totalWidth;
    const scaleY = availableHeight / totalHeight;

    const newZoom = Math.min(scaleX, scaleY, 1);
    setZoom(newZoom);
  }, [image, composition, settingsPanelOpen, blockAreaPercent]);

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
    /** 条带占「一整格原图」边长的比例；主图区始终 1×1 格，仅条带宽窄变化 */
    const rPrev = Math.min(1, Math.max(0.2, blockAreaPercent / 100));
    const scale = isVertical
      ? Math.min(av / iw, ah / (ih * (1 + rPrev)))
      : Math.min(av / (iw * (1 + rPrev)), ah / ih);
    const cw = iw * scale;
    const ch = ih * scale;
    let mainW: number;
    let mainH: number;
    let blockW: number;
    let blockH: number;
    if (isVertical) {
      mainW = cw;
      mainH = ch;
      blockW = cw;
      blockH = ch * rPrev;
      const totalH = ch + blockH;
      setContain({
        w: cw,
        h: totalH,
        ox: (av - cw) / 2,
        oy: (ah - totalH) / 2,
        mainW,
        mainH,
        blockW,
        blockH,
      });
    } else {
      mainW = cw;
      mainH = ch;
      blockW = cw * rPrev;
      blockH = ch;
      const totalW = cw + blockW;
      setContain({
        w: totalW,
        h: ch,
        ox: (av - totalW) / 2,
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
    texture: 'none' as TextureType, // 底图纹理
  });

  // 3. Shape Configuration
  const [cutoutConfig, setCutoutConfig] = useState({
    baseSize: 35,
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
  });

  const [overlayTextConfig, setOverlayTextConfig] = useState({
    content: '',
    fontSize: 35,
    fontFamily: '"Special Elite", cursive',
    fillColor: '#ffffff',
    strokeColor: '#ffffff',
    /** 叠字在画面中的相对位置 (0–1)，默认居中 */
    x: 0.5,
    y: 0.5,
    /** 是否使用图片填充文字（默认不使用） */
    usePhotoFill: false,
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
    const { autoCount, baseSize, variation } = cutoutConfig;
    const count = Math.max(1, Math.round(opts?.autoCount ?? autoCount));
    const dkForGen = opts?.defaultShapeKind ?? cutoutConfig.defaultShapeKind;
    const newCutouts: Cutout[] = [];
    const maxAttempts = 100;
    const stripR = Math.min(0.99, Math.max(0.2, blockAreaPercent / 100));
    const { mainW, mainH } = getLayoutDimensions(composition, stripR, img.width, img.height);

    // 碰撞参考尺寸：与主图区宽高比一致（主图区坐标 0–1）
    const refW = 800;
    const refH = (mainH / mainW) * refW;

    // 根据动画模板类型分析图像内容，生成形状位置
    const imageAnalysis = analyzeImageForShapes(img, count);

    for (let i = 0; i < count; i++) {
      let placed = false;
      let attempts = 0;
      
      while (!placed && attempts < maxAttempts) {
        // 基于图像分析选择位置
        const analysisPoint = imageAnalysis[i] || { x: Math.random(), y: Math.random() };
        const x = attempts < 10 ? analysisPoint.x + (Math.random() - 0.5) * 0.15 : Math.random();
        const y = attempts < 10 ? analysisPoint.y + (Math.random() - 0.5) * 0.15 : Math.random();
        
        const sizeFactor = Math.random() - 0.5;
        const currentSize = baseSize + sizeFactor * variation * 10;
        const angle = Math.random() * Math.PI * 2;

        // 计算形状旋转后的轴对齐包围盒（AABB），用于精确碰撞检测
        const getRotatedAABB = (cx: number, cy: number, size: number, rot: number) => {
          // 四个角的相对坐标（以中心为原点）
          const halfSize = size / 2;
          const corners = [
            { x: -halfSize, y: -halfSize },
            { x: halfSize, y: -halfSize },
            { x: halfSize, y: halfSize },
            { x: -halfSize, y: halfSize },
          ];
          // 旋转并平移到实际坐标
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);
          const rotated = corners.map(c => ({
            x: cx + c.x * cos - c.y * sin,
            y: cy + c.x * sin + c.y * cos,
          }));
          // 计算 AABB
          const xs = rotated.map(p => p.x);
          const ys = rotated.map(p => p.y);
          return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
          };
        };

        // 检查碰撞（使用旋转后的 AABB）
        const collision = newCutouts.some(other => {
          const otherSize = baseSize + other.sizeFactor * variation * 10;
          // 转换为实际像素坐标
          const cx1 = x * refW;
          const cy1 = y * refH;
          const cx2 = other.x * refW;
          const cy2 = other.y * refH;

          const box1 = getRotatedAABB(cx1, cy1, currentSize, angle);
          const box2 = getRotatedAABB(cx2, cy2, otherSize, other.angle);

          // 添加 5px 的安全边距
          const margin = 5;
          return !(
            box1.maxX + margin < box2.minX ||
            box2.maxX + margin < box1.minX ||
            box1.maxY + margin < box2.minY ||
            box2.maxY + margin < box1.minY
          );
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
        createFallbackCutout(dkForGen, cutoutConfig.customShapeSymbol, 0)
      );
    }
    setCutouts(newCutouts);
    setSelectedId(null);
  },
  [cutoutConfig, image, composition, blockAreaPercent]);

  // 星河动画的星星
  const introStars = useRef(Array.from({ length: 20 }).map((_, i) => ({
    id: `intro-star-${i}`,
    x: 5 + Math.random() * 90,
    y: 5 + Math.random() * 90,
    size: 10 + Math.random() * 20,
    delay: i * 0.15,
  }))).current;

  // 雨滴数据
  const RAINDROPS = useRef(Array.from({ length: 20 }).map((_, i) => ({
    id: `rain-${i}`,
    x: Math.random() * 100,
    delay: i * 0.4,
    duration: 5 + Math.random() * 3,
  }))).current;

  // 根据色块配置计算雨滴颜色
  const getRainDropColor = (xPercent: number, yPercent: number): string => {
    const { type, color1, color2, stripeSize } = bgConfig;
    const s = stripeSize || 32;

    // 判断条纹方向：左右布局是竖直条纹，上下布局是水平条纹
    const isVerticalStripes = composition === 'block-left' || composition === 'block-right';

    if (type === 'solid') {
      return color1;
    } else if (type === 'gradient') {
      return yPercent < 0.5 ? color1 : color2;
    } else if (type === 'split') {
      // 双拼条纹：根据条纹方向判断
      const stripeWidth = s * 2;
      if (isVerticalStripes) {
        // 竖直条纹：根据 x 判断
        const isFirstColor = Math.floor(xPercent * 100 / stripeWidth) % 2 === 0;
        return isFirstColor ? color1 : color2;
      } else {
        // 水平条纹：根据 y 判断
        const isFirstColor = Math.floor(yPercent * 100 / stripeWidth) % 2 === 0;
        return isFirstColor ? color1 : color2;
      }
    } else if (type === 'grid' || type === 'diagonal') {
      return color2;
    } else if (type === 'block') {
      // 棋盘格
      const gx = Math.floor(xPercent * 100 / s);
      const gy = Math.floor(yPercent * 100 / s);
      return ((gx + gy) % 2 === 0) ? color1 : color2;
    } else if (type === 'dots') {
      return color2;
    }
    return color1;
  };

  // 五角星 SVG 组件（与元素面板形状一致）
  const StarSVG = ({ size, className }: { size: number; className?: string }) => {
    const spikes = 5;
    const outerR = size / 2;
    const innerR = outerR * 0.38;
    const points: string[] = [];
    
    for (let i = 0; i < spikes * 2; i++) {
      const rad = (i * Math.PI) / spikes - Math.PI / 2;
      const rr = i % 2 === 0 ? outerR : innerR;
      const x = outerR + Math.cos(rad) * rr;
      const y = outerR + Math.sin(rad) * rr;
      points.push(`${x},${y}`);
    }
    
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox={`0 0 ${size} ${size}`}
        className={className}
      >
        <polygon points={points.join(' ')} fill="currentColor" />
      </svg>
    );
  };

  // 水滴 SVG 组件（与元素面板形状一致）
  const DropSVG = ({ size, style, className }: { size: number; style?: React.CSSProperties; className?: string }) => {
    const r = size / 2;
    const cx = size / 2;
    const cy = size / 2;
    const path = `
      M ${cx} ${cy - r}
      C ${cx + r * 0.78} ${cy - r * 0.38}, ${cx + r * 0.92} ${cy + r}, ${cx} ${cy + r}
      C ${cx - r * 0.92} ${cy + r}, ${cx - r * 0.78} ${cy - r * 0.38}, ${cx} ${cy - r}
      Z
    `;
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={style}
        className={className}
      >
        <path d={path} fill="currentColor" />
      </svg>
    );
  };

  const handleAnimationSelect = (type: AnimationType) => {
    setActiveAnimation(type);
    setIsPlaying(true);
    
    if (type === 'stars') {
      setShowStarsIntro(true);
      setTimeout(() => setShowStarsIntro(false), 4000);
    }
    
    // 根据动画模板调整形状生成
    if (image && cutouts.length > 0) {
      // 根据动画类型调整形状
      const shapeKinds: Exclude<ShapeKind, 'symbol' | 'randomLetters'>[] = ['circle', 'square', 'star', 'drop', 'snowflake', 'heart'];
      
      // 璀璨星河：优先使用星形/雪花
      // 漫步雨季：优先使用水滴
      // 其他动画：保持原有设置或使用随机
      let preferredShapes: Exclude<ShapeKind, 'symbol' | 'randomLetters'>[] = shapeKinds;
      if (type === 'stars') {
        preferredShapes = ['star', 'snowflake'];
      } else if (type === 'rain') {
        preferredShapes = ['drop', 'circle'];
      } else if (type === 'pulse') {
        preferredShapes = ['circle', 'heart'];
      } else if (type === 'batch') {
        preferredShapes = shapeKinds;
      }
      
      // 重新生成形状（基于图像分析）
      const img = image;
      const { mainW, mainH } = getLayoutDimensions(composition, Math.min(0.99, Math.max(0.2, blockAreaPercent / 100)), img.width, img.height);
      const refW = 800;
      const refH = (mainH / mainW) * refW;
      const imageAnalysis = analyzeImageForShapes(img, cutouts.length);
      
      setCutouts(prev => prev.map((c, i) => {
        const analysisPoint = imageAnalysis[i] || { x: Math.random(), y: Math.random() };
        return {
          ...c,
          x: analysisPoint.x,
          y: analysisPoint.y,
          shapeKind: preferredShapes[Math.floor(Math.random() * preferredShapes.length)],
          sizeFactor: c.sizeFactor,
          angle: c.angle,
        };
      }));
    }
  };

  const handleExport = async () => {
    if (!image) {
      setExportError('请先上传一张背景图片');
      return;
    }
    if (activeAnimation === 'none') {
      setExportError('请先选择一个动画模板');
      return;
    }
    if (!previewWrapRef.current) {
      setExportError('预览区域未加载，请稍后重试');
      return;
    }
    
    // 如果动画还没开始播放，先开始播放
    if (!isPlaying) {
      setIsPlaying(true);
    }
    
    setExportError(null);
    setIsExporting(true);
    setExportProgress(0);
    setVideoBlobUrl(null);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建绘图上下文');

      const rect = previewWrapRef.current.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        const webmBlob = new Blob(chunks, { type: 'video/webm' });

        // 确保 FFmpeg 已加载
        if (!ffmpegRef.current) {
          const ffmpeg = new FFmpeg();
          const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
          await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          });
          ffmpegRef.current = ffmpeg;
          setFfmpegLoaded(true);
        }

        const ffmpeg = ffmpegRef.current;
        await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));
        await ffmpeg.exec([
          '-i', 'input.webm',
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k',
          'output.mp4'
        ]);
        const data = await ffmpeg.readFile('output.mp4');
        const mp4Blob = new Blob([data], { type: 'video/mp4' });
        const url = URL.createObjectURL(mp4Blob);
        setVideoBlobUrl(url);
        setVideoMimeType('video/mp4');
        setIsExporting(false);
        setShowExportSuccess(true);
      };

      recorder.start();

      const duration = 3000;
      const startTime = Date.now();
      
      const captureFrame = async () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(100, Math.round((elapsed / duration) * 100));
        setExportProgress(progress);

        if (elapsed < duration) {
          if (previewWrapRef.current) {
            const dataUrl = await toPng(previewWrapRef.current, {
              width: canvas.width,
              height: canvas.height,
              cacheBust: true,
            });
            const img = new Image();
            img.src = dataUrl;
            await new Promise((resolve) => {
              img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                resolve(null);
              };
            });
            recorder.requestData(); // 触发 dataavailable，收集当前视频片段
          }
          requestAnimationFrame(captureFrame);
        } else {
          recorder.stop();
        }
      };

      captureFrame();
    } catch (err) {
      console.error('Export failed:', err);
      setExportError('视频合成失败，请重试');
      setIsExporting(false);
    }
  };

  const downloadResult = () => {
    if (!videoBlobUrl) return;
    const link = document.createElement('a');
    link.href = videoBlobUrl;
    link.download = `hicolor_${activeAnimation}_video.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportSuccess(false);
  };

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
        setComposition('block-top'); // Landscape -> 色块在上方
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

    // 2. 主图画布
    // 非动画模式或未播放时：全图 + 条带采样色形状
    // 动画播放时：清空形状，只显示原图+叠加效果
    const isAnimationActive = isPlaying;
    
    if (!isAnimationActive) {
      mainCtx.clearRect(0, 0, mainW, mainH);
      // 先绘制色块背景
      paintBlockFillOnContext(mainCtx, mainW, mainH, bgConfig, composition);
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
    } else {
      // 动画模式：清空后先绘制色块背景，再画原图
      mainCtx.clearRect(0, 0, mainW, mainH);
      paintBlockFillOnContext(mainCtx, mainW, mainH, bgConfig, composition);
      mainCtx.drawImage(image, 0, 0, mainW, mainH);
    }

    // 3. 动画模式渲染：保持原图+色块，清空形状
    if (activeAnimation === 'batch' && isPlaying) {
      // 形状切换模式：每次切换显示不同形状类型和不同角度
      cutouts.slice(0, 8).forEach((c, index) => {
        const size = (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (mainW / 800) * 1.2;
        const holeColor = sampleFromBlockData(c.x, c.y);
        
        // 每次切换使用真正随机产生不同形状、角度和位置
        const switchCycle = Math.floor(batchPositionOffset);
        const randomBase = switchCycle * 1000 + index * 137;
        const shapeOptions = ['circle', 'square', 'star', 'drop', 'snowflake'];
        const selectedShape = shapeOptions[randomBase % shapeOptions.length];
        const randomAngle = (randomBase * 137.508) % (Math.PI * 2);

        // 位置偏移：随 switchCycle 和 index 产生周期性偏移
        const posOffsetX = Math.sin(randomBase * 0.7) * size * 0.3;
        const posOffsetY = Math.cos(randomBase * 0.5) * size * 0.3;

        mainCtx.save();
        mainCtx.translate(c.x * mainW + posOffsetX, c.y * mainH + posOffsetY);
        mainCtx.rotate(randomAngle);
        mainCtx.fillStyle = holeColor;
        
        // 绘制随机形状
        if (selectedShape === 'circle') {
          mainCtx.beginPath();
          mainCtx.arc(0, 0, size / 2, 0, Math.PI * 2);
          mainCtx.fill();
        } else if (selectedShape === 'square') {
          mainCtx.fillRect(-size / 2, -size / 2, size, size);
        } else {
          mainCtx.beginPath();
          addShapePath(mainCtx, selectedShape as ShapeKind, size);
          mainCtx.fill();
        }
        
        mainCtx.restore();
      });
    } else if (activeAnimation === 'pulse' && isPlaying) {
      // 形状叠加模式：形状从零到二十逐步叠加显示
      // 根据 pulseRevealCount 计算显示的形状数量 (0-10 -> 0-20)
      const rawCount = Math.floor(pulseRevealCount * 2);
      const visibleCount = Math.min(20, Math.max(0, rawCount));
      
      // 绘制逐个叠加的形状
      for (let i = 0; i < visibleCount && i < cutouts.length; i++) {
        const c = cutouts[i];
        const baseSize = (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (mainW / 800);
        const holeColor = sampleFromBlockData(c.x, c.y);
        
        mainCtx.save();
        mainCtx.translate(c.x * mainW, c.y * mainH);
        mainCtx.rotate(c.angle + pulseRevealCount * 0.1);
        mainCtx.fillStyle = holeColor;
        
        // 使用元素的形状类型绘制（颜色与色块一致）
        if (isGlyphShapeKind(c.shapeKind)) {
          const char = cutoutGlyphChar(c, cutoutConfig.customShapeSymbol);
          mainCtx.font = `bold ${baseSize}px sans-serif`;
          mainCtx.textAlign = 'center';
          mainCtx.textBaseline = 'middle';
          mainCtx.fillText(char, 0, 0);
        } else if (c.shapeKind) {
          mainCtx.beginPath();
          addShapePath(mainCtx, c.shapeKind, baseSize);
          mainCtx.fill();
        } else {
          mainCtx.font = `bold ${baseSize}px sans-serif`;
          mainCtx.textAlign = 'center';
          mainCtx.textBaseline = 'middle';
          mainCtx.fillText(c.char || 'A', 0, 0);
        }
        
        mainCtx.restore();
      }
    } else if (activeAnimation === 'rainfall' && isPlaying) {
      // 慢步雨季模式：只显示原图+色块，叠加雨滴效果
      const rainStartY = mainH * (1 - blockStripRatio);
      const rainEndY = mainH;
      const currentY = rainStartY + (rainEndY - rainStartY) * rainfallOffset;
      
      const raindrops = 20;
      for (let i = 0; i < raindrops; i++) {
        const x = (mainW / raindrops) * i + mainW / (raindrops * 2);
        const yOffset = Math.sin(i * 0.7 + rainfallOffset * 10) * 30;
        const rainY = currentY + i * ((rainEndY - rainStartY) / raindrops) + yOffset;
        const rainColor = sampleFromBlockData(x / mainW, rainY / mainH);
        
        mainCtx.save();
        mainCtx.fillStyle = rainColor;
        mainCtx.beginPath();
        const dropX = x;
        const dropY = rainY;
        const dropSize = 6;
        mainCtx.moveTo(dropX, dropY - dropSize);
        mainCtx.bezierCurveTo(dropX + dropSize * 0.5, dropY - dropSize * 0.5, dropX + dropSize * 0.5, dropY + dropSize * 0.5, dropX, dropY + dropSize);
        mainCtx.bezierCurveTo(dropX - dropSize * 0.5, dropY + dropSize * 0.5, dropX - dropSize * 0.5, dropY - dropSize * 0.5, dropX, dropY - dropSize);
        mainCtx.fill();
        mainCtx.restore();
      }
    } else if (activeAnimation === 'rain' && isPlaying) {
      // 漫步雨季模式：满屏雨滴依次下降消失
      // rainfallOffset 从 0 到 1，表示雨滴消失的进度
      // offset=0 时满屏雨滴，offset=1 时雨滴消失
      const disappearProgress = rainfallOffset;
      const raindropCount = 40;
      
      for (let i = 0; i < raindropCount; i++) {
        // 每个雨滴有自己的起始高度（随机分布）
        const seed = i * 0.1;
        const baseX = (Math.sin(seed * 3.7) * 0.5 + 0.5);
        const baseY = (Math.cos(seed * 2.3) * 0.5 + 0.5);
        const speed = 0.3 + (Math.sin(seed * 5.1) * 0.5 + 0.5) * 0.7;
        
        // 当前雨滴的位置（基于进度）
        const dropProgress = (disappearProgress * speed) % 1;
        const currentY = baseY + dropProgress;
        
        // 雨滴颜色从色块采样
        const rainX = baseX * mainW;
        const rainY = currentY * mainH;
        const rainColor = sampleFromBlockData(baseX, currentY);
        
        mainCtx.save();
        mainCtx.globalAlpha = 1 - disappearProgress;
        mainCtx.fillStyle = rainColor;
        
        // 只绘制还在屏幕内的雨滴
        if (currentY < 1.1 && 1 - disappearProgress > 0) {
          const x = baseX * mainW;
          const y = currentY * mainH;
          const dropSize = 4 + Math.sin(seed * 7) * 2;
          
          mainCtx.globalAlpha = (1 - disappearProgress) * 0.8;
          mainCtx.beginPath();
          mainCtx.moveTo(x, y - dropSize);
          mainCtx.bezierCurveTo(
            x + dropSize * 0.5, y - dropSize * 0.5,
            x + dropSize * 0.5, y + dropSize * 0.5,
            x, y + dropSize
          );
          mainCtx.bezierCurveTo(
            x - dropSize * 0.5, y + dropSize * 0.5,
            x - dropSize * 0.5, y - dropSize * 0.5,
            x, y - dropSize
          );
          mainCtx.fill();
        }
      }
      mainCtx.globalAlpha = 1;
      mainCtx.restore();
    } else if (activeAnimation === 'stars' && isPlaying) {
      // 璀璨星河模式：只显示原图+色块，叠加星星发光效果
      
      // 绘制星星（使用雪花或星形）
      mainCtx.save();
      
      // 主亮星（中心偏上）- 更大
      const mainStarX = mainW * 0.5;
      const mainStarY = mainH * 0.4;
      const mainStarSize = Math.min(mainW, mainH) * 0.15;
      
      // 主星发光效果（渐进式发光）
      const mainGlowRadius = mainStarSize * (1.5 + starBrightness * 2.5);
      const mainGradient = mainCtx.createRadialGradient(
        mainStarX, mainStarY, 0,
        mainStarX, mainStarY, mainGlowRadius
      );
      const mainGlowAlpha = 0.6 + starBrightness * 0.4;
      mainGradient.addColorStop(0, `rgba(255, 255, 240, ${mainGlowAlpha})`);
      mainGradient.addColorStop(0.4, `rgba(255, 255, 200, ${mainGlowAlpha * 0.6})`);
      mainGradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
      mainCtx.fillStyle = mainGradient;
      mainCtx.beginPath();
      mainCtx.arc(mainStarX, mainStarY, mainGlowRadius, 0, Math.PI * 2);
      mainCtx.fill();
      
      // 绘制主星形状（根据 starBrightness 渐进显示，始终保持最小可见亮度 0.15）
      mainCtx.fillStyle = `rgba(255, 255, 240, ${0.15 + starBrightness * 0.85})`;
      drawStarShape(mainCtx, mainStarX, mainStarY, mainStarSize, 6);
      
      // 副星1（左上）- 较大
      const star1X = mainW * 0.25;
      const star1Y = mainH * 0.25;
      const star1Size = mainStarSize * 0.6;
      const star1Glow = mainStarSize * 0.8 * (0.5 + starBrightness * 0.5);
      const star1Gradient = mainCtx.createRadialGradient(star1X, star1Y, 0, star1X, star1Y, star1Glow);
      star1Gradient.addColorStop(0, `rgba(255, 255, 220, ${0.2 + starBrightness * 0.6})`);
      star1Gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
      mainCtx.fillStyle = star1Gradient;
      mainCtx.beginPath();
      mainCtx.arc(star1X, star1Y, star1Glow, 0, Math.PI * 2);
      mainCtx.fill();
      mainCtx.fillStyle = `rgba(255, 255, 220, ${0.15 + starBrightness * 0.55})`;
      drawStarShape(mainCtx, star1X, star1Y, star1Size, 5);
      
      // 副星2（右上）- 较大
      const star2X = mainW * 0.75;
      const star2Y = mainH * 0.3;
      const star2Size = mainStarSize * 0.65;
      const star2Glow = mainStarSize * 0.85 * (0.5 + starBrightness * 0.5);
      const star2Gradient = mainCtx.createRadialGradient(star2X, star2Y, 0, star2X, star2Y, star2Glow);
      star2Gradient.addColorStop(0, `rgba(255, 255, 220, ${0.2 + starBrightness * 0.6})`);
      star2Gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
      mainCtx.fillStyle = star2Gradient;
      mainCtx.beginPath();
      mainCtx.arc(star2X, star2Y, star2Glow, 0, Math.PI * 2);
      mainCtx.fill();
      mainCtx.fillStyle = `rgba(255, 255, 220, ${0.15 + starBrightness * 0.6})`;
      drawStarShape(mainCtx, star2X, star2Y, star2Size, 5);
      
      // 副星3（左下）
      const star3X = mainW * 0.2;
      const star3Y = mainH * 0.6;
      const star3Size = mainStarSize * 0.5;
      const star3Glow = mainStarSize * 0.7 * (0.5 + starBrightness * 0.5);
      const star3Gradient = mainCtx.createRadialGradient(star3X, star3Y, 0, star3X, star3Y, star3Glow);
      star3Gradient.addColorStop(0, `rgba(255, 255, 220, ${0.2 + starBrightness * 0.6})`);
      star3Gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
      mainCtx.fillStyle = star3Gradient;
      mainCtx.beginPath();
      mainCtx.arc(star3X, star3Y, star3Glow, 0, Math.PI * 2);
      mainCtx.fill();
      mainCtx.fillStyle = `rgba(255, 255, 220, ${0.15 + starBrightness * 0.45})`;
      drawStarShape(mainCtx, star3X, star3Y, star3Size, 5);
      
      // 副星4（右下）
      const star4X = mainW * 0.8;
      const star4Y = mainH * 0.65;
      const star4Size = mainStarSize * 0.55;
      const star4Glow = mainStarSize * 0.75 * (0.5 + starBrightness * 0.5);
      const star4Gradient = mainCtx.createRadialGradient(star4X, star4Y, 0, star4X, star4Y, star4Glow);
      star4Gradient.addColorStop(0, `rgba(255, 255, 220, ${0.2 + starBrightness * 0.6})`);
      star4Gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
      mainCtx.fillStyle = star4Gradient;
      mainCtx.beginPath();
      mainCtx.arc(star4X, star4Y, star4Glow, 0, Math.PI * 2);
      mainCtx.fill();
      mainCtx.fillStyle = `rgba(255, 255, 220, ${0.15 + starBrightness * 0.5})`;
      drawStarShape(mainCtx, star4X, star4Y, star4Size, 5);
      
      mainCtx.restore();
    }

    // 4. 条带预览画布：条纹 → 洞中照片（动画模式显示色块） → 叠字（最上层）
    blockCtx.clearRect(0, 0, blockW, blockH);
    paintBlockFillOnContext(blockCtx, blockW, blockH, bgConfig, composition);
    
    // 动画模式：形状用纯色填充（孔洞露出色块）
    if ((activeAnimation === 'batch' || activeAnimation === 'pulse' || activeAnimation === 'stars' || activeAnimation === 'rain' || activeAnimation === 'rainfall') && isPlaying) {
      // 绘制形状（纯色填充，形状孔洞露出色块背景）
      cutouts.forEach((c) => {
        const currentSize =
          (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) *
          (blockW / 800);
        blockCtx.save();
        blockCtx.translate(c.x * blockW, c.y * blockH);
        blockCtx.rotate(c.angle);
        if (isGlyphShapeKind(c.shapeKind)) {
          const char = cutoutGlyphChar(c, cutoutConfig.customShapeSymbol);
          blockCtx.font = `bold ${currentSize}px sans-serif`;
          blockCtx.textAlign = 'center';
          blockCtx.textBaseline = 'middle';
          blockCtx.fillStyle = cutoutConfig.shapeColor;
          blockCtx.fillText(char, 0, 0);
        } else if (c.shapeKind) {
          blockCtx.beginPath();
          addShapePath(blockCtx, c.shapeKind, currentSize);
          blockCtx.fillStyle = cutoutConfig.shapeColor;
          blockCtx.fill();
        } else {
          blockCtx.font = `bold ${currentSize}px sans-serif`;
          blockCtx.textAlign = 'center';
          blockCtx.textBaseline = 'middle';
          blockCtx.fillStyle = cutoutConfig.shapeColor;
          blockCtx.fillText(c.char || 'A', 0, 0);
        }
        blockCtx.restore();
      });
    } else {
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
    }
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
        { mode: 'crop', sx: cropX, sy: cropY, sw: cropW, sh: cropH },
        overlayTextConfig.usePhotoFill
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
    activeAnimation,
    isPlaying,
    batchShapeType,
    batchPositionOffset,
    pulseRevealCount,
    rainfallOffset,
    starBrightness,
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
        { mode: 'stretch-full' },
        overlayTextConfig.usePhotoFill
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
          {/* 图片填充开关 */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-500">图片填充</span>
            <button
              type="button"
              onClick={() => setOverlayTextConfig((prev) => ({ ...prev, usePhotoFill: !prev.usePhotoFill }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                overlayTextConfig.usePhotoFill ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  overlayTextConfig.usePhotoFill ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
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
      {id === 'video' && (
        <span className="text-[7px] font-bold text-gray-400">待开发</span>
      )}
      {activeTab === id && (
        <motion.div layoutId="tab-indicator" className="absolute bottom-0 w-8 h-1 bg-green-500 rounded-t-full" />
      )}
    </button>
  );

  const renderHeader = () => (
    <header className="fixed top-0 left-0 right-0 z-50 flex min-h-14 items-center justify-between border-b border-gray-100 bg-white/80 px-3 pt-[max(0px,env(safe-area-inset-top))] pb-2 backdrop-blur-xl sm:min-h-16 sm:px-6 sm:pb-0">
      <div className="flex items-center">
        <a 
          href="https://www.xiaohongshu.com/user/profile/57b3456c82ec3947f79496e9" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-lg font-black tracking-tighter text-gray-900 italic leading-none sm:text-xl hover:text-emerald-600 transition-colors cursor-pointer"
          title="访问小红书"
        >
          hicolor
        </a>
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
        {renderTabButton('video', <Video size={22} />, '视频')}
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
                    仅改变条带区宽窄（相对一整格原图），主图预览尺寸不变；20%–100%，导出与预览一致
                  </p>
                </div>
              </div>

              {/* 底图：八选一 */}
              <div className="space-y-2 pr-10">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">底图类型</label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { type: 'solid' as const, label: '纯色' },
                      { type: 'split' as const, label: '双拼色' },
                      { type: 'gradient' as const, label: '渐变' },
                      { type: 'image' as const, label: '图片' },
                      { type: 'grid' as const, label: '笔记本' },
                      { type: 'diagonal' as const, label: '格子' },
                      { type: 'block' as const, label: '棋盘格' },
                      { type: 'dots' as const, label: '点阵' },
                    ] as const
                  ).map(({ type, label }) => {
                    const active = bgConfig.type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setBgConfig((prev) => ({ ...prev, type }))}
                        className={`rounded-xl border py-2.5 text-center text-[11px] font-black shadow-sm transition-all ${
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

              {/* 纹理选择 - 移到色彩配置上方 */}
              {bgConfig.type !== 'image' && (
                <div className="space-y-2 pr-10">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">纹理</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(
                      [
                        { type: 'none' as TextureType, label: '无' },
                        { type: 'fine-paper' as TextureType, label: '像素风' },
                        { type: 'fine-noise' as TextureType, label: '牛皮纸' },
                        { type: 'grain-paper' as TextureType, label: '颗粒' },
                        { type: 'coarse-paper' as TextureType, label: '砂纸' },
                      ]
                    ).map(({ type, label }) => {
                      const active = bgConfig.texture === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            console.log('纹理按钮点击:', type);
                            setBgConfig((prev) => ({ ...prev, texture: type }));
                          }}
                          className={`rounded-lg border py-2 text-center text-[9px] font-black shadow-sm transition-all cursor-pointer ${
                            active
                              ? 'border-emerald-400 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/70'
                              : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                          }`}
                          style={{ cursor: 'pointer' }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 色彩配置 */}
              {bgConfig.type !== 'image' && (
                <div className="space-y-2 pr-10">
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
                    {(bgConfig.type === 'gradient' || bgConfig.type === 'split' || bgConfig.type === 'grid' || bgConfig.type === 'diagonal' || bgConfig.type === 'block' || bgConfig.type === 'dots') && (
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
                <div className="space-y-2 pr-10">
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

              {(bgConfig.type === 'grid' || bgConfig.type === 'diagonal' || bgConfig.type === 'block' || bgConfig.type === 'dots') && (
                <div className="space-y-2 pr-10">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em">图案密度</label>
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
                <div className="space-y-2 pr-10">
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
                <div className="space-y-2 pr-10">
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
                                            0
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
                                            0
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
                                            0
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

          {activeTab === 'video' && (
            <motion.div
              key="video"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">动画模板</h3>
              
              {/* 动画模板选择 */}
              <div className="grid grid-cols-2 gap-3">
                <TemplateButton 
                  label="形状叠加" 
                  icon={<Maximize className="w-4 h-4" />} 
                  active={activeAnimation === 'pulse'}
                  onClick={() => handleAnimationSelect('pulse')}
                  onDeselect={() => { setActiveAnimation('none'); setIsPlaying(false); }}
                />
                <TemplateButton 
                  label="形状切换" 
                  icon={<Layers size={4} className="w-4 h-4" />} 
                  active={activeAnimation === 'batch'}
                  onClick={() => handleAnimationSelect('batch')}
                  onDeselect={() => { setActiveAnimation('none'); setIsPlaying(false); }}
                />
                <TemplateButton 
                  label="漫步雨季" 
                  icon={<CloudRain className="w-4 h-4" />} 
                  active={activeAnimation === 'rain'}
                  onClick={() => handleAnimationSelect('rain')}
                  onDeselect={() => { setActiveAnimation('none'); setIsPlaying(false); }}
                />
                <TemplateButton
                  label="璀璨星河"
                  icon={<Star className="w-4 h-4" />}
                  active={activeAnimation === 'stars'}
                  onClick={() => handleAnimationSelect('stars')}
                  onDeselect={() => { setActiveAnimation('none'); setIsPlaying(false); }}
                />
                <div className="relative">
                  <button
                    disabled
                    className="w-full py-3 px-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 text-gray-400 flex flex-col items-center justify-center gap-1 opacity-60 cursor-not-allowed"
                  >
                    <span className="text-[11px] font-bold">更多模板</span>
                    <span className="text-[8px]">待开发</span>
                  </button>
                </div>
              </div>

              {/* 导出视频按钮 */}
              <button
                onClick={handleExport}
                disabled={!image}
                className={`w-full py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  image
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/25'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Video size={16} /><span>导出视频</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-emerald-100 selection:text-emerald-900 overflow-hidden">
      {/* SVG 滤镜 */}
      <svg style={{ display: 'none' }}>
        <defs>
          {/* 像素风图案 (8x8 网格线) */}
          <pattern id="pixel-art-pattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="8" y2="0" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
          </pattern>
          {/* 像素风发光渐变 */}
          <linearGradient id="pixel-glow" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(99,102,241,0.08)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {/* 颗粒滤镜 (轻量砂纸叠加效果) */}
        <filter id="sandpaper-filter" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
          <feComponentTransfer in="grayNoise" result="lightNoise">
            <feFuncR type="linear" slope="0.15" />
            <feFuncG type="linear" slope="0.15" />
            <feFuncB type="linear" slope="0.15" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="lightNoise" mode="overlay" />
        </filter>
      </svg>
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
                {/* 颗粒纹理覆盖层 */}
                {bgConfig.texture === 'grain-paper' && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'3\' height=\'3\'%3E%3Ccircle cx=\'1\' cy=\'1\' r=\'0.5\' fill=\'rgba(255,255,255,0.06)\'/%3E%3C/svg%3E")',
                      backgroundSize: '4px 4px',
                    }}
                  />
                )}
                {/* 像素风纹理覆盖层 */}
                {bgConfig.texture === 'fine-paper' && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'8\' height=\'8\'%3E%3Cline x1=\'0\' y1=\'0\' x2=\'8\' y2=\'0\' stroke=\'rgba(255,255,255,0.06)\' stroke-width=\'1\'/%3E%3Cline x1=\'0\' y1=\'0\' x2=\'0\' y2=\'8\' stroke=\'rgba(255,255,255,0.06)\' stroke-width=\'1\'/%3E%3C/svg%3E")',
                      backgroundSize: '8px 8px',
                    }}
                  />
                )}
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
                
                {/* 视频动画覆盖层 */}
                {activeAnimation !== 'none' && isPlaying && activeAnimation !== 'batch' && activeAnimation !== 'pulse' && (
                  <div className="absolute inset-0 pointer-events-none" ref={previewWrapRef}>
                    {/* 雨季动画 */}
                    {activeAnimation === 'rain' && RAINDROPS.map((drop) => {
                      const dropColor = getRainDropColor(drop.x / 100, 0.5);
                      return (
                        <motion.div
                          key={drop.id}
                          initial={{ y: -20, opacity: 0 }}
                          animate={{ y: 800, opacity: [0, 1, 1, 0] }}
                          transition={{
                            duration: drop.duration,
                            delay: drop.delay,
                            repeat: Infinity,
                            ease: "linear"
                          }}
                          style={{
                            position: 'absolute',
                            left: `${drop.x}%`,
                            top: 0,
                          }}
                        >
                          <DropSVG size={12} style={{ color: dropColor }} />
                        </motion.div>
                      );
                    })}
                    
                    {/* 星河开场动画 */}
                    {activeAnimation === 'stars' && showStarsIntro && (
                      <div className="absolute inset-0 z-10">
                        {introStars.map((star) => (
                          <motion.div
                            key={star.id}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{
                              opacity: [0, 1, 0.7, 1],
                              scale: [0, 1.1, 1],
                            }}
                            transition={{
                              duration: 2,
                              delay: star.delay,
                              ease: "easeInOut"
                            }}
                            style={{
                              position: 'absolute',
                              left: `${star.x}%`,
                              top: `${star.y}%`,
                            }}
                          >
                            <StarSVG
                              size={star.size}
                              className="text-yellow-300 drop-shadow-[0_0_12px_rgba(253,224,71,0.9)]"
                            />
                          </motion.div>
                        ))}
                      </div>
                    )}
                    
                    {/* 星河背景动画 */}
                    {activeAnimation === 'stars' && !showStarsIntro && (
                      <div className="absolute inset-0">
                        {Array.from({ length: 60 }).map((_, i) => (
                          <motion.div
                            key={`star-bg-${i}`}
                            initial={{ opacity: 0.15 }}
                            animate={{ opacity: [0.15, 1, 0.15] }}
                            transition={{
                              duration: 1.5 + Math.random() * 2,
                              repeat: Infinity,
                              delay: Math.random() * 3
                            }}
                            style={{
                              position: 'absolute',
                              left: `${Math.random() * 100}%`,
                              top: `${Math.random() * 100}%`,
                            }}
                          >
                            <StarSVG className="text-white" size={8 + Math.random() * 12} />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Play按钮覆盖层：仅在选中动画模板且未播放时显示 */}
                {activeAnimation !== 'none' && !isPlaying && image && (
                  <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                    <button
                      onClick={() => setIsPlaying(true)}
                      className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
                    >
                      <Play className="text-emerald-600 w-6 h-6 fill-emerald-600 ml-1" />
                    </button>
                  </div>
                )}
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

      {renderSettingsPanel()}
      {renderBottomNav()}

      {/* 导出视频弹窗 */}
      <AnimatePresence>
        {isExporting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-6"
            >
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle className="text-gray-100 stroke-current" strokeWidth="8" fill="transparent" r="40" cx="50" cy="50" />
                  <motion.circle
                    className="text-emerald-500 stroke-current"
                    strokeWidth="8"
                    strokeLinecap="round"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                    style={{
                      strokeDasharray: 251.2,
                      strokeDashoffset: 251.2 - (251.2 * exportProgress) / 100
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-gray-900">
                  {exportProgress}%
                </div>
              </div>
              <div>
                <h3 className="font-black text-xl text-gray-900">正在导出视频...</h3>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-2">请不要关闭页面</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 导出成功弹窗 */}
      <AnimatePresence>
        {showExportSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-6"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <Video className="text-emerald-600 w-10 h-10" />
              </div>
              <div>
                <h3 className="font-black text-2xl text-gray-900">导出成功！</h3>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-2">视频已准备就绪</p>
              </div>
              <div className="space-y-3 pt-4">
                <button
                  onClick={downloadResult}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-lg"
                >
                  下载 MP4
                </button>
                <button
                  onClick={() => setShowExportSuccess(false)}
                  className="w-full text-gray-400 font-bold py-2 hover:text-gray-600 transition-colors"
                >
                  返回编辑器
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 导出错误弹窗 */}
      <AnimatePresence>
        {exportError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <X className="text-red-500 w-8 h-8" />
              </div>
              <div>
                <h3 className="font-black text-xl text-gray-900">导出失败</h3>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-2">{exportError}</p>
              </div>
              <button
                onClick={() => setExportError(null)}
                className="w-full bg-gray-900 text-white py-3 rounded-xl font-black uppercase tracking-widest hover:bg-gray-800 transition-colors"
              >
                我知道了
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #eee; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ddd; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .pixel-art-grid {
          background-image: 
            linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px);
          background-size: 8px 8px;
        }
        .pixel-art-grid::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(to top right, rgba(99,102,241,0.08), transparent);
          pointer-events: none;
        }
      `}} />
    </div>
  );
}
