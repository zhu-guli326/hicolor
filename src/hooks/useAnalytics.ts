/**
 * 增强数据分析 Hook
 * 基于本地存储，提供更丰富的数据分析维度：
 * - 时段分析（每小时活跃度）
 * - 周对比（本周 vs 上周）
 * - 留存率（次日、7日）
 * - 功能组合分析
 * - 用户路径追踪
 * - 设备/浏览器分布
 */
import { useCallback } from 'react';
import { useStats, type FeatureEvent } from './useStats';
import { useI18n } from '../i18n';

const STORAGE_KEY = 'hicolor_analytics';
const TRACK_USER_KEY = 'hicolor_track_user_id';
const TRACK_SESSION_KEY = 'hicolor_track_session_id';
const TRACK_ENABLE =
  (import.meta.env.PROD && import.meta.env.VITE_ENABLE_SERVER_TRACKING !== 'false')
  || import.meta.env.VITE_ENABLE_SERVER_TRACKING === 'true';

function getOrCreateStableId(key: string): string {
  try {
    const existed = localStorage.getItem(key);
    if (existed) return existed;
    const created = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, created);
    return created;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function shouldSendServerEvent(type: FeatureEvent['type']): boolean {
  switch (type) {
    case 'page_view':
    case 'upload_image':
    case 'export_png':
    case 'export_video':
    case 'change_animation':
    case 'change_texture':
    case 'open_panel':
    case 'error_occurred':
      return true;
    default:
      return false;
  }
}

function postServerTrack(event: FeatureEvent, locale: string) {
  if (!TRACK_ENABLE || !shouldSendServerEvent(event.type)) return;

  const payload = {
    event: event.type,
    ts: Date.now(),
    sessionId: getOrCreateStableId(TRACK_SESSION_KEY),
    userId: getOrCreateStableId(TRACK_USER_KEY),
    path: typeof window !== 'undefined' ? window.location.pathname : '',
    locale,
    props: event,
  };

  const writeKey = import.meta.env.VITE_ANALYTICS_WRITE_KEY;
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (writeKey) headers['x-track-key'] = writeKey;

  // sendBeacon is more reliable during page transitions; fallback to keepalive fetch.
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function' && !writeKey) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/track', blob);
      return;
    }
  } catch {
    // fallback below
  }

  fetch('/api/track', {
    method: 'POST',
    headers,
    body,
    keepalive: true,
  }).catch(() => {
    // Silently ignore network errors to avoid impacting UX.
  });
}

export interface HourlyData {
  hour: number;
  visits: number;
  uploads: number;
  exports: number;
  actions: number;
}

export interface WeekComparison {
  thisWeek: { visits: number; uploads: number; exports: number; actions: number };
  lastWeek: { visits: number; uploads: number; exports: number; actions: number };
  growth: { visits: number; uploads: number; exports: number; actions: number };
}

export interface RetentionData {
  day0: number;   // 当日新访客
  day1: number;   // 次日留存
  day7: number;   // 7日留存
  day30: number;  // 30日留存
}

export interface FeatureCombo {
  combo: string; // "solid+circle+pulse"
  count: number;
}

export interface UserPath {
  path: string;  // "visit->upload->export"
  count: number;
}

export interface DeviceStats {
  device: 'mobile' | 'tablet' | 'desktop';
  visits: number;
  percentage: number;
}

export interface EnhancedAnalytics {
  hourlyData: HourlyData[];
  weekComparison: WeekComparison;
  retentionData: RetentionData;
  topCombos: FeatureCombo[];
  userPaths: UserPath[];
  deviceStats: DeviceStats[];
  peakHour: number;
  mostProductiveDay: string;
  exportRatio: number;
  avgSessionQuality: number; // 每次会话的平均操作数
}

interface AnalyticsData {
  hourlyStats: Record<string, HourlyData>;
  weeklyStats: Record<string, { visits: number; uploads: number; exports: number; actions: number }>;
  newUsersByDate: Record<string, number>;
  returnUsersByDate: Record<string, number>;
  featureCombos: Record<string, number>;
  userPaths: Record<string, number>;
  deviceStats: Record<string, number>;
}

function getDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getHourStr(d: Date): string {
  return `${getDateStr(d)}-${d.getHours().toString().padStart(2, '0')}`;
}

