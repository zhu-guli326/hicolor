export type BatchBaseShape = 'circle' | 'square' | 'star' | 'heart' | 'drop' | 'snowflake';

export type BatchSceneCutout = {
  x: number;
  y: number;
  sizeFactor: number;
};

type BatchShapeRenderer = (
  ctx: CanvasRenderingContext2D,
  shape: BatchBaseShape,
  size: number
) => void;

export type CutoutPlacement = {
  centerX: number;
  centerY: number;
  size: number;
};

type BatchSceneOptions = {
  ctx: CanvasRenderingContext2D;
  cutouts: BatchSceneCutout[];
  phase: number;
  sampleColor: (x: number, y: number) => string;
  cutoutConfig: {
    baseSize: number;
    variation: number;
  };
  width: number;
  height: number;
  drawShape: BatchShapeRenderer;
};

const BATCH_SHAPE_SEQUENCE: BatchBaseShape[] = [
  'circle',
  'square',
  'star',
  'drop',
  'snowflake',
  'heart',
];

export const BATCH_SWITCHES_PER_SECOND = 2.8;
export const BATCH_FRAME_MS = 1000 / 30;
export const BATCH_PROGRESS_STEP = (BATCH_FRAME_MS / 1000) * BATCH_SWITCHES_PER_SECOND;
export const PULSE_REVEAL_INTERVAL_MS = 160;
export const RAIN_ICON_SCALE = 1.5;
export const RAIN_SPEED_MULTIPLIER = 1.5;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getBatchShapeSignature(step: number, index: number) {
  const seed = step * 97 + index * 37;
  const normalizedIndex =
    ((seed % BATCH_SHAPE_SEQUENCE.length) + BATCH_SHAPE_SEQUENCE.length) %
    BATCH_SHAPE_SEQUENCE.length;
  return {
    shape: BATCH_SHAPE_SEQUENCE[normalizedIndex],
    angle: ((seed * 23.417) % 360) * (Math.PI / 180),
    offsetX: Math.sin(seed * 0.61) * 0.72,
    offsetY: Math.cos(seed * 0.47) * 0.72,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeVector(x: number, y: number) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function getBatchSceneVisibleCutouts(cutouts: BatchSceneCutout[], sceneStep: number) {
  if (cutouts.length === 0) return [];

  const maxCount = Math.min(12, cutouts.length);
  const minCount = Math.min(4, maxCount);
  const span = Math.max(1, maxCount - minCount + 1);
  const visibleCount = minCount + (((sceneStep * 3) % span) + span) % span;
  const startIndex = (((sceneStep * 2) % cutouts.length) + cutouts.length) % cutouts.length;

  return Array.from({ length: visibleCount }, (_, i) => cutouts[(startIndex + i) % cutouts.length]);
}

function getBatchSceneAnchor(
  sceneStep: number,
  index: number,
  count: number,
  width: number,
  height: number
) {
  const cols = Math.max(2, Math.ceil(Math.sqrt(count * 1.2)));
  const rows = Math.max(2, Math.ceil(count / cols));
  const cellIndex = (index * 5 + sceneStep * 3) % (cols * rows);
  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols) % rows;
  const cellW = width / cols;
  const cellH = height / rows;
  const jitterSeed = sceneStep * 131 + index * 17;
  const jitterX = Math.sin(jitterSeed * 0.73) * cellW * 0.18;
  const jitterY = Math.cos(jitterSeed * 0.61) * cellH * 0.18;

  return {
    x: cellW * (col + 0.5) + jitterX,
    y: cellH * (row + 0.5) + jitterY,
  };
}

function renderBatchScene(
  ctx: CanvasRenderingContext2D,
  cutouts: BatchSceneCutout[],
  sceneStep: number,
  phase: number,
  sampleColor: (x: number, y: number) => string,
  cutoutConfig: {
    baseSize: number;
    variation: number;
  },
  width: number,
  height: number,
  drawShape: BatchShapeRenderer
) {
  const scenePulse = 0.94 + Math.sin(phase * Math.PI * 2) * 0.06;
  const visibleCutouts = getBatchSceneVisibleCutouts(cutouts, sceneStep);
  const sceneShiftX = Math.sin(sceneStep * 0.83) * width * 0.08;
  const sceneShiftY = Math.cos(sceneStep * 0.67) * height * 0.08;
  const placedShapes: Array<{ x: number; y: number; size: number }> = [];

  ctx.save();
  visibleCutouts.forEach((cutout, index) => {
    const signature = getBatchShapeSignature(sceneStep, index);
    const size =
      (cutoutConfig.baseSize + cutout.sizeFactor * cutoutConfig.variation * 10) *
      (width / 800) *
      1.22 *
      scenePulse;
    const anchor = getBatchSceneAnchor(sceneStep, index, visibleCutouts.length, width, height);

    let centerX = anchor.x + sceneShiftX + signature.offsetX * size * 0.55;
    let centerY = anchor.y + sceneShiftY + signature.offsetY * size * 0.55;

    const minX = size * 0.6;
    const maxX = width - size * 0.6;
    const minY = size * 0.6;
    const maxY = height - size * 0.6;

    for (let attempt = 0; attempt < 16; attempt++) {
      centerX = clamp(centerX, minX, maxX);
      centerY = clamp(centerY, minY, maxY);

      let collided = false;
      for (const placed of placedShapes) {
        const dx = centerX - placed.x;
        const dy = centerY - placed.y;
        const minDistance = (size + placed.size) * 0.72;
        const distance = Math.hypot(dx, dy);

        if (distance < minDistance) {
          collided = true;
          const push = minDistance - distance + 2;
          const direction =
            distance < 1
              ? normalizeVector(
                  Math.sin((sceneStep + 1) * (index + 1) * 1.37),
                  Math.cos((sceneStep + 1) * (index + 1) * 0.91)
                )
              : normalizeVector(dx, dy);
          centerX += direction.x * push;
          centerY += direction.y * push;
        }
      }

      if (!collided) break;
    }

    centerX = clamp(centerX, minX, maxX);
    centerY = clamp(centerY, minY, maxY);
    placedShapes.push({ x: centerX, y: centerY, size });

    const color = sampleColor(cutout.x, cutout.y);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(signature.angle);
    ctx.fillStyle = color;
    drawShape(ctx, signature.shape, size);
    ctx.restore();
  });
  ctx.restore();
}

export function resolveNonOverlappingCutoutPlacements(options: {
  cutouts: BatchSceneCutout[];
  width: number;
  height: number;
  baseSize: number;
  variation: number;
  limit?: number;
  sceneStep?: number;
}) {
  const { cutouts, width, height, baseSize, variation, limit = cutouts.length, sceneStep = 0 } = options;
  const visibleCutouts = cutouts.slice(0, limit);
  const placements: CutoutPlacement[] = [];

  visibleCutouts.forEach((cutout, index) => {
    const size = (baseSize + cutout.sizeFactor * variation * 10) * (width / 800);
    const anchor = getBatchSceneAnchor(sceneStep, index, visibleCutouts.length, width, height);
    let centerX = anchor.x;
    let centerY = anchor.y;

    const minX = size * 0.65;
    const maxX = width - size * 0.65;
    const minY = size * 0.65;
    const maxY = height - size * 0.65;

    for (let attempt = 0; attempt < 20; attempt++) {
      centerX = clamp(centerX, minX, maxX);
      centerY = clamp(centerY, minY, maxY);

      let collided = false;
      for (const placed of placements) {
        const dx = centerX - placed.centerX;
        const dy = centerY - placed.centerY;
        const minDistance = (size + placed.size) * 0.82;
        const distance = Math.hypot(dx, dy);

        if (distance < minDistance) {
          collided = true;
          const push = minDistance - distance + 4;
          const direction =
            distance < 1
              ? normalizeVector(
                  Math.sin((sceneStep + 3) * (index + 2) * 1.11),
                  Math.cos((sceneStep + 5) * (index + 4) * 0.97)
                )
              : normalizeVector(dx, dy);
          centerX += direction.x * push;
          centerY += direction.y * push;
        }
      }

      if (!collided) break;
    }

    centerX = clamp(centerX, minX, maxX);
    centerY = clamp(centerY, minY, maxY);
    placements.push({ centerX, centerY, size });
  });

  return placements;
}

export function renderBatchSceneTransition({
  ctx,
  cutouts,
  phase,
  sampleColor,
  cutoutConfig,
  width,
  height,
  drawShape,
}: BatchSceneOptions) {
  const step = Math.floor(phase);
  const localPhase = phase - step;
  const activeStep = localPhase < 0.5 ? step : step + 1;
  const scenePulse = localPhase < 0.5 ? localPhase * 2 : (1 - localPhase) * 2;
  renderBatchScene(
    ctx,
    cutouts,
    activeStep,
    easeInOutCubic(scenePulse),
    sampleColor,
    cutoutConfig,
    width,
    height,
    drawShape
  );
}
