/**
 * State Manager - Central state management for the extension
 */

import * as vscode from 'vscode';
import { Diagram, Settings, UsageStats, EventListener, Disposable } from '../types';
import { DiagramStore } from './diagram-store';
import { SettingsStore } from './settings-store';
import { UsageStore } from './usage-store';

export interface State {
  diagrams: Diagram[];
  settings: Settings;
  usage: UsageStats;
}

export class StateManager {
  private diagramStore: DiagramStore;
  private settingsStore: SettingsStore;
  private usageStore: UsageStore;
  private context: vscode.ExtensionContext;
  private listeners: Set<EventListener<State>> = new Set();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.diagramStore = new DiagramStore();
    this.settingsStore = new SettingsStore();
    this.usageStore = new UsageStore();

    // Load persisted state
    this.load();
  }

  // Diagram operations

  addDiagram(diagram: Diagram): void {
    this.diagramStore.add(diagram);
    this.usageStore.incrementCreated();
    this.persist();
    this.notifyListeners();
  }

  removeDiagram(id: string): boolean {
    const result = this.diagramStore.remove(id);
    if (result) {
      this.persist();
      this.notifyListeners();
    }
    return result;
  }

  getDiagram(id: string): Diagram | undefined {
    return this.diagramStore.get(id);
  }

  getAllDiagrams(): Diagram[] {
    return this.diagramStore.getAll();
  }

  updateDiagram(id: string, updates: Partial<Diagram>): boolean {
    const result = this.diagramStore.update(id, updates);
    if (result) {
      this.persist();
      this.notifyListeners();
    }
    return result;
  }

  searchDiagrams(query: string): Diagram[] {
    return this.diagramStore.search(query);
  }

  getRecentDiagrams(limit?: number): Diagram[] {
    return this.diagramStore.getRecent(limit);
  }

  // Settings operations

  getSettings(): Settings {
    return this.settingsStore.getAll();
  }

  updateSettings(updates: Partial<Settings>): void {
    this.settingsStore.update(updates);
    this.persist();
    this.notifyListeners();
  }

  getSetting<K extends keyof Settings>(key: K): Settings[K] {
    return this.settingsStore.get(key);
  }

  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settingsStore.set(key, value);
    this.persist();
    this.notifyListeners();
  }

  // Usage operations

  getUsage(): UsageStats {
    return this.usageStore.get();
  }

  updateUsage(stats: Partial<UsageStats>): void {
    this.usageStore.update(stats);
    this.persist();
    this.notifyListeners();
  }

  canCreateDiagram(): boolean {
    return this.usageStore.canCreate();
  }

  getRemainingDiagrams(): number {
    return this.usageStore.getRemaining();
  }

  // State snapshot

  getState(): State {
    return {
      diagrams: this.diagramStore.getAll(),
      settings: this.settingsStore.getAll(),
      usage: this.usageStore.get()
    };
  }

  // Event handling

  onStateChange(listener: EventListener<State>): Disposable {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      }
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  // Persistence

  private async persist(): Promise<void> {
    try {
      // Persist to workspace state
      await this.context.workspaceState.update(
        'flowcraft.diagrams',
        this.diagramStore.toJSON()
      );

      await this.context.globalState.update(
        'flowcraft.settings',
        this.settingsStore.toJSON()
      );

      await this.context.globalState.update(
        'flowcraft.usage',
        this.usageStore.toJSON()
      );
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }

  private async load(): Promise<void> {
    try {
      // Load from workspace state
      const diagrams = this.context.workspaceState.get<any[]>(
        'flowcraft.diagrams',
        []
      );
      this.diagramStore.fromJSON(diagrams);

      const settings = this.context.globalState.get<any>(
        'flowcraft.settings'
      );
      if (settings) {
        this.settingsStore.fromJSON(settings);
      }

      const usage = this.context.globalState.get<any>(
        'flowcraft.usage'
      );
      if (usage) {
        this.usageStore.fromJSON(usage);
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }

  // Utility methods

  clearDiagrams(): void {
    this.diagramStore.clear();
    this.persist();
    this.notifyListeners();
  }

  resetSettings(): void {
    this.settingsStore.reset();
    this.persist();
    this.notifyListeners();
  }

  resetUsage(): void {
    this.usageStore.reset();
    this.persist();
    this.notifyListeners();
  }

  async clearAll(): Promise<void> {
    this.diagramStore.clear();
    this.settingsStore.reset();
    this.usageStore.reset();
    await this.persist();
    this.notifyListeners();
  }
}