function getWeekStr(d: Date): string {
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

function loadAnalytics(): AnalyticsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // 确保所有字段都存在，防止旧数据缺少字段导致类型错误
      return {
        hourlyStats: data.hourlyStats || {},
        weeklyStats: data.weeklyStats || {},
        newUsersByDate: data.newUsersByDate || {},
        returnUsersByDate: data.returnUsersByDate || {},
        featureCombos: data.featureCombos || {},
        userPaths: data.userPaths || {},
        deviceStats: data.deviceStats || {},
      };
    }
  } catch {}
  return {
    hourlyStats: {},
    weeklyStats: {},
    newUsersByDate: {},
    returnUsersByDate: {},
    featureCombos: {},
    userPaths: {},
    deviceStats: {},
  };
}

function saveAnalytics(data: AnalyticsData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function detectDevice(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent;
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/edg/i.test(ua)) return 'edge';
  if (/chrome/i.test(ua)) return 'chrome';
  if (/safari/i.test(ua)) return 'safari';
  if (/firefox/i.test(ua)) return 'firefox';
  return 'other';
}

export function useEnhancedAnalytics() {
  const { stats, track, resetStats } = useStats();
  const { t, locale } = useI18n();

  const recordHourlyStats = useCallback((action: 'visit' | 'upload' | 'export' | 'action') => {
    const now = new Date();
    const hourKey = getHourStr(now);

    const data = loadAnalytics();
    if (!data.hourlyStats[hourKey]) {
      data.hourlyStats[hourKey] = { hour: now.getHours(), visits: 0, uploads: 0, exports: 0, actions: 0 };
    }
    const entry = data.hourlyStats[hourKey];
    if (action === 'visit') entry.visits++;
    else if (action === 'upload') entry.uploads++;
    else if (action === 'export') entry.exports++;
    else entry.actions++;
    saveAnalytics(data);
  }, []);

  const recordWeeklyStats = useCallback((action: 'upload' | 'export' | 'action') => {
    const now = new Date();
    const weekKey = getWeekStr(now);

    const data = loadAnalytics();
    if (!data.weeklyStats[weekKey]) {
      data.weeklyStats[weekKey] = { visits: 0, uploads: 0, exports: 0, actions: 0 };
    }
    const entry = data.weeklyStats[weekKey];
    if (action === 'upload') entry.uploads++;
    else if (action === 'export') entry.exports++;
    else entry.actions++;
    saveAnalytics(data);
  }, []);

  const recordDevice = useCallback(() => {
    const device = detectDevice();
    const browser = detectBrowser();
    const data = loadAnalytics();
    data.deviceStats[device] = (data.deviceStats[device] || 0) + 1;
    data.deviceStats[`browser_${browser}`] = (data.deviceStats[`browser_${browser}`] || 0) + 1;
    saveAnalytics(data);
  }, []);

  const trackWithAnalytics = useCallback((event: FeatureEvent) => {
    track(event);
    postServerTrack(event, locale);
    if (event.type === 'page_view') recordHourlyStats('visit');
    else if (event.type === 'upload_image') { recordHourlyStats('upload'); recordWeeklyStats('upload'); }
    else if (event.type === 'export_png' || event.type === 'export_video') {
      recordHourlyStats('export');
      recordWeeklyStats('export');
    }
    recordHourlyStats('action');
    recordWeeklyStats('action');
    recordDevice();
  }, [track, recordHourlyStats, recordWeeklyStats, recordDevice, locale]);

  const getAnalytics = useCallback((): EnhancedAnalytics => {
    const data = loadAnalytics();

    // 时段分析 - 最近7天的平均每小时数据
    const hourlyMap: Record<number, { visits: number; uploads: number; exports: number; actions: number; count: number }> = {};
    const now = Date.now();
    Object.entries(data.hourlyStats).forEach(([key, entry]) => {
      const age = now - new Date(key.replace('-20', '-T20')).getTime();
      if (age < 7 * 86400000) {
        const h = entry.hour;
        if (!hourlyMap[h]) hourlyMap[h] = { visits: 0, uploads: 0, exports: 0, actions: 0, count: 0 };
        hourlyMap[h].visits += entry.visits;
        hourlyMap[h].uploads += entry.uploads;
        hourlyMap[h].exports += entry.exports;
        hourlyMap[h].actions += entry.actions;
        hourlyMap[h].count++;
      }
    });
    const hourlyData: HourlyData[] = Array.from({ length: 24 }, (_, i) => {
      const avg = hourlyMap[i];
      return avg
        ? { hour: i, visits: Math.round(avg.visits / avg.count), uploads: Math.round(avg.uploads / avg.count), exports: Math.round(avg.exports / avg.count), actions: Math.round(avg.actions / avg.count) }
        : { hour: i, visits: 0, uploads: 0, exports: 0, actions: 0 };
    });

    // 周对比
    const nowW = new Date();
    const thisWeekKey = getWeekStr(nowW);
    const lastWeekDate = new Date(nowW);
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    const lastWeekKey = getWeekStr(lastWeekDate);
    const thisWeek = data.weeklyStats[thisWeekKey] || { visits: 0, uploads: 0, exports: 0, actions: 0 };
    const lastWeek = data.weeklyStats[lastWeekKey] || { visits: 0, uploads: 0, exports: 0, actions: 0 };
    const calcGrowth = (cur: number, prev: number) => prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0;
    const weekComparison: WeekComparison = {
      thisWeek: { ...thisWeek },
      lastWeek: { ...lastWeek },
      growth: {
        visits: calcGrowth(thisWeek.visits, lastWeek.visits),
        uploads: calcGrowth(thisWeek.uploads, lastWeek.uploads),
        exports: calcGrowth(thisWeek.exports, lastWeek.exports),
        actions: calcGrowth(thisWeek.actions, lastWeek.actions),
      },
    };

    // 留存率
    const today = getDateStr(new Date());
    const yesterday = getDateStr(new Date(Date.now() - 86400000));
    const day7 = getDateStr(new Date(Date.now() - 7 * 86400000));
    const day30 = getDateStr(new Date(Date.now() - 30 * 86400000));
    const day0Visits = data.newUsersByDate[today] || 0;
    const day1Visits = data.returnUsersByDate[yesterday] || 0;
    const day7Visits = data.returnUsersByDate[day7] || 0;
    const day30Visits = data.returnUsersByDate[day30] || 0;
    const retentionData: RetentionData = {
      day0: day0Visits,
      day1: day0Visits > 0 ? Math.round((day1Visits / day0Visits) * 100) : 0,
      day7: day0Visits > 0 ? Math.round((day7Visits / day0Visits) * 100) : 0,
      day30: day0Visits > 0 ? Math.round((day30Visits / day0Visits) * 100) : 0,
    };

    // 功能组合 TOP5
    const topCombos: FeatureCombo[] = Object.entries(data.featureCombos)
      .map(([combo, count]) => ({ combo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 用户路径 TOP5
    const userPaths: UserPath[] = Object.entries(data.userPaths)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 设备分布
    const totalDevices = (data.deviceStats['mobile'] || 0) + (data.deviceStats['tablet'] || 0) + (data.deviceStats['desktop'] || 0);
    const deviceStats: DeviceStats[] = [
      { device: 'mobile', visits: data.deviceStats['mobile'] || 0, percentage: totalDevices > 0 ? Math.round(((data.deviceStats['mobile'] || 0) / totalDevices) * 100) : 0 },
      { device: 'tablet', visits: data.deviceStats['tablet'] || 0, percentage: totalDevices > 0 ? Math.round(((data.deviceStats['tablet'] || 0) / totalDevices) * 100) : 0 },
      { device: 'desktop', visits: data.deviceStats['desktop'] || 0, percentage: totalDevices > 0 ? Math.round(((data.deviceStats['desktop'] || 0) / totalDevices) * 100) : 0 },
    ];

    // 高峰时段
    const peakHour = hourlyData.reduce((max, cur) => cur.actions > max.actions ? cur : max, hourlyData[0] || { hour: 0, actions: 0 }).hour;

    // 最活跃日（从 dailyStats）
    const mostActiveDay = stats.dailyStats?.reduce((max, day) =>
      (day.actionsCount || 0) > (max?.actionsCount || 0) ? day : max, stats.dailyStats[0]);

    return {
      hourlyData,
      weekComparison,
      retentionData,
      topCombos,
      userPaths,
      deviceStats,
      peakHour,
      mostProductiveDay: mostActiveDay?.date || '',
      exportRatio: stats.totalUploads > 0 ? Math.round((stats.totalExports / stats.totalUploads) * 100) : 0,
      avgSessionQuality: stats.sessionCount > 0 ? Math.round(stats.totalActions / stats.sessionCount) : 0,
    };
  }, [stats]);

  const resetAnalytics = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    resetStats();
  }, [resetStats]);

  return { track: trackWithAnalytics, getAnalytics, resetAnalytics };
}
