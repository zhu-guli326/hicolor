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
import { useStats } from './hooks/useStats';
import { useEnhancedAnalytics } from './hooks/useAnalytics';
import { useI18n } from './i18n/index';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import {
  BATCH_FRAME_MS,
  BATCH_PROGRESS_STEP,
  BATCH_SWITCHES_PER_SECOND,
  PULSE_REVEAL_INTERVAL_MS,
  RAIN_ICON_SCALE,
  RAIN_SPEED_MULTIPLIER,
  renderBatchSceneTransition,
  resolveNonOverlappingCutoutPlacements,
} from './features/animations/batchScene';
import { extractDominantImageColors } from './utils/colorExtraction';
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
  BarChart3,
  RotateCcw,
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

/** 预计算的噪声遮罩缓存：key = `${w}x${h}-${type}-${seed}`，value = Float32Array(0-1归一化噪声) */
const noiseMaskCache = new Map<string, Float32Array>();

function getNoiseMask(w: number, h: number, textureType: TextureType, seed: number): Float32Array {
  const cacheKey = `${w}x${h}-${textureType}-${seed}`;
  if (noiseMaskCache.has(cacheKey)) {
    return noiseMaskCache.get(cacheKey)!;
  }

  const mask = new Float32Array(w * h);
  let s = seed;
  const rng = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };

  let noiseDensity: number;
  switch (textureType) {
    case 'fine-paper': noiseDensity = 0.15; break;
    case 'grain-paper': noiseDensity = 0.55; break;
    case 'coarse-paper': noiseDensity = 0.85; break;
    default: noiseDensity = 0.5;
  }

  for (let i = 0; i < w * h; i++) {
    if (rng() < noiseDensity) {
      mask[i] = (rng() - 0.5) * 2; // -1 to 1
    }
  }

  noiseMaskCache.set(cacheKey, mask);
  if (noiseMaskCache.size > 30) {
    const firstKey = noiseMaskCache.keys().next().value;
    if (firstKey) noiseMaskCache.delete(firstKey);
  }
  return mask;
}
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
const TEXT_FONT_PRESETS: { value: string; fontKey: string; badgeKey?: string }[] = [
  { value: '"Special Elite", cursive', fontKey: 'fonts.Special Elite' },
  { value: '"Huiwen-mincho", serif', fontKey: 'fonts.Huiwen-mincho', badgeKey: 'fonts.recommended' },
  { value: '"Noto Sans JP", sans-serif', fontKey: 'fonts.Noto Sans JP', badgeKey: 'fonts.recommendedJA' },
  { value: '"Noto Serif JP", serif', fontKey: 'fonts.Noto Serif JP', badgeKey: 'fonts.recommendedJA' },
  { value: '"Noto Sans KR", sans-serif', fontKey: 'fonts.Noto Sans KR', badgeKey: 'fonts.recommendedKO' },
  { value: '"Noto Sans SC", sans-serif', fontKey: 'fonts.Noto Sans SC' },
  { value: '"Noto Serif SC", serif', fontKey: 'fonts.Noto Serif SC' },
  { value: '"Ma Shan Zheng", cursive', fontKey: 'fonts.Ma Shan Zheng' },
  { value: '"ZCOOL XiaoWei", sans-serif', fontKey: 'fonts.ZCOOL XiaoWei' },
  { value: '"ZCOOL QingKe HuangYou", cursive', fontKey: 'fonts.ZCOOL QingKe HuangYou' },
  { value: '"Long Cang", cursive', fontKey: 'fonts.Long Cang' },
  { value: '"Liu Jian Mao Cao", cursive', fontKey: 'fonts.Liu Jian Mao Cao' },
  { value: '"Yi Shi Jiti", cursive', fontKey: 'fonts.Yi Shi Jiti' },
  { value: '"Homemade Apple", cursive', fontKey: 'fonts.Homemade Apple' },
  { value: '"Cinzel", serif', fontKey: 'fonts.Cinzel' },
  { value: '"Oswald", sans-serif', fontKey: 'fonts.Oswald' },
  { value: '"Bebas Neue", sans-serif', fontKey: 'fonts.Bebas Neue' },
  { value: '"Anton", sans-serif', fontKey: 'fonts.Anton' },
  { value: '"Playfair Display", serif', fontKey: 'fonts.Playfair Display' },
  { value: '"Permanent Marker", cursive', fontKey: 'fonts.Permanent Marker' },
  { value: '"Press Start 2P", cursive', fontKey: 'fonts.Press Start 2P' },
  { value: '"Righteous", sans-serif', fontKey: 'fonts.Righteous' },
  { value: '"Dancing Script", cursive', fontKey: 'fonts.Dancing Script' },
  { value: '"Satisfy", cursive', fontKey: 'fonts.Satisfy' },
  { value: '"Great Vibes", cursive', fontKey: 'fonts.Great Vibes' },
  { value: '"Monoton", cursive', fontKey: 'fonts.Monoton' },
  { value: '"Russo One", sans-serif', fontKey: 'fonts.Russo One' },
  { value: '"Bungee", cursive', fontKey: 'fonts.Bungee' },
  { value: '"Black Ops One", cursive', fontKey: 'fonts.Black Ops One' },
  { value: '"Staatliches", cursive', fontKey: 'fonts.Staatliches' },
  { value: '"Abril Fatface", cursive', fontKey: 'fonts.Abril Fatface' },
  { value: '"Alfa Slab One", cursive', fontKey: 'fonts.Alfa Slab One' },
  { value: '"Paytone One", sans-serif', fontKey: 'fonts.Paytone One' },
  { value: '"Syncopate", sans-serif', fontKey: 'fonts.Syncopate' },
  { value: '"Poiret One", cursive', fontKey: 'fonts.Poiret One' },
  { value: '"Comfortaa", cursive', fontKey: 'fonts.Comfortaa' },
  { value: '"Yeseva One", cursive', fontKey: 'fonts.Yeseva One' },
  { value: '"Lobster", cursive', fontKey: 'fonts.Lobster' },
  { value: '"Orbitron", sans-serif', fontKey: 'fonts.Orbitron' },
  { value: '"Acme", sans-serif', fontKey: 'fonts.Acme' },
  { value: '"Boogaloo", cursive', fontKey: 'fonts.Boogaloo' },
  { value: '"Fredoka One", cursive', fontKey: 'fonts.Fredoka One' },
  { value: '"Lilita One", cursive', fontKey: 'fonts.Lilita One' },
  { value: '"Big Shoulders Display", cursive', fontKey: 'fonts.Big Shoulders Display' },
  { value: '"Arvo", serif', fontKey: 'fonts.Arvo' },
  { value: '"Lato", sans-serif', fontKey: 'fonts.Lato' },
  { value: '"Rajdhani", sans-serif', fontKey: 'fonts.Rajdhani' },
  { value: '"Rubik Mono One", sans-serif', fontKey: 'fonts.Rubik Mono One' },
  { value: '"Rubik Bubbles", cursive', fontKey: 'fonts.Rubik Bubbles' },
  { value: '"Shojumaru", cursive', fontKey: 'fonts.Shojumaru' },
  { value: '"Bungee Inline", cursive', fontKey: 'fonts.Bungee Inline' },
  { value: '"Spirax", cursive', fontKey: 'fonts.Spirax' },
  { value: '"Knewave", cursive', fontKey: 'fonts.Knewave' },
];

const SHAPE_OPTIONS: { value: ShapeKind; icon: LucideIcon; key: string }[] = [
  { value: 'circle', icon: Circle, key: 'shapeKinds.circle' },
  { value: 'square', icon: Square, key: 'shapeKinds.square' },
  { value: 'star', icon: Star, key: 'shapeKinds.star' },
  { value: 'drop', icon: Droplet, key: 'shapeKinds.drop' },
  { value: 'snowflake', icon: Snowflake, key: 'shapeKinds.snowflake' },
  { value: 'heart', icon: Heart, key: 'shapeKinds.heart' },
  { value: 'randomLetters', icon: Dices, key: 'shapeKinds.randomLetters' },
  { value: 'random', icon: Shuffle, key: 'shapeKinds.random' },
  { value: 'symbol', icon: Plus, key: 'shapeKinds.symbol' },
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

function isLikelyMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
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

function getVideoExtensionFromMimeType(mimeType: string): 'mp4' | 'webm' {
  return mimeType.toLowerCase().includes('webm') ? 'webm' : 'mp4';
}

function getPreferredRecorderMimeType() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
  ];

  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch {
      // ignore unsupported candidate errors from some browsers
    }
  }

  return '';
}

