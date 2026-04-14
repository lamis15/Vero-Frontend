export interface Formation {
  id?: number;
  title: string;
  description: string;
  duration: number; // in hours
  maxCapacity: number;
  price?: number; // prix d'inscription
  status: FormationStatus;
  participantIds?: number[];
  pinned?: boolean;
}

export enum FormationStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export interface Session {
  id?: number;
  title: string;
  startDate: string; // ISO format
  endDate: string;
  status: SessionStatus;
  meetLink?: string;
  trainerId: number;
  formation?: Formation;
}

export enum SessionStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface FormationResource {
  id: number;
  fileName: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface QuizOption {
  id: number;
  text: string;
}

export interface QuizQuestion {
  id: number;
  text: string;
  options: QuizOption[];
}

export interface QuizResponse {
  id: number;
  title: string;
  passingScore: number;
  questions: QuizQuestion[];
}

export interface QuizResult {
  score: number;
  passed: boolean;
  certificateUrl?: string;
}

export interface AnswerDto {
  questionId: number;
  selectedOptionId: number;
}
