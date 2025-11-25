/**
 * Diagram Service - Business logic for diagram operations
 */

import {
  Diagram,
  DiagramType,
  DiagramCategory,
  CreateDiagramParams,
  GenerateDiagramParams,
  GenerateImageParams,
  EditImageParams,
  DiagramResult,
  ImageResult
} from '../types';
import { FlowCraftClient } from '../api/flowcraft-client';
import { StateManager } from '../state/state-manager';
import { APIKeyService } from './api-key-service';

export class DiagramService {
  constructor(
    private apiClient: FlowCraftClient,
    private stateManager: StateManager,
    private apiKeyService: APIKeyService
  ) {}

  /**
   * Create a new diagram
   */
  async create(params: CreateDiagramParams): Promise<Diagram> {
    const diagram: Diagram = {
      id: this.generateId(),
      title: params.title,
      description: params.description,
      type: params.type,
      category: this.getCategoryForType(params.type),
      content: '',
      isPublic: params.isPublic,
      createdAt: new Date(),
      updatedAt: new Date(),
      tokensUsed: 0
    };

    this.stateManager.addDiagram(diagram);
    return diagram;
  }

  /**
   * Generate a diagram using AI
   */
  async generate(params: GenerateDiagramParams): Promise<Diagram> {
    // Get provider and API key
    const provider = this.stateManager.getSetting('defaultProvider');
    const apiKey = await this.apiKeyService.retrieve(provider);

    if (!apiKey) {
      throw new Error(`No API key configured for ${provider}`);
    }

    // Check usage limits
    if (!this.stateManager.canCreateDiagram()) {
      throw new Error('Usage limit reached. Please upgrade to continue.');
    }

    let result: DiagramResult | ImageResult;
    let category: DiagramCategory;

    // Determine which API endpoint to use based on diagram type
    switch (params.type) {
      case DiagramType.Infographic:
        result = await this.apiClient.generateInfographic(params, provider, apiKey);
        category = DiagramCategory.SVG;
        break;

      case DiagramType.Illustration:
        result = await this.apiClient.generateIllustration(params, provider, apiKey);
        category = DiagramCategory.Image;
        break;

      case DiagramType.GeneratedImage:
      case DiagramType.EditedImage:
        throw new Error('Use generateImage or editImage methods for image generation');

      default:
        // Mermaid diagrams
        result = await this.apiClient.generateDiagram(params, provider, apiKey);
        category = DiagramCategory.Mermaid;
    }

    // Create diagram from result
    const diagram: Diagram = {
      id: (result as DiagramResult).diagramId,
      title: (result as DiagramResult).title || params.prompt.substring(0, 50),
      description: params.prompt,
      type: params.type,
      category,
      content: (result as DiagramResult).code || (result as ImageResult).imageUrl,
      isPublic: params.isPublic,
      createdAt: new Date(),
      updatedAt: new Date(),
      tokensUsed: (result as DiagramResult).tokensUsed || 0,
      metadata: {
        colorPalette: params.colorPalette,
        complexityLevel: params.complexityLevel
      }
    };

    this.stateManager.addDiagram(diagram);
    return diagram;
  }

  /**
   * Generate an image
   */
  async generateImage(params: GenerateImageParams): Promise<Diagram> {
    const provider = this.stateManager.getSetting('defaultProvider');
    const apiKey = await this.apiKeyService.retrieve(provider);

    if (!apiKey) {
      throw new Error(`No API key configured for ${provider}`);
    }

    if (!this.stateManager.canCreateDiagram()) {
      throw new Error('Usage limit reached. Please upgrade to continue.');
    }

    const result = await this.apiClient.generateImage(params, provider, apiKey);

    const diagram: Diagram = {
      id: result.diagramId,
      title: params.prompt.substring(0, 50),
      description: params.prompt,
      type: DiagramType.GeneratedImage,
      category: DiagramCategory.Image,
      content: result.imageUrl,
      isPublic: params.isPublic,
      createdAt: new Date(),
      updatedAt: new Date(),
      tokensUsed: 0,
      metadata: result.metadata
    };

    this.stateManager.addDiagram(diagram);
    return diagram;
  }

