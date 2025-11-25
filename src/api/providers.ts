/**
 * Provider-specific configurations and utilities
 */

import { Provider } from '../types';

export interface ProviderEndpoints {
  diagram: string;
  infographic: string;
  illustration: string;
  generateImage: string;
  editImage: string;
  usage: string;
  publicDiagrams: string;
}

export const API_ENDPOINTS: ProviderEndpoints = {
  diagram: '/v2/diagram',
  infographic: '/v2/infographic',
  illustration: '/v2/illustration',
  generateImage: '/v2/generate-image',
  editImage: '/v2/edit-image',
  usage: '/v2/usage',
  publicDiagrams: '/v2/public-diagrams'
};

export function getAuthHeaderName(provider: Provider): string {
  switch (provider) {
    case Provider.OpenAI:
      return 'X-OpenAI-Key';
    case Provider.Anthropic:
      return 'X-Anthropic-Key';
    case Provider.Google:
      return 'X-Google-Key';
    case Provider.FlowCraft:
      return 'Authorization';
    default:
      return 'X-API-Key';
  }
}

export function getAuthHeaderValue(provider: Provider, apiKey: string): string {
  if (provider === Provider.FlowCraft) {
    return `Bearer ${apiKey}`;
  }
  return apiKey;
}

export function validateApiKey(provider: Provider, apiKey: string): boolean {
  if (!apiKey || apiKey.trim().length === 0) {
    return false;
  }

  switch (provider) {
    case Provider.OpenAI:
      return apiKey.startsWith('sk-');
    case Provider.Anthropic:
      return apiKey.startsWith('sk-ant-');
    case Provider.Google:
      return apiKey.length > 20; // Basic length check
    case Provider.FlowCraft:
      return apiKey.length > 10; // Basic length check
    default:
      return true;
  }
}
