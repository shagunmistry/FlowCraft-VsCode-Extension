import * as vscode from "vscode";

export const STATUS_BAR_SETTING = "statusBar.enabled";
export const FREE_REMAINING_KEY = "flowcraft.freeRemaining";

export interface StatusBarDeps {
  hasApiKey: () => Promise<boolean>;
  getFreeRemaining: () => number | undefined;
  track: (event: "statusbar_clicked", props?: { outcome?: string }) => void;
}

/** True when the free no-key path should be advertised instead of Visualize. */
export function shouldOfferTryFree(hasKey: boolean, freeRemaining: number | undefined): boolean {
  // Unknown remaining (never used the free taste) counts as available.
  return !hasKey && (freeRemaining === undefined || freeRemaining > 0);
}

/**
 * Persistent entry point in the status bar: "Try free" for users without a key
 * who still have free diagrams, otherwise "Visualize".
 */
export class FlowCraftStatusBar implements vscode.Disposable {
  static readonly COMMAND = "flowcraft.statusBarClick";

  private readonly item: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];
  private mode: "tryFree" | "visualize" = "visualize";

  constructor(private readonly deps: StatusBarDeps) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.disposables.push(
      this.item,
      vscode.commands.registerCommand(FlowCraftStatusBar.COMMAND, () => {
        this.deps.track("statusbar_clicked", { outcome: this.mode });
        return vscode.commands.executeCommand(
          this.mode === "tryFree" ? "flowcraft.tryFree" : "flowcraft.visualizeThis"
        );
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(`flowcraft.${STATUS_BAR_SETTING}`)) {
          void this.refresh();
        }
      })
    );
    this.item.command = FlowCraftStatusBar.COMMAND;
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const enabled = vscode.workspace
      .getConfiguration("flowcraft")
      .get<boolean>(STATUS_BAR_SETTING, true);
    if (!enabled) {
      this.item.hide();
      return;
    }
    const hasKey = await this.deps.hasApiKey().catch(() => false);
    this.mode = shouldOfferTryFree(hasKey, this.deps.getFreeRemaining()) ? "tryFree" : "visualize";
    this.item.text = this.mode === "tryFree" ? "$(sparkle) FlowCraft: Try free" : "$(sparkle) FlowCraft: Visualize";
    this.item.tooltip =
      this.mode === "tryFree"
        ? "Generate a diagram with no API key"
        : "Visualize the current file or selection as a diagram";
    this.item.show();
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
