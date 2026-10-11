/**
 * Settings and configuration type definitions
 */

/**
 * All text generation goes through OpenRouter: one key, any model slug
 * (e.g. "anthropic/claude-sonnet-5.5"). Kept as an enum so provider-keyed
 * code (secrets, settings maps) stays generic.
 */
export enum Provider {
  OpenRouter = 'openrouter'
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
    [Provider.OpenRouter]?: ProviderConfig;
  };

  // OpenRouter model slug (e.g. "anthropic/claude-sonnet-5.5").
  // When unset, the API falls back to its server-side default.
  providerModels: Partial<Record<Provider, string>>;

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

  // Privacy — share anonymous usage data (diagram types, provider, success/error).
  // Never includes API keys or prompt text. Also honors VS Code's global
  // telemetry setting (vscode.env.isTelemetryEnabled).
  telemetryEnabled: boolean;

  // Premium — automatically sync generated diagrams to your FlowCraft cloud
  // history when signed in and subscribed. Off = diagrams stay local only.
  cloudSyncEnabled: boolean;

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
  defaultProvider: Provider.OpenRouter,
  providers: {},
  providerModels: {},
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
  telemetryEnabled: true,
  cloudSyncEnabled: true,
  apiBaseUrl: 'https://flowcraft-api-cb66lpneaq-ue.a.run.app',
  maxConcurrentRequests: 3,
  requestTimeout: 60000
};
