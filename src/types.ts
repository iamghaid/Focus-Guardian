export enum FocusState {
  FOCUSED = 'FOCUSED',
  DISTRACTED = 'DISTRACTED',
  AWAY = 'AWAY'
}

export interface TimelineEvent {
  timeOffset: number; // Seconds since start of session
  state: FocusState;
}

export interface SessionHistory {
  id: string;
  date: string;
  duration: number; // Session duration (e.g. 25 min)
  focusPercentage: number;
  distractedCount: number;
  focusTime: number; // seconds
  distractedTime: number; // seconds
  awayTime: number; // seconds
  timeline: TimelineEvent[];
}

export interface Settings {
  focusDuration: number; // in minutes
  breakDuration: number; // in minutes
  soundEnabled: boolean;
  sensitivity: number; // 1 to 10
}
