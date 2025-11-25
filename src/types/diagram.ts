/**
 * Diagram-related type definitions
 */

export enum DiagramType {
  Flowchart = 'flowchart',
  Sequence = 'sequence',
  Class = 'class',
  State = 'state',
  ER = 'er',
  Gantt = 'gantt',
  Pie = 'pie',
  Infographic = 'infographic',
  Illustration = 'illustration',
  GeneratedImage = 'generated_image',
  EditedImage = 'edited_image'
}

export enum DiagramCategory {
  Mermaid = 'mermaid',
  SVG = 'svg',
  Image = 'image'
}

export interface Diagram {
  id: string;
  title: string;
  description: string;
  type: DiagramType;
  category: DiagramCategory;
  content: string; // Mermaid code, SVG code, or image URL
  thumbnailUrl?: string;
  metadata?: DiagramMetadata;
  userId?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  tokensUsed: number;
  tags?: string[];
}

export interface DiagramMetadata {
  colorPalette?: string;
  complexityLevel?: 'simple' | 'medium' | 'complex';
  aspectRatio?: string;
  seed?: number;
  outputFormat?: string;
  safetyTolerance?: number;
  originalUrl?: string;
  storagePath?: string;
  [key: string]: any;
}

export interface CreateDiagramParams {
  title: string;
  description: string;
  type: DiagramType;
  colorPalette?: string;
  complexityLevel?: 'simple' | 'medium' | 'complex';
  isPublic: boolean;
}

export interface GenerateDiagramParams {
  prompt: string;
  type: DiagramType;
  colorPalette?: string;
  complexityLevel?: 'simple' | 'medium' | 'complex';
  isPublic: boolean;
}

export interface GenerateImageParams {
  prompt: string;
  aspectRatio?: string;
  seed?: number;
  outputFormat?: string;
  safetyTolerance?: number;
  isPublic: boolean;
}

export interface EditImageParams {
  prompt: string;
  inputImage: string;
  aspectRatio?: string;
  seed?: number;
  outputFormat?: string;
  safetyTolerance?: number;
  isPublic: boolean;
}

export interface DiagramResult {
  code: string;
  title: string;
  diagramId: string;
  userId?: string;
  colorPalette?: string;
  complexityLevel?: string;
  tokensUsed?: number;
}

export interface ImageResult {
  imageUrl: string;
  diagramId: string;
  userId?: string;
  metadata?: any;
}

export enum ExportFormat {
  SVG = 'svg',
  PNG = 'png',
  PDF = 'pdf',
  JPEG = 'jpeg'
}

export interface ExportOptions {
  format: ExportFormat;
  scale?: number;
  quality?: number;
  backgroundColor?: string;
}

export interface DiagramTreeItem {
  diagram: Diagram;
  label: string;
  description?: string;
}
