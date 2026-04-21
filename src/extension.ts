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
import { Diagram, DiagramCategory, DiagramType, Provider } from "./types";

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

function persistRawFetchDiagram(
  stateManager: StateManager,
  params: {
    id: string;
    title: string;
    description: string;
    type: DiagramType;
    mermaidCode: string;
  }
): void {
  try {
    const now = new Date();
    const diagram: Diagram = {
      id: params.id,
      title: params.title,
      description: params.description,
      type: params.type,
      category: DiagramCategory.Mermaid,
      content: params.mermaidCode ?? "",
      isPublic: false,
      createdAt: now,
      updatedAt: now,
      tokensUsed: 0,
    };
    stateManager.addDiagram(diagram);
  } catch (err) {
    console.error("Failed to persist diagram to history:", err);
  }
}

async function promptForProviderApiKey(
  apiKeyService: APIKeyService,
  provider: Provider
): Promise<string | undefined> {
  const specs: Record<string, { title: string; prompt: string; placeholder: string; prefix?: string; minLen: number }> = {
    [Provider.OpenAI]:    { title: "api.openai",    prompt: "Paste your OpenAI key · stored in vscode.secrets",        placeholder: "sk-…",      prefix: "sk-",     minLen: 20 },
    [Provider.Anthropic]: { title: "api.anthropic", prompt: "Paste your Anthropic key · stored in vscode.secrets",     placeholder: "sk-ant-…",  prefix: "sk-ant-", minLen: 20 },
    [Provider.Google]:    { title: "api.google",    prompt: "Paste your Google (Gemini) key · stored in vscode.secrets", placeholder: "AIza…",   prefix: "AIza",    minLen: 20 },
    [Provider.FlowCraft]: { title: "api.flowcraft", prompt: "Paste your FlowCraft token · stored in vscode.secrets",   placeholder: "fc_…",      prefix: "fc_",     minLen: 10 },
  };
  const spec = specs[provider] ?? { title: `api.${provider}`, prompt: `Enter your ${provider} API key`, placeholder: "key…", minLen: 10 };

  const apiKey = await vscode.window.showInputBox({
    title: `FlowCraft · ${spec.title}`,
    prompt: spec.prompt,
    placeHolder: spec.placeholder,
    password: true,
    ignoreFocusOut: true,
    validateInput: (value: string) => {
      if (!value) return "Key is required";
      if (spec.prefix && !value.startsWith(spec.prefix)) return `Expected prefix "${spec.prefix}"`;
      if (value.length < spec.minLen) return "Key looks too short";
      return null;
    },
  });

  if (apiKey) {
    await apiKeyService.store(provider, apiKey);
    return apiKey;
  }
  return undefined;
}

/** Show an API-key error with an "Open Settings" action. */
function showApiKeyError(provider: string): void {
  vscode.window
    .showErrorMessage(
      `FlowCraft needs a ${provider} API key to generate diagrams.`,
      "Open Settings",
      "Dismiss"
    )
    .then((choice) => {
      if (choice === "Open Settings") {
        vscode.commands.executeCommand("flowcraft.openSettings");
      }
    });
}

/** Collapse verbose upstream errors (litellm / openai / anthropic) into a short toast. */
function humanizeError(raw: string): { title: string; detail?: string; action?: "billing" | "settings" } {
  const msg = (raw || "").toLowerCase();
  if (msg.includes("ratelimiterror") || msg.includes("rate limit") || msg.includes("exceeded your current quota") || msg.includes("insufficient_quota")) {
    return {
      title: "Provider quota exceeded",
      detail: "Your API key has hit its rate limit or quota. Check your billing, then retry.",
      action: "billing",
    };
  }
  if (msg.includes("authenticationerror") || msg.includes("invalid api key") || msg.includes("incorrect api key") || msg.includes("401")) {
    return {
      title: "Invalid API key",
      detail: "The stored key was rejected by the provider. Open settings to re-enter it.",
      action: "settings",
    };
  }
  if (msg.includes("403") || msg.includes("permission")) {
    return { title: "Key lacks permission", detail: "Your key doesn't have access to the requested model." , action: "settings" };
  }
  if (msg.includes("timeout") || msg.includes("econnreset") || msg.includes("network")) {
    return { title: "Network error", detail: "FlowCraft couldn't reach the API. Check your connection and retry." };
  }
  // Fallback: strip wrappers like "Failed to generate diagram: litellm.XxxError:"
  const cleaned = raw.replace(/^(failed to generate diagram:\s*)?(litellm\.[A-Za-z]+Error:\s*)?/i, "").trim();
  return { title: "Generation failed", detail: cleaned.slice(0, 180) };
}

