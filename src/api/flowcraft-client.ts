/**
 * FlowCraft API Client
 * Handles all communication with the FlowCraft API v2
 */

import {
  DiagramType,
  GenerateDiagramParams,
  GenerateImageParams,
  EditImageParams,
  DiagramResult,
  ImageResult,
  UsageStats,
  PublicDiagram,
  Provider
} from '../types';

import {
  DiagramGenerationRequest,
  DiagramGenerationResponse,
  InfographicRequest,
  InfographicResponse,
  IllustrationRequest,
  IllustrationResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageEditRequest,
  UsageResponse,
  PublicDiagramsResponse,
  APIErrorResponse
} from './types';

import {
  FlowCraftAPIError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NetworkError,
  QuotaExceededError
} from './errors';

import {
  API_ENDPOINTS,
  getAuthHeaderName,
  getAuthHeaderValue
} from './providers';

export interface FlowCraftClientConfig {
  baseURL: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class FlowCraftClient {
  private baseURL: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config: FlowCraftClientConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 60000;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * Generate a Mermaid diagram
   */
  async generateDiagram(
    params: GenerateDiagramParams,
    provider: Provider,
    apiKey: string
  ): Promise<DiagramResult> {
    const request: DiagramGenerationRequest = {
      prompt: params.prompt,
      type: this.mapDiagramType(params.type),
      colorPalette: params.colorPalette || 'brand colors',
      complexityLevel: params.complexityLevel || 'medium',
      is_public: params.isPublic
    };

    const response = await this.makeRequest<DiagramGenerationResponse>(
      API_ENDPOINTS.diagram,
      {
        method: 'POST',
        body: request,
        provider,
        apiKey
      }
    );

    return {
      code: response.code,
      title: response.title,
      diagramId: response.diagram_id,
      userId: response.user_id,
      colorPalette: response.colorPalette,
      complexityLevel: response.complexityLevel
    };
  }

  /**
   * Generate an infographic
   */
  async generateInfographic(
    params: GenerateDiagramParams,
    provider: Provider,
    apiKey: string
  ): Promise<DiagramResult> {
    const request: InfographicRequest = {
      prompt: params.prompt,
      type: 'infographic',
      colorPalette: params.colorPalette || 'brand colors',
      complexityLevel: params.complexityLevel || 'medium',
      is_public: params.isPublic
    };

    const response = await this.makeRequest<InfographicResponse>(
      API_ENDPOINTS.infographic,
      {
        method: 'POST',
        body: request,
        provider,
        apiKey
      }
    );

    return {
      code: response.code,
      title: response.title,
      diagramId: response.diagram_id,
      userId: response.user_id,
      colorPalette: response.colorPalette,
      complexityLevel: response.complexityLevel
    };
  }

  /**
   * Generate an illustration
   */
  async generateIllustration(
    params: GenerateDiagramParams,
    provider: Provider,
    apiKey: string
  ): Promise<ImageResult> {
    const request: IllustrationRequest = {
      prompt: params.prompt,
      type: 'illustration',
      colorPalette: params.colorPalette || 'brand colors',
      complexityLevel: params.complexityLevel || 'medium',
      is_public: params.isPublic
    };

    const response = await this.makeRequest<IllustrationResponse>(
      API_ENDPOINTS.illustration,
      {
        method: 'POST',
        body: request,
        provider,
        apiKey
      }
    );

    return {
      imageUrl: response.image_url,
      diagramId: response.diagram_id,
      userId: response.user_id,
      metadata: {
        colorPalette: response.colorPalette,
        complexityLevel: response.complexityLevel
      }
    };
  }

  /**
   * Generate an AI image
   */
  async generateImage(
    params: GenerateImageParams,
    provider: Provider,
    apiKey: string
  ): Promise<ImageResult> {
    const request: ImageGenerationRequest = {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio || '1:1',
      seed: params.seed,
      output_format: params.outputFormat || 'png',
      safety_tolerance: params.safetyTolerance || 2,
      is_public: params.isPublic
    };

    const response = await this.makeRequest<ImageGenerationResponse>(
      API_ENDPOINTS.generateImage,
      {
        method: 'POST',
        body: request,
        provider,
        apiKey
      }
    );

    return {
      imageUrl: response.image_url,
      diagramId: response.diagram_id,
      userId: response.user_id,
      metadata: response.metadata
    };
  }

  /**
   * Edit an existing image
   */
  async editImage(
    params: EditImageParams,
    provider: Provider,
    apiKey: string
  ): Promise<ImageResult> {
    const request: ImageEditRequest = {
      prompt: params.prompt,
      input_image: params.inputImage,
      aspect_ratio: params.aspectRatio || 'match_input_image',
      seed: params.seed,
      output_format: params.outputFormat || 'jpg',
      safety_tolerance: params.safetyTolerance || 2,
      is_public: params.isPublic
    };

    const response = await this.makeRequest<ImageGenerationResponse>(
      API_ENDPOINTS.editImage,
      {
        method: 'POST',
        body: request,
        provider,
        apiKey
      }
    );

    return {
      imageUrl: response.image_url,
      diagramId: response.diagram_id,
      userId: response.user_id,
      metadata: response.metadata
    };
  }

  /**
   * Get user usage statistics
   */
  async getUsage(provider: Provider, apiKey: string): Promise<UsageStats> {
    const response = await this.makeRequest<UsageResponse>(
      API_ENDPOINTS.usage,
      {
        method: 'GET',
        provider,
        apiKey
      }
    );

    return {
      subscribed: response.subscribed,
      diagramsCreated: response.diagrams_created,
      freeLimit: response.free_limit,
      remaining: response.remaining,
      canCreate: response.can_create,
      message: response.message
    };
  }

  /**
   * Get public diagrams
   */
  async getPublicDiagrams(
    limit: number = 20,
    userId?: string
  ): Promise<PublicDiagram[]> {
    const url = `${API_ENDPOINTS.publicDiagrams}?limit=${limit}`;
    const headers: any = { 'Content-Type': 'application/json' };

    if (userId) {
      headers['User-Id'] = userId;
    }

    const response = await this.makeRequest<PublicDiagramsResponse>(
      url,
      {
        method: 'GET',
        headers
      }
    );

    return response.diagrams.map(d => ({
      id: d.id,
      title: d.title,
      description: d.description,
      type: d.type,
      content: d.content,
      thumbnailUrl: d.thumbnail_url,
      createdAt: d.created_at,
      views: d.views,
      likes: d.likes,
      isLiked: d.is_liked,
      isSaved: d.is_saved
    }));
  }

  /**
   * Make an HTTP request with retry logic
   */
  private async makeRequest<T>(
    endpoint: string,
    options: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      headers?: any;
      provider?: Provider;
      apiKey?: string;
    }
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const headers: any = {
          'Content-Type': 'application/json',
          ...options.headers
        };

        // Add authentication headers
        if (options.provider && options.apiKey) {
          const headerName = getAuthHeaderName(options.provider);
          const headerValue = getAuthHeaderValue(options.provider, options.apiKey);
          headers[headerName] = headerValue;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: options.method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          await this.handleErrorResponse(response);
        }

        const data = await response.json() as any;

        // Handle error in response body
        if (data.error) {
          throw new FlowCraftAPIError(
            data.error,
            response.status,
            data.details
          );
        }

        return data as T;

      } catch (error: any) {
        lastError = error;

        // Don't retry on authentication or validation errors
        if (
          error instanceof AuthenticationError ||
          error instanceof ValidationError ||
          error instanceof QuotaExceededError
        ) {
          throw error;
        }

        // Retry on network errors and rate limits
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }
      }
    }

    throw lastError || new NetworkError('Request failed after retries');
  }

  /**
   * Handle error responses
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: APIErrorResponse | undefined;

    try {
      errorData = await response.json() as APIErrorResponse;
    } catch (e) {
      // Response is not JSON
    }

    const message = errorData?.error || response.statusText;
    const details = errorData?.details;

    switch (response.status) {
      case 401:
      case 403:
        throw new AuthenticationError(message, details);
      case 429:
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(
          message,
          retryAfter ? parseInt(retryAfter) : undefined,
          details
        );
      case 400:
        throw new ValidationError(message, details);
      case 402:
        throw new QuotaExceededError(message, details);
      default:
        throw new FlowCraftAPIError(message, response.status, details);
    }
  }

  /**
   * Map internal diagram types to API types
   */
  private mapDiagramType(type: DiagramType): string {
    const mapping: Record<string, string> = {
      [DiagramType.Flowchart]: 'flowchart',
      [DiagramType.Sequence]: 'sequence diagram',
      [DiagramType.Class]: 'class diagram',
      [DiagramType.State]: 'state diagram',
      [DiagramType.ER]: 'er diagram',
      [DiagramType.Gantt]: 'gantt',
      [DiagramType.Pie]: 'pie'
    };

    return mapping[type] || type;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
