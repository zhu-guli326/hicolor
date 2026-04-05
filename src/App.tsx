/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  Hash,
  CaseUpper,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// --- Types & Constants ---

type Tab = 'canvas' | 'background' | 'elements';

type CompositionMode = 'block-bottom' | 'block-top' | 'block-left' | 'block-right';
type BackgroundType = 'solid' | 'stripes';
type CreationMode = 'auto' | 'manual';
type DistributionMode = 'sync' | 'scatter';
type ElementCategory = 'shape' | 'custom';

/** 元素面板内：形状挖空 / 文字字符池 / 画布叠字 */
type ElementsPanelTab = 'shape' | 'cutoutText' | 'overlay';
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

/** 叠加字母串：主图为白字，色块区为照片填充字（与参考图一致） */
interface StringLetter {
  char: string;
  x: number;
  y: number;
  sizeFactor: number;
  angle: number;
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

const SHAPE_OPTIONS: { value: ShapeKind; icon: LucideIcon; title: string }[] = [
  { value: 'circle', icon: Circle, title: '圆形' },
  { value: 'square', icon: Square, title: '正方形' },
  { value: 'star', icon: Star, title: '五角星' },
  { value: 'drop', icon: Droplet, title: '水滴' },
  { value: 'snowflake', icon: Snowflake, title: '雪花' },
  { value: 'heart', icon: Heart, title: '爱心' },
  { value: 'symbol', icon: Hash, title: '自定义符号' },
  { value: 'randomLetters', icon: CaseUpper, title: '随机字母' },
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

/** 随机 26 个大写字母拼接（每位独立随机） */
function randomAlphaString26(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 26; i++) {
    s += letters[Math.floor(Math.random() * letters.length)];
  }
  return s;
}

/** iOS / iPadOS：Safari 对 <a download>、data: 新窗口支持差，需分享或新开 blob 页长按保存 */
function isLikelyIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

function overlayCharsForScatter(raw: string): string[] {
  const t = raw.replace(/\s/g, '');
  if (!t) return [];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const seg = new Intl.Segmenter('zh', { granularity: 'grapheme' });
      return Array.from(seg.segment(t), (s) => s.segment);
    } catch {
      /* ignore */
    }
  }
  return [...t];
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
  fontFamily: string
): { fontSize: number; lines: string[]; lh: number; startY: number; cx: number } {
  const cx = imgWidth / 2;
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
  const cy = imgHeight * 0.42;
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
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.95, -r * 0.15, r * 0.55, r * 0.5, 0, r);
      ctx.bezierCurveTo(-r * 0.55, r * 0.5, -r * 0.95, -r * 0.15, 0, -r);
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

const COMPOSITIONS: { value: CompositionMode; label: string }[] = [
  { value: 'block-bottom', label: '色块在下方' },
  { value: 'block-top', label: '色块在上方' },
  { value: 'block-left', label: '色块在左侧' },
  { value: 'block-right', label: '色块在右侧' },
];

// --- Main Application ---

