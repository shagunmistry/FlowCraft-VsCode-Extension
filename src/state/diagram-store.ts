/**
 * Diagram store - manages diagram state
 */

import { Diagram } from '../types';

export class DiagramStore {
  private diagrams: Map<string, Diagram> = new Map();

  /**
   * Add a diagram to the store
   */
  add(diagram: Diagram): void {
    this.diagrams.set(diagram.id, diagram);
  }

  /**
   * Remove a diagram from the store
   */
  remove(id: string): boolean {
    return this.diagrams.delete(id);
  }

  /**
   * Get a diagram by ID
   */
  get(id: string): Diagram | undefined {
    return this.diagrams.get(id);
  }

  /**
   * Get all diagrams
   */
  getAll(): Diagram[] {
    return Array.from(this.diagrams.values());
  }

  /**
   * Update a diagram
   */
  update(id: string, updates: Partial<Diagram>): boolean {
    const diagram = this.diagrams.get(id);
    if (!diagram) {
      return false;
    }

    const updated = {
      ...diagram,
      ...updates,
      updatedAt: new Date()
    };

    this.diagrams.set(id, updated);
    return true;
  }

  /**
   * Filter diagrams by type
   */
  filterByType(type: string): Diagram[] {
    return this.getAll().filter(d => d.type === type);
  }

  /**
   * Filter diagrams by category
   */
  filterByCategory(category: string): Diagram[] {
    return this.getAll().filter(d => d.category === category);
  }

  /**
   * Search diagrams
   */
  search(query: string): Diagram[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      d =>
        d.title.toLowerCase().includes(lowerQuery) ||
        d.description.toLowerCase().includes(lowerQuery) ||
        d.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get recent diagrams
   */
  getRecent(limit: number = 10): Diagram[] {
    return this.getAll()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Clear all diagrams
   */
  clear(): void {
    this.diagrams.clear();
  }

  /**
   * Get count of diagrams
   */
  count(): number {
    return this.diagrams.size;
  }

  /**
   * Check if diagram exists
   */
  has(id: string): boolean {
    return this.diagrams.has(id);
  }

  /**
   * Convert to JSON for persistence
   */
  toJSON(): any {
    return Array.from(this.diagrams.values());
  }

  /**
   * Load from JSON
   */
  fromJSON(data: any[]): void {
    this.clear();
    for (const item of data) {
      const diagram: Diagram = {
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt)
      };
      this.add(diagram);
    }
  }
}
