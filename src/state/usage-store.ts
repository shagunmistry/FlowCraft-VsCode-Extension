/**
 * Usage store - tracks usage statistics
 */

import { UsageStats } from '../types';

export class UsageStore {
  private usage: UsageStats = {
    subscribed: false,
    diagramsCreated: 0,
    freeLimit: 5,
    remaining: 5,
    canCreate: true
  };

  /**
   * Get usage statistics
   */
  get(): UsageStats {
    return { ...this.usage };
  }

  /**
   * Update usage statistics
   */
  update(stats: Partial<UsageStats>): void {
    this.usage = {
      ...this.usage,
      ...stats
    };
  }

  /**
   * Increment diagrams created
   */
  incrementCreated(): void {
    this.usage.diagramsCreated++;
    this.updateRemaining();
  }

  /**
   * Check if user can create more diagrams
   */
  canCreate(): boolean {
    if (this.usage.subscribed) {
      return true;
    }
    return this.usage.diagramsCreated < this.usage.freeLimit;
  }

  /**
   * Get remaining diagrams
   */
  getRemaining(): number {
    if (this.usage.subscribed) {
      return -1; // Unlimited
    }
    return Math.max(0, this.usage.freeLimit - this.usage.diagramsCreated);
  }

  /**
   * Update remaining count
   */
  private updateRemaining(): void {
    this.usage.remaining = this.getRemaining();
    this.usage.canCreate = this.canCreate();
  }

  /**
   * Reset usage (for new month/period)
   */
  reset(): void {
    this.usage.diagramsCreated = 0;
    this.updateRemaining();
  }

  /**
   * Convert to JSON for persistence
   */
  toJSON(): any {
    return { ...this.usage };
  }

  /**
   * Load from JSON
   */
  fromJSON(data: any): void {
    this.usage = {
      subscribed: data.subscribed || false,
      diagramsCreated: data.diagramsCreated || 0,
      freeLimit: data.freeLimit || 5,
      remaining: data.remaining || 5,
      canCreate: data.canCreate !== undefined ? data.canCreate : true,
      message: data.message
    };
    this.updateRemaining();
  }
}
