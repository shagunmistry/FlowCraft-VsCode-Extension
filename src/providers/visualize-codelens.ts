import * as vscode from "vscode";

export const CODELENS_SETTING = "codeLens.enabled";

export const VISUALIZE_LENS_LANGUAGES = [
  "typescript",
  "typescriptreact",
  "javascript",
  "javascriptreact",
  "python",
  "java",
  "go",
  "ruby",
  "csharp",
];

/**
 * Shows a single "Visualize this file" lens at the top of source files.
 * Dispatches to flowcraft.codeLensVisualize (extension.ts), which records
 * telemetry and runs flowcraft.visualizeThis on the document.
 */
export class VisualizeCodeLensProvider implements vscode.CodeLensProvider {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.changed.event;

  private readonly configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(`flowcraft.${CODELENS_SETTING}`)) {
      this.changed.fire();
    }
  });

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const enabled = vscode.workspace
      .getConfiguration("flowcraft", document.uri)
      .get<boolean>(CODELENS_SETTING, true);
    if (!enabled) {
      return [];
    }
    const range = new vscode.Range(0, 0, 0, 0);
    return [
      new vscode.CodeLens(range, {
        title: "$(sparkle) Visualize this file",
        tooltip: "Generate a diagram of this file with FlowCraft",
        command: "flowcraft.codeLensVisualize",
        arguments: [document.uri],
      }),
    ];
  }

  dispose(): void {
    this.configListener.dispose();
    this.changed.dispose();
  }
}
