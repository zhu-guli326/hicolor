import React, { useState, useCallback, useRef } from 'react';

/**
 * useStats - 本地使用统计 Hook
 * 记录访问次数、功能使用频率、会话行为，所有数据存储在 localStorage 中
 */

export type FeatureEvent =
  | { type: 'page_view' }
  | { type: 'upload_image' }
  | { type: 'export_png' }
  | { type: 'export_video' }
  | { type: 'open_panel'; panel: 'background' | 'elements' | 'video' | 'stats' }
  | { type: 'close_panel' }
  | { type: 'change_bg_type'; bgType: string }
  | { type: 'change_bg_color'; color: string; index: number }
  | { type: 'change_gradient'; gradientType: string }
  | { type: 'change_composition'; composition: string }
  | { type: 'change_shape_kind'; shapeKind: string }
  | { type: 'change_distribution_mode'; mode: string }
  | { type: 'change_creation_mode'; mode: string }
  | { type: 'change_animation'; animation: string }
  | { type: 'play_animation' }
  | { type: 'stop_animation' }
  | { type: 'generate_cutouts' }
  | { type: 'clear_cutouts' }
  | { type: 'add_text_overlay'; textLength: number }
  | { type: 'remove_text_overlay' }
  | { type: 'change_texture'; textureType: string }
  | { type: 'change_shape_color'; color: string }
  | { type: 'change_shape_size'; size: number }
  | { type: 'change_shape_count'; count: number }
  | { type: 'change_seed'; seed: number }
  | { type: 'regenerate_cutouts' }
  | { type: 'start_session' }
  | { type: 'end_session' }
  | { type: 'error_occurred'; errorType: string }
  | { type: 'change_bg_image' }
  | { type: 'adjust_opacity'; layer: string; value: number }
  | { type: 'save_to_favorites' }
  | { type: 'share_creation' };

interface FeatureCounts {
  [key: string]: number;
}

interface DailyStats {
  date: string;
  visitCount: number;
  uploads: number;
  exports: number;
  videoExports: number;
  sessionMinutes: number;
  actionsCount: number;
}

export interface Stats {
  visitCount: number;
  lastVisit: string;
  totalUploads: number;
  totalExports: number;
  totalVideoExports: number;
  featureCounts: FeatureCounts;
  bgTypeUsage: FeatureCounts;
  shapeKindUsage: FeatureCounts;
  animationUsage: FeatureCounts;
  compositionUsage: FeatureCounts;
  distributionModeUsage: FeatureCounts;
  creationModeUsage: FeatureCounts;
  textureUsage: FeatureCounts;
  bgColorUsage: FeatureCounts;
  shapeColorUsage: FeatureCounts;
  gradientUsage: FeatureCounts;
  sessionCount: number;
  totalSessionMinutes: number;
  avgSessionMinutes: number;
  longestSessionMinutes: number;
  dailyStats: DailyStats[];
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  totalActions: number;
  avgActionsPerSession: number;
  uploadSuccessRate: number;
  exportSuccessRate: number;
  mostUsedBgColor: string;
  mostUsedShapeColor: string;
  mostUsedFeature: string;
  creationFavorites: number;
  shares: number;
  errorsCount: number;
}

interface SessionData {
  startTime: number;
  actions: number;
  uploads: number;
  exports: number;
}

const STORAGE_KEY = 'hicolor_stats';

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stats = JSON.parse(raw) as Stats;
      return updateStreak(stats);
    }
  } catch {
    // ignore parse errors
  }
  return createDefaultStats();
}

function createDefaultStats(): Stats {
  return {
    visitCount: 0,
    lastVisit: '',
    totalUploads: 0,
    totalExports: 0,
    totalVideoExports: 0,
    featureCounts: {},
    bgTypeUsage: {},
    shapeKindUsage: {},
    animationUsage: {},
    compositionUsage: {},
    distributionModeUsage: {},
    creationModeUsage: {},
    textureUsage: {},
    bgColorUsage: {},
    shapeColorUsage: {},
    gradientUsage: {},
    sessionCount: 0,
    totalSessionMinutes: 0,
    avgSessionMinutes: 0,
    longestSessionMinutes: 0,
    dailyStats: [],
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    totalActions: 0,
    avgActionsPerSession: 0,
    uploadSuccessRate: 100,
    exportSuccessRate: 100,
    mostUsedBgColor: '',
    mostUsedShapeColor: '',
    mostUsedFeature: '',
    creationFavorites: 0,
    shares: 0,
    errorsCount: 0,
  };
}

