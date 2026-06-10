export type StockFocus = {
  symbol: string;
  name: string;
  sector?: string;
  changePercent: number;
  volumeRatio: number;
  totalScore?: number;
  relativeStrengthScore?: number;
  breakoutScore?: number;
  trendStrengthScore?: number;
  newsImpactScore?: number;
  reason: string;
};

export type WatchlistItem = {
  symbol: string;
  name: string;
  note: string;
  changePercent?: number;
};

export type MarketReport = {
  id?: string;
  reportDate: string;
  session: "morning" | "closing";
  marketMood: "Bullish" | "Bearish" | "Sideways";
  marketMoodDetails?: MarketMoodDetails;
  sectorInFocus: string;
  stocksInFocus: StockFocus[];
  extremeMovementAlerts: StockFocus[];
  watchlist: WatchlistItem[];
  summary: string;
  createdAt?: string;
};

export type MarketMoodDetails = {
  mood: MarketReport["marketMood"];
  score: number;
  niftyTrendScore: number;
  bankNiftyTrendScore: number;
  indiaVixScore: number;
  advanceDeclineScore: number;
  advanceDeclineRatio: number;
  niftyValue?: number;
  niftyChangePercent?: number;
  bankNiftyValue?: number;
  bankNiftyChangePercent?: number;
  indiaVixValue?: number;
  indiaVixChangePercent?: number;
  explanation: string;
};

export type SectorScore = {
  id?: string;
  reportId?: string;
  reportDate: string;
  session: "morning" | "closing";
  rank: number;
  sector: string;
  symbol: string;
  sectorScore: number;
  relativeStrengthScore: number;
  momentumScore: number;
  trendScore: number;
  oneDayChangePercent: number;
  fiveDayChangePercent: number;
  twentyDayChangePercent: number;
};

export type StockScore = {
  id?: string;
  reportId?: string;
  reportDate: string;
  session: "morning" | "closing";
  rank: number;
  symbol: string;
  name: string;
  sector: string;
  totalScore: number;
  relativeStrengthScore: number;
  volumeSpikeScore: number;
  breakoutScore: number;
  trendStrengthScore: number;
  newsImpactScore: number;
  oneDayChangePercent: number;
  fiveDayChangePercent: number;
  twentyDayChangePercent: number;
  volumeRatio: number;
  breakoutPercent: number;
  researchNote: string;
};

export type DashboardReportSummary = {
  id?: string;
  reportDate: string;
  session: "morning" | "closing";
  marketMood: MarketReport["marketMood"];
  sectorInFocus: string;
  createdAt?: string;
};

export type DashboardData = {
  report: MarketReport;
  sectorScores: SectorScore[];
  stockScores: StockScore[];
  recentReports: DashboardReportSummary[];
  isFallback?: boolean;
};

export type AlertPriority = "Critical" | "High" | "Medium" | "Low";

export type NotificationStatus = "created" | "sent" | "failed" | "duplicate" | "skipped";

export type NotificationHistoryItem = {
  id: string;
  reportId?: string | null;
  alertKey: string;
  priority: AlertPriority;
  title: string;
  reason: string;
  sector: string;
  stocksAffected: string[];
  alertType: string;
  triggerValue: number;
  thresholdValue: number;
  notificationStatus: NotificationStatus;
  sentCount: number;
  failedCount: number;
  errorMessage?: string | null;
  triggeredAt: string;
  createdAt: string;
};

export type NotificationAnalytics = {
  total: number;
  byPriority: Record<AlertPriority, number>;
  byStatus: Record<NotificationStatus, number>;
  recent: NotificationHistoryItem[];
  isFallback?: boolean;
};

export type WatchlistStock = {
  id: string;
  symbol: string;
  name: string;
  isTracked: boolean;
  trendScore: number;
  momentumScore: number;
  relativeStrengthScore: number;
  volumeScore: number;
  healthScore: number;
  oneDayChangePercent: number;
  fiveDayChangePercent: number;
  twentyDayChangePercent: number;
  volumeRatio: number;
  latestClose: number;
  researchNote: string;
  lastScannedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WatchlistDashboardData = {
  stocks: WatchlistStock[];
  healthScore: number;
  trackedCount: number;
  isFallback?: boolean;
};
