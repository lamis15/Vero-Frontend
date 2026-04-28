// ── Activity Types ──
export type ActivityType = 'TRANSPORT' | 'FOOD' | 'ENERGY' | 'SHOPPING' | 'WASTE';
export type CalculationSource = 'MANUAL' | 'AUTO_CALCULATED';

// ── Eco Activity ──
export interface CarbonActivity {
  id?: number;
  activityType: ActivityType;
  description: string;
  carbonKg: number;
  waterLiters: number;
  energyKwh: number;
  wasteKg: number;
  landM2: number;
  date: string;            // ISO date string: "2026-04-05"
  source: CalculationSource;
}

// ── Eco Goal ──
export interface CarbonGoal {
  id?: number;
  activityType: ActivityType;
  impactType: 'CARBON' | 'WATER' | 'ENERGY' | 'WASTE' | 'LAND';  // ADD THIS
  targetValue: number;  // RENAME from targetCarbonKg
  startDate: string;
  endDate: string;
  achieved?: boolean;
  progressPct?: number;
}

// ── Helper maps ──
export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  TRANSPORT: 'T',
  FOOD: 'F',
  ENERGY: 'E',
  SHOPPING: 'S',
  WASTE: 'W'
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  TRANSPORT: 'Travel',
  FOOD: 'Food',
  ENERGY: 'Energy',
  SHOPPING: 'Shopping',
  WASTE: 'Waste'
};

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  TRANSPORT: 'var(--fern)',
  FOOD: 'var(--earth)',
  ENERGY: 'var(--sage)',
  SHOPPING: 'var(--moss)',
  WASTE: 'var(--charcoal)'
};