function updateStreak(stats: Stats): Stats {
  const today = getToday();
  const yesterday = getDaysAgo(1);
  let currentStreak = stats.currentStreak || 0;
  let longestStreak = stats.longestStreak || 0;

  if (stats.lastActiveDate === today) {
    // Already updated today
  } else if (stats.lastActiveDate === yesterday) {
    currentStreak += 1;
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
  } else if (stats.lastActiveDate && stats.lastActiveDate !== today) {
    currentStreak = 1;
  }

  return {
    ...stats,
    currentStreak,
    longestStreak,
    lastActiveDate: today,
  };
}

function saveStats(stats: Stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore storage errors
  }
}

function updateDailyStats(stats: Stats): Stats {
  const today = getToday();
  const dailyStats = stats.dailyStats ? [...stats.dailyStats] : [];
  let todayStats = dailyStats.find(d => d.date === today);

  if (!todayStats) {
    todayStats = {
      date: today,
      visitCount: 0,
      uploads: 0,
      exports: 0,
      videoExports: 0,
      sessionMinutes: 0,
      actionsCount: 0,
    };
    dailyStats.push(todayStats);
  }

  // Keep only last 30 days
  const thirtyDaysAgo = getDaysAgo(30);
  const filteredStats = dailyStats.filter(d => d.date >= thirtyDaysAgo);

  return { ...stats, dailyStats: filteredStats };
}

