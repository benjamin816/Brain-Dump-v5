
export enum Category {
  ALL = 'All',
  WORK = 'Work',
  PERSONAL = 'Personal',
  IDEAS = 'Ideas',
  TODO = 'Todo',
  HEALTH = 'Health',
  FINANCE = 'Finance',
  EVENT = 'Event',
  OTHER = 'Other'
}

export interface Note {
  id: string;
  content: string;
  category: Category;
  timestamp: number;
  isEvent: boolean;
  forwardedToCalendar: boolean;
  metadata?: {
    detectedTime?: string;
    summary?: string;
  };
}

export interface GeminiNoteAnalysis {
  category: Category;
  isEvent: boolean;
  summary: string;
  detectedTime?: string;
}
