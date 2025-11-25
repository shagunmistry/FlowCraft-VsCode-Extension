/**
 * Validation utility functions
 */

import { DiagramType, Provider } from '../types';

/**
 * Validate API key format
 */
export function validateApiKey(provider: Provider, apiKey: string): {
  valid: boolean;
  error?: string;
} {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key cannot be empty' };
  }

  switch (provider) {
    case Provider.OpenAI:
      if (!apiKey.startsWith('sk-')) {
        return { valid: false, error: 'OpenAI API key must start with "sk-"' };
      }
      if (apiKey.length < 20) {
        return { valid: false, error: 'OpenAI API key is too short' };
      }
      break;

    case Provider.Anthropic:
      if (!apiKey.startsWith('sk-ant-')) {
        return { valid: false, error: 'Anthropic API key must start with "sk-ant-"' };
      }
      if (apiKey.length < 20) {
        return { valid: false, error: 'Anthropic API key is too short' };
      }
      break;

    case Provider.Google:
      if (apiKey.length < 20) {
        return { valid: false, error: 'Google API key is too short' };
      }
      break;

    case Provider.FlowCraft:
      if (apiKey.length < 10) {
        return { valid: false, error: 'FlowCraft API key is too short' };
      }
      break;
  }

  return { valid: true };
}

/**
 * Validate diagram title
 */
export function validateDiagramTitle(title: string): {
  valid: boolean;
  error?: string;
} {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'Title cannot be empty' };
  }

  if (title.length > 200) {
    return { valid: false, error: 'Title is too long (max 200 characters)' };
  }

  return { valid: true };
}

/**
 * Validate diagram description/prompt
 */
export function validateDiagramDescription(description: string): {
  valid: boolean;
  error?: string;
} {
  if (!description || description.trim().length === 0) {
    return { valid: false, error: 'Description cannot be empty' };
  }

  if (description.length < 10) {
    return { valid: false, error: 'Description is too short (min 10 characters)' };
  }

  if (description.length > 10000) {
    return { valid: false, error: 'Description is too long (max 10,000 characters)' };
  }

  return { valid: true };
}

/**
 * Validate URL
 */
export function validateUrl(url: string): {
  valid: boolean;
  error?: string;
} {
  try {
    new URL(url);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate email
 */
export function validateEmail(email: string): {
  valid: boolean;
  error?: string;
} {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email cannot be empty' };
  }

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

/**
 * Validate diagram type
 */
export function validateDiagramType(type: string): {
  valid: boolean;
  error?: string;
} {
  const validTypes = Object.values(DiagramType);

  if (!validTypes.includes(type as DiagramType)) {
    return {
      valid: false,
      error: `Invalid diagram type. Must be one of: ${validTypes.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Validate color palette
 */
export function validateColorPalette(palette: string): {
  valid: boolean;
  error?: string;
} {
  const validPalettes = ['brand colors', 'monochromatic', 'complementary', 'analogous'];

  if (!validPalettes.includes(palette)) {
    return {
      valid: false,
      error: `Invalid color palette. Must be one of: ${validPalettes.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Validate complexity level
 */
export function validateComplexity(complexity: string): {
  valid: boolean;
  error?: string;
} {
  const validComplexities = ['simple', 'medium', 'complex'];

  if (!validComplexities.includes(complexity)) {
    return {
      valid: false,
      error: `Invalid complexity. Must be one of: ${validComplexities.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Validate aspect ratio
 */
export function validateAspectRatio(ratio: string): {
  valid: boolean;
  error?: string;
} {
  const validRatios = ['1:1', '4:3', '16:9', '21:9', '9:16'];

  if (!validRatios.includes(ratio)) {
    return {
      valid: false,
      error: `Invalid aspect ratio. Must be one of: ${validRatios.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Sanitize file name
 */
export function sanitizeFileName(fileName: string): string {
  // Remove invalid characters
  return fileName
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

/**
 * Validate file name
 */
export function validateFileName(fileName: string): {
  valid: boolean;
  error?: string;
} {
  if (!fileName || fileName.trim().length === 0) {
    return { valid: false, error: 'File name cannot be empty' };
  }

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(fileName)) {
    return {
      valid: false,
      error: 'File name contains invalid characters: < > : " / \\ | ? *'
    };
  }

  if (fileName.length > 255) {
    return { valid: false, error: 'File name is too long (max 255 characters)' };
  }

  return { valid: true };
}

/**
 * Validate positive number
 */
export function validatePositiveNumber(value: number, name: string = 'Value'): {
  valid: boolean;
  error?: string;
} {
  if (typeof value !== 'number') {
    return { valid: false, error: `${name} must be a number` };
  }

  if (value <= 0) {
    return { valid: false, error: `${name} must be positive` };
  }

  if (!isFinite(value)) {
    return { valid: false, error: `${name} must be finite` };
  }

  return { valid: true };
}

/**
 * Validate number range
 */
export function validateNumberRange(
  value: number,
  min: number,
  max: number,
  name: string = 'Value'
): {
  valid: boolean;
  error?: string;
} {
  if (typeof value !== 'number') {
    return { valid: false, error: `${name} must be a number` };
  }

  if (value < min || value > max) {
    return {
      valid: false,
      error: `${name} must be between ${min} and ${max}`
    };
  }

  return { valid: true };
}
