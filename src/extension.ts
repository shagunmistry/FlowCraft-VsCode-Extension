import * as vscode from "vscode";
import FlowCraftChatParticipant from "./ChatParticipantHandler";
import { StateManager } from "./state/state-manager";
import { APIKeyService } from "./services/api-key-service";
import { UsageService } from "./services/usage-service";
import { FlowCraftClient } from "./api/flowcraft-client";
import { WelcomeViewProvider } from "./views/welcome-view";
import { SettingsViewProvider } from "./views/settings-view";
import { initLogger } from "./utils/logger";

const FLOWCRAFT_API_URL = "https://flowcraft-api-cb66lpneaq-ue.a.run.app";
const OPENAI_KEY_SECRET = "flowcraft.openai.key";

const GENERATE_FLOW_DIAGRAM = "flowcraft.generateFlowDiagram";
const GENERATE_SELECTION_FLOW_DIAGRAM =
  "flowcraft.generateFlowDiagramFromSelection";
const GENERATE_CLASS_DIAGRAM = "flowcraft.generateClassDiagram";
const GENERATE_SELECTION_CLASS_DIAGRAM =
  "flowcraft.generateClassDiagramFromSelection";

async function getSelectionText() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return "";
  }

  const selection = editor.selection;
  const text = editor.document.getText(selection);

  return text;
}

async function getCurrentOpenFileText() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return "";
  }

  const text = editor.document.getText();

  return text;
}

async function getOpenAIKey(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  return await context.secrets.get(OPENAI_KEY_SECRET);
}

async function promptForOpenAIKey(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  const apiKey = await vscode.window.showInputBox({
    prompt: "Please enter your OpenAI API key (starts with 'sk-')",
    placeHolder: "sk-...",
    password: true,
    ignoreFocusOut: true,
    validateInput: (value: string) => {
      if (!value.startsWith("sk-")) {
        return 'OpenAI API key should start with "sk-"';
      }
      if (value.length < 20) {
        return "Invalid API key length";
      }
      return null;
    },
  });

  if (apiKey) {
    await context.secrets.store(OPENAI_KEY_SECRET, apiKey);
    return apiKey;
  }
  return undefined;
}

