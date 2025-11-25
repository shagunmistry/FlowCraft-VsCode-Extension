/**
 * Custom error classes for API interactions
 */

export class FlowCraftAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'FlowCraftAPIError';
    Object.setPrototypeOf(this, FlowCraftAPIError.prototype);
  }
}

export class AuthenticationError extends FlowCraftAPIError {
  constructor(message: string = 'Authentication failed', details?: any) {
    super(message, 401, details);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class RateLimitError extends FlowCraftAPIError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number,
    details?: any
  ) {
    super(message, 429, details);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class ValidationError extends FlowCraftAPIError {
  constructor(message: string, details?: any) {
    super(message, 400, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NetworkError extends FlowCraftAPIError {
  constructor(message: string = 'Network request failed', details?: any) {
    super(message, undefined, details);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class QuotaExceededError extends FlowCraftAPIError {
  constructor(message: string = 'Usage quota exceeded', details?: any) {
    super(message, 402, details);
    this.name = 'QuotaExceededError';
    Object.setPrototypeOf(this, QuotaExceededError.prototype);
  }
}
