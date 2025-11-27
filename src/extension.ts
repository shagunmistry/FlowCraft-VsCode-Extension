import * as vscode from "vscode";
import FlowCraftChatParticipant from "./ChatParticipantHandler";
import { StateManager } from "./state/state-manager";
import { APIKeyService } from "./services/api-key-service";
import { UsageService } from "./services/usage-service";
import { DiagramService } from "./services/diagram-service";
import { FlowCraftClient } from "./api/flowcraft-client";
import { WelcomeViewProvider } from "./views/welcome-view";
import { SettingsViewProvider } from "./views/settings-view";
import { initLogger } from "./utils/logger";
import { Provider } from "./types";

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

async function getProviderApiKey(
  apiKeyService: APIKeyService,
  provider: Provider
): Promise<string | undefined> {
  return await apiKeyService.retrieve(provider);
}

async function promptForProviderApiKey(
  apiKeyService: APIKeyService,
  provider: Provider
): Promise<string | undefined> {
  // Get provider-specific validation info
  let prompt = "";
  let placeholder = "";
  let validateInput: (value: string) => string | null;

  switch (provider) {
    case Provider.OpenAI:
      prompt = "Please enter your OpenAI API key (starts with 'sk-')";
      placeholder = "sk-...";
      validateInput = (value: string) => {
        if (!value.startsWith("sk-")) {
          return 'OpenAI API key should start with "sk-"';
        }
        if (value.length < 20) {
          return "Invalid API key length";
        }
        return null;
      };
      break;
    case Provider.Anthropic:
      prompt = "Please enter your Anthropic API key (starts with 'sk-ant-')";
      placeholder = "sk-ant-...";
      validateInput = (value: string) => {
        if (!value.startsWith("sk-ant-")) {
          return 'Anthropic API key should start with "sk-ant-"';
        }
        if (value.length < 20) {
          return "Invalid API key length";
        }
        return null;
      };
      break;
    case Provider.Google:
      prompt = "Please enter your Google (Gemini) API key";
      placeholder = "Your Google API key";
      validateInput = (value: string) => {
        if (value.length < 20) {
          return "Invalid API key length";
        }
        return null;
      };
      break;
    case Provider.FlowCraft:
      prompt = "Please enter your FlowCraft API key";
      placeholder = "Your FlowCraft API key";
      validateInput = (value: string) => {
        if (value.length < 10) {
          return "Invalid API key length";
        }
        return null;
      };
      break;
    default:
      prompt = `Please enter your ${provider} API key`;
      placeholder = "API key";
      validateInput = (value: string) => {
        if (value.length < 10) {
          return "Invalid API key length";
        }
        return null;
      };
  }

  const apiKey = await vscode.window.showInputBox({
    prompt,
    placeHolder: placeholder,
    password: true,
    ignoreFocusOut: true,
    validateInput,
  });

  if (apiKey) {
    await apiKeyService.store(provider, apiKey);
    return apiKey;
  }
  return undefined;
}

