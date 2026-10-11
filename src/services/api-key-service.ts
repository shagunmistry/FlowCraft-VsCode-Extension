/**
 * API Key Service - Secure API key management using VS Code SecretStorage
 */

import * as vscode from "vscode";
import { Provider, ProviderConfig } from "../types";
import { validateApiKey } from "../api/providers";

export class APIKeyService {
  private context: vscode.ExtensionContext;
  private readonly KEY_PREFIX = "flowcraft.apikey.";

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

    try {
      const response = await fetch(
        "https://flowcraft-api-cb66lpneaq-ue.a.run.app/v2/vscode/verify",
        {
          method: "GET",
          headers: {
            "X-api-key": apiKey,
          },
        }
      );
      return response.ok;
    } catch (error) {
      console.error(`API test failed for ${provider}:`, error);
      return false;
    }
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
   * Remove keys saved by pre-OpenRouter versions (OpenAI / Anthropic / Google /
   * FlowCraft). They are not OpenRouter keys and the API now rejects them.
   * Returns true when at least one was found, so the caller can tell the user
   * once that they need to add an OpenRouter key.
   */
  async migrateOldKeys(): Promise<boolean> {
    let found = false;
    const legacy = [
      "flowcraft.openai.key",
      ...["openai", "anthropic", "google", "flowcraft"].map((p) => `${this.KEY_PREFIX}${p}`),
    ];
    for (const name of legacy) {
      if (await this.context.secrets.get(name)) {
        found = true;
        await this.context.secrets.delete(name);
      }
    }
    return found;
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
      displayName: displayName || provider.toString(),
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
