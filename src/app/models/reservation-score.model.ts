// src/app/models/reservation-score.model.ts

export type Recommendation = 'CONFIRM' | 'MANUAL' | 'REJECT';
export type ScoreProfile   = 'reliable' | 'moderate' | 'risk';
export type SortKey        = 'score-desc' | 'score-asc' | 'eco-desc' | 'cancel-desc' | 'events-desc';
export type FilterKey      = 'all' | 'reliable' | 'cancel-high' | 'eco' | 'new';

export interface ReservationScoreDTO {
  reservation: {
    id: number;
    status: string;
    createdAt?: string;
    processedAt?: string;
    user?: {
      id: number;
      fullName: string;
      email: string;
      role?: string;
    };
    event?: {
      id: number;
      title: string;
      startDate?: string;
      location?: string;
      capacity?: number;
    };
  };
  globalScore:           number;
  ecoScore:              number;
  cancelRate:            number;
  totalReservations:     number;
  confirmedReservations: number;
  cancelledReservations: number;
  newMember:             boolean;
  recommendation:        Recommendation;
  aiNote:                string;
}

export interface ScoredRow extends ReservationScoreDTO {
  profile: ScoreProfile;
}

export interface ScoreStats {
  total:         number;
  avgScore:      number;
  avgCancelRate: number;
  avgEco:        number;
  reliableCount: number;
  moderateCount: number;
  riskCount:     number;
}

export function toProfile(score: number): ScoreProfile {
  if (score >= 75) return 'reliable';
  if (score >= 50) return 'moderate';
  return 'risk';
}

export function computeStats(rows: ScoredRow[]): ScoreStats {
  if (!rows.length) {
    return { total: 0, avgScore: 0, avgCancelRate: 0, avgEco: 0,
             reliableCount: 0, moderateCount: 0, riskCount: 0 };
  }
  const n = rows.length;
  return {
    total:         n,
    avgScore:      Math.round(rows.reduce((s, r) => s + r.globalScore, 0) / n),
    avgCancelRate: Math.round(rows.reduce((s, r) => s + r.cancelRate,  0) / n),
    avgEco:        Math.round(rows.reduce((s, r) => s + r.ecoScore,    0) / n * 10) / 10,
    reliableCount: rows.filter(r => r.profile === 'reliable').length,
    moderateCount: rows.filter(r => r.profile === 'moderate').length,
    riskCount:     rows.filter(r => r.profile === 'risk').length,
  };
}