function getMostUsedKey(usage: FeatureCounts): string {
  const entries = Object.entries(usage);
  if (entries.length === 0) return '';
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

function getMostUsedFeature(featureCounts: FeatureCounts): string {
  const entries = Object.entries(featureCounts);
  if (entries.length === 0) return '';
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

export function useStats() {
  const [stats, setStats] = useState<Stats>(() => {
    const loadedStats = loadStats();
    const initialStats: Stats = {
      ...loadedStats,
      visitCount: (loadedStats.visitCount || 0) + 1,
      lastVisit: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    };
    const updated = updateDailyStats(initialStats);
    const today = getToday();
    const todayStats = updated.dailyStats.find(d => d.date === today);
    if (todayStats) {
      todayStats.visitCount = (todayStats.visitCount || 0) + 1;
    }
    saveStats(updated);
    return updated;
  });

  const sessionRef = useRef<SessionData>({
    startTime: Date.now(),
    actions: 0,
    uploads: 0,
    exports: 0,
  });

  const track = useCallback((event: FeatureEvent) => {
    setStats((prev) => {
      // 使用 updateDailyStats 返回新的 dailyStats
      const updatedResult = updateDailyStats(prev);
      const next = {
        ...prev,
        dailyStats: updatedResult.dailyStats,
      };
      const todayStats = next.dailyStats.find(d => d.date === getToday())!;
      // 创建 todayStats 的副本以避免直接修改
      const todayStatsCopy = todayStats ? { ...todayStats } : null;
      if (!todayStatsCopy) return next;

      next.totalActions = (next.totalActions || 0) + 1;
      todayStatsCopy.actionsCount = (todayStatsCopy.actionsCount || 0) + 1;

      switch (event.type) {
        case 'upload_image':
          next.totalUploads = (next.totalUploads || 0) + 1;
          todayStatsCopy.uploads = (todayStatsCopy.uploads || 0) + 1;
          next.featureCounts = { ...next.featureCounts, upload_image: (next.featureCounts['upload_image'] || 0) + 1 };
          sessionRef.current.uploads += 1;
          break;

        case 'export_png':
          next.totalExports = (next.totalExports || 0) + 1;
          todayStatsCopy.exports = (todayStatsCopy.exports || 0) + 1;
          next.featureCounts = { ...next.featureCounts, export_png: (next.featureCounts['export_png'] || 0) + 1 };
          sessionRef.current.exports += 1;
          break;

        case 'export_video':
          next.totalVideoExports = (next.totalVideoExports || 0) + 1;
          todayStatsCopy.videoExports = (todayStatsCopy.videoExports || 0) + 1;
          next.featureCounts = { ...next.featureCounts, export_video: (next.featureCounts['export_video'] || 0) + 1 };
          break;

        case 'change_bg_type':
          next.bgTypeUsage = { ...next.bgTypeUsage, [event.bgType]: (next.bgTypeUsage[event.bgType] || 0) + 1 };
          next.featureCounts = { ...next.featureCounts, change_bg_type: (next.featureCounts['change_bg_type'] || 0) + 1 };
          next.mostUsedBgColor = getMostUsedKey(next.bgTypeUsage);
          break;

        case 'change_bg_color':
          next.bgColorUsage = { ...next.bgColorUsage, [event.color]: (next.bgColorUsage[event.color] || 0) + 1 };
          next.featureCounts = { ...next.featureCounts, change_bg_color: (next.featureCounts['change_bg_color'] || 0) + 1 };
          next.mostUsedBgColor = getMostUsedKey(next.bgColorUsage);
          break;

        case 'change_gradient':
          next.gradientUsage = { ...next.gradientUsage, [event.gradientType]: (next.gradientUsage[event.gradientType] || 0) + 1 };
          next.featureCounts = { ...next.featureCounts, change_gradient: (next.featureCounts['change_gradient'] || 0) + 1 };
          break;

        case 'change_composition':
          next.compositionUsage = { ...next.compositionUsage, [event.composition]: (next.compositionUsage[event.composition] || 0) + 1 };
          next.featureCounts = { ...next.featureCounts, change_composition: (next.featureCounts['change_composition'] || 0) + 1 };
          break;

        case 'change_shape_kind':
          next.shapeKindUsage = { ...next.shapeKindUsage, [event.shapeKind]: (next.shapeKindUsage[event.shapeKind] || 0) + 1 };
          next.featureCounts = { ...next.featureCounts, change_shape_kind: (next.featureCounts['change_shape_kind'] || 0) + 1 };
          break;

        case 'change_distribution_mode':
          next.distributionModeUsage = { ...next.distributionModeUsage, [event.mode]: (next.distributionModeUsage[event.mode] || 0) + 1 };
          next.featureCounts = { ...next.featureCounts, change_distribution_mode: (next.featureCounts['change_distribution_mode'] || 0) + 1 };
          break;

        case 'change_creation_mode':
          next.creationModeUsage = { ...next.creationModeUsage, [event.mode]: (next.creationModeUsage[event.mode] || 0) + 1 };
          next.featureCounts = { ...next.featureCounts, change_creation_mode: (next.featureCounts['change_creation_mode'] || 0) + 1 };
          break;

        case 'change_animation':
          next.animationUsage = { ...next.animationUsage, [event.animation]: (next.animationUsage[event.animation] || 0) + 1 };
          next.featureCounts = { ...next.featureCounts, change_animation: (next.featureCounts['change_animation'] || 0) + 1 };
          break;

        case 'change_texture':
          next.textureUsage = { ...next.textureUsage, [event.textureType]: (next.textureUsage[event.textureType] || 0) + 1 };
          next.featureCounts = { ...next.featureCounts, change_texture: (next.featureCounts['change_texture'] || 0) + 1 };
          break;

        case 'change_shape_color':
          next.shapeColorUsage = { ...next.shapeColorUsage, [event.color]: (next.shapeColorUsage[event.color] || 0) + 1 };
          next.featureCounts = { ...next.featureCounts, change_shape_color: (next.featureCounts['change_shape_color'] || 0) + 1 };
          next.mostUsedShapeColor = getMostUsedKey(next.shapeColorUsage);
          break;

        case 'play_animation':
          next.featureCounts = { ...next.featureCounts, play_animation: (next.featureCounts['play_animation'] || 0) + 1 };
          break;

        case 'stop_animation':
          next.featureCounts = { ...next.featureCounts, stop_animation: (next.featureCounts['stop_animation'] || 0) + 1 };
          break;

        case 'generate_cutouts':
          next.featureCounts = { ...next.featureCounts, generate_cutouts: (next.featureCounts['generate_cutouts'] || 0) + 1 };
          break;

        case 'clear_cutouts':
          next.featureCounts = { ...next.featureCounts, clear_cutouts: (next.featureCounts['clear_cutouts'] || 0) + 1 };
          break;

        case 'add_text_overlay':
          next.featureCounts = { ...next.featureCounts, add_text_overlay: (next.featureCounts['add_text_overlay'] || 0) + 1 };
          break;

        case 'remove_text_overlay':
          next.featureCounts = { ...next.featureCounts, remove_text_overlay: (next.featureCounts['remove_text_overlay'] || 0) + 1 };
          break;

        case 'regenerate_cutouts':
          next.featureCounts = { ...next.featureCounts, regenerate_cutouts: (next.featureCounts['regenerate_cutouts'] || 0) + 1 };
          break;

        case 'start_session':
          next.sessionCount = (next.sessionCount || 0) + 1;
          sessionRef.current.startTime = Date.now();
          sessionRef.current.actions = 0;
          sessionRef.current.uploads = 0;
          sessionRef.current.exports = 0;
          break;

        case 'end_session':
          const sessionDuration = Math.round((Date.now() - sessionRef.current.startTime) / 60000);
          next.totalSessionMinutes = (next.totalSessionMinutes || 0) + sessionDuration;
          next.avgSessionMinutes = Math.round(next.totalSessionMinutes / Math.max(next.sessionCount || 1, 1));
          if (sessionDuration > (next.longestSessionMinutes || 0)) {
            next.longestSessionMinutes = sessionDuration;
          }
          todayStatsCopy.sessionMinutes = (todayStatsCopy.sessionMinutes || 0) + sessionDuration;
          next.avgActionsPerSession = Math.round(next.totalActions / Math.max(next.sessionCount || 1, 1));
          break;

        case 'error_occurred':
          next.errorsCount = (next.errorsCount || 0) + 1;
          next.featureCounts = { ...next.featureCounts, [`error_${event.errorType}`]: (next.featureCounts[`error_${event.errorType}`] || 0) + 1 };
          break;

        case 'save_to_favorites':
          next.creationFavorites = (next.creationFavorites || 0) + 1;
          next.featureCounts = { ...next.featureCounts, save_to_favorites: (next.featureCounts['save_to_favorites'] || 0) + 1 };
          break;

        case 'share_creation':
          next.shares = (next.shares || 0) + 1;
          next.featureCounts = { ...next.featureCounts, share_creation: (next.featureCounts['share_creation'] || 0) + 1 };
          break;

        case 'change_bg_image':
          next.featureCounts = { ...next.featureCounts, change_bg_image: (next.featureCounts['change_bg_image'] || 0) + 1 };
          break;

        case 'adjust_opacity':
          next.featureCounts = { ...next.featureCounts, adjust_opacity: (next.featureCounts['adjust_opacity'] || 0) + 1 };
          break;

        default:
          next.featureCounts = { ...next.featureCounts, [event.type]: (next.featureCounts[event.type] || 0) + 1 };
      }

      // 更新 todayStatsCopy 中的统计值
      todayStatsCopy.actionsCount = (todayStatsCopy.actionsCount || 0) + 1;
      if (event.type === 'upload_image') {
        todayStatsCopy.uploads = (todayStatsCopy.uploads || 0) + 1;
      } else if (event.type === 'export_png') {
        todayStatsCopy.exports = (todayStatsCopy.exports || 0) + 1;
      } else if (event.type === 'export_video') {
        todayStatsCopy.videoExports = (todayStatsCopy.videoExports || 0) + 1;
      } else if (event.type === 'end_session') {
        const sessionDuration = Math.round((Date.now() - sessionRef.current.startTime) / 60000);
        todayStatsCopy.sessionMinutes = (todayStatsCopy.sessionMinutes || 0) + sessionDuration;
      }

      // 更新 dailyStats 中的 todayStats
      const today = getToday();
      next.dailyStats = next.dailyStats.map(d =>
        d.date === today ? todayStatsCopy : d
      );

      // Update success rates
      const totalUploads = next.totalUploads || 0;
      const failedUploads = next.featureCounts['upload_failed'] || 0;
      next.uploadSuccessRate = totalUploads > 0 ? Math.round(((totalUploads - failedUploads) / totalUploads) * 100) : 100;

      const totalExports = (next.totalExports || 0) + (next.totalVideoExports || 0);
      const failedExports = next.featureCounts['export_failed'] || 0;
      next.exportSuccessRate = totalExports > 0 ? Math.round(((totalExports - failedExports) / totalExports) * 100) : 100;

      // Update most used feature
      next.mostUsedFeature = getMostUsedFeature(next.featureCounts);

      saveStats(next);
      return next;
    });
  }, []);

  const resetStats = useCallback(() => {
    const fresh = createDefaultStats();
    saveStats(fresh);
    setStats(fresh);
  }, []);

  return { stats, track, resetStats };
}