export default function App() {
  // --- State ---
  const [activeTab, setActiveTab] = useState<Tab>('canvas');
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cutouts, setCutouts] = useState<Cutout[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pickingTarget, setPickingTarget] = useState<'color1' | 'color2' | null>(null);
  const [elementCategory, setElementCategory] = useState<ElementCategory>('shape');
  const [elementsPanelTab, setElementsPanelTab] = useState<ElementsPanelTab>('shape');

  // 1. Canvas Configuration
  const [composition, setComposition] = useState<CompositionMode>('block-bottom');
  const [zoom, setZoom] = useState(0.6);

  useEffect(() => {
    setPickingTarget(null);
  }, [activeTab]);

  const fitToScreen = useCallback(() => {
    if (!image) return;
    
    // Calculate available space more accurately
    const headerHeight = 64;
    const navHeight = 64;
    const padding = 40;
    
    // We want to fit in the space between header and bottom nav
    // If settings panel is open, it takes up more space
    const settingsPanelHeight = activeTab ? window.innerHeight * 0.4 : 0;
    
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
  }, [image, composition, activeTab]);

  useEffect(() => {
    fitToScreen();
    window.addEventListener('resize', fitToScreen);
    return () => window.removeEventListener('resize', fitToScreen);
  }, [image, composition, activeTab, fitToScreen]);

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
    defaultChar: 'A',
    defaultShapeKind: 'circle' as ShapeKind,
    /** 形状类型为「符号」时：可输入多个字符，生成时随机取其一 */
    customShapeSymbol: '★♥●',
    /** 形状挖空后填入的颜色（全局统一） */
    shapeColor: '#ffffff',
  });

  const [overlayTextConfig, setOverlayTextConfig] = useState({
    /** 默认不叠字；在「文字」里输入后才会画到画布上 */
    content: '',
    /** false：整句排版；true：去掉空白后逐字拆散到画面上 */
    scattered: false,
    fontSize: 52,
    fontFamily: '"Noto Sans SC", sans-serif',
    fillColor: '#ffffff',
  });
  const [stringLetters, setStringLetters] = useState<StringLetter[]>([]);
  /** 元素「文字」里展示的随机 26 字母串，可与下方输入联动 */
  const [randomLetterPool26, setRandomLetterPool26] = useState(randomAlphaString26);
  const overlayTextConfigRef = useRef(overlayTextConfig);
  overlayTextConfigRef.current = overlayTextConfig;

  /** 拆散模式下的字号参差，仅内部使用 */
  const scatterVariation = 2;

  const regenerateStringLetters = useCallback(() => {
    const cfg = overlayTextConfigRef.current;
    if (!image || !cfg.scattered) {
      setStringLetters([]);
      return;
    }
    const chars = overlayCharsForScatter(cfg.content);
    if (chars.length === 0) {
      setStringLetters([]);
      return;
    }
    const { fontSize: baseSize } = cfg;
    const variation = scatterVariation;
    const refW = 800;
    const letters: StringLetter[] = [];
    const maxAttempts = 120;

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < maxAttempts) {
        const x = Math.random();
        const y = Math.random();
        const dxCenter = x - 0.5;
        const dyCenter = y - 0.5;
        const distFromCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
        const keepProb = Math.pow(distFromCenter / 0.5, 1.2);
        if (Math.random() > keepProb && attempts < maxAttempts / 2) {
          attempts++;
          continue;
        }

        const sizeFactor = Math.random() - 0.5;
        const currentSize = baseSize + sizeFactor * variation * 10;
        const angle = (Math.random() - 0.5) * Math.PI * 1.4;

        const collision = letters.some((other) => {
          const otherSize = baseSize + other.sizeFactor * variation * 10;
          const dx = (x - other.x) * refW;
          const dy = (y - other.y) * refW * (image.height / image.width);
          const d = Math.sqrt(dx * dx + dy * dy);
          return d < (currentSize + otherSize) / 2 + 14;
        });

        if (!collision) {
          letters.push({ char: ch, x, y, sizeFactor, angle });
          placed = true;
        }
        attempts++;
      }
      if (!placed) {
        letters.push({
          char: ch,
          x: 0.12 + ((i * 37) % 76) / 100,
          y: 0.18 + ((i * 53) % 64) / 100,
          sizeFactor: Math.random() - 0.5,
          angle: (Math.random() - 0.5) * Math.PI,
        });
      }
    }
    setStringLetters(letters);
  }, [image]);

  useEffect(() => {
    regenerateStringLetters();
  }, [image, overlayTextConfig.content, overlayTextConfig.scattered, overlayTextConfig.fontSize, regenerateStringLetters]);

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
  const generateAutoCutouts = useCallback(() => {
    const { autoCount, baseSize, variation } = cutoutConfig;
    const newCutouts: Cutout[] = [];
    const maxAttempts = 100;
    
    // Reference dimensions for collision math (based on baseWidth=800)
    const refW = 800;
    const refH = image ? (image.height / image.width) * refW : 800;

    for (let i = 0; i < autoCount; i++) {
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
          if (elementCategory === 'shape') {
            const dk = cutoutConfig.defaultShapeKind;
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
          } else {
            newCutouts.push({
              ...base,
              char:
                cutoutConfig.defaultChar[Math.floor(Math.random() * cutoutConfig.defaultChar.length)] || 'A',
            });
          }
          placed = true;
        }
        attempts++;
      }
    }
    setCutouts(newCutouts);
    setSelectedId(null);
  }, [cutoutConfig, image, elementCategory]);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        generateAutoCutouts();
        // Delay fit to screen to allow state updates
        setTimeout(fitToScreen, 100);
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
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const newCutout: Cutout =
        elementCategory === 'shape'
          ? cutoutConfig.defaultShapeKind === 'symbol'
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
                }
          : {
              id: Math.random().toString(36).substr(2, 9),
              x: nx,
              y: ny,
              sizeFactor: Math.random() - 0.5,
              angle: Math.random() * Math.PI * 2,
              char:
                cutoutConfig.defaultChar[Math.floor(Math.random() * cutoutConfig.defaultChar.length)] ||
                chars[Math.floor(Math.random() * chars.length)],
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
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const newCutout: Cutout =
        elementCategory === 'shape'
          ? cutoutConfig.defaultShapeKind === 'symbol'
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
                }
          : {
              id: Math.random().toString(36).substr(2, 9),
              x: nx,
              y: ny,
              sizeFactor: Math.random() - 0.5,
              angle: Math.random() * Math.PI * 2,
              char:
                cutoutConfig.defaultChar[
                  Math.floor(Math.random() * cutoutConfig.defaultChar.length)
                ] || chars[Math.floor(Math.random() * chars.length)],
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
    const showScatter =
      hasOverlayText && overlayTextConfig.scattered && stringLetters.length > 0;
    const showLine = hasOverlayText && !overlayTextConfig.scattered;
    const oxFontFamily = overlayTextConfig.fontFamily;
    const oxFill = overlayTextConfig.fillColor;
    const scaleRef = canvasWidth / 800;
    const oxStroke = '#0a0a0a';

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
        oxFontFamily
      );
    }

    // 1. Render Main Image with Holes
    mainCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    mainCtx.save();
    mainCtx.drawImage(image, 0, 0, imgWidth, imgHeight);
    
    cutouts.forEach((c) => {
      const currentSize = (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (canvasWidth / 800);
      mainCtx.save();
      mainCtx.translate(c.x * imgWidth, c.y * imgHeight);
      mainCtx.rotate(c.angle);

      mainCtx.globalCompositeOperation = 'destination-out';
      if (isGlyphShapeKind(c.shapeKind)) {
        mainCtx.font = `bold ${currentSize}px sans-serif`;
        mainCtx.textAlign = 'center';
        mainCtx.textBaseline = 'middle';
        mainCtx.fillText(cutoutGlyphChar(c, cutoutConfig.customShapeSymbol), 0, 0);
      } else if (c.shapeKind) {
        mainCtx.beginPath();
        addShapePath(mainCtx, c.shapeKind, currentSize);
        mainCtx.fill();
      } else {
        mainCtx.font = `bold ${currentSize}px sans-serif`;
        mainCtx.textAlign = 'center';
        mainCtx.textBaseline = 'middle';
        mainCtx.fillText(c.char || 'A', 0, 0);
      }
      mainCtx.restore();
    });

    if (showLine && lineLayout) {
      mainCtx.save();
      mainCtx.font = `800 ${lineLayout.fontSize}px ${oxFontFamily}, sans-serif`;
      mainCtx.textAlign = 'center';
      mainCtx.textBaseline = 'middle';
      lineLayout.lines.forEach((line, i) => {
        if (!line) return;
        const y = lineLayout.startY + i * lineLayout.lh;
        mainCtx.shadowColor = 'rgba(0,0,0,0.22)';
        mainCtx.shadowBlur = 6 * scaleRef;
        mainCtx.shadowOffsetX = 1;
        mainCtx.shadowOffsetY = 2;
        mainCtx.lineWidth = Math.max(1, lineLayout.fontSize * 0.07);
        mainCtx.strokeStyle = oxStroke;
        mainCtx.lineJoin = 'round';
        mainCtx.strokeText(line, lineLayout.cx, y);
        mainCtx.shadowColor = 'transparent';
        mainCtx.fillStyle = oxFill;
        mainCtx.fillText(line, lineLayout.cx, y);
      });
      mainCtx.restore();
    }

    if (showScatter) {
      stringLetters.forEach((sl) => {
        const currentSize =
          (overlayTextConfig.fontSize + sl.sizeFactor * scatterVariation * 10) * scaleRef;
        mainCtx.save();
        mainCtx.translate(sl.x * imgWidth, sl.y * imgHeight);
        mainCtx.rotate(sl.angle);
        mainCtx.font = `800 ${currentSize}px ${oxFontFamily}, sans-serif`;
        mainCtx.textAlign = 'center';
        mainCtx.textBaseline = 'middle';
        mainCtx.shadowColor = 'rgba(0,0,0,0.22)';
        mainCtx.shadowBlur = 5 * scaleRef;
        mainCtx.shadowOffsetX = 1;
        mainCtx.shadowOffsetY = 2;
        mainCtx.lineWidth = Math.max(1, currentSize * 0.06);
        mainCtx.strokeStyle = oxStroke;
        mainCtx.lineJoin = 'round';
        mainCtx.strokeText(sl.char, 0, 0);
        mainCtx.shadowColor = 'transparent';
        mainCtx.fillStyle = oxFill;
        mainCtx.fillText(sl.char, 0, 0);
        mainCtx.restore();
      });
    }

    mainCtx.restore();

    // 2. Render Background Block
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

    cutouts.forEach((c, index) => {
      const currentSize = (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (canvasWidth / 800);
      blockCtx.save();
      
      let dx, dy;
      if (cutoutConfig.distributionMode === 'sync' || cutoutConfig.creationMode === 'manual') {
        dx = c.x * imgWidth;
        dy = c.y * imgHeight;
      } else {
        // Scatter mode for auto-generated shapes: spread them out
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

    if (showScatter) {
      stringLetters.forEach((sl) => {
        const currentSize =
          (overlayTextConfig.fontSize + sl.sizeFactor * scatterVariation * 10) * scaleRef;
        const dx = sl.x * imgWidth;
        const dy = sl.y * imgHeight;
        blockCtx.save();
        blockCtx.translate(dx, dy);
        blockCtx.rotate(sl.angle);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = currentSize * 2;
        tempCanvas.height = currentSize * 2;
        const tctx = tempCanvas.getContext('2d');
        if (tctx) {
          tctx.save();
          tctx.translate(currentSize, currentSize);
          tctx.font = `800 ${currentSize}px ${oxFontFamily}, sans-serif`;
          tctx.textAlign = 'center';
          tctx.textBaseline = 'middle';
          tctx.fillStyle = oxFill || '#fff';
          tctx.fillText(sl.char, 0, 0);
          tctx.restore();
          tctx.globalCompositeOperation = 'source-in';
          tctx.drawImage(
            image,
            sl.x * image.width - (currentSize * image.width / imgWidth) / 2,
            sl.y * image.height - (currentSize * image.height / imgHeight) / 2,
            currentSize * image.width / imgWidth,
            currentSize * image.height / imgHeight,
            0,
            0,
            currentSize * 2,
            currentSize * 2
          );
          blockCtx.drawImage(tempCanvas, -currentSize, -currentSize);
        }

        blockCtx.font = `800 ${currentSize}px ${oxFontFamily}, sans-serif`;
        blockCtx.textAlign = 'center';
        blockCtx.textBaseline = 'middle';
        blockCtx.lineWidth = Math.max(1, currentSize * 0.055);
        blockCtx.lineJoin = 'round';
        blockCtx.strokeStyle = oxStroke;
        blockCtx.strokeText(sl.char, 0, 0);

        blockCtx.restore();
      });
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
    stringLetters,
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

  const elementSelectedEditor =
    selectedId ? (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-5 bg-gray-50 rounded-3xl border border-gray-100 space-y-5 shadow-sm"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
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
              className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-black"
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
              className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-black"
            />
          </div>
        </div>
      </motion.div>
    ) : null;

  const elementCustomCharPool = (
    <div className="space-y-4">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">文字内容</label>
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {['A', 'B', 'C', 'H', 'S', 'O', 'X', '★', '♥', '●'].map((char) => (
          <button
            key={char}
            type="button"
            onClick={() => {
              setCutoutConfig((prev) => ({ ...prev, defaultChar: char }));
              if (selectedId) {
                setCutouts((prev) =>
                  prev.map((c) => (c.id === selectedId ? { ...c, char, shapeKind: undefined } : c))
                );
              }
            }}
            className={`flex-shrink-0 w-12 h-12 rounded-xl text-lg font-black border transition-all flex items-center justify-center ${
              (selectedId ? cutouts.find((c) => c.id === selectedId)?.char : cutoutConfig.defaultChar) === char
                ? 'bg-black border-black text-white'
                : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
            }`}
          >
            {char}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">随机 26 位字母串</label>
        <div className="flex items-stretch gap-2 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <code className="flex-1 min-w-0 px-3 py-2.5 text-[10px] sm:text-[11px] font-mono font-bold text-gray-800 tracking-wide break-all select-all leading-snug self-center">
            {randomLetterPool26}
          </code>
          <div className="flex flex-col shrink-0 border-l border-gray-100">
            <button
              type="button"
              title="重新生成"
              onClick={() => setRandomLetterPool26(randomAlphaString26())}
              className="flex-1 px-2.5 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-black transition-colors"
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              title="填入下方输入框作为字符池"
              onClick={() => {
                const pool = randomLetterPool26;
                setCutoutConfig((prev) => ({ ...prev, defaultChar: pool }));
                if (selectedId && pool.length > 0) {
                  setCutouts((prev) =>
                    prev.map((c) =>
                      c.id === selectedId ? { ...c, char: pool[0], shapeKind: undefined } : c
                    )
                  );
                }
              }}
              className="flex-1 px-2.5 text-[9px] font-black uppercase tracking-tighter text-gray-600 hover:bg-black hover:text-white transition-colors border-t border-gray-100"
            >
              填入
            </button>
          </div>
        </div>
        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest px-1">
          每位独立随机 A–Z；填入后与「多个字符随机选取」规则一致
        </p>
      </div>
      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={cutoutConfig.defaultChar}
            onChange={(e) => {
              const val = e.target.value;
              setCutoutConfig((prev) => ({ ...prev, defaultChar: val }));
              if (selectedId && val.length > 0) {
                setCutouts((prev) =>
                  prev.map((c) =>
                    c.id === selectedId ? { ...c, char: val[0], shapeKind: undefined } : c
                  )
                );
              }
            }}
            className="w-full h-14 px-5 rounded-2xl border border-gray-100 text-lg font-black focus:border-black outline-none transition-all bg-white shadow-sm"
            placeholder="在此输入文字..."
          />
          {cutoutConfig.defaultChar.length > 0 && (
            <button
              type="button"
              onClick={() => setCutoutConfig((prev) => ({ ...prev, defaultChar: '' }))}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-900 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest px-1">
          {cutoutConfig.defaultChar.length > 1
            ? '系统将从您输入的文字中随机选取字符'
            : '输入单个或多个字符'}
        </p>
      </div>
    </div>
  );

  const elementOverlayTextPanel = (
    <div className="space-y-5">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">画布叠字</label>
      <div className="space-y-2">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">一句话</label>
        <textarea
          value={overlayTextConfig.content}
          onChange={(e) =>
            setOverlayTextConfig((prev) => ({ ...prev, content: e.target.value }))
          }
          rows={3}
          className="w-full min-h-[5rem] px-4 py-3 rounded-2xl border border-gray-100 text-sm font-bold text-gray-900 focus:border-black outline-none bg-white shadow-sm resize-y"
          placeholder="写一句话…可换行"
        />
        <p className="text-[9px] text-gray-400 font-bold leading-snug">
          有内容后主图叠字；主图字色 + 细描边，色块为照片填字。「拆散」会去掉空格并随机铺字。
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">排版方式</label>
        <div className="flex p-1 bg-gray-100 rounded-xl">
          <button
            type="button"
            onClick={() => setOverlayTextConfig((prev) => ({ ...prev, scattered: false }))}
            className={`flex-1 py-2.5 rounded-lg text-[11px] font-bold transition-all ${
              !overlayTextConfig.scattered
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400'
            }`}
          >
            整句
          </button>
          <button
            type="button"
            onClick={() => setOverlayTextConfig((prev) => ({ ...prev, scattered: true }))}
            className={`flex-1 py-2.5 rounded-lg text-[11px] font-bold transition-all ${
              overlayTextConfig.scattered
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400'
            }`}
          >
            拆散
          </button>
        </div>
      </div>

      {overlayTextConfig.scattered && (
        <button
          type="button"
          onClick={() => regenerateStringLetters()}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-800 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-[0.99] transition-all hover:bg-gray-200"
        >
          <RefreshCw size={16} />
          重新打散位置
        </button>
      )}

      <div className="space-y-2">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">字体</label>
        <div className="flex flex-wrap gap-2">
          {TEXT_FONT_PRESETS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setOverlayTextConfig((prev) => ({ ...prev, fontFamily: f.value }))}
              className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                overlayTextConfig.fontFamily === f.value
                  ? 'bg-black border-black text-white shadow-md'
                  : 'bg-white border-gray-100 text-gray-600 hover:border-gray-300'
              }`}
              style={{ fontFamily: f.value.replace(/"/g, '') }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-end">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">字号</label>
          <span className="text-[10px] font-mono font-bold text-gray-900">
            {overlayTextConfig.fontSize}
          </span>
        </div>
        <input
          type="range"
          min="24"
          max="160"
          value={overlayTextConfig.fontSize}
          onChange={(e) =>
            setOverlayTextConfig((prev) => ({
              ...prev,
              fontSize: Number(e.target.value),
            }))
          }
          className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-black"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">主图上的字色</label>
        <div
          className="relative h-11 rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
          style={{ backgroundColor: overlayTextConfig.fillColor }}
        >
          <input
            type="color"
            value={overlayTextConfig.fillColor}
            onChange={(e) =>
              setOverlayTextConfig((prev) => ({ ...prev, fillColor: e.target.value }))
            }
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>
      </div>
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
            className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-black"
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
            className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-black"
          />
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
        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">形状内部照片填字的颜色</p>
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
          className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-4 rounded-2xl transition-all text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95"
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

  const renderTabButton = (id: Tab, icon: React.ReactNode, label: string) => (
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
    <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-gray-100 flex items-center justify-between px-6 z-50">
      <div className="flex items-center">
        <h1 className="text-xl font-black text-gray-900 tracking-tighter italic leading-none">hicolor</h1>
      </div>
      <div className="flex gap-3">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-600 transition-all active:scale-90"
          title="上传图片"
        >
          <Upload size={20} />
        </button>
        {image && (
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 bg-black hover:bg-gray-800 rounded-full text-white shadow-xl shadow-black/20 transition-all active:scale-95 group"
            title="保存作品"
          >
            <Download size={20} className="group-hover:translate-y-0.5 transition-transform" />
            <span className="text-[13px] font-black uppercase tracking-widest">保存作品</span>
          </button>
        )}
      </div>
    </header>
  );

  const renderBottomNav = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-gray-100 pb-safe z-50">
      <div className="flex justify-around items-center h-16 px-4">
        {renderTabButton('background', <Palette size={22} />, '背景')}
        {renderTabButton('elements', <Target size={22} />, '元素')}
      </div>
    </nav>
  );

  const renderSettingsPanel = () => (
    <div className="fixed bottom-16 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-50 z-40 max-h-[45vh] overflow-y-auto custom-scrollbar shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
      <div className="p-6 pb-10 space-y-8 max-w-2xl mx-auto relative">
        <button 
          onClick={() => setActiveTab(null)}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-black transition-colors"
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
              {/* Layout Mode */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">排版模式</label>
                <div className="grid grid-cols-2 gap-2">
                  {COMPOSITIONS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setComposition(c.value)}
                      className={`px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${
                        composition === c.value 
                          ? 'bg-black border-black text-white shadow-lg' 
                          : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Type */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">底图类型</label>
                <div className="flex p-1 bg-gray-100 rounded-xl">
                  {(['solid', 'stripes'] as BackgroundType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setBgConfig(prev => ({ ...prev, type }))}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${
                        bgConfig.type === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {type === 'solid' ? '纯色' : '条纹'}
                    </button>
                  ))}
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
                          pickingTarget === 'color1' ? 'bg-black text-white border-black scale-110' : 'bg-white text-gray-400 border-gray-100 hover:text-black'
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
                            pickingTarget === 'color2' ? 'bg-black text-white border-black scale-110' : 'bg-white text-gray-400 border-gray-100 hover:text-black'
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
                    className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-black"
                  />
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'elements' && (
            <motion.div
              key="elements"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {elementSelectedEditor}

              <div className="grid grid-cols-3 gap-1 p-1.5 bg-gray-100 rounded-2xl mb-4">
                {(
                  [
                    { tab: 'shape' as const, label: '形状', cat: 'shape' as const },
                    { tab: 'cutoutText' as const, label: '文字', cat: 'custom' as const },
                    { tab: 'overlay' as const, label: '叠字', cat: null },
                  ] as const
                ).map(({ tab, label, cat }) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setElementsPanelTab(tab);
                      if (cat) setElementCategory(cat);
                    }}
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

              {elementsPanelTab === 'shape' ? (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">形状类型</label>
                  <div className="flex flex-wrap gap-2">
                    {SHAPE_OPTIONS.map(({ value, icon: ShapeIcon, title }) => {
                      const selectedCutout = selectedId
                        ? cutouts.find((c) => c.id === selectedId)
                        : undefined;
                      let activeShapeKind: ShapeKind | null = cutoutConfig.defaultShapeKind;
                      if (selectedCutout) {
                        activeShapeKind = selectedCutout.shapeKind ?? null;
                      }
                      const active = activeShapeKind !== null && activeShapeKind === value;
                      return (
                      <button
                        key={value}
                        type="button"
                        title={title}
                        aria-label={title}
                        onClick={() => {
                          if (value === 'symbol') {
                            setCutoutConfig((prev) => ({ ...prev, defaultShapeKind: 'symbol' }));
                            if (selectedId) {
                              setCutouts((prev) =>
                                prev.map((c) =>
                                  c.id === selectedId
                                    ? {
                                        ...c,
                                        shapeKind: 'symbol',
                                        char: pickRandomSymbolChar(cutoutConfig.customShapeSymbol),
                                      }
                                    : c
                                )
                              );
                            }
                          } else if (value === 'randomLetters') {
                            setCutoutConfig((prev) => ({ ...prev, defaultShapeKind: 'randomLetters' }));
                            if (selectedId) {
                              setCutouts((prev) =>
                                prev.map((c) =>
                                  c.id === selectedId
                                    ? { ...c, shapeKind: 'randomLetters', char: randomUpperLetter() }
                                    : c
                                )
                              );
                            }
                          } else {
                            setCutoutConfig((prev) => ({ ...prev, defaultShapeKind: value }));
                            if (selectedId) {
                              setCutouts((prev) =>
                                prev.map((c) =>
                                  c.id === selectedId ? { ...c, shapeKind: value, char: undefined } : c
                                )
                              );
                            }
                          }
                        }}
                        className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-full transition-all border ${
                          active
                            ? 'bg-black border-black text-white shadow-md'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <ShapeIcon size={20} strokeWidth={active ? 2.5 : 2} aria-hidden />
                      </button>
                    );
                    })}
                  </div>
                  {cutoutConfig.defaultShapeKind === 'symbol' && (
                    <div className="space-y-2 pt-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                        符号内容
                      </label>
                      <input
                        type="text"
                        value={cutoutConfig.customShapeSymbol}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCutoutConfig((prev) => ({ ...prev, customShapeSymbol: val }));
                          const g = [...val].filter(Boolean);
                          if (selectedId) {
                            setCutouts((prev) =>
                              prev.map((c) =>
                                c.id === selectedId && c.shapeKind === 'symbol'
                                  ? { ...c, char: g.length ? g[0] : '★' }
                                  : c
                              )
                            );
                          }
                        }}
                        className="w-full h-12 px-4 rounded-2xl border border-gray-100 text-lg font-black text-center focus:border-black outline-none bg-white shadow-sm"
                        placeholder="输入符号，如 ★ ♥ @ …"
                      />
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest px-1">
                        多个字符时，重新生成会从中随机选取；选中项会同步为第一个字符
                      </p>
                    </div>
                  )}
                </div>
              ) : elementsPanelTab === 'cutoutText' ? (
                elementCustomCharPool
              ) : (
                elementOverlayTextPanel
              )}

              {elementsPanelTab !== 'overlay' && elementSharedFooter}
              {elementsPanelTab === 'overlay' && (
                <button
                  type="button"
                  onClick={() => setActiveTab(null)}
                  className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-gray-100 hover:text-gray-600 transition-all flex items-center justify-center gap-2"
                >
                  <ChevronDown size={16} />
                  <span>收起设置面板</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-black selection:text-white overflow-hidden">
      {renderHeader()}
      
      <main 
        className={`fixed inset-0 pt-16 pb-16 overflow-hidden flex items-center justify-center ${
          pickingTarget ? 'cursor-crosshair' : ''
        }`}
      >
        <div className={`w-full h-full overflow-auto p-4 md:p-12 flex flex-col items-center justify-center custom-scrollbar`}>
          {image && cutoutConfig.creationMode === 'manual' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 px-4 py-1.5 bg-black/5 backdrop-blur-md rounded-full border border-black/5 flex items-center gap-2"
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
                <div className="absolute -inset-10 bg-black/5 blur-3xl rounded-full" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-80 h-56 border-2 border-dashed border-gray-200 rounded-[3rem] flex flex-col items-center justify-center space-y-5 bg-white/80 hover:bg-white hover:border-black hover:shadow-2xl transition-all duration-500 group"
                >
                  <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center group-hover:bg-black group-hover:rotate-12 transition-all duration-500">
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
                y: activeTab ? -(window.innerHeight * 0.4) / 2 : 0
              }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`flex ${
                composition === 'block-bottom' ? 'flex-col' : 
                composition === 'block-top' ? 'flex-col-reverse' :
                composition === 'block-right' ? 'flex-row' : 'flex-row-reverse'
              } shadow-[0_40px_100px_-20px_rgba(0,0,0,0.2)] items-center gap-0 p-0 overflow-visible bg-white flex-shrink-0`}
              style={{ 
                width: (composition === 'block-bottom' || composition === 'block-top' ? image.width : image.width * 2) * zoom,
                height: (composition === 'block-bottom' || composition === 'block-top' ? image.height * 2 : image.height) * zoom
              }}
            >
              <div className="relative leading-[0]">
                <canvas 
                  ref={mainCanvasRef} 
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  className={`block p-0 m-0 border-none ${isDraggingImage ? 'cursor-grabbing' : 'cursor-grab'}`} 
                  style={{ width: image.width * zoom, height: image.height * zoom }}
                />
                {selectedId && (() => {
                  const c = cutouts.find((x) => x.id === selectedId);
                  if (!c) return null;
                  const iw = image.width;
                  const currentSize =
                    (cutoutConfig.baseSize + c.sizeFactor * cutoutConfig.variation * 10) * (iw / 800);
                  const boxPx = currentSize * zoom;
                  const handleCls =
                    'absolute w-4 h-4 bg-white border-2 border-black rounded-full shadow-md pointer-events-auto touch-none z-20';
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
              <div className="relative leading-[0]">
                <canvas
                  ref={blockCanvasRef}
                  onMouseDown={handleBlockCanvasMouseDown}
                  className="block p-0 m-0 border-none cursor-crosshair"
                  style={{ width: image.width * zoom, height: image.height * zoom }}
                />
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
