/**
 * Logger utility for extension-wide logging
 */

import * as vscode from 'vscode';
import { LogLevel, LogEntry } from '../types';

export class Logger {
  private outputChannel: vscode.OutputChannel;
  private logLevel: LogLevel = LogLevel.Info;

  constructor(channelName: string = 'FlowCraft') {
    this.outputChannel = vscode.window.createOutputChannel(channelName);
  }

  /**
   * Set the minimum log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: any): void {
    this.log(LogLevel.Debug, message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: any): void {
    this.log(LogLevel.Info, message, context);
  }

  /**
   * Log a warning message
   */
  warning(message: string, context?: any): void {
    this.log(LogLevel.Warning, message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: any): void {
    const context = error ? {
      error: error.message || error,
      stack: error.stack
    } : undefined;

    this.log(LogLevel.Error, message, context);
  }

  /**
   * Show output channel
   */
  show(): void {
    this.outputChannel.show();
  }

  /**
   * Hide output channel
   */
  hide(): void {
    this.outputChannel.hide();
  }

  /**
   * Clear output channel
   */
  clear(): void {
    this.outputChannel.clear();
  }

  /**
   * Dispose of the output channel
   */
  dispose(): void {
    this.outputChannel.dispose();
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, message: string, context?: any): void {
    // Check if we should log this level
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context
    };

    const formattedMessage = this.formatLogEntry(entry);
    this.outputChannel.appendLine(formattedMessage);

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      this.logToConsole(entry);
    }
  }

  /**
   * Check if we should log this level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.Debug, LogLevel.Info, LogLevel.Warning, LogLevel.Error];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);

    return messageIndex >= currentIndex;
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(7);
    let message = `[${timestamp}] [${level}] ${entry.message}`;

    if (entry.context) {
      message += `\n${JSON.stringify(entry.context, null, 2)}`;
    }

    return message;
  }

  /**
   * Log to console (development only)
   */
  private logToConsole(entry: LogEntry): void {
    const message = `[FlowCraft] ${entry.message}`;

    switch (entry.level) {
      case LogLevel.Debug:
        console.debug(message, entry.context);
        break;
      case LogLevel.Info:
        console.info(message, entry.context);
        break;
      case LogLevel.Warning:
        console.warn(message, entry.context);
        break;
      case LogLevel.Error:
        console.error(message, entry.context);
        break;
    }
  }
}

// Singleton instance
let loggerInstance: Logger | undefined;

/**
 * Get the logger instance
 */
export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

/**
 * Initialize logger with custom channel name
 */
export function initLogger(channelName?: string): Logger {
  loggerInstance = new Logger(channelName);
  return loggerInstance;
}
