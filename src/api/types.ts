/**
 * API-specific request/response types
 */

// Request Bodies
export interface DiagramGenerationRequest {
  prompt: string;
  type: string;
  colorPalette?: string;
  complexityLevel?: string;
  is_public: boolean;
}

export interface InfographicRequest {
  prompt: string;
  type: string;
  colorPalette?: string;
  complexityLevel?: string;
  is_public: boolean;
}

export interface IllustrationRequest {
  prompt: string;
  type: string;
  colorPalette?: string;
  complexityLevel?: string;
  is_public: boolean;
}

export interface ImageGenerationRequest {
  prompt: string;
  aspect_ratio?: string;
  seed?: number;
  output_format?: string;
  safety_tolerance?: number;
  is_public: boolean;
}

export interface ImageEditRequest {
  prompt: string;
  input_image: string;
  aspect_ratio?: string;
  seed?: number;
  output_format?: string;
  safety_tolerance?: number;
  is_public: boolean;
}

// Response Bodies
export interface DiagramGenerationResponse {
  code: string;
  title: string;
  user_id?: string;
  diagram_id: string;
  colorPalette?: string;
  complexityLevel?: string;
}

export interface InfographicResponse {
  code: string;
  title: string;
  user_id?: string;
  diagram_id: string;
  colorPalette?: string;
  complexityLevel?: string;
}

export interface IllustrationResponse {
  image_url: string;
  user_id?: string;
  diagram_id: string;
  colorPalette?: string;
  complexityLevel?: string;
}

export interface ImageGenerationResponse {
  image_url: string;
  original_url?: string;
  user_id?: string;
  diagram_id: string;
  metadata?: any;
}

export interface UsageResponse {
  subscribed: boolean;
  diagrams_created: number;
  free_limit: number;
  can_create: boolean;
  message?: string;
  remaining: number;
}

export interface PublicDiagramsResponse {
  diagrams: Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    content: string;
    thumbnail_url?: string;
    created_at: string;
    views: number;
    likes: number;
    is_liked?: boolean;
    is_saved?: boolean;
  }>;
  total: number;
  page: number;
  limit: number;
}

export interface APIErrorResponse {
  error: string;
  details?: string;
  statusCode?: number;
}