/** Open the rendered diagram in the browser with a toast fallback. */
function openDiagramResult(id: string): void {
  const url = `https://flowcraft.app/vscode/${id}`;
  vscode.env.openExternal(vscode.Uri.parse(url));
  vscode.window
    .showInformationMessage("Diagram ready.", "Open Diagram", "Copy Link")
    .then((choice) => {
      if (choice === "Open Diagram") vscode.env.openExternal(vscode.Uri.parse(url));
      else if (choice === "Copy Link") vscode.env.clipboard.writeText(url);
    });
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
      type ResetItem = vscode.QuickPickItem & { value: "all" | Provider };
      const items: ResetItem[] = [
        { label: "$(trash) All providers", description: "clear every stored key", value: "all" },
        { label: "OpenAI",    value: Provider.OpenAI },
        { label: "Anthropic", value: Provider.Anthropic },
        { label: "Google",    value: Provider.Google },
        { label: "FlowCraft", value: Provider.FlowCraft },
      ];
      const picked = await vscode.window.showQuickPick(items, {
        title: "FlowCraft · reset API key",
        placeHolder: "Which provider key would you like to clear?",
      });
      if (!picked) return;

      // Also scrub the legacy single-provider secret if it still exists.
      await context.secrets.delete(OPENAI_KEY_SECRET);

      if (picked.value === "all") {
        await apiKeyService.clearAll();
        vscode.window.showInformationMessage(
          "All FlowCraft provider keys have been cleared. You will be prompted on next use."
        );
      } else {
        await apiKeyService.delete(picked.value);
        vscode.window.showInformationMessage(
          `${picked.value} API key has been cleared. You will be prompted on next use.`
        );
      }
    }
  );

  let openWelcomeCommand = vscode.commands.registerCommand(
    "flowcraft.openWelcome",
    async () => {
      await vscode.commands.executeCommand("flowcraft.welcomeView.focus");
    }
  );

  let openSettingsCommand = vscode.commands.registerCommand(
    "flowcraft.openSettings",
    async () => {
      // Focus the settings view
      await vscode.commands.executeCommand("flowcraft.settingsView.focus");
    }
  );

  let syncUsageCommand = vscode.commands.registerCommand(
    "flowcraft.syncUsage",
    async () => {
      try {
        const usage = await usageService.syncFromAPI();
        const label = usage.subscribed
          ? `Pro · ${usage.diagramsCreated} diagram${usage.diagramsCreated === 1 ? "" : "s"} created`
          : `${usage.diagramsCreated} of ${usage.freeLimit} used · ${Math.max(0, usage.freeLimit - usage.diagramsCreated)} left`;
        vscode.window.showInformationMessage(`FlowCraft usage · ${label}`);
      } catch (error: any) {
        const msg = error?.message ?? String(error);
        if (msg.toLowerCase().includes("no api key")) {
          showApiKeyError(stateManager.getSetting("defaultProvider"));
        } else {
          vscode.window.showErrorMessage(`Couldn't sync usage · ${msg}`);
        }
      }
    }
  );

  async function runVisualGeneration(
    kind: "infographic" | "illustration"
  ): Promise<void> {
    const prompt = await vscode.window.showInputBox({
      title: `FlowCraft · ${kind}`,
      prompt: `Describe the ${kind} you want FlowCraft to produce`,
      placeHolder: kind === "infographic"
        ? "e.g. A 4-step infographic explaining OAuth 2.0"
        : "e.g. An isometric illustration of a cloud deployment pipeline",
      ignoreFocusOut: true,
      validateInput: (value: string) => {
        if (!value || value.trim().length === 0) return "Please provide a description";
        if (value.length > 10000) return "Description is too long (max 10,000 characters)";
        return null;
      },
    });
    if (!prompt) return;

    const palettePick = await vscode.window.showQuickPick(
      [
        { label: "Brand colors", value: "brand colors" },
        { label: "Monochromatic", value: "monochromatic" },
        { label: "Complementary", value: "complementary" },
        { label: "Analogous", value: "analogous" },
      ],
      {
        title: `FlowCraft · ${kind} · palette`,
        placeHolder: "Pick a color palette",
      }
    );
    if (!palettePick) return;

    const complexityPick = await vscode.window.showQuickPick(
      [
        { label: "Simple",  value: "simple"  as const },
        { label: "Medium",  value: "medium"  as const },
        { label: "Detailed",value: "complex" as const },
      ],
      {
        title: `FlowCraft · ${kind} · detail`,
        placeHolder: "How much detail?",
      }
    );
    if (!complexityPick) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `flowcraft › ${kind}`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "checking credentials…", increment: 10 });
        const apiKey = await ensureProviderApiKey(stateManager, apiKeyService);
        if (!apiKey) {
          showApiKeyError(stateManager.getSetting("defaultProvider"));
          return;
        }

        progress.report({ message: "sending prompt to model…", increment: 40 });

        try {
          const result = await diagramService.generate({
            prompt,
            type: kind === "infographic" ? DiagramType.Infographic : DiagramType.Illustration,
            colorPalette: palettePick.value,
            complexityLevel: complexityPick.value,
            isPublic: stateManager.getSetting("defaultPrivacy") !== "private",
          });

          progress.report({ message: "rendering…", increment: 40 });

          if (result?.id) {
            progress.report({ message: "done", increment: 10 });
            openDiagramResult(result.id);
          } else {
            vscode.window.showErrorMessage(
              `FlowCraft didn't return a ${kind}. Try again or tweak your prompt.`
            );
          }
        } catch (error: any) {
          const friendly = humanizeError(error?.message ?? String(error));
          vscode.window
            .showErrorMessage(
              friendly.detail ? `${friendly.title} · ${friendly.detail}` : friendly.title,
              "Retry",
              "Open Settings"
            )
            .then((choice) => {
              if (choice === "Retry") {
                vscode.commands.executeCommand("flowcraft.openGenerationView", kind);
              } else if (choice === "Open Settings") {
                vscode.commands.executeCommand("flowcraft.openSettings");
              }
            });
          console.error(`Error generating ${kind}:`, error);
        }
      }
    );
  }

  let openGenerationViewCommand = vscode.commands.registerCommand(
    "flowcraft.openGenerationView",
    async (type?: string) => {
      if (type === "infographic") {
        await runVisualGeneration("infographic");
      } else if (type === "image" || type === "illustration") {
        await runVisualGeneration("illustration");
      } else {
        type DiagramItem = vscode.QuickPickItem & { value?: string };
        const diagramItems: DiagramItem[] = [
          { label: "Software", kind: vscode.QuickPickItemKind.Separator },
          { label: "$(symbol-event) FlowChart",          description: "control flow · decisions",         value: "FlowChart",                     detail: "graph TD …" },
          { label: "$(arrow-both) Sequence Diagram",     description: "message passing between actors",   value: "Sequence Diagram",              detail: "sequenceDiagram …" },
          { label: "$(symbol-class) Class Diagram",      description: "uml · classes · relationships",    value: "Class Diagram",                 detail: "classDiagram …" },
          { label: "$(symbol-enum) State Diagram",       description: "states · transitions",             value: "State Diagram",                 detail: "stateDiagram-v2 …" },
          { label: "$(database) Entity Relationship",    description: "er · schema · tables",             value: "Entity Relationship Diagram",   detail: "erDiagram …" },

          { label: "Planning", kind: vscode.QuickPickItemKind.Separator },
          { label: "$(calendar) Gantt",                  description: "project timeline",                 value: "Gantt" },
          { label: "$(pie-chart) Pie Chart",             description: "proportional breakdown",           value: "Pie Chart" },
          { label: "$(milestone) Timeline",              description: "events on an axis",                value: "Timeline" },
          { label: "$(organization) Mindmaps",           description: "hierarchical ideas",               value: "Mindmaps" },
          { label: "$(list-tree) Requirement Diagram",   description: "requirements traceability",       value: "Requirement Diagram" },

          { label: "Advanced", kind: vscode.QuickPickItemKind.Separator },
          { label: "$(person) User Journey",             description: "user experience flow",             value: "User Journey" },
          { label: "$(git-branch) Gitgraph",             description: "branch · merge visualisation",    value: "Gitgraph (Git) Diagram" },
          { label: "$(graph-scatter) Quadrant Chart",    description: "2x2 matrix",                       value: "Quadrant Chart" },
          { label: "$(zap) Zenuml",                      description: "sequence · z-style",               value: "Zenuml" },
          { label: "$(symbol-color) Sankey",             description: "weighted flows",                   value: "Sankey" },
          { label: "$(symbol-structure) Treemap",        description: "nested rectangles",                value: "Treemap" },
        ];

        const picked = await vscode.window.showQuickPick(diagramItems, {
          title: "FlowCraft · generate",
          placeHolder: "Pick a diagram type  (type to filter)",
          matchOnDescription: true,
          matchOnDetail: true,
        });

        if (!picked || !picked.value) {
          return;
        }
        const selectedType = picked.value;

        // Ask for code input method
        type InputItem = vscode.QuickPickItem & { value: string };
        const inputMethods: InputItem[] = [
          { label: "$(selection) Use current selection", description: "highlighted text from the active editor",          value: "Use Current Selection" },
          { label: "$(file-code) Use current file",     description: "entire content of the active file (≤10k chars)",   value: "Use Current File" },
          { label: "$(folder-opened) Pick a file…",     description: "choose any file from your workspace",              value: "Select File" },
          { label: "$(edit) Paste code or description", description: "free-form input · prompt-style",                    value: "Paste Code" },
        ];

        const pickedInput = await vscode.window.showQuickPick(inputMethods, {
          title: `FlowCraft · source for ${selectedType}`,
          placeHolder: "How should we read the source?",
          matchOnDescription: true,
        });

        if (!pickedInput) {
          return;
        }
        const inputMethod = { label: pickedInput.value };

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
            title: `flowcraft › ${selectedType.toLowerCase()}`,
            cancellable: false,
          },
          async (progress, _token) => {
            progress.report({ message: "checking credentials…", increment: 10 });

            try {
              // Get API key based on default provider
              const apiKey = await ensureProviderApiKey(stateManager, apiKeyService);
              if (!apiKey) {
                showApiKeyError(stateManager.getSetting("defaultProvider"));
                return;
              }

              progress.report({ message: "sending prompt to model…", increment: 40 });

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

              progress.report({ message: "rendering mermaid…", increment: 40 });

              if (!response.ok) {
                const errorData: any = await response.json().catch(() => ({}));
                throw new Error(
                  errorData.detail ||
                    `HTTP ${response.status}: ${response.statusText}`
                );
              }

              const data: any = await response.json();
              const _res = data.response;
              const inserted_diagram = _res.inserted_diagram;

              if (
                inserted_diagram &&
                inserted_diagram.data &&
                inserted_diagram.data.length > 0
              ) {
                progress.report({ message: "done", increment: 10 });
                openDiagramResult(inserted_diagram.data[0].id);
              } else {
                vscode.window.showErrorMessage(
                  "FlowCraft didn't return a diagram. Try again or tweak your prompt."
                );
              }
            } catch (error: any) {
              const friendly = humanizeError(error?.message ?? String(error));
              const actions = friendly.action === "billing"
                ? ["Open Billing", "Switch Provider", "Retry"]
                : friendly.action === "settings"
                ? ["Open Settings", "Retry"]
                : ["Retry", "Open Settings"];
              vscode.window
                .showErrorMessage(
                  friendly.detail ? `${friendly.title} · ${friendly.detail}` : friendly.title,
                  ...actions
                )
                .then((choice) => {
                  if (choice === "Retry") {
                    vscode.commands.executeCommand("flowcraft.openGenerationView");
                  } else if (choice === "Open Settings") {
                    vscode.commands.executeCommand("flowcraft.openSettings");
                  } else if (choice === "Switch Provider") {
                    vscode.commands.executeCommand("flowcraft.openSettings");
                  } else if (choice === "Open Billing") {
                    const prov = stateManager.getSetting("defaultProvider");
                    const billing: Record<string, string> = {
                      openai: "https://platform.openai.com/account/billing",
                      anthropic: "https://console.anthropic.com/settings/billing",
                      google: "https://aistudio.google.com/app/apikey",
                      flowcraft: "https://flowcraft.app/dashboard/billing",
                    };
                    vscode.env.openExternal(vscode.Uri.parse(billing[prov] || "https://flowcraft.app"));
                  }
                });
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
        vscode.window
          .showInformationMessage(
            "No diagrams yet. Generate one to populate your history.",
            "Generate"
          )
          .then((choice) => {
            if (choice === "Generate") {
              vscode.commands.executeCommand("flowcraft.openGenerationView");
            }
          });
        return;
      }
      const items = recent.map((d) => ({
        label: `$(graph) ${d.title}`,
        description: d.type,
        detail: d.description,
        id: d.id,
      }));
      const selection = await vscode.window.showQuickPick(items, {
        title: "FlowCraft · history",
        placeHolder: `${recent.length} recent diagram${recent.length === 1 ? "" : "s"} · type to filter`,
        matchOnDescription: true,
        matchOnDetail: true,
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
          title: "flowcraft › generating",
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
              showApiKeyError(stateManager.getSetting("defaultProvider"));
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
                  const diagramId = inserted_diagram.data[0].id;

                  persistRawFetchDiagram(stateManager, {
                    id: diagramId,
                    title: title ?? "Untitled diagram",
                    description: fileContent,
                    type: DiagramType.Flowchart,
                    mermaidCode: diagram,
                  });

                  const diagramUrl = `https://flowcraft.app/vscode/${diagramId}`;

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
          title: "flowcraft › generating",
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
              showApiKeyError(stateManager.getSetting("defaultProvider"));
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
                  const diagramId = inserted_diagram.data[0].id;

                  persistRawFetchDiagram(stateManager, {
                    id: diagramId,
                    title: title ?? "Untitled diagram",
                    description: selection,
                    type: DiagramType.Flowchart,
                    mermaidCode: diagram,
                  });

                  const diagramUrl = `https://flowcraft.app/vscode/${diagramId}`;

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
          title: "flowcraft › generating",
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
              showApiKeyError(stateManager.getSetting("defaultProvider"));
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
                  const diagramId = inserted_diagram.data[0].id;

                  persistRawFetchDiagram(stateManager, {
                    id: diagramId,
                    title: title ?? "Untitled diagram",
                    description: fileContext,
                    type: DiagramType.Class,
                    mermaidCode: diagram,
                  });

                  const diagramUrl = `https://flowcraft.app/vscode/${diagramId}`;

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
          title: "flowcraft › generating",
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
              showApiKeyError(stateManager.getSetting("defaultProvider"));
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
                  const diagramId = inserted_diagram.data[0].id;

                  persistRawFetchDiagram(stateManager, {
                    id: diagramId,
                    title: title ?? "Untitled diagram",
                    description: selection,
                    type: DiagramType.Class,
                    mermaidCode: diagram,
                  });

                  const diagramUrl = `https://flowcraft.app/vscode/${diagramId}`;

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
  context.subscriptions.push(openWelcomeCommand);
  context.subscriptions.push(openSettingsCommand);
  context.subscriptions.push(syncUsageCommand);
  context.subscriptions.push(openGenerationViewCommand);
  context.subscriptions.push(showHistoryCommand);
  context.subscriptions.push(generateFromSelectionCommand);
  context.subscriptions.push(generateFromFileCommand);
  context.subscriptions.push(chatHandler);
}

// This method is called when your extension is deactivated
export function deactivate() {}
