/**
 * Central export for all types
 */

export * from './diagram';
export * from './settings';
export * from './api';

// Additional shared types

export interface StateChangeEvent<T> {
  type: string;
  data: T;
  timestamp: Date;
}

export interface WebviewMessage {
  command: string;
  data?: any;
}

export type Disposable = {
  dispose(): void;
};

export type EventListener<T> = (data: T) => void;

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warning = 'warning',
  Error = 'error'
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: any;
}
