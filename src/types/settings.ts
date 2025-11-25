/**
 * Settings and configuration type definitions
 */

export enum Provider {
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  Google = 'google',
  FlowCraft = 'flowcraft'
}

export interface ProviderConfig {
  provider: Provider;
  apiKey: string;
  isEnabled: boolean;
  displayName: string;
  models?: string[];
  defaultModel?: string;
}

export interface Settings {
  // API Configuration
  defaultProvider: Provider;
  providers: {
    [Provider.OpenAI]?: ProviderConfig;
    [Provider.Anthropic]?: ProviderConfig;
    [Provider.Google]?: ProviderConfig;
    [Provider.FlowCraft]?: ProviderConfig;
  };

  // Diagram Defaults
  defaultDiagramType: string;
  defaultColorPalette: string;
  defaultComplexity: 'simple' | 'medium' | 'complex';
  defaultPrivacy: 'public' | 'private';
  autoSave: boolean;

  // Cache Settings
  cacheEnabled: boolean;
  cacheTTL: number; // in seconds

  // UI Preferences
  showWelcomeOnStartup: boolean;
  showUsageWarnings: boolean;
  enableAnimations: boolean;

  // Advanced
  apiBaseUrl: string;
  maxConcurrentRequests: number;
  requestTimeout: number; // in milliseconds
}

export interface ProviderStatus {
  provider: Provider;
  isConfigured: boolean;
  isConnected: boolean;
  lastChecked?: Date;
  error?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultProvider: Provider.OpenAI,
  providers: {},
  defaultDiagramType: 'flowchart',
  defaultColorPalette: 'brand colors',
  defaultComplexity: 'medium',
  defaultPrivacy: 'private',
  autoSave: true,
  cacheEnabled: true,
  cacheTTL: 3600,
  showWelcomeOnStartup: true,
  showUsageWarnings: true,
  enableAnimations: true,
  apiBaseUrl: 'https://flowcraft-api-cb66lpneaq-ue.a.run.app',
  maxConcurrentRequests: 3,
  requestTimeout: 60000
};