async function ensureProviderApiKey(
  stateManager: StateManager,
  apiKeyService: APIKeyService
): Promise<string | undefined> {
  // Get the default provider from settings
  const defaultProvider = stateManager.getSetting("defaultProvider");

  // Check if API key exists for the default provider
  let apiKey = await getProviderApiKey(apiKeyService, defaultProvider);

  // If not, prompt for it
  if (!apiKey) {
    apiKey = await promptForProviderApiKey(apiKeyService, defaultProvider);
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
  initLogger("FlowCraft");

  // Initialize Core Services
  const stateManager = new StateManager(context);
  const apiKeyService = new APIKeyService(context);
  await apiKeyService.migrateOldKeys(); // Migrate legacy keys

  const apiClient = new FlowCraftClient({
    baseURL: process.env.FLOWCRAFT_API_URL || FLOWCRAFT_API_URL,
  });

  const usageService = new UsageService(apiClient, stateManager, apiKeyService);
  const diagramService = new DiagramService(
    apiClient,
    stateManager,
    apiKeyService
  );

  // Initialize View Providers
  const welcomeProvider = new WelcomeViewProvider(
    context.extensionUri,
    stateManager,
    usageService
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WelcomeViewProvider.viewType,
      welcomeProvider
    )
  );

  const settingsProvider = new SettingsViewProvider(
    context.extensionUri,
    stateManager,
    apiKeyService
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SettingsViewProvider.viewType,
      settingsProvider
    )
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
      await vscode.commands.executeCommand("flowcraft.settingsView.focus");
    }
  );

  let openGenerationViewCommand = vscode.commands.registerCommand(
    "flowcraft.openGenerationView",
    async (type?: string) => {
      if (type === "infographic") {
        vscode.window.showInformationMessage(
          "Infographic generation coming soon!"
        );
      } else if (type === "image") {
        vscode.window.showInformationMessage("Image generation coming soon!");
      } else {
        // Show diagram type selection
        const diagramTypes = [
          "FlowChart",
          "Sequence Diagram",
          "Class Diagram",
          "State Diagram",
          "Entity Relationship Diagram",
          "User Journey",
          "Gantt",
          "Pie Chart",
          "Quadrant Chart",
          "Requirement Diagram",
          "Gitgraph (Git) Diagram",
          "Mindmaps",
          "Timeline",
          "Zenuml",
          "Sankey",
          "Treemap",
        ];

        const selectedType = await vscode.window.showQuickPick(diagramTypes, {
          placeHolder: "Select diagram type to generate",
        });

        if (!selectedType) {
          return;
        }

        // Map display names to DiagramType enum values

        // Ask for code input method
        const inputMethods = [
          {
            label: "Paste Code",
            description: "Paste code or description directly",
          },
          {
            label: "Select File",
            description: "Choose a file from your workspace",
          },
          {
            label: "Use Current Selection",
            description: "Use selected text from the active editor",
          },
          {
            label: "Use Current File",
            description: "Use entire content of the active file",
          },
        ];

        const inputMethod = await vscode.window.showQuickPick(inputMethods, {
          placeHolder: "How would you like to provide the code/description?",
        });

        if (!inputMethod) {
          return;
        }

        let codeContent = "";

        // Get code based on selection
        if (inputMethod.label === "Paste Code") {
          const pastedCode = await vscode.window.showInputBox({
            prompt: `Paste your code or description for the ${selectedType}`,
            placeHolder: "Paste code here...",
            ignoreFocusOut: true,
            validateInput: (value: string) => {
              if (!value || value.trim().length === 0) {
                return "Please provide some code or description";
              }
              if (value.length > 10000) {
                return "Code is too large (max 10,000 characters)";
              }
              return null;
            },
          });

          if (!pastedCode) {
            return;
          }
          codeContent = pastedCode;
        } else if (inputMethod.label === "Select File") {
          const fileUri = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: "Select File",
            filters: {
              "All Files": ["*"],
            },
          });

          if (!fileUri || fileUri.length === 0) {
            return;
          }

          const document = await vscode.workspace.openTextDocument(fileUri[0]);
          codeContent = document.getText();

          if (codeContent.length === 0 || codeContent.length > 10000) {
            vscode.window.showErrorMessage(
              "The file content is either empty or too large (max 10,000 characters)"
            );
            return;
          }
        } else if (inputMethod.label === "Use Current Selection") {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            vscode.window.showErrorMessage("No active editor found");
            return;
          }

          const selection = editor.selection;
          codeContent = editor.document.getText(selection);

          if (codeContent.length === 0) {
            vscode.window.showErrorMessage(
              "No text selected. Please select some code first."
            );
            return;
          }

          if (codeContent.length > 10000) {
            vscode.window.showErrorMessage(
              "Selection is too large (max 10,000 characters)"
            );
            return;
          }
        } else if (inputMethod.label === "Use Current File") {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            vscode.window.showErrorMessage("No active editor found");
            return;
          }

          codeContent = editor.document.getText();

          if (codeContent.length === 0 || codeContent.length > 10000) {
            vscode.window.showErrorMessage(
              "The file content is either empty or too large (max 10,000 characters)"
            );
            return;
          }
        }

        // Generate diagram using VS Code endpoint
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Generating ${selectedType} from FlowCraft`,
            cancellable: false,
          },
          async (progress, _token) => {
            progress.report({ increment: 0 });

            try {
              progress.report({ increment: 20 });

              // Get API key based on default provider
              const apiKey = await ensureProviderApiKey(stateManager, apiKeyService);
              if (!apiKey) {
                const defaultProvider = stateManager.getSetting("defaultProvider");
                vscode.window.showErrorMessage(
                  `FlowCraft needs a ${defaultProvider} API key to function. Please configure it in the settings.`
                );
                return;
              }

              progress.report({ increment: 40 });

              const flowCraftApiUrl =
                process.env.FLOWCRAFT_API_URL || FLOWCRAFT_API_URL;

              // Create title from first 50 chars of content or use diagram type
              let title = "";
              const editor = vscode.window.activeTextEditor;
              if (editor && editor.document && editor.document.fileName) {
                const fileName = editor.document.fileName.split(/[\\/]/).pop();
                title = fileName ? fileName.replace(/\s/g, "_") : "";
              }
              if (!title.trim()) {
                title = `${selectedType} - ${new Date().toISOString()}`;
              }

              const body = {
                title: title,
                description: codeContent,
                type: selectedType, // Send the display name, API will map it
                source: "vscode",
              };

              console.log("Request Body: ", body);
              console.log("Sending a request to this endpoint: ", `${flowCraftApiUrl}/v2/diagrams/generate`);

              const response = await fetch(
                `${flowCraftApiUrl}/v2/diagrams/generate`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-api-key": apiKey,
                  },
                  body: JSON.stringify(body),
                }
              );

              progress.report({ increment: 80 });

              if (!response.ok) {
                const errorData: any = await response.json().catch(() => ({}));
                throw new Error(
                  errorData.detail ||
                    `HTTP ${response.status}: ${response.statusText}`
                );
              }

              const data: any = await response.json();
              console.log("RESPONSE Data: ", data);

              const _res = data.response;
              const diagram = _res.mermaid_code;
              const inserted_diagram = _res.inserted_diagram;

              console.log("Diagram: ", diagram);
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
            } catch (error: any) {
              vscode.window.showErrorMessage(
                `An error occurred while generating the diagram: ${error.message}`
              );
              console.error("Error generating diagram:", error);
            }
          }
        );
      }
    }
  );

  let showHistoryCommand = vscode.commands.registerCommand(
    "flowcraft.showHistory",
    async () => {
      const recent = await diagramService.getRecent();
      if (recent.length === 0) {
        vscode.window.showInformationMessage("No diagram history found.");
        return;
      }
      const items = recent.map((d) => ({
        label: d.title,
        description: d.type,
        detail: d.description,
        id: d.id,
      }));
      const selection = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a diagram to view",
      });
      if (selection) {
        const diagramUrl = `https://flowcraft.app/vscode/${selection.id}`;
        vscode.env.openExternal(vscode.Uri.parse(diagramUrl));
      }
    }
  );

  let generateFromSelectionCommand = vscode.commands.registerCommand(
    "flowcraft.generateFromSelection",
    () => vscode.commands.executeCommand(GENERATE_SELECTION_FLOW_DIAGRAM)
  );

  let generateFromFileCommand = vscode.commands.registerCommand(
    "flowcraft.generateFromFile",
    () => vscode.commands.executeCommand(GENERATE_FLOW_DIAGRAM)
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

            const apiKey = await ensureProviderApiKey(stateManager, apiKeyService);
            if (!apiKey) {
              const defaultProvider = stateManager.getSetting("defaultProvider");
              vscode.window.showErrorMessage(
                `FlowCraft needs a ${defaultProvider} API key to function. Please configure it in the settings.`
              );
              return;
            }

            console.log("Request Body: ", body);

            fetch(`${flowCraftApiUrl}/diagrams/generate`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-api-key": apiKey,
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

            const apiKey = await ensureProviderApiKey(stateManager, apiKeyService);
            if (!apiKey) {
              const defaultProvider = stateManager.getSetting("defaultProvider");
              vscode.window.showErrorMessage(
                `FlowCraft needs a ${defaultProvider} API key to function. Please configure it in the settings.`
              );
              return;
            }

            fetch(`${flowCraftApiUrl}/diagrams/generate`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-api-key": apiKey,
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

            const apiKey = await ensureProviderApiKey(stateManager, apiKeyService);
            if (!apiKey) {
              const defaultProvider = stateManager.getSetting("defaultProvider");
              vscode.window.showErrorMessage(
                `FlowCraft needs a ${defaultProvider} API key to function. Please configure it in the settings.`
              );
              return;
            }

            fetch(`${flowCraftApiUrl}/diagrams/generate`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-api-key": apiKey,
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

            const apiKey = await ensureProviderApiKey(stateManager, apiKeyService);
            if (!apiKey) {
              const defaultProvider = stateManager.getSetting("defaultProvider");
              vscode.window.showErrorMessage(
                `FlowCraft needs a ${defaultProvider} API key to function. Please configure it in the settings.`
              );
              return;
            }

            fetch(`${flowCraftApiUrl}/diagrams/generate`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-api-key": apiKey,
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
  context.subscriptions.push(openGenerationViewCommand);
  context.subscriptions.push(showHistoryCommand);
  context.subscriptions.push(generateFromSelectionCommand);
  context.subscriptions.push(generateFromFileCommand);
  context.subscriptions.push(chatHandler);
}

// This method is called when your extension is deactivated
export function deactivate() {}
