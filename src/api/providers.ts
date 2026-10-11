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
  entitlement: string;
  myDiagrams: string;
  templates: string;
  publicDiagrams: string;
}

export const API_ENDPOINTS: ProviderEndpoints = {
  diagram: '/v2/diagram',
  infographic: '/v2/infographic',
  illustration: '/v2/illustration',
  generateImage: '/v2/generate-image',
  editImage: '/v2/edit-image',
  usage: '/v2/usage',
  entitlement: '/v2/me/entitlement',
  myDiagrams: '/v2/me/diagrams',
  templates: '/v2/templates',
  publicDiagrams: '/v2/public-diagrams'
};

export function getAuthHeaderName(_provider: Provider): string {
  return 'X-api-key';
}

export function getAuthHeaderValue(_provider: Provider, apiKey: string): string {
  return apiKey;
}

export function validateApiKey(_provider: Provider, apiKey: string): boolean {
  const k = (apiKey ?? '').trim();
  return k.startsWith('sk-or-') && k.length > 20;
}
