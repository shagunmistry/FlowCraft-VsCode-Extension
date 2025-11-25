/**
 * API Key Service - Secure API key management using VS Code SecretStorage
 */

import * as vscode from 'vscode';
import { Provider, ProviderConfig } from '../types';
import { validateApiKey } from '../api/providers';

export class APIKeyService {
  private context: vscode.ExtensionContext;
  private readonly KEY_PREFIX = 'flowcraft.apikey.';

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Store an API key securely
   */
  async store(provider: Provider, apiKey: string): Promise<void> {
    const key = this.getStorageKey(provider);
    await this.context.secrets.store(key, apiKey);
  }

  /**
   * Retrieve an API key
   */
  async retrieve(provider: Provider): Promise<string | undefined> {
    const key = this.getStorageKey(provider);
    return await this.context.secrets.get(key);
  }

  /**
   * Delete an API key
   */
  async delete(provider: Provider): Promise<void> {
    const key = this.getStorageKey(provider);
    await this.context.secrets.delete(key);
  }

  /**
   * Check if provider has an API key stored
   */
  async has(provider: Provider): Promise<boolean> {
    const apiKey = await this.retrieve(provider);
    return apiKey !== undefined && apiKey.length > 0;
  }

  /**
   * Validate an API key
   */
  validate(provider: Provider, apiKey: string): boolean {
    return validateApiKey(provider, apiKey);
  }

  /**
   * Test API key by making a test request
   */
  async test(provider: Provider, apiKey: string): Promise<boolean> {
    // Basic validation first
    if (!this.validate(provider, apiKey)) {
      return false;
    }

    // For actual connection testing, this would be implemented
    // by making a lightweight API call to verify the key works
    // This is a placeholder for now
    return true;
  }

  /**
   * Get all providers that have keys stored
   */
  async getConfiguredProviders(): Promise<Provider[]> {
    const providers: Provider[] = [];
    for (const provider of Object.values(Provider)) {
      if (await this.has(provider)) {
        providers.push(provider);
      }
    }
    return providers;
  }

  /**
   * Migrate from old key format (if needed)
   */
  async migrateOldKeys(): Promise<void> {
    // Migrate from old 'flowcraft.openai.key' to new format
    const oldKey = await this.context.secrets.get('flowcraft.openai.key');
    if (oldKey) {
      await this.store(Provider.OpenAI, oldKey);
      await this.context.secrets.delete('flowcraft.openai.key');
    }
  }

  /**
   * Clear all API keys
   */
  async clearAll(): Promise<void> {
    for (const provider of Object.values(Provider)) {
      await this.delete(provider);
    }
  }

  /**
   * Get storage key for a provider
   */
  private getStorageKey(provider: Provider): string {
    return `${this.KEY_PREFIX}${provider}`;
  }

  /**
   * Create provider config with API key
   */
  async createProviderConfig(
    provider: Provider,
    apiKey: string,
    displayName?: string
  ): Promise<ProviderConfig> {
    await this.store(provider, apiKey);

    return {
      provider,
      apiKey,
      isEnabled: true,
      displayName: displayName || provider.toString()
    };
  }

  /**
   * Update provider config
   */
  async updateProviderConfig(
    provider: Provider,
    updates: Partial<ProviderConfig>
  ): Promise<void> {
    if (updates.apiKey) {
      await this.store(provider, updates.apiKey);
    }
  }
}
