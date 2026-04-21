/**
 * API-related type definitions
 */

import { Provider } from './settings';

export interface APIError {
  code: string;
  message: string;
  details?: any;
  statusCode?: number;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
}

export interface UsageStats {
  subscribed: boolean;
  diagramsCreated: number;
  freeLimit: number;
  remaining: number;
  canCreate: boolean;
  message?: string;
}

export interface PublicDiagram {
  id: string;
  title: string;
  description: string;
  type: string;
  content: string;
  thumbnailUrl?: string;
  createdAt: string;
  views: number;
  likes: number;
  isLiked?: boolean;
  isSaved?: boolean;
}

export interface AuthHeaders {
  'Content-Type': string;
  'Authorization'?: string;
  'X-API-Key'?: string;
  'X-OpenAI-Key'?: string;
  'X-Anthropic-Key'?: string;
  'X-Google-Key'?: string;
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: AuthHeaders;
  body?: any;
  timeout?: number;
}

export enum RequestStatus {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Error = 'error'
}

export interface RequestState<T> {
  status: RequestStatus;
  data?: T;
  error?: APIError;
  progress?: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
}

export interface ProviderInfo {
  provider: Provider;
  displayName: string;
  requiresApiKey: boolean;
  supportedModels: string[];
  defaultModel: string;
  costPerToken?: number;
  features: string[];
}

export const PROVIDER_INFO: Record<Provider, ProviderInfo> = {
  [Provider.OpenAI]: {
    provider: Provider.OpenAI,
    displayName: 'OpenAI',
    requiresApiKey: true,
    supportedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini', 'o3-mini'],
    defaultModel: 'gpt-4o',
    features: ['diagrams', 'infographics']
  },
  [Provider.Anthropic]: {
    provider: Provider.Anthropic,
    displayName: 'Anthropic (Claude)',
    requiresApiKey: true,
    supportedModels: [
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-haiku-4-20250514',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022'
    ],
    defaultModel: 'claude-sonnet-4-20250514',
    features: ['diagrams', 'infographics']
  },
  [Provider.Google]: {
    provider: Provider.Google,
    displayName: 'Google (Gemini)',
    requiresApiKey: true,
    supportedModels: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-2.5-flash',
    features: ['diagrams']
  },
  [Provider.FlowCraft]: {
    provider: Provider.FlowCraft,
    displayName: 'FlowCraft API',
    requiresApiKey: true,
    supportedModels: ['flowcraft-default'],
    defaultModel: 'flowcraft-default',
    features: ['diagrams', 'infographics', 'illustrations', 'images']
  }
};

/**
 * Returns the curated list of models available for a given provider.
 * Used by the Settings webview to populate the per-provider model picker.
 */
export function getSupportedModels(provider: Provider): string[] {
  return PROVIDER_INFO[provider]?.supportedModels ?? [];
}

/**
 * Returns the default model for a given provider.
 */
export function getDefaultModel(provider: Provider): string {
  return PROVIDER_INFO[provider]?.defaultModel ?? '';
}