  /**
   * Edit an existing image
   */
  async editImage(params: EditImageParams): Promise<Diagram> {
    const provider = this.stateManager.getSetting('defaultProvider');
    const apiKey = await this.apiKeyService.retrieve(provider);

    if (!apiKey) {
      throw new Error(`No API key configured for ${provider}`);
    }

    if (!this.stateManager.canCreateDiagram()) {
      throw new Error('Usage limit reached. Please upgrade to continue.');
    }

    const result = await this.apiClient.editImage(params, provider, apiKey);

    const diagram: Diagram = {
      id: result.diagramId,
      title: `Edited: ${params.prompt.substring(0, 40)}`,
      description: params.prompt,
      type: DiagramType.EditedImage,
      category: DiagramCategory.Image,
      content: result.imageUrl,
      isPublic: params.isPublic,
      createdAt: new Date(),
      updatedAt: new Date(),
      tokensUsed: 0,
      metadata: result.metadata
    };

    this.stateManager.addDiagram(diagram);
    return diagram;
  }

  /**
   * Update diagram
   */
  async update(id: string, updates: Partial<Diagram>): Promise<Diagram> {
    const success = this.stateManager.updateDiagram(id, updates);
    if (!success) {
      throw new Error(`Diagram not found: ${id}`);
    }

    const diagram = this.stateManager.getDiagram(id);
    if (!diagram) {
      throw new Error(`Diagram not found: ${id}`);
    }

    return diagram;
  }

  /**
   * Delete diagram
   */
  async delete(id: string): Promise<void> {
    const success = this.stateManager.removeDiagram(id);
    if (!success) {
      throw new Error(`Diagram not found: ${id}`);
    }
  }

  /**
   * Get diagram by ID
   */
  async get(id: string): Promise<Diagram | undefined> {
    return this.stateManager.getDiagram(id);
  }

  /**
   * Get all diagrams
   */
  async getAll(): Promise<Diagram[]> {
    return this.stateManager.getAllDiagrams();
  }

  /**
   * Search diagrams
   */
  async search(query: string): Promise<Diagram[]> {
    return this.stateManager.searchDiagrams(query);
  }

  /**
   * Get recent diagrams
   */
  async getRecent(limit?: number): Promise<Diagram[]> {
    return this.stateManager.getRecentDiagrams(limit);
  }

  /**
   * Regenerate a diagram
   */
  async regenerate(id: string): Promise<Diagram> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Diagram not found: ${id}`);
    }

    // Generate new diagram with same parameters
    const params: GenerateDiagramParams = {
      prompt: existing.description,
      type: existing.type,
      colorPalette: existing.metadata?.colorPalette,
      complexityLevel: existing.metadata?.complexityLevel,
      isPublic: existing.isPublic
    };

    const newDiagram = await this.generate(params);

    // Update existing diagram with new content
    return await this.update(id, {
      content: newDiagram.content,
      tokensUsed: newDiagram.tokensUsed,
      updatedAt: new Date()
    });
  }

  /**
   * Duplicate a diagram
   */
  async duplicate(id: string): Promise<Diagram> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Diagram not found: ${id}`);
    }

    const duplicate: Diagram = {
      ...existing,
      id: this.generateId(),
      title: `${existing.title} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.stateManager.addDiagram(duplicate);
    return duplicate;
  }

  /**
   * Helper: Generate unique ID
   */
  private generateId(): string {
    return `diagram_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Helper: Get category for diagram type
   */
  private getCategoryForType(type: DiagramType): DiagramCategory {
    switch (type) {
      case DiagramType.Infographic:
      case DiagramType.Illustration:
        return DiagramCategory.SVG;

      case DiagramType.GeneratedImage:
      case DiagramType.EditedImage:
        return DiagramCategory.Image;

      default:
        return DiagramCategory.Mermaid;
    }
  }
}
