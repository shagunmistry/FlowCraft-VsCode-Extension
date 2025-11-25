/**
 * Usage Service - Track and manage usage statistics
 */

import { UsageStats } from '../types';
import { FlowCraftClient } from '../api/flowcraft-client';
import { StateManager } from '../state/state-manager';
import { APIKeyService } from './api-key-service';

export class UsageService {
  constructor(
    private apiClient: FlowCraftClient,
    private stateManager: StateManager,
    private apiKeyService: APIKeyService
  ) {}

  /**
   * Get current usage statistics
   */
  getUsage(): UsageStats {
    return this.stateManager.getUsage();
  }

  /**
   * Sync usage from API
   */
  async syncFromAPI(): Promise<UsageStats> {
    const provider = this.stateManager.getSetting('defaultProvider');
    const apiKey = await this.apiKeyService.retrieve(provider);

    if (!apiKey) {
      throw new Error(`No API key configured for ${provider}`);
    }

    const usage = await this.apiClient.getUsage(provider, apiKey);
    this.stateManager.updateUsage(usage);

    return usage;
  }

  /**
   * Check if user can create more diagrams
   */
  canCreate(): boolean {
    return this.stateManager.canCreateDiagram();
  }

  /**
   * Get remaining diagrams
   */
  getRemaining(): number {
    return this.stateManager.getRemainingDiagrams();
  }

  /**
   * Track diagram creation
   */
  trackCreation(_tokensUsed: number = 0): void {
    const usage = this.stateManager.getUsage();
    this.stateManager.updateUsage({
      ...usage,
      diagramsCreated: usage.diagramsCreated + 1
    });
  }

  /**
   * Get usage percentage
   */
  getUsagePercentage(): number {
    const usage = this.stateManager.getUsage();
    if (usage.subscribed) {
      return 0; // Unlimited
    }
    return (usage.diagramsCreated / usage.freeLimit) * 100;
  }

  /**
   * Check if approaching limit
   */
  isApproachingLimit(threshold: number = 80): boolean {
    return this.getUsagePercentage() >= threshold;
  }

  /**
   * Get warning message
   */
  getWarningMessage(): string | undefined {
    const usage = this.stateManager.getUsage();

    if (usage.subscribed) {
      return undefined;
    }

    const remaining = this.getRemaining();

    if (remaining === 0) {
      return 'You have reached your free limit. Please upgrade to continue.';
    }

    if (remaining === 1) {
      return 'You have 1 diagram remaining this month.';
    }

    if (this.isApproachingLimit()) {
      return `You have ${remaining} diagrams remaining this month.`;
    }

    return undefined;
  }

  /**
   * Reset usage (for testing or new period)
   */
  reset(): void {
    this.stateManager.resetUsage();
  }
}
