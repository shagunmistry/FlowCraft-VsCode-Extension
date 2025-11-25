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
    supportedModels: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4',
    features: ['diagrams', 'infographics']
  },
  [Provider.Anthropic]: {
    provider: Provider.Anthropic,
    displayName: 'Anthropic (Claude)',
    requiresApiKey: true,
    supportedModels: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    defaultModel: 'claude-3-sonnet',
    features: ['diagrams', 'infographics']
  },
  [Provider.Google]: {
    provider: Provider.Google,
    displayName: 'Google (Gemini)',
    requiresApiKey: true,
    supportedModels: ['gemini-pro', 'gemini-pro-vision'],
    defaultModel: 'gemini-pro',
    features: ['diagrams']
  },
  [Provider.FlowCraft]: {
    provider: Provider.FlowCraft,
    displayName: 'FlowCraft API',
    requiresApiKey: true,
    supportedModels: ['flowcraft-v2'],
    defaultModel: 'flowcraft-v2',
    features: ['diagrams', 'infographics', 'illustrations', 'images']
  }
};
