export interface Formation {
  id?: number;
  title: string;
  description: string;
  imageUrl?: string; // URL de l'image de la formation
  duration: number; // in hours
  maxCapacity: number;
  price?: number; // prix d'inscription
  status: FormationStatus;
  participantIds?: number[];
  waitlistIds?: number[];
  pinned?: boolean;
  tags?: string[]; // Tags de la formation
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
  type?: SessionType; // Type de session (en ligne ou présentiel)
  meetLink?: string;
  trainerId: number;
  formation?: Formation;
  isFinalSession?: boolean; // Indique si c'est la session finale
}

export enum SessionStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum SessionType {
  ONLINE = 'ONLINE',
  IN_PERSON = 'IN_PERSON'
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
