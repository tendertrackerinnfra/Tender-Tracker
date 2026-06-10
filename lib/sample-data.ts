import type { DashboardData, MarketReport, NotificationAnalytics, SectorScore, StockScore } from "@/lib/types";

export const sampleReport: MarketReport = {
  reportDate: new Date().toISOString().slice(0, 10),
  session: "morning",
  marketMood: "Sideways",
  marketMoodDetails: {
    mood: "Sideways",
    score: 51.2,
    niftyTrendScore: 48.5,
    bankNiftyTrendScore: 55.1,
    indiaVixScore: 58.4,
    advanceDeclineScore: 46.9,
    advanceDeclineRatio: 0.92,
    niftyValue: 24850.4,
    niftyChangePercent: 0.18,
    bankNiftyValue: 52310.7,
    bankNiftyChangePercent: 0.31,
    indiaVixValue: 14.2,
    indiaVixChangePercent: -2.4,
    explanation: "Sample data shown until Supabase is configured or a scanner report is saved."
  },
  sectorInFocus: "Banks and IT services",
  summary:
    "Index trend, volatility, and monitored breadth point to a balanced research watch. Track liquidity, index breadth, and earnings/news catalysts before drawing conclusions.",
  stocksInFocus: [
    {
      symbol: "RELIANCE.NS",
      name: "Reliance Industries",
      changePercent: 1.8,
      volumeRatio: 1.4,
      reason: "Large-cap index weight with above-average participation."
    },
    {
      symbol: "INFY.NS",
      name: "Infosys",
      changePercent: -1.1,
      volumeRatio: 1.2,
      reason: "IT sector sensitivity to global risk cues."
    }
  ],
  extremeMovementAlerts: [
    {
      symbol: "TATAMOTORS.NS",
      name: "Tata Motors",
      changePercent: 4.9,
      volumeRatio: 2.1,
      reason: "Sharp move with elevated volume versus recent average."
    }
  ],
  watchlist: [
    {
      symbol: "HDFCBANK.NS",
      name: "HDFC Bank",
      note: "Monitor bank-sector breadth and news flow.",
      changePercent: 0.4
    },
    {
      symbol: "SUNPHARMA.NS",
      name: "Sun Pharma",
      note: "Healthcare defensive participation watch.",
      changePercent: -0.2
    }
  ]
};

export const sampleSectorScores: SectorScore[] = [
  {
    reportDate: sampleReport.reportDate,
    session: "morning",
    rank: 1,
    sector: "Nifty Pharma",
    symbol: "^CNXPHARMA",
    sectorScore: 72,
    relativeStrengthScore: 76,
    momentumScore: 70,
    trendScore: 68,
    oneDayChangePercent: 0.8,
    fiveDayChangePercent: 2.3,
    twentyDayChangePercent: 5.4
  },
  {
    reportDate: sampleReport.reportDate,
    session: "morning",
    rank: 2,
    sector: "Nifty Financial Services",
    symbol: "NIFTY_FIN_SERVICE.NS",
    sectorScore: 66,
    relativeStrengthScore: 64,
    momentumScore: 69,
    trendScore: 65,
    oneDayChangePercent: 0.5,
    fiveDayChangePercent: 1.4,
    twentyDayChangePercent: 3.1
  },
  {
    reportDate: sampleReport.reportDate,
    session: "morning",
    rank: 3,
    sector: "Nifty Auto",
    symbol: "^CNXAUTO",
    sectorScore: 58,
    relativeStrengthScore: 56,
    momentumScore: 60,
    trendScore: 57,
    oneDayChangePercent: 0.2,
    fiveDayChangePercent: 0.7,
    twentyDayChangePercent: 1.8
  },
  {
    reportDate: sampleReport.reportDate,
    session: "morning",
    rank: 4,
    sector: "Nifty IT",
    symbol: "^CNXIT",
    sectorScore: 42,
    relativeStrengthScore: 40,
    momentumScore: 38,
    trendScore: 47,
    oneDayChangePercent: -0.6,
    fiveDayChangePercent: -1.9,
    twentyDayChangePercent: -2.5
  }
];

export const sampleStockScores: StockScore[] = sampleReport.stocksInFocus.map((stock, index) => ({
  reportDate: sampleReport.reportDate,
  session: "morning",
  rank: index + 1,
  symbol: stock.symbol,
  name: stock.name,
  sector: stock.sector ?? "Large Cap",
  totalScore: stock.totalScore ?? 60 - index * 3,
  relativeStrengthScore: stock.relativeStrengthScore ?? 58,
  volumeSpikeScore: stock.volumeRatio * 25,
  breakoutScore: stock.breakoutScore ?? 50,
  trendStrengthScore: stock.trendStrengthScore ?? 55,
  newsImpactScore: stock.newsImpactScore ?? 50,
  oneDayChangePercent: stock.changePercent,
  fiveDayChangePercent: stock.changePercent * 2,
  twentyDayChangePercent: stock.changePercent * 4,
  volumeRatio: stock.volumeRatio,
  breakoutPercent: 0,
  researchNote: stock.reason
}));

export const sampleDashboardData: DashboardData = {
  report: sampleReport,
  sectorScores: sampleSectorScores,
  stockScores: sampleStockScores,
  recentReports: [
    {
      reportDate: sampleReport.reportDate,
      session: "morning",
      marketMood: sampleReport.marketMood,
      sectorInFocus: sampleReport.sectorInFocus,
      createdAt: new Date().toISOString()
    }
  ],
  isFallback: true
};

export const sampleNotificationAnalytics: NotificationAnalytics = {
  total: 3,
  byPriority: {
    Critical: 1,
    High: 1,
    Medium: 1,
    Low: 0
  },
  byStatus: {
    created: 1,
    sent: 1,
    failed: 0,
    duplicate: 0,
    skipped: 1
  },
  recent: [
    {
      id: "sample-critical",
      alertKey: "sample:critical",
      priority: "Critical",
      title: "Critical: Market mood changed to Bullish",
      reason: "Sample alert shown until Supabase notification history is available.",
      sector: "Broad Market",
      stocksAffected: [],
      alertType: "market_mood_change",
      triggerValue: 65,
      thresholdValue: 0,
      notificationStatus: "sent",
      sentCount: 1,
      failedCount: 0,
      triggeredAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    },
    {
      id: "sample-high",
      alertKey: "sample:high",
      priority: "High",
      title: "High: Nifty IT notable sector move",
      reason: "Sample sector movement alert.",
      sector: "Nifty IT",
      stocksAffected: [],
      alertType: "sector_move",
      triggerValue: 1.5,
      thresholdValue: 1.25,
      notificationStatus: "created",
      sentCount: 0,
      failedCount: 0,
      triggeredAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    },
    {
      id: "sample-medium",
      alertKey: "sample:medium",
      priority: "Medium",
      title: "Medium: RELIANCE.NS focus score elevated",
      reason: "Sample stock focus score alert.",
      sector: "Nifty Energy",
      stocksAffected: ["RELIANCE.NS"],
      alertType: "focus_score",
      triggerValue: 71,
      thresholdValue: 70,
      notificationStatus: "skipped",
      sentCount: 0,
      failedCount: 0,
      triggeredAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }
  ],
  isFallback: true
};