function createRecorderWithFallback(
  stream: MediaStream,
  preferredMimeType: string,
  videoBitsPerSecond: number
) {
  const attempts: MediaRecorderOptions[] = [];

  if (preferredMimeType) {
    attempts.push({ mimeType: preferredMimeType, videoBitsPerSecond });
  }
  attempts.push({ videoBitsPerSecond });
  attempts.push({});

  let lastError: unknown = null;
  for (const options of attempts) {
    try {
      const recorder = new MediaRecorder(stream, options);
      return {
        recorder,
        mimeType: options.mimeType || recorder.mimeType || preferredMimeType || 'video/webm',
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('当前浏览器无法初始化视频录制器');
}

function getVideoExportSupport() {
  if (typeof window === 'undefined') {
    return { supported: true, reason: '' };
  }

  const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
  const hasCanvasCapture =
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function';

  if (!hasMediaRecorder || !hasCanvasCapture) {
    return {
      supported: false,
      reason: '当前浏览器缺少视频录制能力，无法直接导出视频',
    };
  }

  return { supported: true, reason: '' };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

const MAX_VIDEO_EXPORT_EDGE = 1280;

type FilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

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
async function drawOverlayTextOnContext(
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

  // 等待字体加载完成后再测量和绘制，防止导出时中文字体乱码
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch {}

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

  targetCtx.save();
  targetCtx.font = `800 ${lineLayout.fontSize}px ${fontFamily}, sans-serif`;
  targetCtx.textAlign = 'center';
  targetCtx.textBaseline = 'middle';
  targetCtx.fillStyle = fillColor;
  lineLayout.lines.forEach((line, i) => {
    if (!line) return;
    const y = lineLayout.startY + i * lineLayout.lh;
    targetCtx.fillText(line, lineLayout.cx, y);
  });
  targetCtx.restore();

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

function drawBatchSceneShape(
  ctx: CanvasRenderingContext2D,
  shape: 'circle' | 'square' | 'star' | 'heart' | 'drop' | 'snowflake',
  size: number
) {
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (shape === 'square') {
    ctx.fillRect(-size / 2, -size / 2, size, size);
    return;
  }

  ctx.beginPath();
  addShapePath(ctx, shape, size);
  ctx.fill();
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

  // 获取平均亮度，暗背景下适当降低纹理强度，避免发脏
  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  const avgBrightness = totalBrightness / (data.length / 4);
  const brightnessFactor = avgBrightness > 128 ? 1 : 0.75;

  let noiseStrength: number;
  let clumpStrength: number;
  let clumpScale: number;
  let fiberStrength: number;
  let fiberFrequency: number;
  let warmBias: number;

  switch (textureType) {
    case 'fine-paper':
      noiseStrength = 7.5 * brightnessFactor * strengthMultiplier;
      clumpStrength = 1.2 * strengthMultiplier;
      clumpScale = 28;
      fiberStrength = 3.6 * strengthMultiplier;
      fiberFrequency = 0.34;
      warmBias = 0.25;
      break;
    case 'grain-paper':
      noiseStrength = 14 * brightnessFactor * strengthMultiplier;
      clumpStrength = 7.8 * strengthMultiplier;
      clumpScale = 12;
      fiberStrength = 1.1 * strengthMultiplier;
      fiberFrequency = 0.17;
      warmBias = 0.8;
      break;
    case 'coarse-paper':
      noiseStrength = 22 * brightnessFactor * strengthMultiplier;
      clumpStrength = 16 * strengthMultiplier;
      clumpScale = 7;
      fiberStrength = 0.35 * strengthMultiplier;
      fiberFrequency = 0.09;
      warmBias = 1.5;
      break;
    default:
      return;
  }

  // 细粒度噪声 + 低频团块噪声的叠加，让几种纸张质感差异更明显
  const mask = getNoiseMask(w, h, textureType, 12345);
  const clumpW = Math.max(1, Math.ceil(w / clumpScale));
  const clumpH = Math.max(1, Math.ceil(h / clumpScale));
  const clumpMask = getNoiseMask(clumpW, clumpH, 'fine-noise', 271828);

  for (let i = 0; i < w * h; i++) {
    const x = i % w;
    const y = Math.floor(i / w);
    const cIdx = Math.floor(y / clumpScale) * clumpW + Math.floor(x / clumpScale);

    const baseNoise = mask[i] * noiseStrength;
    const clumpNoise = clumpMask[cIdx] * clumpStrength;

    // 细纸纹：加入轻微方向纤维；粗纸纹纤维弱但团块更强
    const fiberWave = Math.sin((x + y * 0.35) * fiberFrequency + clumpNoise * 0.25);
    const fiber = fiberWave > 0.9 ? fiberStrength : 0;

    let mix = baseNoise + clumpNoise + fiber;
    if (textureType === 'fine-paper') {
      mix = baseNoise * 0.65 + clumpNoise * 0.35 + fiber * 1.25;
    } else if (textureType === 'grain-paper') {
      mix = baseNoise * 0.9 + clumpNoise * 1.2 + fiber;
    } else if (textureType === 'coarse-paper') {
      mix = baseNoise * 0.75 + clumpNoise * 1.65 + fiber;
      if (Math.abs(clumpNoise) > clumpStrength * 0.45) {
        mix += Math.sign(clumpNoise) * 1.6 * strengthMultiplier;
      }
    }
    if (Math.abs(mix) < 0.08) continue;

    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    // 给纸张增加一点暖色纤维偏移，视觉更像纸而不是纯噪点
    data[idx] = Math.min(255, Math.max(0, r + mix + warmBias));
    data[idx + 1] = Math.min(255, Math.max(0, g + mix * 0.96));
    data[idx + 2] = Math.min(255, Math.max(0, b + mix * 0.9 - warmBias * 0.25));
  }

  ctx.putImageData(imageData, 0, 0);
}

// 像素风纹理：使用固定的像素块效果（带缓存）
function applyPixelTexture(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength: number
) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const pixelSize = 1;

  // 使用高频噪点 + 低频明暗起伏，让“细腻噪点”与纸张纹理明显区分
  const blockCountX = Math.ceil(w / pixelSize);
  const blockCountY = Math.ceil(h / pixelSize);
  const blockSeed = Math.round(strength);
  const blockMask = getNoiseMask(blockCountX, blockCountY, 'fine-noise', blockSeed);
  const microMask = getNoiseMask(w, h, 'fine-noise', 314159 + blockSeed);
  const toneMask = getNoiseMask(Math.ceil(w / 6), Math.ceil(h / 6), 'grain-paper', 2718 + blockSeed);

  for (let py = 0; py < h; py += pixelSize) {
    for (let px = 0; px < w; px += pixelSize) {
      const bx = Math.floor(px / pixelSize);
      const by = Math.floor(py / pixelSize);
      const bIdx = by * blockCountX + bx;
      const tx = Math.floor(px / 6);
      const ty = Math.floor(py / 6);
      const tIdx = ty * Math.ceil(w / 6) + tx;
      const baseGrain = blockMask[bIdx];
      const micro = microMask[py * w + px];
      const tone = toneMask[tIdx];
      const brightnessOffset = baseGrain * strength * 0.42 + tone * strength * 0.2;
      const salt =
        Math.abs(micro) > 0.6 ? Math.sign(micro) * strength * 0.22 : 0;
      const colorShift = micro * strength * 0.08;

      for (let dy = 0; dy < pixelSize && py + dy < h; dy++) {
        for (let dx = 0; dx < pixelSize && px + dx < w; dx++) {
          const pxX = px + dx;
          const pxY = py + dy;
          const pIdx = pxY * w + pxX;
          const idx = pIdx * 4;
          const pixelMicro = microMask[pIdx] * strength * 0.18;
          const delta = brightnessOffset + pixelMicro + salt;
          data[idx] = Math.min(255, Math.max(0, data[idx] + delta + colorShift));
          data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + delta * 0.97));
          data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + delta * 0.93 - colorShift));
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
        textureStrengthMultiplier = 1.25;
        break;
      case 'split':
        // 双拼色：纹理适中
        textureStrengthMultiplier = 1.1;
        break;
      case 'gradient':
        // 渐变：纹理略弱，保留渐变层次
        textureStrengthMultiplier = 0.85;
        break;
      case 'grid':
        // 笔记本：纹理偏弱，保持线条清晰
        textureStrengthMultiplier = 0.65;
        break;
      case 'diagonal':
        // 格子：纹理弱，保持格子清晰
        textureStrengthMultiplier = 0.7;
        break;
      case 'block':
        // 棋盘格：纹理适中
        textureStrengthMultiplier = 0.85;
        break;
      case 'dots':
        // 点阵：纹理弱，保持点阵清晰
        textureStrengthMultiplier = 0.65;
        break;
      default:
        textureStrengthMultiplier = 1.0;
    }

    // 像素风使用特殊的像素块效果
    if (bgConfig.texture === 'fine-noise') {
      applyPixelTexture(ctx, w, h, 26 * textureStrengthMultiplier);
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

const COMPOSITIONS: { value: CompositionMode; key: string; icon: React.FC<{ size?: number; strokeWidth?: number }> }[] = [
  { value: 'block-bottom', key: 'compositions.block-bottom', icon: AlignEndHorizontal },
  { value: 'block-top', key: 'compositions.block-top', icon: AlignStartHorizontal },
  { value: 'block-left', key: 'compositions.block-left', icon: AlignStartVertical },
  { value: 'block-right', key: 'compositions.block-right', icon: AlignEndVertical },
];

// --- Main Application ---

// TemplateButton 组件
function TemplateButton({ label, icon, active, onClick, onDeselect, t }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void; onDeselect?: () => void; t: (key: string) => string }) {
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
          title="Clear"
        >
          <X size={10} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

export default function App() {
  // --- Stats ---
  const { stats, track, resetStats } = useStats();
  const { track: trackWithAnalytics, getAnalytics, resetAnalytics } = useEnhancedAnalytics();
  const { locale, setLocale, t } = useI18n();
  const lastBgTypeRef = useRef<string | null>(null);
  const lastCompositionRef = useRef<string | null>(null);
  const lastShapeKindRef = useRef<string | null>(null);
  const lastDistributionModeRef = useRef<string | null>(null);
  const lastCreationModeRef = useRef<string | null>(null);
  const lastAnimationRef = useRef<string | null>(null);
  const lastTextureRef = useRef<string | null>(null);
  const lastBgColor1Ref = useRef<string | null>(null);
  const lastBgColor2Ref = useRef<string | null>(null);
  const lastShapeColorRef = useRef<string | null>(null);
  const lastGradientAngleRef = useRef<number | null>(null);
  const lastBaseSizeRef = useRef<number | null>(null);
  const lastVariationRef = useRef<number | null>(null);
  const lastAutoCountRef = useRef<number | null>(null);
  const lastScatterCountRef = useRef<number | null>(null);
  const lastSeedRef = useRef<number | null>(null);

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
  const [exportPhase, setExportPhase] = useState<'record' | 'transcode'>('record');
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [videoExportSupported, setVideoExportSupported] = useState(true);
  const [videoExportBlockedReason, setVideoExportBlockedReason] = useState('');
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

  useEffect(() => {
    const support = getVideoExportSupport();
    setVideoExportSupported(support.supported);
    setVideoExportBlockedReason(support.reason);
  }, []);

  // 形状切换动画：连续推进 phase，用双层缩放和旋转做更顺滑的切换
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeAnimation === 'batch' && isPlaying) {
      interval = setInterval(() => {
        setBatchPositionOffset((prev) => prev + BATCH_PROGRESS_STEP);
      }, BATCH_FRAME_MS);
    }
    return () => clearInterval(interval);
  }, [activeAnimation, isPlaying]);

  const prevCutoutsLengthRef = useRef(cutouts.length);

  // 形状叠加动画：逐个显现图形，每次只增加一个，节奏更慢
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeAnimation === 'pulse' && isPlaying && cutouts.length > 0) {
      // 只在 cutouts 长度首次增加时重置（从 0 到有内容）
      if (prevCutoutsLengthRef.current === 0 && cutouts.length > 0) {
        setPulseRevealCount(0);
      }
      prevCutoutsLengthRef.current = cutouts.length;

      interval = setInterval(() => {
        setPulseRevealCount(prev => {
          if (prev >= 50) {
            // 达到50个后重新开始
            return 0;
          }
          return prev + 1;
        });
      }, PULSE_REVEAL_INTERVAL_MS); // 更快地逐个显现
    }
    return () => clearInterval(interval);
  }, [activeAnimation, isPlaying]);

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
          const step = activeAnimation === 'rain' ? 0.01 * RAIN_SPEED_MULTIPLIER : 0.01;
          return prev + step; // 缓慢下落
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
  /** 色块在「主图+色块」整条里所占比例，20%–80%（80% 内部按 79% 计算避免除零） */
  /** 主图预览始终一整格原图缩放；色块区为条带「裁剪」宽度/高度（占比仅改变条带，不挤压主图格） */
  const [blockAreaPercent, setBlockAreaPercent] = useState(80);
  const blockStripRatio = Math.min(0.79, Math.max(0.2, blockAreaPercent / 100));

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
    const handleResize = () => fitToScreen();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [image, composition, settingsPanelOpen, blockAreaPercent]);

  const settingsPanelOpenRef = useRef(settingsPanelOpen);
  useEffect(() => {
    settingsPanelOpenRef.current = settingsPanelOpen;
  }, [settingsPanelOpen]);

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
      const settingsPanelHeight = settingsPanelOpenRef.current ? window.innerHeight * 0.32 : 0;
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
  }, [image, composition, blockAreaPercent]);

  useLayoutEffect(() => {
    if (!image) return;
    measurePreviewContain();
    const id = requestAnimationFrame(() => measurePreviewContain());
    return () => cancelAnimationFrame(id);
  }, [image, composition, blockAreaPercent, settingsPanelOpen]);

  useEffect(() => {
    if (!image) return;
    const stage = previewStageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(() => measurePreviewContain());
    ro.observe(stage);
    return () => ro.disconnect();
  }, [image, composition, blockAreaPercent]);

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

  // --- Stats Tracking: 跟踪配置变化（仅在值真正改变时记录） ---
  useEffect(() => {
    if (lastBgTypeRef.current !== null && lastBgTypeRef.current !== bgConfig.type) {
      trackWithAnalytics({ type: 'change_bg_type', bgType: bgConfig.type });
    }
    lastBgTypeRef.current = bgConfig.type;
  }, [bgConfig.type]);

  useEffect(() => {
    if (lastCompositionRef.current !== null && lastCompositionRef.current !== composition) {
      trackWithAnalytics({ type: 'change_composition', composition });
    }
    lastCompositionRef.current = composition;
  }, [composition]);

  useEffect(() => {
    if (lastShapeKindRef.current !== null && lastShapeKindRef.current !== cutoutConfig.defaultShapeKind) {
      trackWithAnalytics({ type: 'change_shape_kind', shapeKind: cutoutConfig.defaultShapeKind });
    }
    lastShapeKindRef.current = cutoutConfig.defaultShapeKind;
  }, [cutoutConfig.defaultShapeKind]);

  useEffect(() => {
    if (lastDistributionModeRef.current !== null && lastDistributionModeRef.current !== cutoutConfig.distributionMode) {
      trackWithAnalytics({ type: 'change_distribution_mode', mode: cutoutConfig.distributionMode });
    }
    lastDistributionModeRef.current = cutoutConfig.distributionMode;
  }, [cutoutConfig.distributionMode]);

  useEffect(() => {
    if (lastCreationModeRef.current !== null && lastCreationModeRef.current !== cutoutConfig.creationMode) {
      trackWithAnalytics({ type: 'change_creation_mode', mode: cutoutConfig.creationMode });
    }
    lastCreationModeRef.current = cutoutConfig.creationMode;
  }, [cutoutConfig.creationMode]);

  useEffect(() => {
    if (lastAnimationRef.current !== null && lastAnimationRef.current !== activeAnimation) {
      trackWithAnalytics({ type: 'change_animation', animation: activeAnimation });
    }
    lastAnimationRef.current = activeAnimation;
  }, [activeAnimation]);

  useEffect(() => {
    if (lastTextureRef.current !== null && lastTextureRef.current !== bgConfig.texture) {
      trackWithAnalytics({ type: 'change_texture', textureType: bgConfig.texture });
    }
    lastTextureRef.current = bgConfig.texture;
  }, [bgConfig.texture]);

  useEffect(() => {
    if (lastBgColor1Ref.current !== null && lastBgColor1Ref.current !== bgConfig.color1) {
      trackWithAnalytics({ type: 'change_bg_color', color: bgConfig.color1, index: 1 });
    }
    lastBgColor1Ref.current = bgConfig.color1;
  }, [bgConfig.color1]);

  useEffect(() => {
    if (lastBgColor2Ref.current !== null && lastBgColor2Ref.current !== bgConfig.color2) {
      trackWithAnalytics({ type: 'change_bg_color', color: bgConfig.color2, index: 2 });
    }
    lastBgColor2Ref.current = bgConfig.color2;
  }, [bgConfig.color2]);

  useEffect(() => {
    if (lastShapeColorRef.current !== null && lastShapeColorRef.current !== cutoutConfig.shapeColor) {
      trackWithAnalytics({ type: 'change_shape_color', color: cutoutConfig.shapeColor });
    }
    lastShapeColorRef.current = cutoutConfig.shapeColor;
  }, [cutoutConfig.shapeColor]);

  useEffect(() => {
    if (lastBaseSizeRef.current !== null && lastBaseSizeRef.current !== cutoutConfig.baseSize) {
      trackWithAnalytics({ type: 'change_shape_size', size: cutoutConfig.baseSize });
    }
    lastBaseSizeRef.current = cutoutConfig.baseSize;
  }, [cutoutConfig.baseSize]);

  useEffect(() => {
    if (lastAutoCountRef.current !== null && lastAutoCountRef.current !== cutoutConfig.autoCount) {
      trackWithAnalytics({ type: 'change_shape_count', count: cutoutConfig.autoCount });
    }
    lastAutoCountRef.current = cutoutConfig.autoCount;
  }, [cutoutConfig.autoCount]);

  useEffect(() => {
    if (lastVariationRef.current !== null && lastVariationRef.current !== cutoutConfig.variation) {
      trackWithAnalytics({ type: 'change_creation_mode', mode: `variation_${cutoutConfig.variation}` });
    }
    lastVariationRef.current = cutoutConfig.variation;
  }, [cutoutConfig.variation]);

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
  /** 是否显示叠字编辑框（默认不显示，点击文字时才显示） */
  const [overlayEditing, setOverlayEditing] = useState(false);
  const overlayDragStartRef = useRef({ mouseX: 0, mouseY: 0, ox: 0, oy: 0 });
  const overlayResizeStartRef = useRef({ mouseY: 0, fontSize: 0 });

  // --- Refs ---
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const blockCanvasRef = useRef<HTMLCanvasElement>(null);
  const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);
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

    // 仅在手动触发（无 imageOverride）时记录统计
    if (!opts?.imageOverride) {
      trackWithAnalytics({ type: 'generate_cutouts' });
    }
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
    trackWithAnalytics({ type: 'play_animation' });
    setIsPlaying(true);
    if (type === 'batch') setBatchPositionOffset(0);
    
    if (type === 'stars') {
      setShowStarsIntro(true);
      setTimeout(() => setShowStarsIntro(false), 4000);
    }

    if (image && cutouts.length === 0 && (type === 'pulse' || type === 'batch')) {
      generateAutoCutouts();
      return;
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
    if (!videoExportSupported) {
      setExportError(videoExportBlockedReason || '当前浏览器缺少视频录制能力，无法直接导出视频');
      return;
    }
    if (!image) {
      setExportError('请先上传一张背景图片');
      return;
    }
    if (activeAnimation === 'none') {
      setExportError('请先选择一个动画模板');
      return;
    }

    if ((activeAnimation === 'pulse' || activeAnimation === 'batch') && cutouts.length === 0) {
      generateAutoCutouts();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    setExportError(null);
    setIsExporting(true);
    setExportProgress(0);
    setExportPhase('record');
    if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
    setVideoBlobUrl(null);

    const previousIsPlaying = isPlaying;

    try {
      // 临时启用动画播放状态，确保录制时能绘制动画效果
      setIsPlaying(true);

      // 等待一帧，确保动画状态生效
      await new Promise(resolve => requestAnimationFrame(resolve));

      // 直接使用主画布和色块画布的尺寸，不依赖 previewWrapRef
      const r = blockStripRatio;
      const { mainW: baseMainW, mainH: baseMainH, blockW: baseBlockW, blockH: baseBlockH } =
        getLayoutDimensions(composition, r, image.width, image.height);

      const horiz = composition === 'block-left' || composition === 'block-right';
      const baseRecW = horiz ? baseMainW + baseBlockW : Math.max(baseMainW, baseBlockW);
      const baseRecH = horiz ? Math.max(baseMainH, baseBlockH) : baseMainH + baseBlockH;
      const exportScale = Math.min(1, MAX_VIDEO_EXPORT_EDGE / Math.max(baseRecW, baseRecH));
      const mainW = Math.max(1, Math.round(baseMainW * exportScale));
      const mainH = Math.max(1, Math.round(baseMainH * exportScale));
      const blockW = Math.max(1, Math.round(baseBlockW * exportScale));
      const blockH = Math.max(1, Math.round(baseBlockH * exportScale));
      const recW = Math.max(1, Math.round(baseRecW * exportScale));
      const recH = Math.max(1, Math.round(baseRecH * exportScale));

      const canvas = document.createElement('canvas');
      canvas.width = recW;
      canvas.height = recH;
      const ctx = canvas.getContext('2d')!;
      applyHighFidelity2d(ctx);

      // 建立截图用的离屏画布（mainW×mainH 和 blockW×blockH）
      const mainSnap = document.createElement('canvas');
      mainSnap.width = mainW;
      mainSnap.height = mainH;
      const mainSnapCtx = mainSnap.getContext('2d')!;

      const blockSnap = document.createElement('canvas');
      blockSnap.width = blockW;
      blockSnap.height = blockH;
      const blockSnapCtx = blockSnap.getContext('2d')!;

      // 复用主画布和色块画布绘制结果（截图时暂停主画布更新）
      const captureMain = () => {
        const mc = mainCanvasRef.current;
        if (!mc) return;
        mainSnapCtx.clearRect(0, 0, mainW, mainH);
        mainSnapCtx.drawImage(mc, 0, 0, mc.width, mc.height, 0, 0, mainW, mainH);
      };
      const captureBlock = () => {
        const bc = blockCanvasRef.current;
        if (!bc) return;
        blockSnapCtx.clearRect(0, 0, blockW, blockH);
        blockSnapCtx.drawImage(bc, 0, 0, bc.width, bc.height, 0, 0, blockW, blockH);
      };

      // 预计算条带采样（用于雨滴取色）
      const sampleCvs = document.createElement('canvas');
      sampleCvs.width = blockW;
      sampleCvs.height = blockH;
      const sampleCtx = sampleCvs.getContext('2d')!;
      const overlayTrim = overlayTextConfig.content.trim();
      paintBlockFillOnContext(sampleCtx, blockW, blockH, bgConfig, composition);
      const blockImageData = sampleCtx.getImageData(0, 0, blockW, blockH);
      const sampleFromBlockData = (nx: number, ny: number): string => {
        const xi = Math.max(0, Math.min(blockW - 1, Math.floor(nx * blockW)));
        const yi = Math.max(0, Math.min(blockH - 1, Math.floor(ny * blockH)));
        const i = (yi * blockW + xi) * 4;
        return `rgb(${blockImageData.data[i]},${blockImageData.data[i + 1]},${blockImageData.data[i + 2]})`;
      };

      const lightweightExportEffects =
        activeAnimation === 'rain' ||
        activeAnimation === 'rainfall' ||
        activeAnimation === 'stars';
      const exportFps = lightweightExportEffects ? 30 : 60;

      // 流 & 录制器
      const stream = canvas.captureStream(exportFps);
      const supportedType = getPreferredRecorderMimeType();

      if (typeof MediaRecorder === 'undefined') {
        throw new Error('当前浏览器内核不支持视频录制，建议改用系统浏览器打开');
      }

      if (!supportedType && !('MediaRecorder' in window)) {
        throw new Error('当前浏览器不支持视频录制');
      }

      console.log('Canvas size:', recW, 'x', recH);
      console.log('Stream tracks:', stream.getTracks().length);
      console.log('MediaRecorder supported:', supportedType);

      const { recorder, mimeType: recorderMimeType } = createRecorderWithFallback(
        stream,
        supportedType,
        lightweightExportEffects ? 5000000 : 8000000
      );

      const chunks: Blob[] = [];
      let recorderError: Error | null = null;
      recorder.ondataavailable = (e) => { 
        if (e.data.size > 0) {
          chunks.push(e.data);
          console.log('Data available:', e.data.size, 'bytes, type:', e.data.type);
        }
      };

      recorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        recorderError = new Error('浏览器录制器运行失败，正在尝试兼容模式导出');
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        if (chunks.length === 0) {
          try {
            await exportByFrameSequence();
            return;
          } catch (fallbackErr) {
            console.error('Frame sequence export failed:', fallbackErr);
            setExportError(
              recorderError?.message ||
              (fallbackErr instanceof Error ? fallbackErr.message : '导出失败，请重试')
            );
            setIsExporting(false);
            setIsPlaying(previousIsPlaying);
            return;
          }
        }

        const rawType = chunks[0]?.type || recorderMimeType || supportedType || 'video/webm';
        const recordedBlob = new Blob(chunks, { type: rawType });

        finalizeExport(recordedBlob, rawType || 'video/webm');
      };

      recorder.start(250);

      // 基础层只绘制一次（动画过程中不变）
      const drawBaseLayer = (ctx: CanvasRenderingContext2D) => {
        if (composition === 'block-right') {
          ctx.drawImage(mainSnap, 0, 0);
          ctx.drawImage(blockSnap, mainW, 0);
        } else if (composition === 'block-left') {
          ctx.drawImage(blockSnap, 0, 0);
          ctx.drawImage(mainSnap, blockW, 0);
        } else if (composition === 'block-bottom') {
          ctx.drawImage(mainSnap, 0, 0);
          ctx.drawImage(blockSnap, 0, mainH);
        } else {
          ctx.drawImage(blockSnap, 0, 0);
          ctx.drawImage(mainSnap, 0, blockH);
        }
      };
      drawBaseLayer(ctx);

      // 动画参数
      const DURATION = activeAnimation === 'pulse' ? 5000 : 3000; // ms
      const startTime = performance.now();

      let rainfallVal = 0;
      let starVal = 0;
      let pulseVal = 0;
      let batchVal = 0;

      function finalizeExport(blob: Blob, mimeType: string) {
        const url = URL.createObjectURL(blob);
        setVideoBlobUrl(url);
        setVideoMimeType(mimeType);
        setExportProgress(100);
        setIsExporting(false);
        setShowExportSuccess(true);
        trackWithAnalytics({ type: 'export_video' });
        setIsPlaying(previousIsPlaying);
      }

      function renderFrame(t: number) {
        setExportProgress(Math.round(t * 80));

        ctx.clearRect(0, 0, recW, recH);
        drawBaseLayer(ctx);

        if (activeAnimation !== 'none') {
          if (activeAnimation === 'rain') rainfallVal = t;
          if (activeAnimation === 'rainfall') rainfallVal = t;
          if (activeAnimation === 'stars') starVal = t;
          if (activeAnimation === 'pulse') pulseVal = t;
          if (activeAnimation === 'batch') batchVal = t;

          if (activeAnimation === 'rain' || activeAnimation === 'rainfall') {
            const raindropCount = lightweightExportEffects ? 18 : 40;
            const rainScale = activeAnimation === 'rain' ? RAIN_ICON_SCALE : 1;
            const rainSpeed = activeAnimation === 'rain' ? RAIN_SPEED_MULTIPLIER : 1;
            for (let i = 0; i < raindropCount; i++) {
              const rx = (mainW / raindropCount) * i + mainW / (raindropCount * 2);
              const rainY = mainH * Math.min(1, rainfallVal * rainSpeed) + i * (mainH / raindropCount);
              if (rainY < 0 || rainY >= mainH) continue;
              const rc = sampleFromBlockData(rx / mainW, rainY / mainH);
              ctx.fillStyle = rc;
              if (lightweightExportEffects) {
                ctx.fillRect(rx - 2 * rainScale, rainY - 8 * rainScale, 4 * rainScale, 16 * rainScale);
              } else {
                ctx.beginPath();
                ctx.ellipse(rx, rainY, 3 * rainScale, 10 * rainScale, 0, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }

          if (activeAnimation === 'stars') {
            const drawStarOnCtx = (starCtx: CanvasRenderingContext2D, sx: number, sy: number, size: number, pts: number, alpha: number) => {
              starCtx.save();
              starCtx.fillStyle = `rgba(255,255,240,${alpha})`;
              starCtx.beginPath();
              for (let pi = 0; pi < pts * 2; pi++) {
                const angle = (pi * Math.PI) / pts - Math.PI / 2;
                const radius = pi % 2 === 0 ? size : size * 0.4;
                const px = sx + Math.cos(angle) * radius;
                const py = sy + Math.sin(angle) * radius;
                pi === 0 ? starCtx.moveTo(px, py) : starCtx.lineTo(px, py);
              }
              starCtx.closePath();
              starCtx.fill();
              starCtx.restore();
            };
            const mainStarX = mainW / 2;
            const mainStarY = mainH * 0.4;
            const mainStarSize = Math.min(mainW, mainH) * 0.15;
            const mainGlowRadius = mainStarSize * (1.5 + starVal * 2.5);
            const mainGlowAlpha = 0.6 + starVal * 0.4;
            if (lightweightExportEffects) {
              ctx.fillStyle = `rgba(255,255,220,${0.18 + starVal * 0.32})`;
              ctx.beginPath();
              ctx.arc(mainStarX, mainStarY, mainGlowRadius * 0.68, 0, Math.PI * 2);
              ctx.fill();
            } else {
              const mainGlow = ctx.createRadialGradient(mainStarX, mainStarY, 0, mainStarX, mainStarY, mainGlowRadius);
              mainGlow.addColorStop(0, `rgba(255,255,240,${mainGlowAlpha})`);
              mainGlow.addColorStop(0.4, `rgba(255,255,200,${mainGlowAlpha * 0.6})`);
              mainGlow.addColorStop(1, 'rgba(255,255,200,0)');
              ctx.fillStyle = mainGlow;
              ctx.beginPath();
              ctx.arc(mainStarX, mainStarY, mainGlowRadius, 0, Math.PI * 2);
              ctx.fill();
            }
            drawStarOnCtx(ctx, mainStarX, mainStarY, mainStarSize, 6, 0.15 + starVal * 0.85);
            drawStarOnCtx(ctx, mainW * 0.25, mainH * 0.25, mainStarSize * 0.6, 5, 0.15 + starVal * 0.55);
            drawStarOnCtx(ctx, mainW * 0.75, mainH * 0.3, mainStarSize * 0.65, 5, 0.15 + starVal * 0.6);
            if (!lightweightExportEffects) {
              drawStarOnCtx(ctx, mainW * 0.2, mainH * 0.6, mainStarSize * 0.5, 5, 0.15 + starVal * 0.45);
              drawStarOnCtx(ctx, mainW * 0.8, mainH * 0.65, mainStarSize * 0.55, 5, 0.15 + starVal * 0.5);
            }
          }

          if (activeAnimation === 'pulse') {
            const rawCount = Math.floor(pulseVal * 20);
            const visibleCount = Math.min(20, Math.max(0, rawCount));
            for (let idx = 0; idx < visibleCount && idx < cutouts.length; idx++) {
              const c = cutouts[idx];
              const holeColor = sampleFromBlockData(c.x, c.y);
              ctx.save();
              ctx.translate(c.x * mainW, c.y * mainH);
              ctx.rotate(c.angle + pulseVal * 0.1);
              ctx.fillStyle = holeColor;
              const sz = (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (mainW / 800);
              if (c.shapeKind === 'circle' || !c.shapeKind) {
                ctx.beginPath(); ctx.arc(0, 0, sz, 0, Math.PI * 2); ctx.fill();
              } else if (c.shapeKind === 'square') {
                ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
              } else if (c.shapeKind === 'star') {
                const drawS = (ctx as any).constructor.prototype.drawStar
                  || ((ctx as any)._drawStarFn ? (ctx as any)._drawStarFn(ctx, 0, 0, sz, 5) : null);
                if (!drawS) {
                  for (let pi = 0; pi < 10; pi++) {
                    const angle = (pi * Math.PI) / 5 - Math.PI / 2;
                    const radius = pi % 2 === 0 ? sz : sz * 0.4;
                    pi === 0 ? ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius) : ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
                  }
                  ctx.closePath(); ctx.fill();
                }
              }
              ctx.restore();
            }
          }

          if (activeAnimation === 'batch') {
            const batchPhase = batchVal * (DURATION / 1000) * BATCH_SWITCHES_PER_SECOND;
            renderBatchSceneTransition({
              ctx,
              cutouts,
              phase: batchPhase,
              sampleColor: sampleFromBlockData,
              cutoutConfig: { baseSize: cutoutConfig.baseSize, variation: cutoutConfig.variation },
              width: mainW,
              height: mainH,
              drawShape: drawBatchSceneShape,
            });
          }
        }
      }

      async function exportByFrameSequence() {
        if (!ffmpegRef.current) {
          throw new Error('视频编码器尚未准备完成，请稍后再试');
        }

        const ffmpeg = ffmpegRef.current;
        const fps = 30;
        const totalFrames = Math.max(1, Math.round((DURATION / 1000) * fps));
        const frameNames: string[] = [];

        setExportPhase('transcode');
        setVideoMimeType('video/mp4');

        ffmpeg.on('progress', ({ progress }) => {
          setExportProgress(Math.max(80, Math.round(80 + progress * 20)));
        });

        try {
          for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
            const t = totalFrames === 1 ? 1 : frameIndex / (totalFrames - 1);
            renderFrame(t);
            const frameBlob = await canvasToBlob(canvas, 'image/png');
            if (!frameBlob) {
              throw new Error('生成视频帧失败');
            }

            const frameName = `frame-${String(frameIndex).padStart(4, '0')}.png`;
            frameNames.push(frameName);
            await ffmpeg.writeFile(frameName, await fetchFile(frameBlob));
          }

          await ffmpeg.exec([
            '-framerate', String(fps),
            '-i', 'frame-%04d.png',
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1',
            '-c:v', 'libx264',
            '-crf', '23',
            '-preset', 'fast',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            'output.mp4',
          ]);

          const mp4Data = await ffmpeg.readFile('output.mp4');
          const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' });
          try { await ffmpeg.deleteFile('output.mp4'); } catch {}
          for (const frameName of frameNames) {
            try { await ffmpeg.deleteFile(frameName); } catch {}
          }
          finalizeExport(mp4Blob, 'video/mp4');
        } catch (err) {
          try { await ffmpeg.deleteFile('output.mp4'); } catch {}
          for (const frameName of frameNames) {
            try { await ffmpeg.deleteFile(frameName); } catch {}
          }
          throw err;
        }
      }

      const captureFrame = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / DURATION);
        renderFrame(t);
        if (t < 1) {
          requestAnimationFrame(captureFrame);
        } else {
          try {
            recorder.requestData();
          } catch {}
          setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
          }, 80);
        }
      };

      // 截图一次主画布和色块画布，然后开始动画录制
      captureMain();
      captureBlock();
      captureFrame();

    } catch (err) {
      console.error('Export failed:', err);
      setExportError(err instanceof Error ? err.message : '视频合成失败，请重试');
      setIsExporting(false);
      setIsPlaying(previousIsPlaying);
    }
  };

  const getVideoDownloadFileName = () => {
    const ext = getVideoExtensionFromMimeType(videoMimeType);
    return `hicolor_${activeAnimation}_video.${ext}`;
  };

  const downloadResult = () => {
    if (!videoBlobUrl) return;

    try {
      const link = document.createElement('a');
      link.href = videoBlobUrl;
      link.download = getVideoDownloadFileName();
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setShowExportSuccess(false);
    } catch (err) {
      console.error('Save video failed:', err);
      try {
        window.open(videoBlobUrl, '_blank', 'noopener,noreferrer');
        setShowExportSuccess(false);
      } catch (openErr) {
        console.error('Open video preview failed:', openErr);
        setExportError(t('video.downloadBlocked'));
      }
    }
  };

  const previewVideoResult = () => {
    if (!videoBlobUrl) return;

    try {
      window.open(videoBlobUrl, '_blank', 'noopener,noreferrer');
      setShowExportSuccess(false);
    } catch (err) {
      console.error('Open video preview failed:', err);
      setExportError(t('video.previewBlocked'));
    }
  };

  const saveVideoToLocalFile = async () => {
    if (!videoBlobUrl) return;

    const pickerApi = (window as Window & {
      showSaveFilePicker?: (options?: {
        suggestedName?: string;
        excludeAcceptAllOption?: boolean;
        types?: Array<{
          description?: string;
          accept: Record<string, string[]>;
        }>;
      }) => Promise<{
        createWritable: () => Promise<{
          write: (data: Blob) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    }).showSaveFilePicker;

    if (!pickerApi) {
      setExportError(t('video.localSaveUnsupported'));
      return;
    }

    try {
      const ext = getVideoExtensionFromMimeType(videoMimeType);
      const blob = await fetch(videoBlobUrl).then((res) => res.blob());
      const handle = await pickerApi({
        suggestedName: `hicolor_${activeAnimation}_video.${ext}`,
        excludeAcceptAllOption: false,
        types: [
          {
            description: videoMimeType.includes('webm') ? 'WEBM Video' : 'MP4 Video',
            accept: {
              [videoMimeType]: [`.${ext}`],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      setShowExportSuccess(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Save to local file failed:', err);
      setExportError(t('video.localSaveFailed'));
    }
  };

  const getImageDownloadFileName = () => `hicolor-${Date.now()}.png`;

  const triggerImageDownload = (blobUrl: string, fileName: string) => {
    try {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    } catch (err) {
      console.error('Download image failed:', err);
      try {
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
        return true;
      } catch (openErr) {
        console.error('Preview image failed:', openErr);
        setExportError(t('imageExport.downloadBlocked'));
        return false;
      }
    }
  };

  const applyImageDominantColors = () => {
    if (!image) return;
    const { primary, secondary } = extractDominantImageColors(image);
    setBgConfig((prev) => ({
      ...prev,
      color1: primary,
      color2: secondary,
    }));
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
      trackWithAnalytics({ type: 'upload_image' });
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
    // 点击文字区域时，开启编辑模式
    setOverlayEditing(true);
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
      // 形状切换模式：整组场景一起切换，不做单个形状的变形过渡
      renderBatchSceneTransition({
        ctx: mainCtx,
        cutouts,
        phase: batchPositionOffset,
        sampleColor: sampleFromBlockData,
        cutoutConfig: { baseSize: cutoutConfig.baseSize, variation: cutoutConfig.variation },
        width: mainW,
        height: mainH,
        drawShape: drawBatchSceneShape,
      });
    } else if (activeAnimation === 'pulse' && isPlaying) {
      // 形状叠加模式：每个节拍只新增一个形状
      const rawCount = Math.floor(pulseRevealCount);
      const visibleCount = Math.min(20, Math.max(0, rawCount));
      const placements = resolveNonOverlappingCutoutPlacements({
        cutouts,
        width: mainW,
        height: mainH,
        baseSize: cutoutConfig.baseSize,
        variation: cutoutConfig.variation,
        limit: visibleCount,
        sceneStep: 1,
      });
      
      // 绘制逐个叠加的形状
      for (let i = 0; i < visibleCount && i < cutouts.length; i++) {
        const c = cutouts[i];
        const placement = placements[i];
        if (!placement) continue;
        const baseSize = placement.size;
        const holeColor = sampleFromBlockData(c.x, c.y);
        
        mainCtx.save();
        mainCtx.translate(placement.centerX, placement.centerY);
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
        const speed = (0.3 + (Math.sin(seed * 5.1) * 0.5 + 0.5) * 0.7) * RAIN_SPEED_MULTIPLIER;
        
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
          const dropSize = (4 + Math.sin(seed * 7) * 2) * RAIN_ICON_SCALE;
          
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
    if (activeAnimation === 'batch' && isPlaying) {
      renderBatchSceneTransition({
        ctx: blockCtx,
        cutouts,
        phase: batchPositionOffset,
        sampleColor: () => cutoutConfig.shapeColor,
        cutoutConfig: { baseSize: cutoutConfig.baseSize, variation: cutoutConfig.variation },
        width: blockW,
        height: blockH,
        drawShape: drawBatchSceneShape,
      });
    } else if ((activeAnimation === 'pulse' || activeAnimation === 'stars' || activeAnimation === 'rain' || activeAnimation === 'rainfall') && isPlaying) {
      // 绘制形状（纯色填充，形状孔洞露出色块背景）
      const pulseVisibleCount =
        activeAnimation === 'pulse' ? Math.min(20, Math.max(0, Math.floor(pulseRevealCount))) : cutouts.length;
      const placements =
        activeAnimation === 'pulse'
          ? resolveNonOverlappingCutoutPlacements({
              cutouts,
              width: blockW,
              height: blockH,
              baseSize: cutoutConfig.baseSize,
              variation: cutoutConfig.variation,
              limit: pulseVisibleCount,
              sceneStep: 1,
            })
          : [];

      cutouts.slice(0, pulseVisibleCount).forEach((c, index) => {
        const currentSize =
          activeAnimation === 'pulse'
            ? placements[index]?.size ?? (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (blockW / 800)
            : (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (blockW / 800);
        const placement = activeAnimation === 'pulse' ? placements[index] : null;
        blockCtx.save();
        blockCtx.translate(placement ? placement.centerX : c.x * blockW, placement ? placement.centerY : c.y * blockH);
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
      await drawOverlayTextOnContext(
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

    const blob = await new Promise<Blob | null>((resolve) => {
      saveCanvas.toBlob((b) => resolve(b), 'image/png');
    });
    if (!blob) return;

    trackWithAnalytics({ type: 'export_png' });
    const objectUrl = URL.createObjectURL(blob);
    const filename = getImageDownloadFileName();

    // 桌面端：生成后直接下载，不再弹中间成功层
    if (!isLikelyMobileDevice()) {
      triggerImageDownload(objectUrl, filename);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      return;
    }

    // 2) Web Share + 文件：仅保留给移动端，避免桌面端进入分享弹窗
    if (isLikelyMobileDevice() && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
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

    // 3) iOS：download 常无效；新开标签展示 PNG，用户可长按 → 存储图像，或用 Safari 分享
    if (isLikelyIOS()) {
      const w = window.open(objectUrl, '_blank', 'noopener,noreferrer');
      if (w) {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
        return;
      }
    }

    // 4) 兜底：Blob + download
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
            <span className="text-[10px] font-black text-gray-900 uppercase tracking-wider">{t('elements.editingShape')}</span>
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
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{t('elements.shapeSize')}</label>
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
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{t('elements.shapeAdjust')}</label>
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
          {t('overlay.font')}
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
          {t('overlay.style')}
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
              className={`relative px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                overlayTextConfig.fontFamily === f.value
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-200/70'
                  : 'bg-white border-gray-100 text-gray-600 hover:border-gray-300'
              }`}
              style={{ fontFamily: f.value.replace(/"/g, '') }}
            >
              {t(f.fontKey)}
              {f.badgeKey && (
                <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[8px] font-black bg-amber-400 text-amber-900 rounded-full shadow-sm">
                  {t(f.badgeKey)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 样式 Tab：三列并列 — 标题 + 滑块/取色，无图标；点开「样式」即可直接调 */}
      {overlayPanelTab === 'style' && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-gray-400 tracking-[0.2em]">{t('overlay.style')}</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4">
            <div className="min-w-0 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-black text-gray-500">{t('overlay.fontSize')}</span>
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
              <span className="block text-[10px] font-black text-gray-500">{t('overlay.fillColor')}</span>
              <div
                className="relative h-10 w-full overflow-hidden rounded-xl border border-gray-200 shadow-inner"
                style={{ backgroundColor: overlayTextConfig.fillColor }}
              >
                <input
                  type="color"
                  value={overlayTextConfig.fillColor}
                  onChange={(e) => setOverlayTextConfig((prev) => ({ ...prev, fillColor: e.target.value }))}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label={t('overlay.fillColor')}
                />
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <span className="block text-[10px] font-black text-gray-500">{t('overlay.strokeColor')}</span>
              <div
                className="relative h-10 w-full overflow-hidden rounded-xl border border-gray-200 shadow-inner"
                style={{ backgroundColor: overlayTextConfig.strokeColor }}
              >
                <input
                  type="color"
                  value={overlayTextConfig.strokeColor}
                  onChange={(e) => setOverlayTextConfig((prev) => ({ ...prev, strokeColor: e.target.value }))}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label={t('overlay.strokeColor')}
                />
              </div>
            </div>
          </div>
          {/* 图片填充开关 */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-500">{t('overlay.usePhotoFill')}</span>
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
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('elements.shapeSize')}</label>
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
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('elements.shapeVariation')}</label>
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
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('elements.scatterCount')}</label>
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
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('elements.shapeCount')}</label>
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
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{t('elements.autoModeAdjustable')}</p>
          )}
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('elements.shapeColor')}</label>
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
          {t('elements.shapeColorHint')}
        </p>
      </div>

      <div className="space-y-4 pt-4 border-t border-gray-50">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('elements.shapeDistribution')}</label>
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
              {mode === 'sync' ? t('distributions.gather') : t('elements.distribution')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-gray-50">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('elements.creationMode')}</label>
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
              {mode === 'auto' ? t('elements.autoGenerate') : t('elements.manualClick')}
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
          <span>{t('common.regenerate')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            trackWithAnalytics({ type: 'clear_cutouts' });
            setCutouts([]);
            setSelectedId(null);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-600 py-3 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest active:scale-95"
        >
          <Trash2 size={14} />
          <span>{t('common.clear')}</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => setActiveTab(null)}
        className="w-full py-2.5 bg-gray-50 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-gray-100 hover:text-gray-600 transition-all flex items-center justify-center gap-2"
      >
        <ChevronDown size={16} />
        <span>{t('common.collapse')}</span>
      </button>
    </>
  );

  // --- Render Helpers ---

  // 渲染趋势柱状图（7天活跃趋势）
  const renderTrendChart = () => {
    const dailyStats = stats.dailyStats || [];
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const dayLabels = ['日', '一', '二', '三', '四', '五', '六'];
    const data = days.map(day => {
      const found = dailyStats.find(d => d.date === day);
      return found ? found.actionsCount : 0;
    });

    const maxVal = Math.max(...data, 1);

    return (
      <div className="space-y-2">
        <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">7天活跃趋势</h4>
        <div className="flex items-end justify-between gap-1 h-16 px-1">
          {days.map((day, i) => {
            const val = data[i];
            const height = Math.max((val / maxVal) * 100, 2);
            const date = new Date(day);
            const weekday = dayLabels[date.getDay()];
            const isToday = day === today.toISOString().split('T')[0];
            return (
              <div key={day} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full flex flex-col items-center justify-end h-10">
                  {val > 0 && (
                    <span className="text-[7px] font-mono font-bold text-emerald-600 mb-0.5">{val}</span>
                  )}
                  <div
                    className={`w-full rounded-t transition-all duration-500 ${
                      isToday ? 'bg-emerald-500' : 'bg-emerald-200'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className={`text-[7px] font-bold ${isToday ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {weekday}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 渲染环形进度图
  const renderCircleProgress = (value: number, max: number, label: string, color: string = 'emerald') => {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;

    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative w-12 h-12">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
            <circle
              cx="22" cy="22" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-gray-100"
            />
            <circle
              cx="22" cy="22" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={`text-${color}-500 transition-all duration-700`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-black text-gray-700">{Math.round(pct)}%</span>
          </div>
        </div>
        <span className="text-[7px] font-bold text-gray-400 text-center">{label}</span>
      </div>
    );
  };

  // 渲染统计数据条形图
  const renderStatBar = (usageKey: keyof typeof stats, labelMap?: Record<string, string>, maxItems: number = 5) => {
    const usage = stats[usageKey] as Record<string, number>;
    if (!usage || Object.keys(usage).length === 0) {
      return <p className="text-[9px] text-gray-400 italic">{t('stats.noData')}</p>;
    }
    const entries = Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxItems);
    const maxVal = entries[0]?.[1] || 1;

    return (
      <div className="space-y-1.5">
        {entries.map(([key, count]) => {
          const label = labelMap?.[key] ?? key;
          const pct = Math.round((count / maxVal) * 100);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[8px] font-bold text-gray-500 w-14 shrink-0 text-right truncate">{label}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[8px] font-mono font-bold text-gray-400 w-4 text-right">{count}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // 渲染颜色使用热力条
  const renderColorBar = (usage: Record<string, number>, maxItems: number = 8) => {
    if (!usage || Object.keys(usage).length === 0) {
      return <p className="text-[9px] text-gray-400 italic">{t('stats.noData')}</p>;
    }
    const entries = Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxItems);
    const maxVal = entries[0]?.[1] || 1;

    return (
      <div className="space-y-1.5">
        {entries.map(([color, count]) => {
          const pct = Math.round((count / maxVal) * 100);
          const isHex = /^#[0-9A-Fa-f]{6}$/.test(color);
          return (
            <div key={color} className="flex items-center gap-2">
              {isHex ? (
                <div
                  className="w-4 h-4 rounded border border-gray-200 shrink-0"
                  style={{ backgroundColor: color }}
                />
              ) : (
                <div className="w-4 h-4 rounded border border-gray-200 bg-gray-200 shrink-0" />
              )}
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: isHex ? color : '#10b981' }}
                />
              </div>
              <span className="text-[8px] font-mono font-bold text-gray-400 w-4 text-right">{count}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // 渲染行为漏斗
  const renderFunnel = () => {
    const uploads = stats.totalUploads;
    const exports = stats.totalExports + stats.totalVideoExports;
    const views = stats.visitCount;

    const funnelData = [
      { label: t('chart.views'), value: views, color: 'bg-blue-400' },
      { label: t('chart.upload'), value: uploads, color: 'bg-emerald-400' },
      { label: t('chart.export'), value: exports, color: 'bg-purple-400' },
    ];

    const maxVal = views || 1;

    return (
      <div className="space-y-2">
        <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('stats.behaviorFunnel')}</h4>
        <div className="space-y-1.5">
          {funnelData.map((item, i) => {
            const width = Math.max((item.value / maxVal) * 100, 5);
            const pct = maxVal > 0 ? Math.round((item.value / maxVal) * 100) : 0;
            return (
              <div key={item.label} className="flex items-center gap-2">
                <span className="text-[8px] font-bold text-gray-500 w-6 shrink-0">{item.label}</span>
                <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded transition-all duration-500 flex items-center justify-end pr-1`}
                    style={{ width: `${width}%` }}
                  >
                    {width > 20 && (
                      <span className="text-[7px] font-bold text-white">{item.value}</span>
                    )}
                  </div>
                </div>
                <span className="text-[8px] font-mono font-bold text-gray-400 w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const panelMeta = activeTab === 'background'
    ? {
        title: t('nav.background'),
        description: t('guide.panelBackgroundDesc'),
      }
    : activeTab === 'elements'
      ? {
          title: t('nav.elements'),
          description: t('guide.panelElementsDesc'),
        }
      : activeTab === 'video'
        ? {
            title: t('nav.video'),
            description: t('guide.panelVideoDesc'),
          }
        : null;

  const renderSettingsPanel = () => {
    if (!settingsPanelOpen) return null;
    return (
    <div ref={settingsPanelRef} className="fixed bottom-16 left-0 right-0 z-40 max-h-[min(38dvh,20rem)] overflow-y-auto border-t border-gray-50 bg-white/95 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl custom-scrollbar sm:max-h-[30vh]">
      <div className="relative mx-auto max-w-2xl space-y-4 px-4 pb-6 pt-3 sm:space-y-5 sm:p-5 sm:pb-8">
        <button 
          onClick={() => setActiveTab(null)}
          className="absolute right-2 top-3 z-10 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-800 sm:right-4 sm:top-4"
          title={t('common.collapse')}
        >
          <X size={20} />
        </button>
        {panelMeta && (
          <div className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3 pr-12">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-500">{panelMeta.title}</div>
            <p className="mt-1 text-[11px] leading-5 text-gray-500">{panelMeta.description}</p>
          </div>
        )}
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
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t('background.layout')}</label>
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
                          <span className="line-clamp-2 text-center text-[7px] font-bold leading-tight">{t(c.key)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2 border-t border-gray-100/80 pt-3">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t('background.colorRatio')}</label>
                    <span className="text-[10px] font-mono font-bold text-gray-900">{Math.round(blockAreaPercent)}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={80}
                    step={1}
                    value={blockAreaPercent}
                    onChange={(e) => setBlockAreaPercent(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
                  />
                  <p className="text-[8px] font-bold text-gray-400 leading-snug">
                    {t('background.colorRatioHint')}
                  </p>
                </div>
              </div>

              {/* 底图：八选一 */}
              <div className="space-y-2 pr-10">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t('background.bgType')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { type: 'solid' as const, label: t('bgTypes.solid') },
                      { type: 'split' as const, label: t('bgTypes.split') },
                      { type: 'gradient' as const, label: t('bgTypes.gradient') },
                      { type: 'image' as const, label: t('bgTypes.image') },
                      { type: 'grid' as const, label: t('bgTypes.grid') },
                      { type: 'diagonal' as const, label: t('bgTypes.diagonal') },
                      { type: 'block' as const, label: t('bgTypes.block') },
                      { type: 'dots' as const, label: t('bgTypes.dots') },
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
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('background.texture')}</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(
                      [
                        { type: 'none' as TextureType, label: t('textures.none') },
                        { type: 'fine-paper' as TextureType, label: t('textures.fine-paper') },
                        { type: 'fine-noise' as TextureType, label: t('textures.fine-noise') },
                        { type: 'grain-paper' as TextureType, label: t('textures.grain-paper') },
                        { type: 'coarse-paper' as TextureType, label: t('textures.coarse-paper') },
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
                    {bgConfig.type === 'solid' ? t('background.color') : t('background.color')}
                  </label>
                  {image && (
                    <button
                      type="button"
                      onClick={applyImageDominantColors}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      <Sparkles size={12} />
                      <span>Pick Main Colors</span>
                    </button>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {bgConfig.type !== 'solid' && (
                        <span className="text-[8px] font-black text-gray-400">{t('background.color')} 1</span>
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
                        <span className="text-[8px] font-black text-gray-400">{t('background.color')} 2</span>
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
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('background.gradientAngle')}</label>
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
                      {t('errors.pickingColor')}
                    </p>
                  )}
                </div>
              )}

              {bgConfig.type === 'split' && (
                <div className="space-y-2 pr-10">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('background.stripeWidth')}</label>
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
                  <p className="text-[8px] font-bold text-gray-400 leading-snug">
                    {t('background.stripeWidthHint')}
                  </p>
                </div>
              )}

              {(bgConfig.type === 'grid' || bgConfig.type === 'diagonal' || bgConfig.type === 'block' || bgConfig.type === 'dots') && (
                <div className="space-y-2 pr-10">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('background.patternDensity')}</label>
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
                  <p className="text-[8px] font-bold text-gray-400 leading-snug">
                    {t('background.patternDensityHint')}
                  </p>
                </div>
              )}

              {bgConfig.type === 'gradient' && (
                <div className="space-y-2 pr-10">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('background.gradientAngle')}</label>
                    <span className="text-[10px] font-mono font-bold text-gray-900">{bgConfig.gradientAngle}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={bgConfig.gradientAngle}
                    onChange={(e) => setBgConfig((prev) => ({ ...prev, gradientAngle: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>
              )}

              {bgConfig.type === 'image' && (
                <div className="space-y-2 pr-10">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('background.bgImage')}</label>
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
                    {bgConfig.bgImage ? t('background.changeImage') : t('background.uploadImage')}
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
                      { tab: 'shape' as const, label: t('elements.shape') },
                      { tab: 'overlay' as const, label: t('elements.overlay') },
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
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('elements.shapeType')}</label>
                    <div className="-mx-1 flex flex-nowrap items-start gap-2 overflow-x-auto overflow-y-visible px-1 pt-1.5 pb-1 sm:mx-0 sm:px-0">
                      {SHAPE_OPTIONS.map(({ value, icon: ShapeIcon, key }) => {
                        const selectedCutout = selectedId ? cutouts.find((c) => c.id === selectedId) : undefined;
                        let activeShapeKind: ShapeKind | null = cutoutConfig.defaultShapeKind;
                        if (selectedCutout) activeShapeKind = selectedCutout.shapeKind ?? null;
                        const active = activeShapeKind !== null && activeShapeKind === value;
                        const shapeLabel = t(key);
                        return (
                          <div key={value} className="flex w-[3.25rem] min-w-[3.25rem] shrink-0 flex-col items-center gap-0.5">
                            <button
                              type="button"
                              title={shapeLabel}
                              aria-label={shapeLabel}
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
                              {shapeLabel}
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
                          placeholder={t('elements.symbolPlaceholder')}
                          aria-label={t('elements.symbolPool')}
                        />
                      </div>
                    )}

                    {/* 取消形状按钮 */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        title={t('elements.cancelShape')}
                        aria-label={t('elements.cancelShape')}
                        onClick={() => {
                          setCutouts([]);
                          setSelectedId(null);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-black hover:bg-red-50 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={12} />
                        <span>{t('elements.clearShapes')}</span>
                      </button>
                    </div>

                    {/* 形状调整：6个圆形控制按钮 */}
                    <div className="space-y-2 pt-2">
                      <p className="text-[10px] font-black text-gray-400 tracking-[0.2em]">{t('elements.shapeAdjust')}</p>
                      <div className="flex items-start gap-1.5 overflow-x-auto px-1">
                        {/* 形状大小 */}
                        <div className={`flex w-[4rem] min-w-[4rem] shrink-0 flex-col items-center gap-1 ${cutoutConfig.creationMode === 'manual' ? 'opacity-40' : ''}`}>
                          <button type="button" onClick={() => setExpandedSlider(expandedSlider === 'baseSize' ? null : 'baseSize')}
                            className={`h-[3rem] w-[3rem] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all ${expandedSlider === 'baseSize' ? 'bg-emerald-700 text-white' : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'}`}>
                            <Images size={13} strokeWidth={expandedSlider === 'baseSize' ? 2.2 : 1.65} />
                            <span className={`text-[9px] font-mono font-bold tabular-nums leading-none ${expandedSlider === 'baseSize' ? 'text-white' : 'text-gray-400'}`}>{cutoutConfig.baseSize}</span>
                          </button>
                          <span className={`text-[7px] font-black leading-snug tracking-tight ${expandedSlider === 'baseSize' ? 'text-emerald-800' : 'text-gray-700'}`}>{t('elements.shapeSize')}</span>
                        </div>

                        {/* 形状数量 */}
                        <div className={`flex w-[4rem] min-w-[4rem] shrink-0 flex-col items-center gap-1 ${cutoutConfig.creationMode === 'manual' ? 'opacity-40' : ''}`}>
                          <button type="button" onClick={() => cutoutConfig.creationMode !== 'manual' && setExpandedSlider(expandedSlider === 'autoCount' ? null : 'autoCount')}
                            className={`h-[3rem] w-[3rem] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all ${expandedSlider === 'autoCount' && cutoutConfig.creationMode !== 'manual' ? 'bg-emerald-700 text-white' : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'}`}>
                            <ImageIcon size={13} strokeWidth={expandedSlider === 'autoCount' ? 2.2 : 1.65} />
                            <span className={`text-[9px] font-mono font-bold tabular-nums leading-none ${expandedSlider === 'autoCount' && cutoutConfig.creationMode !== 'manual' ? 'text-white' : 'text-gray-400'}`}>{cutoutConfig.autoCount}</span>
                          </button>
                          <span className={`text-[7px] font-black leading-snug tracking-tight ${expandedSlider === 'autoCount' && cutoutConfig.creationMode !== 'manual' ? 'text-emerald-800' : 'text-gray-700'}`}>{t('elements.shapeCount')}</span>
                        </div>

                        {/* 随机差异 */}
                        <div className={`flex w-[4rem] min-w-[4rem] shrink-0 flex-col items-center gap-1 ${cutoutConfig.creationMode === 'manual' ? 'opacity-40' : ''}`}>
                          <button type="button" onClick={() => setExpandedSlider(expandedSlider === 'variation' ? null : 'variation')}
                            className={`h-[3rem] w-[3rem] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all ${expandedSlider === 'variation' ? 'bg-emerald-700 text-white' : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'}`}>
                            <Sun size={13} strokeWidth={expandedSlider === 'variation' ? 2.2 : 1.65} />
                            <span className={`text-[9px] font-mono font-bold tabular-nums leading-none ${expandedSlider === 'variation' ? 'text-white' : 'text-gray-400'}`}>{cutoutConfig.variation}</span>
                          </button>
                          <span className={`text-[7px] font-black leading-snug tracking-tight ${expandedSlider === 'variation' ? 'text-emerald-800' : 'text-gray-700'}`}>{t('elements.shapeVariation')}</span>
                        </div>

                        {/* 元素打散 */}
                        <div className="flex w-[4rem] min-w-[4rem] shrink-0 flex-col items-center gap-1">
                          <button type="button" onClick={() => setCutoutConfig((prev) => ({ ...prev, distributionMode: prev.distributionMode === 'sync' ? 'scatter' : 'sync' }))}
                            className={`h-[3rem] w-[3rem] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all ${cutoutConfig.distributionMode === 'scatter' ? 'bg-emerald-700 text-white' : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'}`}>
                            <Sparkles size={13} strokeWidth={cutoutConfig.distributionMode === 'scatter' ? 2.2 : 1.65} />
                            <span className={`text-[9px] font-mono font-bold leading-none ${cutoutConfig.distributionMode === 'scatter' ? 'text-white' : 'text-gray-400'}`}>{cutoutConfig.distributionMode === 'scatter' ? t('common.on') : t('common.off')}</span>
                          </button>
                          <span className={`text-[7px] font-black leading-snug tracking-tight ${cutoutConfig.distributionMode === 'scatter' ? 'text-emerald-800' : 'text-gray-700'}`}>{t('elements.distribution')}</span>
                        </div>

                        {/* 手动添加 */}
                        <div className="flex w-[4rem] min-w-[4rem] shrink-0 flex-col items-center gap-1">
                          <button type="button" onClick={() => { const next = cutoutConfig.creationMode === 'manual' ? 'auto' : 'manual'; setCutoutConfig((prev) => ({ ...prev, creationMode: next })); if (next === 'auto' && cutouts.length === 0) generateAutoCutouts(); }}
                            className={`h-[3rem] w-[3rem] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all ${cutoutConfig.creationMode === 'manual' ? 'bg-emerald-700 text-white' : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'}`}>
                            <Triangle size={13} strokeWidth={cutoutConfig.creationMode === 'manual' ? 2.2 : 1.65} />
                            <span className={`text-[9px] font-mono font-bold leading-none ${cutoutConfig.creationMode === 'manual' ? 'text-white' : 'text-gray-400'}`}>{cutoutConfig.creationMode === 'manual' ? t('common.on') : t('common.off')}</span>
                          </button>
                          <span className={`text-[7px] font-black leading-snug tracking-tight ${cutoutConfig.creationMode === 'manual' ? 'text-emerald-800' : 'text-gray-700'}`}>{t('elements.manualAdd')}</span>
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
                        <RefreshCw size={14} /><span>{t('common.regenerate')}</span>
                      </button>
                    </div>
                  </div>
                )}

                {elementsPanelTab === 'overlay' && (
                  <div className="pt-2 border-t border-gray-100/90 pr-10 sm:pr-12 space-y-4">
                    <textarea
                      value={overlayTextConfig.content}
                      onChange={(e) =>
                        setOverlayTextConfig((prev) => ({ ...prev, content: e.target.value }))
                      }
                      rows={3}
                      className="w-full min-h-[5rem] px-4 py-3 rounded-2xl border border-gray-100 text-sm font-bold text-gray-900 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none bg-white shadow-sm resize-y"
                      placeholder={t('overlay.placeholder')}
                    />
                    {elementOverlayTextPanel}
                  </div>
                )}
            </motion.div>
          )}

          {activeTab === 'stats' && (() => {
            const analytics = getAnalytics();
            const hourLabel = (h: number) => {
              const labels: Record<string, string> = {
                zh: `${h}时`, zhTW: `${h}時`, en: `${h}:00`, ko: `${h}시`, ja: `${h}時`
              };
              return labels[locale] || `${h}:00`;
            };
            return (
            <motion.div
              key="stats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t('stats.title')}</h3>

              {/* 概览卡片 - 核心指标 */}
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-2 text-center">
                  <div className="text-lg font-black text-emerald-600">{stats.visitCount}</div>
                  <div className="text-[7px] font-bold text-gray-400 uppercase tracking-wider">{t('stats.visits')}</div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-2 text-center">
                  <div className="text-lg font-black text-emerald-600">{stats.totalUploads}</div>
                  <div className="text-[7px] font-bold text-gray-400 uppercase tracking-wider">{t('stats.uploads')}</div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-2 text-center">
                  <div className="text-lg font-black text-emerald-600">{stats.totalExports}</div>
                  <div className="text-[7px] font-bold text-gray-400 uppercase tracking-wider">{t('stats.exports')}</div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-2 text-center">
                  <div className="text-lg font-black text-emerald-600">{stats.totalActions}</div>
                  <div className="text-[7px] font-bold text-gray-400 uppercase tracking-wider">{t('stats.operations')}</div>
                </div>
              </div>

              {/* 连续活跃 & 会话信息 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2 text-center">
                  <div className="text-lg font-black text-emerald-600">{stats.currentStreak}</div>
                  <div className="text-[7px] font-bold text-emerald-500">{t('stats.consecutiveDays')}</div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-2 text-center">
                  <div className="text-lg font-black text-gray-900">{stats.sessionCount}</div>
                  <div className="text-[7px] font-bold text-gray-400">{t('stats.sessions')}</div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-2 text-center">
                  <div className="text-lg font-black text-gray-900">{stats.avgSessionMinutes || 0}<span className="text-[10px]">m</span></div>
                  <div className="text-[7px] font-bold text-gray-400">{t('stats.avgSession')}</div>
                </div>
              </div>

              {/* 7天活跃趋势图 */}
              {renderTrendChart()}

              {/* 时段分析 - 24小时活跃热力条 */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.hourlyAnalysis')}</h4>
                <div className="bg-gray-50/40 rounded-xl border border-gray-100 p-3">
                  <div className="flex items-end gap-[2px] h-12">
                    {analytics.hourlyData.map((d) => {
                      const maxActions = Math.max(...analytics.hourlyData.map(x => x.actions), 1);
                      const height = maxActions > 0 ? Math.round((d.actions / maxActions) * 100) : 0;
                      const isPeak = d.hour === analytics.peakHour && d.actions > 0;
                      return (
                        <div key={d.hour} className="flex-1 flex flex-col items-center gap-0.5 group cursor-default">
                          <div
                            className={`w-full rounded-t-sm transition-all ${isPeak ? 'bg-amber-400' : 'bg-blue-300'} hover:bg-blue-400`}
                            style={{ height: `${Math.max(height, 4)}px` }}
                            title={`${d.hour}:00 - ${t('chart.actions')}:${d.actions} ${t('chart.upload')}:${d.uploads} ${t('chart.export')}:${d.exports}`}
                          />
                          {d.hour % 6 === 0 && (
                            <span className="text-[6px] text-gray-400 font-mono">{d.hour}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[7px] text-gray-400">0:00</span>
                    <span className="text-[7px] text-amber-500 font-bold">
                      {t('insights.peakHour')}: {hourLabel(analytics.peakHour)} ({analytics.hourlyData[analytics.peakHour]?.actions || 0}{t('chart.actions')})
                    </span>
                    <span className="text-[7px] text-gray-400">23:00</span>
                  </div>
                </div>
              </div>

              {/* 周对比 */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.weekComparison')}</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-2">
                    <div className="text-[7px] text-gray-400 uppercase tracking-wider mb-1">{t('chart.thisWeek')}</div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px]">
                        <span className="text-gray-500">{t('chart.visitors')}</span>
                        <span className="font-bold text-emerald-600">{analytics.weekComparison.thisWeek.visits}</span>
                      </div>
                      <div className="flex justify-between text-[8px]">
                        <span className="text-gray-500">{t('chart.upload')}</span>
                        <span className="font-bold text-blue-600">{analytics.weekComparison.thisWeek.uploads}</span>
                      </div>
                      <div className="flex justify-between text-[8px]">
                        <span className="text-gray-500">{t('chart.export')}</span>
                        <span className="font-bold text-purple-600">{analytics.weekComparison.thisWeek.exports}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-2">
                    <div className="text-[7px] text-gray-400 uppercase tracking-wider mb-1">{t('chart.lastWeek')}</div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px]">
                        <span className="text-gray-500">{t('chart.visitors')}</span>
                        <span className="font-bold text-gray-400">{analytics.weekComparison.lastWeek.visits}</span>
                      </div>
                      <div className="flex justify-between text-[8px]">
                        <span className="text-gray-500">{t('chart.upload')}</span>
                        <span className="font-bold text-gray-400">{analytics.weekComparison.lastWeek.uploads}</span>
                      </div>
                      <div className="flex justify-between text-[8px]">
                        <span className="text-gray-500">{t('chart.export')}</span>
                        <span className="font-bold text-gray-400">{analytics.weekComparison.lastWeek.exports}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* 增长率 */}
                <div className="flex gap-3 justify-center">
                  {[
                    { key: 'visits' as const, color: 'text-emerald-500', icon: '▲' },
                    { key: 'uploads' as const, color: 'text-blue-500', icon: '▲' },
                    { key: 'exports' as const, color: 'text-purple-500', icon: '▲' },
                    { key: 'actions' as const, color: 'text-amber-500', icon: '▲' },
                  ].map(({ key, color, icon }) => {
                    const growth = analytics.weekComparison.growth[key];
                    return (
                      <div key={key} className={`text-[8px] font-bold ${growth >= 0 ? color : 'text-red-400'}`}>
                        {growth >= 0 ? icon : '▼'} {Math.abs(growth)}%
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 留存率 */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.retentionRate')}</h4>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: t('retention.day1'), value: analytics.retentionData.day1, color: 'emerald' },
                    { label: t('retention.day3'), value: Math.round((analytics.retentionData.day7 + analytics.retentionData.day1) / 2), color: 'blue' },
                    { label: t('retention.day7'), value: analytics.retentionData.day7, color: 'purple' },
                    { label: t('retention.day30'), value: analytics.retentionData.day30, color: 'amber' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`rounded-lg border border-${color}-100 bg-${color}-50/50 p-2 text-center`}>
                      <div className={`text-sm font-black text-${color}-600`}>{value}%</div>
                      <div className={`text-[7px] font-bold text-${color}-400`}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 设备分布 */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.deviceStats')}</h4>
                <div className="flex gap-2 bg-gray-50/40 rounded-xl border border-gray-100 p-3">
                  {analytics.deviceStats.map((d) => {
                    const deviceLabels: Record<string, string> = {
                      mobile: t('device.mobile'),
                      tablet: t('device.tablet'),
                      desktop: t('device.desktop'),
                    };
                    return (
                      <div key={d.device} className="flex-1 text-center">
                        <div className="text-[10px] font-bold text-gray-700">{deviceLabels[d.device]}</div>
                        <div className="text-[9px] text-gray-400">{d.visits}x</div>
                        <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${d.device === 'mobile' ? 'bg-blue-400' : d.device === 'tablet' ? 'bg-purple-400' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.max(d.percentage, 5)}%` }}
                          />
                        </div>
                        <div className="text-[7px] text-gray-400 mt-0.5">{d.percentage}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 每日洞察 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-2.5">
                  <div className="text-[7px] font-bold text-blue-500 uppercase tracking-wider">{t('insights.peakHour')}</div>
                  <div className="text-sm font-black text-blue-700 mt-0.5">{hourLabel(analytics.peakHour)}</div>
                  <div className="text-[7px] text-blue-400 mt-0.5">
                    {analytics.hourlyData[analytics.peakHour]?.actions || 0}{t('chart.actions')}
                  </div>
                </div>
                <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-2.5">
                  <div className="text-[7px] font-bold text-purple-500 uppercase tracking-wider">{t('insights.exportRatio')}</div>
                  <div className="text-sm font-black text-purple-700 mt-0.5">{analytics.exportRatio}%</div>
                  <div className="text-[7px] text-purple-400 mt-0.5">
                    {stats.totalExports}/{stats.totalUploads} {t('chart.export')}
                  </div>
                </div>
              </div>

              {/* 行为漏斗 */}
              {renderFunnel()}

              {/* 效率指标 */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.efficiency')}</h4>
                <div className="flex justify-around items-center bg-gray-50/50 rounded-xl border border-gray-100 p-3">
                  {renderCircleProgress(stats.uploadSuccessRate, 100, t('sections.uploadRate'), 'emerald')}
                  {renderCircleProgress(stats.exportSuccessRate, 100, t('sections.exportRate'), 'blue')}
                  {renderCircleProgress(
                    stats.totalExports > 0 ? (stats.totalUploads / stats.totalExports) : 0,
                    Math.max(stats.totalUploads, 1),
                    t('sections.creationRate'),
                    'purple'
                  )}
                </div>
              </div>

              {/* 最热功能标签 */}
              {stats.mostUsedFeature && stats.featureCounts[stats.mostUsedFeature] > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <div className="text-[8px] font-bold text-amber-600 uppercase tracking-wider mb-1">{t('stats.mostUsedFeature')}</div>
                  <div className="text-sm font-black text-amber-700">
                    {stats.mostUsedFeature.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[9px] text-amber-500 mt-0.5">
                    {t('stats.usedTimes', { count: stats.featureCounts[stats.mostUsedFeature] })}
                  </div>
                </div>
              )}

              {stats.lastVisit && (
                <p className="text-[9px] text-gray-400 font-bold text-center">
                  {t('stats.lastVisit')}：{stats.lastVisit}
                </p>
              )}

              {/* 功能热度排名 - 底图类型 */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.bgTypeRanking')}</h4>
                {renderStatBar('bgTypeUsage', {
                  solid: t('bgTypes.solid'), split: t('bgTypes.split'), gradient: t('bgTypes.gradient'), image: t('bgTypes.image'),
                  grid: t('bgTypes.grid'), diagonal: t('bgTypes.diagonal'), block: t('bgTypes.block'), dots: t('bgTypes.dots'),
                })}
              </div>

              {/* 底图颜色使用热力图 */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.bgColorHot')}</h4>
                {renderColorBar(stats.bgColorUsage)}
              </div>

              {/* 形状类型使用排行 */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.shapeRanking')}</h4>
                {renderStatBar('shapeKindUsage', {
                  circle: t('shapeKinds.circle'), square: t('shapeKinds.square'), star: t('shapeKinds.star'), drop: t('shapeKinds.drop'),
                  snowflake: t('shapeKinds.snowflake'), heart: t('shapeKinds.heart'), symbol: t('shapeKinds.symbol'), randomLetters: t('shapeKinds.randomLetters'),
                })}
              </div>

              {/* 形状颜色使用热力图 */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.shapeColorHot')}</h4>
                {renderColorBar(stats.shapeColorUsage)}
              </div>

              {/* 动画模板使用排行 */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.animationRanking')}</h4>
                {renderStatBar('animationUsage', {
                  pulse: t('animations.pulse'), batch: t('animations.batch'), rain: t('animations.rain'),
                  stars: t('animations.stars'), rainfall: t('animations.rainfall'),
                })}
              </div>

              {/* 排版模式使用排行 */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.compositionRanking')}</h4>
                {renderStatBar('compositionUsage', {
                  'block-bottom': t('compositions.block-bottom'), 'block-top': t('compositions.block-top'),
                  'block-left': t('compositions.block-left'), 'block-right': t('compositions.block-right'),
                })}
              </div>

              {/* 分布模式使用排行 */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.distributionRanking')}</h4>
                {renderStatBar('distributionModeUsage', {
                  scatter: t('distributions.scatter'), gather: t('distributions.gather'), edge: t('distributions.edge'),
                })}
              </div>

              {/* 纹理类型使用排行 */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.textureRanking')}</h4>
                {renderStatBar('textureUsage', {
                  'none': t('textures.none'), 'fine-paper': t('textures.fine-paper'), 'fine-noise': t('textures.fine-noise'),
                  'grain-paper': t('textures.grain-paper'), 'coarse-paper': t('textures.coarse-paper'),
                })}
              </div>

              {/* 渐变类型使用排行 */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.gradientRanking')}</h4>
                {renderStatBar('gradientUsage', {
                  linear: t('gradients.linear'), radial: t('gradients.radial'), conic: t('gradients.conic'),
                })}
              </div>

              {/* 每日统计数据 */}
              {stats.dailyStats && stats.dailyStats.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sections.recentActivity')}</h4>
                  <div className="space-y-1">
                    {stats.dailyStats.slice(-5).reverse().map((day: any) => (
                      <div key={day.date} className="flex items-center justify-between text-[8px] text-gray-500 bg-gray-50/50 rounded px-2 py-1">
                        <span>{day.date}</span>
                        <div className="flex gap-4">
                          <span>{t('chart.views')}<span className="font-bold text-emerald-600 ml-1">{day.visitCount}</span></span>
                          <span>{t('chart.upload')}<span className="font-bold text-blue-600 ml-1">{day.uploads}</span></span>
                          <span>{t('chart.export')}<span className="font-bold text-purple-600 ml-1">{day.exports}</span></span>
                          <span>{t('chart.actions')}<span className="font-bold text-gray-700 ml-1">{day.actionsCount}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 重置按钮 */}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t('stats.resetConfirm'))) {
                    resetAnalytics();
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-gray-400 text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 hover:text-gray-600 transition-all"
              >
                <RotateCcw size={12} />
                <span>{t('stats.clearStats')}</span>
              </button>
            </motion.div>
            );
          })()}

          {activeTab === 'video' && (
            <motion.div
              key="video"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t('animations.template')}</h3>
              
              {/* 动画模板选择 */}
              <div className="grid grid-cols-2 gap-3">
                <TemplateButton 
                  label={t('animations.pulse')} 
                  icon={<Maximize className="w-4 h-4" />} 
                  active={activeAnimation === 'pulse'}
                  onClick={() => handleAnimationSelect('pulse')}
                  onDeselect={() => { setActiveAnimation('none'); setIsPlaying(false); trackWithAnalytics({ type: 'stop_animation' }); }}
                  t={t}
                />
                <TemplateButton 
                  label={t('animations.batch')} 
                  icon={<Layers size={4} className="w-4 h-4" />} 
                  active={activeAnimation === 'batch'}
                  onClick={() => handleAnimationSelect('batch')}
                  onDeselect={() => { setActiveAnimation('none'); setIsPlaying(false); trackWithAnalytics({ type: 'stop_animation' }); }}
                  t={t}
                />
                <TemplateButton 
                  label={t('animations.rain')} 
                  icon={<CloudRain className="w-4 h-4" />} 
                  active={activeAnimation === 'rain'}
                  onClick={() => handleAnimationSelect('rain')}
                  onDeselect={() => { setActiveAnimation('none'); setIsPlaying(false); trackWithAnalytics({ type: 'stop_animation' }); }}
                  t={t}
                />
                <TemplateButton
                  label={t('animations.stars')}
                  icon={<Star className="w-4 h-4" />}
                  active={activeAnimation === 'stars'}
                  onClick={() => handleAnimationSelect('stars')}
                  onDeselect={() => { setActiveAnimation('none'); setIsPlaying(false); trackWithAnalytics({ type: 'stop_animation' }); }}
                  t={t}
                />
                <div className="relative">
                  <button
                    disabled
                    className="w-full py-3 px-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 text-gray-400 flex flex-col items-center justify-center gap-1 opacity-60 cursor-not-allowed"
                  >
                    <span className="text-[11px] font-bold">{t('animations.moreTemplates')}</span>
                    <span className="text-[8px]">{t('animations.comingSoon')}</span>
                  </button>
                </div>
              </div>

              {/* 导出视频按钮 */}
              <button
                onClick={handleExport}
                disabled={!image || !videoExportSupported}
                title={!videoExportSupported ? videoExportBlockedReason : undefined}
                className={`w-full py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  image && videoExportSupported
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/25'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Video size={16} /><span>{t('export.video')}</span>
              </button>
              {!videoExportSupported && (
                <p className="text-[10px] leading-4 text-amber-700 font-bold">
                  {t('export.videoUnsupported')}
                </p>
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
      <AppHeader
        image={image}
        locale={locale}
        setLocale={setLocale}
        onSave={handleSave}
        uploadTitle={t('upload.title')}
        languageTitle={t('nav.language')}
        exportLabel={t('export.png')}
      />
      
      <main
        className={`fixed inset-0 overflow-hidden pb-16 pt-14 flex items-center justify-center sm:pt-16 ${
          pickingTarget ? 'cursor-crosshair' : ''
        }`}
      >
        <div
          ref={previewStageRef}
          className={`custom-scrollbar flex h-full w-full max-w-[100vw] flex-col items-center justify-center overflow-auto p-2 sm:p-4 md:p-12`}
          style={{ maxHeight: 'calc(100dvh - 7rem - env(safe-area-inset-top, 0px))' }}
          onClick={() => {
            // 点击空白区域时关闭叠字编辑框
            if (overlayEditing) setOverlayEditing(false);
          }}
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
                <label
                  htmlFor="main-image-upload"
                  className="relative mx-auto flex h-52 w-full max-w-sm cursor-pointer flex-col items-center justify-center space-y-5 rounded-[2.5rem] border-2 border-dashed border-gray-200 bg-white/80 transition-all duration-500 hover:border-emerald-400 hover:bg-white hover:shadow-2xl group sm:h-56 sm:rounded-[3rem]"
                >
                  <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center text-gray-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 group-hover:rotate-12 transition-all duration-500">
                    <Upload className="w-7 h-7 text-gray-400 group-hover:text-white" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-black text-gray-900 uppercase tracking-widest">{t('upload.startCreating')}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.2em]">Support JPG, PNG, WEBP</p>
                  </div>
                </label>
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
                          title={t('overlay.delete')}
                          aria-label={t('overlay.deleteSelected')}
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
                            duration: drop.duration / RAIN_SPEED_MULTIPLIER,
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
                          <DropSVG size={12 * RAIN_ICON_SCALE} style={{ color: dropColor }} />
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
                      onClick={() => { setIsPlaying(true); trackWithAnalytics({ type: 'play_animation' }); }}
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
                {/* 纹理覆盖层只显示在色块区域，不覆盖原图 */}
                {bgConfig.texture === 'fine-paper' && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage:
                        'linear-gradient(105deg, rgba(255,255,255,0.14) 0, rgba(255,255,255,0.14) 1px, transparent 1px, transparent 6px), linear-gradient(15deg, rgba(0,0,0,0.035) 0, rgba(0,0,0,0.035) 1px, transparent 1px, transparent 9px)',
                      backgroundSize: '8px 8px, 12px 12px',
                    }}
                  />
                )}
                {bgConfig.texture === 'fine-noise' && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 0.6px, transparent 0.7px), radial-gradient(circle at 2px 2px, rgba(0,0,0,0.12) 0.5px, transparent 0.6px)',
                      backgroundSize: '3px 3px, 4px 4px',
                    }}
                  />
                )}
                {bgConfig.texture === 'grain-paper' && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.12) 1.1px, transparent 1.2px), radial-gradient(circle at 4px 3px, rgba(0,0,0,0.08) 1px, transparent 1.1px)',
                      backgroundSize: '6px 6px, 8px 8px',
                    }}
                  />
                )}
                {bgConfig.texture === 'coarse-paper' && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 3px 3px, rgba(0,0,0,0.13) 1.4px, transparent 1.5px), radial-gradient(circle at 7px 5px, rgba(255,255,255,0.12) 1.6px, transparent 1.7px)',
                      backgroundSize: '10px 10px, 12px 12px',
                    }}
                  />
                )}
                {overlayTextConfig.content.trim().length > 0 && overlayEditing && (() => {
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
                  <div className="absolute inset-0 pointer-events-none z-10 overflow-visible" onClick={(e) => e.stopPropagation()}>
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
          id="main-image-upload"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="sr-only"
        />
      </main>

      {renderSettingsPanel()}
      <BottomNav
        ref={bottomNavRef}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        labels={{
          background: t('nav.background'),
          elements: t('nav.elements'),
          video: t('nav.video'),
        }}
      />

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
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-2">
                  {exportPhase === 'transcode' ? '转码中...' : '录制中...'}
                </p>
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
                <h3 className="font-black text-2xl text-gray-900">{t('video.exportSuccess')}</h3>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-2">
                  {t('video.ready')} {videoMimeType.includes('webm') ? '(WEBM)' : '(MP4)'}
                </p>
                <p className="text-sm text-gray-500 mt-3 leading-6">
                  {t('video.exportActionsHint')}
                </p>
              </div>
              <div className="space-y-3 pt-4">
                <button
                  onClick={downloadResult}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-lg"
                >
                  {t('video.downloadNow')}
                </button>
                <button
                  onClick={previewVideoResult}
                  className="w-full bg-slate-100 text-slate-900 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  {t('video.previewResult')}
                </button>
                <button
                  onClick={() => void saveVideoToLocalFile()}
                  className="w-full bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
                >
                  {t('video.saveToLocal')}
                </button>
                <button
                  onClick={() => setShowExportSuccess(false)}
                  className="w-full text-gray-400 font-bold py-2 hover:text-gray-600 transition-colors"
                >
                  {t('video.backToEditor')}
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
                <h3 className="font-black text-xl text-gray-900">{t('errors.exportFailed')}</h3>
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