async function ensureOpenAIKey(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  let apiKey = await getOpenAIKey(context);

  if (!apiKey) {
    apiKey = await promptForOpenAIKey(context);
  }

  return apiKey;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "flowcraft" is now active!');

  // Initialize Logger
  initLogger('FlowCraft');

  // Initialize Core Services
  const stateManager = new StateManager(context);
  const apiKeyService = new APIKeyService(context);
  await apiKeyService.migrateOldKeys(); // Migrate legacy keys

  const apiClient = new FlowCraftClient({
    baseURL: process.env.FLOWCRAFT_API_URL || FLOWCRAFT_API_URL
  });

  const usageService = new UsageService(apiClient, stateManager, apiKeyService);

  // Initialize View Providers
  const welcomeProvider = new WelcomeViewProvider(context.extensionUri, stateManager, usageService);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(WelcomeViewProvider.viewType, welcomeProvider)
  );

  const settingsProvider = new SettingsViewProvider(context.extensionUri, stateManager, apiKeyService);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SettingsViewProvider.viewType, settingsProvider)
  );

  const chatParticipant = new FlowCraftChatParticipant();

  let resetKeyCommand = vscode.commands.registerCommand(
    "flowcraft.resetApiKey",
    async () => {
      await context.secrets.delete(OPENAI_KEY_SECRET);
      vscode.window.showInformationMessage(
        "API key has been reset. You will be prompted for a new key on next use."
      );
    }
  );

  let openSettingsCommand = vscode.commands.registerCommand(
    "flowcraft.openSettings",
    async () => {
      // Focus the settings view
      await vscode.commands.executeCommand('flowcraft.settingsView.focus');
    }
  );

  let generateFlowDiagramDisposable = vscode.commands.registerCommand(
    GENERATE_FLOW_DIAGRAM,
    async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating Diagram from FlowCraft",
          cancellable: false,
        },
        (progress, _token) => {
          progress.report({ increment: 0 });
          return new Promise<void>(async (resolve) => {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
              vscode.window.showErrorMessage(
                "No active editor found. Please open a file to generate a diagram."
              );
              return;
            }
            const fileName = activeEditor.document.fileName;
            const fileExtension = fileName.split(".").pop();

            progress.report({ increment: 20 });

            if (!fileExtension) {
              vscode.window.showErrorMessage(
                "Please save the file with a valid extension."
              );
              return;
            }

            const fileContent = activeEditor.document.getText();
            if (fileContent.length === 0 || fileContent.length > 10000) {
              vscode.window.showErrorMessage(
                "The file content is either empty or too large (max 10,000 characters). If you have a large file, please contact us at https://flowcraft.app/support."
              );
              return;
            }

            const flowCraftApiUrl =
              process.env.FLOWCRAFT_API_URL || FLOWCRAFT_API_URL;

            let title = fileName.split("\\").pop();
            title = title?.replace(/\s/g, "_");
            const body = {
              title,
              description: fileContent,
              type: "flowchart",
            };

            progress.report({ increment: 40 });

            const apiKey = await ensureOpenAIKey(context);
            if (!apiKey) {
              vscode.window.showErrorMessage(
                "FlowCraft needs an OpenAI API key to function."
              );
              return;
            }

            fetch(`${flowCraftApiUrl}/diagrams/generate`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-OpenAI-Key": apiKey,
              },
              body: JSON.stringify(body),
            })
              .then((response) => response.json())
              .then((data: any) => {
                progress.report({ increment: 80 });
                console.log("RESPONSE Data: ", data.response);

                const _res = data.response;
                let diagram = _res.mermaid_code;
                console.log("Diagram: ", diagram);

                const inserted_diagram = _res.inserted_diagram;

                console.log("Inserted Diagram: ", inserted_diagram);
                if (
                  inserted_diagram &&
                  inserted_diagram.data &&
                  inserted_diagram.data.length > 0
                ) {
                  progress.report({ increment: 100 });
                  const diagramUrl = `https://flowcraft.app/vscode/${inserted_diagram.data[0].id}`;

                  vscode.env.openExternal(vscode.Uri.parse(diagramUrl));

                  vscode.window
                    .showInformationMessage(
                      "The diagram has been successfully generated. If the diagram does not open automatically, please click on the link below.",
                      "Open Diagram"
                    )
                    .then((selection) => {
                      if (selection === "Open Diagram") {
                        vscode.env.openExternal(vscode.Uri.parse(diagramUrl));
                      }
                    });
                } else {
                  vscode.window.showErrorMessage(
                    "An error occurred while generating the diagram. Please try again later."
                  );
                }

                resolve();
              })
              .catch((error) => {
                vscode.window.showErrorMessage(
                  "An error occurred while generating the diagram. Please try again later."
                );

                console.error("Error: ", error);
                return;
              });
          });
        }
      );
    }
  );

  let generateSelectionDiagramDisposable = vscode.commands.registerCommand(
    GENERATE_SELECTION_FLOW_DIAGRAM,
    async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating Diagram from FlowCraft",
          cancellable: false,
        },
        (progress, _token) => {
          progress.report({ increment: 0 });
          return new Promise<void>(async (resolve) => {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
              vscode.window.showErrorMessage(
                "No active editor found. Please open a file to generate a diagram."
              );
              return;
            }

            const selection = activeEditor.document.getText(
              activeEditor.selection
            );

            if (selection.length === 0 || selection.length > 10000) {
              vscode.window.showErrorMessage(
                "The selection is either empty or too large (max 10,000 characters). If you have a large selection, please contact us at https://flowcraft.app/support."
              );
              return;
            }

            const flowCraftApiUrl =
              process.env.FLOWCRAFT_API_URL || FLOWCRAFT_API_URL;

            let title = activeEditor.document.fileName || "Untitled";
            const fileNameOnly = title.split("\\").pop() || "Untitled";
            title = fileNameOnly.replace(/\s/g, "_");
            const body = {
              title,
              description: selection,
              type: "flowchart",
            };

            progress.report({ increment: 40 });

            const apiKey = await ensureOpenAIKey(context);
            if (!apiKey) {
              vscode.window.showErrorMessage(
                "FlowCraft needs an OpenAI API key to function."
              );
              return;
            }

            fetch(`${flowCraftApiUrl}/diagrams/generate`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-OpenAI-Key": apiKey,
              },
              body: JSON.stringify(body),
            })
              .then((response) => response.json())
              .then((data: any) => {
                progress.report({ increment: 80 });
                console.log("RESPONSE Data: ", data.response);

                const _res = data.response;
                let diagram = _res.mermaid_code;
                console.log("Diagram: ", diagram);

                const inserted_diagram = _res.inserted_diagram;

                console.log("Inserted Diagram: ", inserted_diagram);
                if (
                  inserted_diagram &&
                  inserted_diagram.data &&
                  inserted_diagram.data.length > 0
                ) {
                  progress.report({ increment: 100 });
                  const diagramUrl = `https://flowcraft.app/vscode/${inserted_diagram.data[0].id}`;

                  vscode.env.openExternal(vscode.Uri.parse(diagramUrl));
                  vscode.window
                    .showInformationMessage(
                      "The diagram has been successfully generated. If the diagram does not open automatically, please click on the link below.",
                      "Open Diagram"
                    )
                    .then((selection) => {
                      if (selection === "Open Diagram") {
                        vscode.env.openExternal(vscode.Uri.parse(diagramUrl));
                      }
                    });
                }

                resolve();
              })
              .catch((error) => {
                vscode.window.showErrorMessage(
                  "An error occurred while generating the diagram. Please try again later."
                );

                console.error("Error: ", error);
                return;
              });
          });
        }
      );
    }
  );

  let generateClassDiagramDisposable = vscode.commands.registerCommand(
    GENERATE_CLASS_DIAGRAM,
    async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating Diagram from FlowCraft",
          cancellable: false,
        },
        (progress, _token) => {
          progress.report({ increment: 0 });
          return new Promise<void>(async (resolve) => {
            const fileContext = await getCurrentOpenFileText();

            if (fileContext.length === 0 || fileContext.length > 10000) {
              vscode.window.showErrorMessage(
                "The file content is either empty or too large (max 10,000 characters). If you have a large file, please contact us at https://flowcraft.app/support."
              );
              return;
            }

            const flowCraftApiUrl =
              process.env.FLOWCRAFT_API_URL || FLOWCRAFT_API_URL;

            let title = `Class Diagram - ${new Date().toISOString()}`;
            title = title?.replace(/\s/g, "_");
            const body = {
              title,
              description: fileContext,
              type: "classDiagram",
            };

            progress.report({ increment: 40 });

            const apiKey = await ensureOpenAIKey(context);
            if (!apiKey) {
              vscode.window.showErrorMessage(
                "FlowCraft needs an OpenAI API key to function."
              );
              return;
            }

            fetch(`${flowCraftApiUrl}/diagrams/generate`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-OpenAI-Key": apiKey,
              },
              body: JSON.stringify(body),
            })
              .then((response) => response.json())
              .then((data: any) => {
                progress.report({ increment: 80 });
                console.log("RESPONSE Data: ", data.response);

                const _res = data.response;
                let diagram = _res.mermaid_code;
                console.log("Diagram: ", diagram);

                const inserted_diagram = _res.inserted_diagram;

                console.log("Inserted Diagram: ", inserted_diagram);
                if (
                  inserted_diagram &&
                  inserted_diagram.data &&
                  inserted_diagram.data.length > 0
                ) {
                  progress.report({ increment: 100 });
                  const diagramUrl = `https://flowcraft.app/vscode/${inserted_diagram.data[0].id}`;

                  vscode.env.openExternal(vscode.Uri.parse(diagramUrl));

                  vscode.window
                    .showInformationMessage(
                      "The diagram has been successfully generated. If the diagram does not open automatically, please click on the link below.",
                      "Open Diagram"
                    )
                    .then((selection) => {
                      if (selection === "Open Diagram") {
                        vscode.env.openExternal(vscode.Uri.parse(diagramUrl));
                      }
                    });
                }

                resolve();
              })
              .catch((error) => {
                vscode.window.showErrorMessage(
                  "An error occurred while generating the diagram. Please try again later."
                );

                console.error("Error: ", error);
                return;
              });
          });
        }
      );
    }
  );

  let generateSelectionClassDiagramDisposable = vscode.commands.registerCommand(
    GENERATE_SELECTION_CLASS_DIAGRAM,
    async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating Diagram from FlowCraft",
          cancellable: false,
        },
        (progress, _token) => {
          progress.report({ increment: 0 });
          return new Promise<void>(async (resolve) => {
            const selection = await getSelectionText();

            if (selection.length === 0 || selection.length > 10000) {
              vscode.window.showErrorMessage(
                "The selection is either empty or too large (max 10,000 characters). If you have a large selection, please contact us at https://flowcraft.app/support."
              );
              return;
            }

            const flowCraftApiUrl =
              process.env.FLOWCRAFT_API_URL || FLOWCRAFT_API_URL;

            let title = `Class Diagram - ${new Date().toISOString()}`;
            title = title?.replace(/\s/g, "_");
            const body = {
              title,
              description: selection,
              type: "classDiagram",
            };

            progress.report({ increment: 40 });

            const apiKey = await ensureOpenAIKey(context);
            if (!apiKey) {
              vscode.window.showErrorMessage(
                "FlowCraft needs an OpenAI API key to function."
              );
              return;
            }

            fetch(`${flowCraftApiUrl}/diagrams/generate`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-OpenAI-Key": apiKey,
              },
              body: JSON.stringify(body),
            })
              .then((response) => response.json())
              .then((data: any) => {
                progress.report({ increment: 80 });
                console.log("RESPONSE Data: ", data.response);

                const _res = data.response;
                let diagram = _res.mermaid_code;
                console.log("Diagram: ", diagram);

                const inserted_diagram = _res.inserted_diagram;

                console.log("Inserted Diagram: ", inserted_diagram);
                if (
                  inserted_diagram &&
                  inserted_diagram.data &&
                  inserted_diagram.data.length > 0
                ) {
                  progress.report({ increment: 100 });
                  const diagramUrl = `https://flowcraft.app/vscode/${inserted_diagram.data[0].id}`;

                  vscode.env.openExternal(vscode.Uri.parse(diagramUrl));

                  vscode.window
                    .showInformationMessage(
                      "The diagram has been successfully generated. If the diagram does not open automatically, please click on the link below.",
                      "Open Diagram"
                    )
                    .then((selection) => {
                      if (selection === "Open Diagram") {
                        vscode.env.openExternal(vscode.Uri.parse(diagramUrl));
                      }
                    });
                }

                resolve();
              })
              .catch((error) => {
                vscode.window.showErrorMessage(
                  "An error occurred while generating the diagram from the selection. Please try again later."
                );

                console.error("Error: ", error);
                return;
              });
          });
        }
      );
    }
  );

  const chatHandler = vscode.chat.createChatParticipant(
    "flowcraft.diagramAssistant",
    chatParticipant.handleRequest
  );

  context.subscriptions.push(generateFlowDiagramDisposable);
  context.subscriptions.push(generateSelectionDiagramDisposable);
  context.subscriptions.push(generateClassDiagramDisposable);
  context.subscriptions.push(generateSelectionClassDiagramDisposable);
  context.subscriptions.push(resetKeyCommand);
  context.subscriptions.push(openSettingsCommand);
  context.subscriptions.push(chatHandler);
}

// This method is called when your extension is deactivated
export function deactivate() {}
