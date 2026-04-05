/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, ChangeEvent } from 'react';
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
  CaseUpper,
  AlignStartVertical,
  AlignStartHorizontal,
  AlignEndVertical,
  AlignEndHorizontal,
  SlidersHorizontal,
  PaintBucket,
  Images,
  Image as ImageIcon,
  Sparkles,
  Sun,
  Clock,
  Triangle,
  Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// --- Types & Constants ---

type BottomNavTab = 'background' | 'elements';

type CompositionMode = 'block-bottom' | 'block-top' | 'block-left' | 'block-right';
type BackgroundType = 'solid' | 'stripes';
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
  | 'randomLetters';

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
  { value: 'randomLetters', icon: CaseUpper, title: '随机字母', caption: '随机字母' },
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

/** 在 (0,0) 中心绘制形状路径，size 为外接直径 */
function addShapePath(ctx: CanvasRenderingContext2D, kind: ShapeKind, size: number) {
  const r = size / 2;
  switch (kind) {
    case 'circle':
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
      const spikes = 6;
      const outerR = r;
      const innerR = r * 0.42;
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

/** 与 block 画布条纹/纯色绘制规则一致，在像素坐标采样颜色 */
function sampleBlockPatternColor(
  px: number,
  py: number,
  width: number,
  height: number,
  composition: CompositionMode,
  bg: { type: BackgroundType; color1: string; color2: string; stripeSize: number }
): string {
  const x = Math.min(width - 1e-6, Math.max(0, px));
  const y = Math.min(height - 1e-6, Math.max(0, py));
  if (bg.type === 'solid') return bg.color1;
  const s = Math.max(1, bg.stripeSize);
  const isVertical = composition === 'block-left' || composition === 'block-right';
  if (isVertical) {
    const band = Math.floor(x / s) % 2;
    return band === 0 ? bg.color2 : bg.color1;
  }
  const band = Math.floor(y / s) % 2;
  return band === 0 ? bg.color2 : bg.color1;
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
  const [pickingTarget, setPickingTarget] = useState<'color1' | 'color2' | null>(null);
  const [elementsPanelTab, setElementsPanelTab] = useState<ElementsPanelTab>('shape');

  const [expandedSlider, setExpandedSlider] = useState<string | null>(null);

  // 1. Canvas Configuration
  const [composition, setComposition] = useState<CompositionMode>('block-bottom');
  const [zoom, setZoom] = useState(0.6);

  useEffect(() => {
    setPickingTarget(null);
  }, [activeTab]);

  const settingsPanelOpen = activeTab === 'background' || activeTab === 'elements';

  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const bottomNavRef = useRef<HTMLElement>(null);

  /** 点击面板、底栏、顶栏以外的区域时收起设置面板（含取色、展开滑块） */
  useEffect(() => {
    if (!settingsPanelOpen) return;
    const onPointerDownCapture = (e: PointerEvent) => {
      const t = e.target as Node;
      if (settingsPanelRef.current?.contains(t)) return;
      if (bottomNavRef.current?.contains(t)) return;
      const headerEl = document.querySelector('header');
      if (headerEl?.contains(t)) return;
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
    const settingsPanelHeight = settingsPanelOpen ? window.innerHeight * 0.4 : 0;
    
    const availableWidth = window.innerWidth - padding;
    const availableHeight = window.innerHeight - headerHeight - navHeight - settingsPanelHeight - padding;
    
    let totalWidth, totalHeight;
    if (composition === 'block-bottom' || composition === 'block-top') {
      totalWidth = image.width;
      totalHeight = image.height * 2;
    } else {
      totalWidth = image.width * 2;
      totalHeight = image.height;
    }
    
    const scaleX = availableWidth / totalWidth;
    const scaleY = availableHeight / totalHeight;
    
    // Ensure we don't zoom in too much, but fit perfectly
    const newZoom = Math.min(scaleX, scaleY, 1);
    setZoom(newZoom);
  }, [image, composition, settingsPanelOpen]);

  useEffect(() => {
    fitToScreen();
    window.addEventListener('resize', fitToScreen);
    return () => window.removeEventListener('resize', fitToScreen);
  }, [image, composition, settingsPanelOpen, fitToScreen]);

  // 2. Background Configuration
  const [bgConfig, setBgConfig] = useState({
    type: 'stripes' as BackgroundType,
    color1: '#e63946',
    color2: '#a8dadc',
    stripeSize: 48,
  });

  // 3. Shape Configuration
  const [cutoutConfig, setCutoutConfig] = useState({
    baseSize: 40,
    variation: 2,
    autoCount: 10,
    creationMode: 'auto' as CreationMode,
    distributionMode: 'sync' as DistributionMode,
    defaultShapeKind: 'circle' as ShapeKind,
    /** 形状类型为「符号」时：可输入多个字符，生成时随机取其一 */
    customShapeSymbol: '★♥●',
    /** 形状挖空后填入的颜色（全局统一） */
    shapeColor: '#ffffff',
    /** 每个元素位置散落的形状数量（>=1，1=单个形状） */
    scatterCount: 3,
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
    
    // Reference dimensions for collision math (based on baseWidth=800)
    const refW = 800;
    const refH = (img.height / img.width) * refW;

    for (let i = 0; i < count; i++) {
      let placed = false;
      let attempts = 0;
      
      while (!placed && attempts < maxAttempts) {
        let x = Math.random();
        let y = Math.random();
        
        // Bias towards edges: calculate distance from center (0.5, 0.5)
        const dxCenter = x - 0.5;
        const dyCenter = y - 0.5;
        const distFromCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
        
        // Probability of keeping the point increases as we move away from center
        // distFromCenter max is ~0.707 at corners, 0.5 at edge midpoints
        const keepProb = Math.pow(distFromCenter / 0.5, 1.5); 
        if (Math.random() > keepProb && attempts < maxAttempts / 2) {
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
          const dk = dkForGen;
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
    setCutouts(newCutouts);
    setSelectedId(null);
  },
  [cutoutConfig, image]);

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
        blobToLoad = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.92,
        }) as Blob;
      } catch {
        alert('无法读取此图片（HEIC/Live Photos 格式），请尝试先在手机相册中将图片另存为 JPG/PNG 格式。');
        return;
      }
    } else {
      blobToLoad = file;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
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
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(blobToLoad);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mainCanvasRef.current || !image) return;

    const rect = mainCanvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (rect.width / image.width);
    const y = (e.clientY - rect.top) / (rect.height / image.height);

    const imgWidth = image.width;
    const imgHeight = image.height;

    // 1. Check if clicking on a shape
    const nx = x / imgWidth;
    const ny = y / imgHeight;
    
    let clickedId: string | null = null;
    for (let i = cutouts.length - 1; i >= 0; i--) {
      const c = cutouts[i];
      const currentSize = (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (image.width / 800);
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
    if (cutoutConfig.creationMode === 'manual') {
      const newCutout: Cutout =
        cutoutConfig.defaultShapeKind === 'symbol'
          ? {
              id: Math.random().toString(36).substr(2, 9),
              x: nx,
              y: ny,
              sizeFactor: Math.random() - 0.5,
              angle: Math.random() * Math.PI * 2,
              shapeKind: 'symbol',
              char: pickRandomSymbolChar(cutoutConfig.customShapeSymbol),
            }
          : cutoutConfig.defaultShapeKind === 'randomLetters'
            ? {
                id: Math.random().toString(36).substr(2, 9),
                x: nx,
                y: ny,
                sizeFactor: Math.random() - 0.5,
                angle: Math.random() * Math.PI * 2,
                shapeKind: 'randomLetters',
                char: randomUpperLetter(),
              }
            : {
                id: Math.random().toString(36).substr(2, 9),
                x: nx,
                y: ny,
                sizeFactor: Math.random() - 0.5,
                angle: Math.random() * Math.PI * 2,
                shapeKind: cutoutConfig.defaultShapeKind,
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

    // Handle Color Picking
    if (pickingTarget && image) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = image.width;
      tempCanvas.height = image.height;
      const tctx = tempCanvas.getContext('2d');
      if (tctx && x >= 0 && x <= imgWidth && y >= 0 && y <= imgHeight) {
        tctx.drawImage(image, 0, 0);
        const px = Math.floor(nx * image.width);
        const py = Math.floor(ny * image.height);
        const pixel = tctx.getImageData(px, py, 1, 1).data;
        const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
        setBgConfig(prev => ({ ...prev, [pickingTarget]: hex }));
        setPickingTarget(null);
      }
    }
  };

  /** 色块区域（blockCanvas）点击：选中/新建挖空 */
  const handleBlockCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!blockCanvasRef.current || !image) return;

    const rect = blockCanvasRef.current.getBoundingClientRect();
    const bx = (e.clientX - rect.left) / (rect.width / image.width);
    const by = (e.clientY - rect.top) / (rect.height / image.height);
    const bw = image.width;
    const bh = image.height;

    // 1. Check if clicking on an existing shape hitbox
    const nx = bx / bw;
    const ny = by / bh;

    let clickedId: string | null = null;
    for (let i = cutouts.length - 1; i >= 0; i--) {
      const c = cutouts[i];
      const currentSize =
        (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) *
        (image.width / 800);
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

    if (cutoutConfig.creationMode === 'manual') {
      const newCutout: Cutout =
        cutoutConfig.defaultShapeKind === 'symbol'
          ? {
              id: Math.random().toString(36).substr(2, 9),
              x: nx,
              y: ny,
              sizeFactor: Math.random() - 0.5,
              angle: Math.random() * Math.PI * 2,
              shapeKind: 'symbol',
              char: pickRandomSymbolChar(cutoutConfig.customShapeSymbol),
            }
          : cutoutConfig.defaultShapeKind === 'randomLetters'
            ? {
                id: Math.random().toString(36).substr(2, 9),
                x: nx,
                y: ny,
                sizeFactor: Math.random() - 0.5,
                angle: Math.random() * Math.PI * 2,
                shapeKind: 'randomLetters',
                char: randomUpperLetter(),
              }
            : {
                id: Math.random().toString(36).substr(2, 9),
                x: nx,
                y: ny,
                sizeFactor: Math.random() - 0.5,
                angle: Math.random() * Math.PI * 2,
                shapeKind: cutoutConfig.defaultShapeKind,
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
      
      // We need to account for the zoom/scale of the canvas in the UI
      const rect = mainCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scale = 1000 / rect.width;

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
    const rect = blockCanvasRef.current.getBoundingClientRect();
    const scaleX = image.width / rect.width;
    const scaleY = image.height / rect.height;
    const cx = overlayTextConfig.x * image.width;
    const cy = overlayTextConfig.y * image.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const dist = Math.hypot(mx - cx, my - cy);
    const approxW = overlayTextConfig.fontSize * scaleX * 3;
    if (dist < Math.max(approxW, 30)) {
      setIsDraggingOverlay(true);
      overlayDragStartRef.current = { mouseX: mx, mouseY: my, ox: overlayTextConfig.x, oy: overlayTextConfig.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingOverlay || !blockCanvasRef.current || !image) return;
    e.stopPropagation();
    const rect = blockCanvasRef.current.getBoundingClientRect();
    const scaleX = image.width / rect.width;
    const scaleY = image.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const dx = mx - overlayDragStartRef.current.mouseX;
    const dy = my - overlayDragStartRef.current.mouseY;
    setOverlayTextConfig((prev) => ({
      ...prev,
      x: Math.max(0.05, Math.min(0.95, overlayDragStartRef.current.ox + dx / image.width)),
      y: Math.max(0.05, Math.min(0.95, overlayDragStartRef.current.oy + dy / image.height)),
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
    const rect = mainCanvasRef.current.getBoundingClientRect();
    const c = cutouts.find((x) => x.id === selectedId);
    if (!c) return;
    const cx = rect.left + c.x * rect.width;
    const cy = rect.top + c.y * rect.height;
    const startDist = Math.hypot(e.clientX - cx, e.clientY - cy);
    const startSizeCanvas =
      (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (image.width / 800);
    resizeDragRef.current = {
      startDist: Math.max(startDist, 4),
      startSizeCanvas,
      cutoutId: c.id,
      centerX: cx,
      centerY: cy,
      scale: image.width / rect.width,
      baseSize: cutoutConfig.baseSize,
      variation: cutoutConfig.variation,
      imgW: image.width,
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

    // Use image dimensions for the canvas
    const canvasWidth = image.width;
    const canvasHeight = image.height;
    
    mainCanvasRef.current.width = canvasWidth;
    mainCanvasRef.current.height = canvasHeight;
    blockCanvasRef.current.width = canvasWidth;
    blockCanvasRef.current.height = canvasHeight;

    // Image fills the canvas
    const imgWidth = canvasWidth;
    const imgHeight = canvasHeight;
    const ix = 0;
    const iy = 0;

    const overlayTrim = overlayTextConfig.content.trim();
    const hasOverlayText = overlayTrim.length > 0;
    const showLine = hasOverlayText;
    const oxFontFamily = overlayTextConfig.fontFamily;
    const oxFill = overlayTextConfig.fillColor;
    const scaleRef = canvasWidth / 800;
    const oxStroke = overlayTextConfig.strokeColor;

    let lineLayout: {
      fontSize: number;
      lines: string[];
      lh: number;
      startY: number;
      cx: number;
    } | null = null;
    if (showLine) {
      const basePx = overlayTextConfig.fontSize * scaleRef;
      lineLayout = computeOverlayLineLayout(
        mainCtx,
        overlayTrim,
        imgWidth,
        imgHeight,
        basePx,
        oxFontFamily,
        overlayTextConfig.x,
        overlayTextConfig.y
      );
    }

    // 1. 先画色块画布（条纹/纯色背景）
    blockCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    blockCtx.fillStyle = bgConfig.color1;
    blockCtx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (bgConfig.type === 'stripes') {
      blockCtx.fillStyle = bgConfig.color2;
      const isVertical = composition === 'block-left' || composition === 'block-right';
      if (isVertical) {
        for (let i = 0; i < canvasWidth; i += bgConfig.stripeSize * 2) {
          blockCtx.fillRect(i, 0, bgConfig.stripeSize, canvasHeight);
        }
      } else {
        for (let i = 0; i < canvasHeight; i += bgConfig.stripeSize * 2) {
          blockCtx.fillRect(0, i, canvasWidth, bgConfig.stripeSize);
        }
      }
    }

    // 从色块画布读取像素数据用于主图画孔洞
    const blockImageData = blockCtx.getImageData(0, 0, canvasWidth, canvasHeight);
    const blockData = blockImageData.data;

    function sampleFromBlockData(nx: number, ny: number): string {
      const px = Math.round(nx * (canvasWidth - 1));
      const py = Math.round(ny * (canvasHeight - 1));
      const idx = (py * canvasWidth + px) * 4;
      return `rgba(${blockData[idx]},${blockData[idx + 1]},${blockData[idx + 2]},${blockData[idx + 3] / 255})`;
    }

    // 2. 画主图（照片 + 填色孔洞）
    mainCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    mainCtx.save();
    mainCtx.drawImage(image, 0, 0, imgWidth, imgHeight);

    cutouts.forEach((c) => {
      const currentSize = (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (canvasWidth / 800);
      const holeColor = sampleFromBlockData(c.x, c.y);
      mainCtx.save();
      mainCtx.translate(c.x * imgWidth, c.y * imgHeight);
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

    mainCtx.restore();

    // 3. 色块画布画形状孔洞（透照片）
    blockCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    blockCtx.fillStyle = bgConfig.color1;
    blockCtx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (bgConfig.type === 'stripes') {
      blockCtx.fillStyle = bgConfig.color2;
      const isVertical = composition === 'block-left' || composition === 'block-right';
      if (isVertical) {
        for (let i = 0; i < canvasWidth; i += bgConfig.stripeSize * 2) {
          blockCtx.fillRect(i, 0, bgConfig.stripeSize, canvasHeight);
        }
      } else {
        for (let i = 0; i < canvasHeight; i += bgConfig.stripeSize * 2) {
          blockCtx.fillRect(0, i, canvasWidth, bgConfig.stripeSize);
        }
      }
    }

    const isSyncMode = cutoutConfig.distributionMode === 'sync' || cutoutConfig.creationMode === 'manual';

    cutouts.forEach((c, index) => {
      const currentSize = (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (canvasWidth / 800);
      const count = isSyncMode ? 1 : cutoutConfig.scatterCount;

      if (count <= 1) {
        // 单形状模式
        blockCtx.save();
        let dx = c.x * imgWidth;
        let dy = c.y * imgHeight;

        if (!isSyncMode) {
          const seedX = index * 123.456;
          const seedY = index * 789.012;
          dx = ((Math.sin(seedX) + 1) / 2) * canvasWidth;
          dy = ((Math.cos(seedY) + 1) / 2) * canvasHeight;
        }

        blockCtx.translate(dx, dy);
        blockCtx.rotate(c.angle);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = currentSize * 2;
        tempCanvas.height = currentSize * 2;
        const tctx = tempCanvas.getContext('2d');
        if (tctx) {
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
            c.x * image.width - (currentSize * image.width / imgWidth) / 2,
            c.y * image.height - (currentSize * image.height / imgHeight) / 2,
            currentSize * image.width / imgWidth,
            currentSize * image.height / imgHeight,
            0, 0, currentSize * 2, currentSize * 2
          );
          blockCtx.drawImage(tempCanvas, -currentSize, -currentSize);
        }
        blockCtx.restore();

        // 为选中的元素添加高亮边框（在形状外围画一圈醒目的边）
        if (c.id === selectedId) {
          blockCtx.save();
          blockCtx.translate(dx, dy);
          blockCtx.rotate(c.angle);
          blockCtx.strokeStyle = '#22c55e';
          blockCtx.lineWidth = 3;
          blockCtx.setLineDash([6, 4]);
          if (isGlyphShapeKind(c.shapeKind)) {
            const char = cutoutGlyphChar(c, cutoutConfig.customShapeSymbol);
            blockCtx.font = `bold ${currentSize}px sans-serif`;
            blockCtx.textAlign = 'center';
            blockCtx.textBaseline = 'middle';
            const metrics = blockCtx.measureText(char);
            const tw = metrics.width;
            const th = currentSize;
            blockCtx.strokeRect(-tw / 2 - 4, -th / 2 - 4, tw + 8, th + 8);
          } else if (c.shapeKind) {
            blockCtx.beginPath();
            addShapePath(blockCtx, c.shapeKind, currentSize + 6);
            blockCtx.stroke();
          }
          blockCtx.restore();
        }
      } else {
        // 散落形状群：以元素位置为中心，随机散布多个小形状
        blockCtx.save();
        let baseX, baseY;
        if (cutoutConfig.distributionMode === 'sync' || cutoutConfig.creationMode === 'manual') {
          baseX = c.x * imgWidth;
          baseY = c.y * imgHeight;
        } else {
          const seedX = index * 123.456;
          const seedY = index * 789.012;
          baseX = ((Math.sin(seedX) + 1) / 2) * canvasWidth;
          baseY = ((Math.cos(seedY) + 1) / 2) * canvasHeight;
        }
        blockCtx.translate(baseX, baseY);
        blockCtx.rotate(c.angle);

        const rng = (seed: number) => Math.abs(Math.sin(seed * 9301 + 49297) * 233280) % 1;
        const getRand = (seed: number) => rng(seed);

        for (let s = 0; s < count; s++) {
          const r1 = getRand(index * 100 + s * 7 + 1);
          const r2 = getRand(index * 100 + s * 13 + 2);
          const r3 = getRand(index * 100 + s * 17 + 3);
          const r4 = getRand(index * 100 + s * 19 + 4);

          // 随机散落位置（以 currentSize 为半径）
          const scatterRadius = currentSize * 0.8;
          const angle = r1 * Math.PI * 2;
          const dist = r2 * scatterRadius;
          const sx = Math.cos(angle) * dist;
          const sy = Math.sin(angle) * dist;

          // 随机大小（0.3~1.0 范围）
          const scale = 0.3 + r3 * 0.7;
          const sc = currentSize * scale * 0.5;

          // 随机旋转
          const sAngle = r4 * Math.PI * 2;

          blockCtx.save();
          blockCtx.translate(sx, sy);
          blockCtx.rotate(sAngle);

          const scSize = currentSize * scale;
          const kind = c.shapeKind;

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = sc * 2;
          tempCanvas.height = sc * 2;
          const tctx = tempCanvas.getContext('2d');
          if (tctx) {
            tctx.save();
            tctx.translate(sc, sc);
            tctx.fillStyle = cutoutConfig.shapeColor;
            if (isGlyphShapeKind(kind)) {
              tctx.font = `bold ${scSize}px sans-serif`;
              tctx.textAlign = 'center';
              tctx.textBaseline = 'middle';
              const ch =
                kind === 'randomLetters'
                  ? randomUpperLetter()
                  : pickRandomSymbolChar(cutoutConfig.customShapeSymbol);
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
              c.x * image.width - (currentSize * image.width / imgWidth) / 2,
              c.y * image.height - (currentSize * image.height / imgHeight) / 2,
              currentSize * image.width / imgWidth,
              currentSize * image.height / imgHeight,
              0, 0, sc * 2, sc * 2
            );
            blockCtx.drawImage(tempCanvas, -sc, -sc);
          }
          blockCtx.restore();
        }

        // 为散落形状群的选中元素添加高亮边框
        if (c.id === selectedId) {
          blockCtx.save();
          blockCtx.translate(baseX, baseY);
          blockCtx.rotate(c.angle);
          blockCtx.strokeStyle = '#22c55e';
          blockCtx.lineWidth = 3;
          blockCtx.setLineDash([6, 4]);
          const groupRadius = currentSize + 10;
          blockCtx.beginPath();
          blockCtx.arc(0, 0, groupRadius, 0, Math.PI * 2);
          blockCtx.stroke();
          blockCtx.restore();
        }
        blockCtx.restore();
      }
    });

    if (showLine && lineLayout) {
      const tc = document.createElement('canvas');
      tc.width = imgWidth;
      tc.height = imgHeight;
      const tctx = tc.getContext('2d');
      if (tctx) {
        tctx.font = `800 ${lineLayout.fontSize}px ${oxFontFamily}, sans-serif`;
        tctx.textAlign = 'center';
        tctx.textBaseline = 'middle';
        lineLayout.lines.forEach((line, i) => {
          if (!line) return;
          tctx.fillStyle = cutoutConfig.shapeColor;
          tctx.fillText(line, lineLayout.cx, lineLayout.startY + i * lineLayout.lh);
        });
        tctx.globalCompositeOperation = 'source-in';
        tctx.drawImage(image, 0, 0, imgWidth, imgHeight);
        blockCtx.drawImage(tc, 0, 0);
        lineLayout.lines.forEach((line, i) => {
          if (!line) return;
          const y = lineLayout.startY + i * lineLayout.lh;
          blockCtx.save();
          blockCtx.font = `800 ${lineLayout.fontSize}px ${oxFontFamily}, sans-serif`;
          blockCtx.textAlign = 'center';
          blockCtx.textBaseline = 'middle';
          blockCtx.lineWidth = Math.max(1, lineLayout.fontSize * 0.065);
          blockCtx.lineJoin = 'round';
          blockCtx.strokeStyle = oxStroke;
          blockCtx.strokeText(line, lineLayout.cx, y);
          blockCtx.shadowColor = 'rgba(0,0,0,0.2)';
          blockCtx.shadowBlur = 4 * scaleRef;
          blockCtx.shadowOffsetX = 1;
          blockCtx.shadowOffsetY = 1;
          blockCtx.fillStyle = oxFill;
          blockCtx.fillText(line, lineLayout.cx, y);
          blockCtx.restore();
        });
      }
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
  ]);

  const handleSave = async () => {
    if (!mainCanvasRef.current || !blockCanvasRef.current || !image) return;

    const mainCanvas = mainCanvasRef.current;
    const blockCanvas = blockCanvasRef.current;

    const saveCanvas = document.createElement('canvas');
    const sctx = saveCanvas.getContext('2d');
    if (!sctx) return;

    if (composition === 'block-bottom' || composition === 'block-top') {
      saveCanvas.width = mainCanvas.width;
      saveCanvas.height = mainCanvas.height + blockCanvas.height;

      if (composition === 'block-bottom') {
        sctx.drawImage(mainCanvas, 0, 0);
        sctx.drawImage(blockCanvas, 0, mainCanvas.height);
      } else {
        sctx.drawImage(blockCanvas, 0, 0);
        sctx.drawImage(mainCanvas, 0, blockCanvas.height);
      }
    } else {
      saveCanvas.width = mainCanvas.width + blockCanvas.width;
      saveCanvas.height = mainCanvas.height;

      if (composition === 'block-right') {
        sctx.drawImage(mainCanvas, 0, 0);
        sctx.drawImage(blockCanvas, mainCanvas.width, 0);
      } else {
        sctx.drawImage(blockCanvas, 0, 0);
        sctx.drawImage(mainCanvas, blockCanvas.width, 0);
      }
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
        className="p-5 bg-gray-50 rounded-3xl border border-gray-100 space-y-5 shadow-sm"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-gray-900 uppercase tracking-wider">正在编辑选中形状</span>
          </div>
          <button
            type="button"
            onClick={deleteSelectedCutout}
            className="p-2 bg-white text-red-500 rounded-xl hover:bg-red-50 transition-colors shadow-sm border border-red-50"
          >
            <Trash2 size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">大小缩放</label>
              <span className="text-[10px] font-mono font-bold text-gray-900">
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

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">旋转角度</label>
              <span className="text-[10px] font-mono font-bold text-gray-900">
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

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={generateAutoCutouts}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-4 rounded-2xl transition-all text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/25 hover:bg-emerald-700 active:scale-95"
        >
          <RefreshCw size={16} />
          <span>重新生成</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setCutouts([]);
            setSelectedId(null);
          }}
          className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-600 py-4 rounded-2xl transition-all text-[11px] font-black uppercase tracking-widest active:scale-95"
        >
          <Trash2 size={16} />
          <span>清空形状</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => setActiveTab(null)}
        className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-gray-100 hover:text-gray-600 transition-all flex items-center justify-center gap-2"
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
      <div className="flex justify-around items-center h-16 px-4">
        {renderTabButton('background', <Palette size={22} />, '背景')}
        {renderTabButton('elements', <Target size={22} />, '元素')}
      </div>
    </nav>
  );

  const renderSettingsPanel = () => {
    if (!settingsPanelOpen) return null;
    return (
    <div ref={settingsPanelRef} className="fixed bottom-16 left-0 right-0 z-40 max-h-[min(52dvh,28rem)] overflow-y-auto border-t border-gray-50 bg-white/95 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.03)] backdrop-blur-xl custom-scrollbar sm:max-h-[45vh]">
      <div className="relative mx-auto max-w-2xl space-y-6 px-4 pb-8 pt-4 sm:space-y-8 sm:p-6 sm:pb-10">
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
              className="space-y-8"
            >
              {/* Layout Mode — 移动端一行四列 */}
              <div className="space-y-2 sm:space-y-3 pr-10">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">排版模式</label>
                <div className="grid w-full grid-cols-4 gap-1.5 sm:gap-2">
                  {COMPOSITIONS.map((c) => {
                    const Icon = c.icon;
                    const active = composition === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setComposition(c.value)}
                        className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-0.5 py-2 shadow-sm transition-all sm:py-2.5 ${
                          active
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-200/70'
                            : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                        }`}
                      >
                        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className="shrink-0" />
                        <span className="line-clamp-2 text-center text-[7px] font-bold leading-tight sm:text-[9px]">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Background Type — 仅文字 */}
              <div className="space-y-2 sm:space-y-3 pr-10">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">底图类型</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['solid', 'stripes'] as BackgroundType[]).map((type) => {
                    const active = bgConfig.type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setBgConfig((prev) => ({ ...prev, type }))}
                        className={`rounded-2xl border py-3 text-center text-xs font-black shadow-sm transition-all sm:py-3.5 sm:text-sm ${
                          active
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-200/70'
                            : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                        }`}
                      >
                        {type === 'solid' ? '纯色' : '条纹'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Config */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">色彩配置</label>
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="group relative">
                      <div className="w-full h-12 rounded-xl border border-gray-100 relative overflow-hidden shadow-inner" style={{ backgroundColor: bgConfig.color1 }}>
                        <input type="color" value={bgConfig.color1} onChange={(e) => setBgConfig(prev => ({ ...prev, color1: e.target.value }))} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                      </div>
                      <button 
                        onClick={() => setPickingTarget(pickingTarget === 'color1' ? null : 'color1')}
                        className={`absolute -top-2 -right-2 p-1.5 rounded-lg shadow-md border transition-all ${
                          pickingTarget === 'color1' ? 'bg-emerald-100 text-emerald-700 border-emerald-300 scale-110' : 'bg-white text-gray-400 border-gray-100 hover:text-emerald-700'
                        }`}
                      >
                        <Pipette size={12} />
                      </button>
                    </div>
                  </div>
                  {bgConfig.type === 'stripes' && (
                    <div className="flex-1 space-y-1">
                      <div className="group relative">
                        <div className="w-full h-12 rounded-xl border border-gray-100 relative overflow-hidden shadow-inner" style={{ backgroundColor: bgConfig.color2 }}>
                          <input type="color" value={bgConfig.color2} onChange={(e) => setBgConfig(prev => ({ ...prev, color2: e.target.value }))} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        </div>
                        <button 
                          onClick={() => setPickingTarget(pickingTarget === 'color2' ? null : 'color2')}
                          className={`absolute -top-2 -right-2 p-1.5 rounded-lg shadow-md border transition-all ${
                            pickingTarget === 'color2' ? 'bg-emerald-100 text-emerald-700 border-emerald-300 scale-110' : 'bg-white text-gray-400 border-gray-100 hover:text-emerald-700'
                          }`}
                        >
                          <Pipette size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {pickingTarget && (
                  <p className="text-[9px] text-center text-black font-black animate-pulse uppercase tracking-widest">
                    请点击画面中的位置进行取色...
                  </p>
                )}
              </div>

              {bgConfig.type === 'stripes' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">条纹粗细</label>
                    <span className="text-[10px] font-mono font-bold text-gray-900">{bgConfig.stripeSize}px</span>
                  </div>
                  <input
                    type="range" min="4" max="200" value={bgConfig.stripeSize}
                    onChange={(e) => setBgConfig(prev => ({ ...prev, stripeSize: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
                  />
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
              className="space-y-6"
            >
              {elementSelectedEditor}

              <div className="sticky top-0 z-30 -mx-6 px-6 py-2.5 mb-2 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-[0_6px_16px_rgba(255,255,255,0.85)]">
                <div className="grid grid-cols-2 gap-1 p-1.5 bg-gray-100 rounded-2xl mr-11 sm:mr-12">
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
                      className={`py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-[12px] font-black transition-all ${
                        elementsPanelTab === tab
                          ? 'bg-white text-gray-900 shadow-md'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* 形状类型：与 Tab 同区吸顶；切换形状时自动/手动均立即更新画布（见 onClick 内 setCutouts / generateAutoCutouts） */}
                {elementsPanelTab === 'shape' && (
                  <div className="mt-3 pt-3 border-t border-gray-100/90 space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">形状类型</label>
                    <div className="flex items-start gap-2 overflow-x-auto pb-1 pt-0.5">
                      {SHAPE_OPTIONS.map(({ value, icon: ShapeIcon, title, caption }) => {
                        const selectedCutout = selectedId ? cutouts.find((c) => c.id === selectedId) : undefined;
                        let activeShapeKind: ShapeKind | null = cutoutConfig.defaultShapeKind;
                        if (selectedCutout) activeShapeKind = selectedCutout.shapeKind ?? null;
                        const active = activeShapeKind !== null && activeShapeKind === value;
                        return (
                          <div key={value} className="flex flex-col items-center gap-2 shrink-0 w-[56px]">
                            <button
                              type="button"
                              title={title}
                              aria-label={title}
                              onClick={() => {
                                // 自动模式：只改 defaultShapeKind 并重新生成，切勿再 setCutouts([]) 与 generate 抢同一批更新，否则易被空数组覆盖导致「画面失效」
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
                                if (value === 'symbol') {
                                  setCutoutConfig((prev) => ({ ...prev, defaultShapeKind: 'symbol' }));
                                  setCutouts((prev) =>
                                    prev.map((c) => ({
                                      ...c,
                                      shapeKind: 'symbol' as ShapeKind,
                                      char: pickRandomSymbolChar(cutoutConfig.customShapeSymbol),
                                    }))
                                  );
                                } else if (value === 'randomLetters') {
                                  setCutoutConfig((prev) => ({ ...prev, defaultShapeKind: 'randomLetters' }));
                                  setCutouts((prev) =>
                                    prev.map((c) => ({
                                      ...c,
                                      shapeKind: 'randomLetters' as ShapeKind,
                                      char: randomUpperLetter(),
                                    }))
                                  );
                                } else {
                                  setCutoutConfig((prev) => ({ ...prev, defaultShapeKind: value }));
                                  setCutouts((prev) =>
                                    prev.map((c) => ({
                                      ...c,
                                      shapeKind: value as ShapeKind,
                                      char: undefined,
                                    }))
                                  );
                                }
                              }}
                              className={`h-14 w-14 shrink-0 flex items-center justify-center rounded-full transition-all ${
                                active
                                  ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/25'
                                  : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'
                              }`}
                            >
                              <ShapeIcon size={22} strokeWidth={active ? 2.25 : 1.65} aria-hidden />
                            </button>
                            <span
                              className={`min-h-[2rem] w-full px-0.5 text-center text-[9px] font-black leading-snug tracking-tight ${
                                active ? 'text-emerald-800' : 'text-gray-600'
                              }`}
                            >
                              {caption}
                            </span>
                          </div>
                        );
                      })}

                      {cutoutConfig.defaultShapeKind === 'symbol' && (
                        <div className="flex flex-col items-center gap-2 shrink-0 w-[88px]">
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
                            className="h-14 w-full max-w-[5.5rem] shrink-0 px-2 rounded-full border border-gray-200 text-sm font-black text-center focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none bg-white shadow-sm"
                            placeholder="符号"
                            aria-label="自定义符号池"
                          />
                          <span className="min-h-[2rem] w-full text-center text-[9px] font-black leading-snug text-gray-600">符号池</span>
                        </div>
                      )}
                      {cutoutConfig.defaultShapeKind === 'randomLetters' && (
                        <div className="flex flex-col items-center gap-2 shrink-0 w-[56px]">
                          <span className="h-14 w-14 flex items-center justify-center text-[10px] font-black text-gray-500 bg-gray-50/90 ring-1 ring-gray-100 rounded-full">A–Z</span>
                          <span className="min-h-[2rem] w-full text-center text-[9px] font-black leading-snug text-gray-600">随机字母</span>
                        </div>
                      )}

                      <div className="w-px shrink-0 self-stretch min-h-[5.5rem] bg-gray-100" aria-hidden />

                      <div className="flex flex-col items-center gap-2 shrink-0 w-[56px]">
                        <button
                          type="button"
                          title="取消形状"
                          aria-label="取消形状"
                          onClick={() => {
                            setCutouts([]);
                            setSelectedId(null);
                          }}
                          className="h-14 w-14 shrink-0 flex items-center justify-center rounded-full bg-gray-50/90 text-gray-400 ring-1 ring-gray-100 hover:bg-red-50 hover:text-red-500 transition-all"
                        >
                          <X size={20} strokeWidth={1.85} />
                        </button>
                        <span className="min-h-[2rem] w-full text-center text-[9px] font-black leading-snug text-gray-600 px-0.5">取消形状</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {elementsPanelTab === 'shape' ? (
                <div className="space-y-5">
                  {/* 选中形状编辑器仅在上方 elementSelectedEditor 渲染一份，避免重复 */}

                  {/* 形状调整：参考图二 — 圆环内「线稿图标 + 数值」，圆环外底部加粗标签；展开区在整行下方 */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-gray-400 tracking-[0.2em]">形状调整</p>

                    <div className="-mx-1 flex items-start gap-2 overflow-x-auto overflow-y-visible px-2 pb-2 pt-1 sm:-mx-0 sm:px-0">
                      {/* 形状大小 */}
                      <div className="flex w-[5rem] min-w-[5rem] shrink-0 flex-col items-center gap-2">
                        <button
                          type="button"
                          title="形状大小"
                          aria-label="形状大小"
                          onClick={() => setExpandedSlider(expandedSlider === 'baseSize' ? null : 'baseSize')}
                          className={`h-[4.25rem] w-[4.25rem] shrink-0 flex flex-col items-center justify-center gap-1 rounded-full transition-all ${
                            expandedSlider === 'baseSize'
                              ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/25'
                              : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'
                          }`}
                        >
                          <span className="relative inline-flex text-current" aria-hidden>
                            <Images size={17} strokeWidth={expandedSlider === 'baseSize' ? 2.2 : 1.65} />
                            <Sparkles
                              className="absolute -bottom-px -right-px text-current"
                              size={9}
                              strokeWidth={expandedSlider === 'baseSize' ? 2.4 : 1.85}
                            />
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold tabular-nums leading-none ${
                              expandedSlider === 'baseSize' ? 'text-white' : 'text-gray-400'
                            }`}
                          >
                            {cutoutConfig.baseSize}
                          </span>
                        </button>
                        <span
                          className={`min-h-[2.25rem] w-full text-center text-[8px] font-black leading-snug tracking-tight sm:text-[9px] ${
                            expandedSlider === 'baseSize' ? 'text-emerald-800' : 'text-gray-700'
                          }`}
                        >
                          形状大小
                        </span>
                      </div>

                      {/* 形状数量 */}
                      <div className={`flex w-[5rem] min-w-[5rem] shrink-0 flex-col items-center gap-2 ${cutoutConfig.creationMode === 'manual' ? 'opacity-45 pointer-events-none' : ''}`}>
                        <button
                          type="button"
                          title="形状数量"
                          aria-label="形状数量"
                          onClick={() => cutoutConfig.creationMode === 'auto' && setExpandedSlider(expandedSlider === 'autoCount' ? null : 'autoCount')}
                          className={`h-[4.25rem] w-[4.25rem] shrink-0 flex flex-col items-center justify-center gap-1 rounded-full transition-all ${
                            expandedSlider === 'autoCount' && cutoutConfig.creationMode === 'auto'
                              ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/25'
                              : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'
                          }`}
                        >
                          <span className="relative inline-flex text-current" aria-hidden>
                            <ImageIcon size={17} strokeWidth={expandedSlider === 'autoCount' && cutoutConfig.creationMode === 'auto' ? 2.2 : 1.65} />
                            <Sparkles
                              className="absolute -right-0.5 -top-0.5 text-current"
                              size={9}
                              strokeWidth={expandedSlider === 'autoCount' && cutoutConfig.creationMode === 'auto' ? 2.4 : 1.85}
                            />
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold tabular-nums leading-none ${
                              expandedSlider === 'autoCount' && cutoutConfig.creationMode === 'auto' ? 'text-white' : 'text-gray-400'
                            }`}
                          >
                            {cutoutConfig.autoCount}
                          </span>
                        </button>
                        <span
                          className={`min-h-[2.25rem] w-full text-center text-[8px] font-black leading-snug tracking-tight sm:text-[9px] ${
                            expandedSlider === 'autoCount' && cutoutConfig.creationMode === 'auto' ? 'text-emerald-800' : 'text-gray-700'
                          }`}
                        >
                          形状数量
                        </span>
                      </div>

                      {/* 随机差异 */}
                      <div className="flex w-[5rem] min-w-[5rem] shrink-0 flex-col items-center gap-2">
                        <button
                          type="button"
                          title="随机差异"
                          aria-label="随机差异"
                          onClick={() => setExpandedSlider(expandedSlider === 'variation' ? null : 'variation')}
                          className={`h-[4.25rem] w-[4.25rem] shrink-0 flex flex-col items-center justify-center gap-1 rounded-full transition-all ${
                            expandedSlider === 'variation'
                              ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/25'
                              : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'
                          }`}
                        >
                          <Sun size={17} strokeWidth={expandedSlider === 'variation' ? 2.2 : 1.65} aria-hidden />
                          <span
                            className={`text-[10px] font-mono font-bold tabular-nums leading-none ${
                              expandedSlider === 'variation' ? 'text-white' : 'text-gray-400'
                            }`}
                          >
                            {cutoutConfig.variation}
                          </span>
                        </button>
                        <span
                          className={`min-h-[2.25rem] w-full text-center text-[8px] font-black leading-snug tracking-tight sm:text-[9px] ${
                            expandedSlider === 'variation' ? 'text-emerald-800' : 'text-gray-700'
                          }`}
                        >
                          随机差异
                        </span>
                      </div>

                      {/* 形状填色 */}
                      <div className="flex w-[5rem] min-w-[5rem] shrink-0 flex-col items-center gap-2">
                        <button
                          type="button"
                          title="形状填色"
                          aria-label="形状填色"
                          onClick={() => setExpandedSlider(expandedSlider === 'shapeColor' ? null : 'shapeColor')}
                          className={`h-[4.25rem] w-[4.25rem] shrink-0 flex flex-col items-center justify-center gap-1 rounded-full transition-all ${
                            expandedSlider === 'shapeColor'
                              ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/25'
                              : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'
                          }`}
                        >
                          <PaintBucket size={17} strokeWidth={expandedSlider === 'shapeColor' ? 2.2 : 1.65} aria-hidden />
                          <span
                            className={`h-3 w-3 rounded-full border-2 ${
                              expandedSlider === 'shapeColor' ? 'border-white' : 'border-gray-300'
                            }`}
                            style={{ backgroundColor: cutoutConfig.shapeColor }}
                          />
                        </button>
                        <span
                          className={`min-h-[2.25rem] w-full text-center text-[8px] font-black leading-snug tracking-tight sm:text-[9px] ${
                            expandedSlider === 'shapeColor' ? 'text-emerald-800' : 'text-gray-700'
                          }`}
                        >
                          形状填色
                        </span>
                      </div>

                      {/* 元素对称 */}
                      <div className="flex w-[5rem] min-w-[5rem] shrink-0 flex-col items-center gap-2">
                        <button
                          type="button"
                          title="元素对称"
                          aria-label="元素对称"
                          onClick={() => setExpandedSlider(expandedSlider === 'distributionMode' ? null : 'distributionMode')}
                          className={`h-[4.25rem] w-[4.25rem] shrink-0 flex flex-col items-center justify-center gap-1 rounded-full transition-all ${
                            expandedSlider === 'distributionMode'
                              ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/25'
                              : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'
                          }`}
                        >
                          <span className="relative inline-flex h-[17px] w-[17px] items-center justify-center text-current" aria-hidden>
                            <Clock size={17} strokeWidth={expandedSlider === 'distributionMode' ? 2.2 : 1.65} />
                            <span
                              className={`pointer-events-none absolute bottom-[-3px] right-[-2px] text-[5px] font-black leading-none tracking-tighter ${
                                expandedSlider === 'distributionMode' ? 'text-white' : 'text-gray-500'
                              }`}
                            >
                              HD
                            </span>
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold leading-none ${
                              expandedSlider === 'distributionMode' ? 'text-white' : 'text-gray-400'
                            }`}
                          >
                            {cutoutConfig.distributionMode === 'sync' ? '是' : '否'}
                          </span>
                        </button>
                        <span
                          className={`min-h-[2.25rem] w-full text-center text-[8px] font-black leading-snug tracking-tight sm:text-[9px] ${
                            expandedSlider === 'distributionMode' ? 'text-emerald-800' : 'text-gray-700'
                          }`}
                        >
                          元素对称
                        </span>
                      </div>

                      {/* 手动添加 */}
                      <div className="flex w-[5rem] min-w-[5rem] shrink-0 flex-col items-center gap-2">
                        <button
                          type="button"
                          title="手动添加"
                          aria-label="手动添加"
                          onClick={() => {
                            const next = cutoutConfig.creationMode === 'manual' ? 'auto' : 'manual';
                            setCutoutConfig((prev) => ({ ...prev, creationMode: next }));
                            if (next === 'auto' && cutouts.length === 0) generateAutoCutouts();
                          }}
                          className={`h-[4.25rem] w-[4.25rem] shrink-0 flex flex-col items-center justify-center gap-1 rounded-full transition-all ${
                            cutoutConfig.creationMode === 'manual'
                              ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/25'
                              : 'bg-gray-50/90 text-gray-500 ring-1 ring-gray-100 hover:bg-gray-100/90'
                          }`}
                        >
                          <Triangle size={17} strokeWidth={cutoutConfig.creationMode === 'manual' ? 2.2 : 1.65} aria-hidden />
                          <span
                            className={`text-[10px] font-mono font-bold leading-none ${
                              cutoutConfig.creationMode === 'manual' ? 'text-white' : 'text-gray-400'
                            }`}
                          >
                            {cutoutConfig.creationMode === 'manual' ? '开' : '关'}
                          </span>
                        </button>
                        <span
                          className={`min-h-[2.25rem] w-full text-center text-[8px] font-black leading-snug tracking-tight sm:text-[9px] ${
                            cutoutConfig.creationMode === 'manual' ? 'text-emerald-800' : 'text-gray-700'
                          }`}
                        >
                          手动添加
                        </span>
                      </div>
                    </div>

                    {/* 展开区：与当前选中项对齐的整行控件 */}
                    <div className="space-y-2 pt-1">
                      {expandedSlider === 'baseSize' && (
                        <input
                          type="range"
                          min="4"
                          max="200"
                          value={cutoutConfig.baseSize}
                          onChange={(e) => setCutoutConfig((prev) => ({ ...prev, baseSize: Number(e.target.value) }))}
                          className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
                        />
                      )}
                      {expandedSlider === 'autoCount' && cutoutConfig.creationMode === 'auto' && (
                        <input
                          type="range"
                          min="1"
                          max="80"
                          step="1"
                          value={cutoutConfig.autoCount}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setCutoutConfig((prev) => ({ ...prev, autoCount: next }));
                            if (image) generateAutoCutouts({ autoCount: next });
                          }}
                          className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
                        />
                      )}
                      {expandedSlider === 'variation' && (
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={cutoutConfig.variation}
                          onChange={(e) => setCutoutConfig((prev) => ({ ...prev, variation: Number(e.target.value) }))}
                          className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-emerald-600"
                        />
                      )}
                      {expandedSlider === 'shapeColor' && (
                        <div className="relative h-9 rounded-xl overflow-hidden border border-gray-100" style={{ backgroundColor: cutoutConfig.shapeColor }}>
                          <input
                            type="color"
                            value={cutoutConfig.shapeColor}
                            onChange={(e) => setCutoutConfig((prev) => ({ ...prev, shapeColor: e.target.value }))}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>
                      )}
                      {expandedSlider === 'distributionMode' && (
                        <div className="flex gap-2">
                          {(['sync', 'scatter'] as DistributionMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setCutoutConfig((prev) => ({ ...prev, distributionMode: mode }))}
                              className={`flex-1 py-2.5 rounded-2xl text-[10px] font-black transition-all ${
                                cutoutConfig.distributionMode === mode
                                  ? 'bg-emerald-50 text-emerald-900 border-2 border-emerald-400 shadow-sm'
                                  : 'bg-gray-50/80 text-gray-600 border border-gray-200 hover:bg-gray-100/80'
                              }`}
                            >
                              {mode === 'sync' ? '对称（是）' : '打散（否）'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 第三行：重新生成 */}
                  <div className="flex gap-2">
                    <button type="button" onClick={generateAutoCutouts}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-4 rounded-2xl transition-all text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/25 hover:bg-emerald-700 active:scale-95">
                      <RefreshCw size={16} /><span>重新生成</span>
                    </button>
                  </div>

                  <button type="button" onClick={() => setActiveTab(null)}
                    className="w-full py-3 bg-gray-50 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-gray-100 hover:text-gray-600 transition-all flex items-center justify-center gap-2">
                    <ChevronDown size={16} /><span>收起面板</span>
                  </button>
                </div>
              ) : (
                elementOverlayTextPanel
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
                y: settingsPanelOpen ? -(window.innerHeight * 0.4) / 2 : 0
              }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`flex ${
                composition === 'block-bottom' ? 'flex-col' :
                composition === 'block-top' ? 'flex-col-reverse' :
                composition === 'block-right' ? 'flex-row' : 'flex-row-reverse'
              } shadow-[0_40px_100px_-20px_rgba(0,0,0,0.2)] items-stretch justify-center gap-0 p-0 overflow-visible bg-white flex-shrink-0`}
              style={{
                width: (composition === 'block-bottom' || composition === 'block-top' ? image.width : image.width * 2) * zoom,
                height: (composition === 'block-bottom' || composition === 'block-top' ? image.height * 2 : image.height) * zoom,
                maxWidth: 'min(100vw - 1rem, 100%)',
                maxHeight: 'min(calc(100dvh - 7rem - env(safe-area-inset-top, 0px)), 100%)',
              }}
            >
              {/* 主图与色块必须同宽同高（各为 image×zoom），勿用 100%+contain，否则 flex 下左右两半占位不一致 */}
              <div
                className="relative shrink-0 leading-[0]"
                style={{ width: image.width * zoom, height: image.height * zoom }}
              >
                <canvas
                  ref={mainCanvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  className={`block p-0 m-0 border-none ${isDraggingImage ? 'cursor-grabbing' : 'cursor-grab'}`}
                  style={{ width: image.width * zoom, height: image.height * zoom, display: 'block' }}
                />
                {selectedId && (() => {
                  const c = cutouts.find((x) => x.id === selectedId);
                  if (!c) return null;
                  const iw = image.width;
                  const currentSize =
                    (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (iw / 800);
                  const boxPx = currentSize * zoom;
                  const handleCls =
                    'absolute w-4 h-4 bg-white border-2 border-emerald-500 rounded-full shadow-md pointer-events-auto touch-none z-20';
                  return (
                    <div className="absolute inset-0 pointer-events-none z-10 overflow-visible">
                      <div
                        className="absolute pointer-events-auto"
                        style={{
                          left: `${c.x * 100}%`,
                          top: `${c.y * 100}%`,
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
                className="relative shrink-0 leading-[0]"
                style={{ width: image.width * zoom, height: image.height * zoom }}
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
                  className={`block p-0 m-0 border-none ${
                    isDraggingOverlay || isResizingOverlay ? 'cursor-grabbing' : 'cursor-crosshair'
                  }`}
                  style={{ width: image.width * zoom, height: image.height * zoom }}
                />
                {overlayTextConfig.content.trim().length > 0 && !selectedId && (
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
                        left: `${overlayTextConfig.x * 100}%`,
                        top: `${overlayTextConfig.y * 100}%`,
                        width: '100%',
                        height: '100%',
                        transform: 'translate(-50%, -50%)',
                        cursor: isDraggingOverlay ? 'grabbing' : 'grab',
                      }}
                    />
                    <div
                      className="absolute border-2 border-dashed border-blue-400 pointer-events-none z-[6]"
                      style={{
                        left: `${overlayTextConfig.x * 100}%`,
                        top: `${overlayTextConfig.y * 100}%`,
                        minWidth: 80 * zoom,
                        minHeight: 24 * zoom,
                        transform: 'translate(-50%, -50%)',
                        boxShadow: '0 0 8px rgba(59,130,246,0.25)',
                      }}
                    />
                    <div
                      role="presentation"
                      className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow-md pointer-events-auto cursor-ns-resize z-20"
                      style={{
                        left: `${overlayTextConfig.x * 100}%`,
                        top: `calc(${overlayTextConfig.y * 100}% + ${overlayTextConfig.fontSize * zoom * 1.5})`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      onMouseDown={handleOverlayResizeMouseDown}
                      onMouseMove={handleOverlayResizeMouseMove}
                      onMouseUp={() => setIsResizingOverlay(false)}
                    />
                  </div>
                )}
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
