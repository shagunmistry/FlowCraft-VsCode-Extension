/**
 * Export Service - Handle diagram exports to various formats
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { Diagram, ExportFormat, ExportOptions, DiagramCategory } from '../types';

export class ExportService {
  /**
   * Export diagram to file
   */
  async export(
    diagram: Diagram,
    options: ExportOptions
  ): Promise<string> {
    // Get save location from user
    const defaultFileName = this.getSafeFileName(diagram.title, options.format);

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultFileName),
      filters: this.getFileFilters(options.format)
    });

    if (!uri) {
      throw new Error('Export cancelled');
    }

    const filePath = uri.fsPath;

    // Export based on format
    switch (options.format) {
      case ExportFormat.SVG:
        await this.exportSVG(diagram, filePath, options);
        break;

      case ExportFormat.PNG:
        await this.exportPNG(diagram, filePath, options);
        break;

      case ExportFormat.PDF:
        await this.exportPDF(diagram, filePath, options);
        break;

      case ExportFormat.JPEG:
        await this.exportJPEG(diagram, filePath, options);
        break;

      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    vscode.window.showInformationMessage(`Diagram exported to ${filePath}`);
    return filePath;
  }

  /**
   * Export to SVG
   */
  private async exportSVG(
    diagram: Diagram,
    filePath: string,
    _options: ExportOptions
  ): Promise<void> {
    let content: string;

    if (diagram.category === DiagramCategory.SVG) {
      // Already SVG
      content = diagram.content;
    } else if (diagram.category === DiagramCategory.Mermaid) {
      // Would need to render Mermaid to SVG
      // This is a placeholder - actual implementation would use Mermaid rendering
      content = `<svg><!-- Mermaid diagram would be rendered here --></svg>`;
    } else {
      throw new Error('Cannot export image diagram to SVG');
    }

    await fs.promises.writeFile(filePath, content, 'utf8');
  }

  /**
   * Export to PNG
   */
  private async exportPNG(
    _diagram: Diagram,
    _filePath: string,
    _options: ExportOptions
  ): Promise<void> {
    // This would require rendering the diagram and converting to PNG
    // Placeholder implementation
    throw new Error('PNG export not yet implemented');
  }

  /**
   * Export to PDF
   */
  private async exportPDF(
    _diagram: Diagram,
    _filePath: string,
    _options: ExportOptions
  ): Promise<void> {
    // This would require rendering the diagram and converting to PDF
    // Placeholder implementation
    throw new Error('PDF export not yet implemented');
  }

  /**
   * Export to JPEG
   */
  private async exportJPEG(
    _diagram: Diagram,
    _filePath: string,
    _options: ExportOptions
  ): Promise<void> {
    // This would require rendering the diagram and converting to JPEG
    // Placeholder implementation
    throw new Error('JPEG export not yet implemented');
  }

  /**
   * Copy diagram to clipboard
   */
  async copyToClipboard(diagram: Diagram): Promise<void> {
    if (diagram.category === DiagramCategory.Image) {
      // For images, copy the URL
      await vscode.env.clipboard.writeText(diagram.content);
      vscode.window.showInformationMessage('Image URL copied to clipboard');
    } else {
      // For code/SVG, copy the content
      await vscode.env.clipboard.writeText(diagram.content);
      vscode.window.showInformationMessage('Diagram code copied to clipboard');
    }
  }

  /**
   * Get file filters for save dialog
   */
  private getFileFilters(format: ExportFormat): { [name: string]: string[] } {
    switch (format) {
      case ExportFormat.SVG:
        return { 'SVG Files': ['svg'] };
      case ExportFormat.PNG:
        return { 'PNG Images': ['png'] };
      case ExportFormat.PDF:
        return { 'PDF Documents': ['pdf'] };
      case ExportFormat.JPEG:
        return { 'JPEG Images': ['jpg', 'jpeg'] };
      default:
        return { 'All Files': ['*'] };
    }
  }

  /**
   * Get safe file name
   */
  private getSafeFileName(title: string, format: ExportFormat): string {
    // Remove invalid characters
    const safe = title.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
    const extension = format.toString();
    return `${safe}.${extension}`;
  }
}
