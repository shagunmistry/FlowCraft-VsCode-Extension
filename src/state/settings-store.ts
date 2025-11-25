/**
 * Settings store - manages application settings
 */

import { Settings, DEFAULT_SETTINGS, Provider, ProviderConfig } from '../types';

export class SettingsStore {
  private settings: Settings;

  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
  }

  /**
   * Get all settings
   */
  getAll(): Settings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  update(updates: Partial<Settings>): void {
    this.settings = {
      ...this.settings,
      ...updates
    };
  }

  /**
   * Get a specific setting value
   */
  get<K extends keyof Settings>(key: K): Settings[K] {
    return this.settings[key];
  }

  /**
   * Set a specific setting value
   */
  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settings[key] = value;
  }

  /**
   * Get default provider
   */
  getDefaultProvider(): Provider {
    return this.settings.defaultProvider;
  }

  /**
   * Set default provider
   */
  setDefaultProvider(provider: Provider): void {
    this.settings.defaultProvider = provider;
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(provider: Provider): ProviderConfig | undefined {
    return this.settings.providers[provider];
  }

  /**
   * Set provider configuration
   */
  setProviderConfig(provider: Provider, config: ProviderConfig): void {
    this.settings.providers[provider] = config;
  }

  /**
   * Remove provider configuration
   */
  removeProviderConfig(provider: Provider): void {
    delete this.settings.providers[provider];
  }

  /**
   * Get all configured providers
   */
  getConfiguredProviders(): Provider[] {
    return Object.keys(this.settings.providers) as Provider[];
  }

  /**
   * Check if provider is configured
   */
  isProviderConfigured(provider: Provider): boolean {
    return provider in this.settings.providers;
  }

  /**
   * Get enabled providers
   */
  getEnabledProviders(): Provider[] {
    return this.getConfiguredProviders().filter(
      p => this.settings.providers[p]?.isEnabled
    );
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
  }

  /**
   * Convert to JSON for persistence
   */
  toJSON(): any {
    return { ...this.settings };
  }

  /**
   * Load from JSON
   */
  fromJSON(data: any): void {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...data
    };
  }
}
