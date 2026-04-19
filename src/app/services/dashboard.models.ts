// ── Dashboard DTO — mirrors EcoDashboardDTO.java ──

export interface DailyCarbon {
  date: string;
  carbonKg: number;
}

export interface EcoDashboardDTO {
  // Period
  periodStart: string;
  periodEnd: string;

  // Impact totals
  totalCarbonKg: number;
  totalWaterLiters: number;
  totalEnergyKwh: number;
  totalWasteKg: number;
  totalLandM2: number;

  // CO₂ breakdown by activity type
  carbonByType: Record<string, number>;

  // Weekly trend (7 days)
  weeklyTrend: DailyCarbon[];

  // EcoScore
  ecoScore: number;
  ecoScoreLabel: string; // "Excellent" | "Good" | "Average" | "Poor"

  // Goals summary
  totalGoals: number;
  achievedGoals: number;
  activeGoals: number;
}
