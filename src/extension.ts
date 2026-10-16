import * as vscode from "vscode";
import FlowCraftChatParticipant from "./ChatParticipantHandler";
import { StateManager } from "./state/state-manager";
import { APIKeyService } from "./services/api-key-service";
import { AuthService } from "./services/auth-service";
import { UsageService } from "./services/usage-service";
import { DiagramService } from "./services/diagram-service";
import { FlowCraftClient } from "./api/flowcraft-client";
import { AuthResolver, NoCredentialsError, ResolvedAuth } from "./api/auth-resolver";
import { resolveAuthConfig } from "./auth/auth-config";
import { registerAuthUriHandler, signIn, signOut } from "./auth/auth-flow";
import { WelcomeViewProvider } from "./views/welcome-view";
import { SettingsViewProvider } from "./views/settings-view";
import { initLogger } from "./utils/logger";
import { TelemetryService, userIdFromAccessToken } from "./services/telemetry-service";
import { EntitlementService } from "./services/entitlement-service";
import { CloudSyncService } from "./services/cloud-sync-service";
import { requirePremium, FLOWCRAFT_PRICING_URL } from "./services/premium-gate";
import { RenderService } from "./services/render-service";
import { RefineService } from "./services/refine-service";
import { pickDiagramType } from "./utils/diagram-heuristics";
import { buildFileContext, summarizeFolder } from "./utils/visualize-context";
import { toApiType } from "./services/diagram-type-map";
import { MermaidCodeLensProvider } from "./providers/mermaid-codelens";
import { ExportService } from "./services/export-service";
import { ShareService } from "./services/share-service";
import { Diagram, DiagramCategory, DiagramType, Provider } from "./types";
import { FreeTasteService, FreeTasteQuotaError } from "./services/free-taste-service";
import { shouldShowFirstRunNotice, FIRST_RUN_NOTICE_KEY } from "./services/first-run";
import { solvePow } from "./utils/pow";

const FLOWCRAFT_API_URL = "https://flowcraft-api-cb66lpneaq-ue.a.run.app";
const OPENAI_KEY_SECRET = "flowcraft.openai.key";

// Set during activate(); lets module-level helpers (e.g. the legacy fetch flows)
// emit telemetry without threading the service through every call.
let telemetryRef: TelemetryService | undefined;
/** Returns the user's chosen OpenRouter model slug (undefined = server default). */
let modelRef: () => string | undefined = () => undefined;

/** Attach the chosen model to a /v2/diagrams/generate body. */
function withModel<T extends object>(body: T): T & { model?: string } {
  const model = modelRef();
  return model ? { ...body, model } : body;
}
// Same idea for usage, so the post-generation upgrade nudge can read it.
let usageServiceRef: UsageService | undefined;
// Show the soft upgrade nudge at most once per session (avoid nagging).
let upgradeNudgedThisSession = false;

/**
 * After a successful generation, gently nudge a free user who is at/near their
 * limit toward Premium — at most once per session. Generation stays free + BYOK;
 * this only surfaces account-level premium (cloud sync, templates, exports).
 */
function maybeNudgeUpgrade(): void {
  const usageService = usageServiceRef;
  if (!usageService || upgradeNudgedThisSession) {
    return;
  }
  const usage = usageService.getUsage();
  if (usage.subscribed) {
    return;
  }
  const remaining = usageService.getRemaining();
  const atLimit = remaining <= 0;
  if (!atLimit && !usageService.isApproachingLimit(70)) {
    return;
  }
  upgradeNudgedThisSession = true;
  if (atLimit) {
    telemetryRef?.track("free_limit_exhausted");
  }
  const message = atLimit
    ? "You've reached your FlowCraft free limit. Upgrade to Premium for unlimited cloud sync, premium templates, and advanced exports."
    : `You have ${remaining} FlowCraft diagram${remaining === 1 ? "" : "s"} left this period. Upgrade anytime for unlimited.`;
  vscode.window
    .showInformationMessage(message, "See Premium", "Not now")
    .then((choice) => {
      if (choice === "See Premium") {
        telemetryRef?.track("upgrade_clicked");
        vscode.env.openExternal(vscode.Uri.parse(FLOWCRAFT_PRICING_URL));
      }
    });
}

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

/**
 * Sync the `flowcraft.hasApiKey` context key with whether a key is stored for
 * the default provider. Drives the onboarding walkthrough's "Add your API key"
 * checkmark. Returns whether a key is present.
 */
async function refreshHasApiKeyContext(
  apiKeyService: APIKeyService,
  stateManager: StateManager
): Promise<boolean> {
  const provider = stateManager.getSetting("defaultProvider");
  const hasKey = !!(await getProviderApiKey(apiKeyService, provider));
  await vscode.commands.executeCommand("setContext", "flowcraft.hasApiKey", hasKey);
  return hasKey;
}

function persistRawFetchDiagram(
  stateManager: StateManager,
  params: {
    id: string;
    title: string;
    description: string;
    type: DiagramType;
    mermaidCode: string;
  },
  skipTelemetry: boolean = false
): Diagram | undefined {
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
      // The server id is the canonical web id — persist it explicitly so
      // "Open on web" resolves a URL even if the local id scheme changes.
      metadata: { remoteId: params.id },
    };
    stateManager.addDiagram(diagram);
    if (!skipTelemetry) {
      telemetryRef?.track("generation_succeeded", {
        diagram_type: params.type,
        provider: stateManager.getSetting("defaultProvider"),
      });
    }
    maybeNudgeUpgrade();
    return diagram;
  } catch (err) {
    console.error("Failed to persist diagram to history:", err);
    return undefined;
  }
}

/** Map the generation QuickPick's display label to a DiagramType (best effort). */
function displayTypeToDiagramType(display: string): DiagramType {
  const key = display.toLowerCase();
  if (key.includes("sequence")) return DiagramType.Sequence;
  if (key.includes("class")) return DiagramType.Class;
  if (key.includes("state")) return DiagramType.State;
  if (key.includes("entity") || key.includes("er ") || key === "er") return DiagramType.ER;
  if (key.includes("gantt")) return DiagramType.Gantt;
  if (key.includes("pie")) return DiagramType.Pie;
  if (key.includes("timeline")) return DiagramType.Timeline;
  if (key.includes("mindmap")) return DiagramType.Mindmap;
  if (key.includes("requirement")) return DiagramType.Requirement;
  if (key.includes("journey")) return DiagramType.UserJourney;
  if (key.includes("gitgraph") || key.includes("git")) return DiagramType.Gitgraph;
  if (key.includes("quadrant")) return DiagramType.Quadrant;
  if (key.includes("zenuml")) return DiagramType.Zenuml;
  if (key.includes("sankey")) return DiagramType.Sankey;
  if (key.includes("treemap")) return DiagramType.Treemap;
  return DiagramType.Flowchart;
}

async function promptForProviderApiKey(
  apiKeyService: APIKeyService,
  provider: Provider
): Promise<string | undefined> {
  const spec = {
    title: "api.openrouter",
    prompt: "Paste your OpenRouter key (openrouter.ai/keys) · stored in vscode.secrets",
    placeholder: "sk-or-…",
    prefix: "sk-or-",
    minLen: 20,
  };

  const apiKey = await vscode.window.showInputBox({
    title: `FlowCraft · ${spec.title}`,
    prompt: spec.prompt,
    placeHolder: spec.placeholder,
    password: true,
    ignoreFocusOut: true,
    validateInput: (value: string) => {
      if (!value) return "Key is required";
      if (!value.startsWith(spec.prefix)) return `Expected prefix "${spec.prefix}" — create a key at openrouter.ai/keys`;
      if (value.length < spec.minLen) return "Key looks too short";
      return null;
    },
  });

  if (apiKey) {
    await apiKeyService.store(provider, apiKey);
    telemetryRef?.track("key_added", { provider });
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

/** Collapse verbose upstream errors (OpenRouter / provider) into a short toast. */
function humanizeError(raw: string): { title: string; detail?: string; action?: "billing" | "settings" } {
  const msg = (raw || "").toLowerCase();
  if (msg.includes("only openrouter api keys") || msg.includes("invalid openrouter api key format")) {
    return {
      title: "OpenRouter key required",
      detail: "FlowCraft now uses OpenRouter for every model. Create a key at openrouter.ai/keys (starts sk-or-) and add it in settings.",
      action: "settings",
    };
  }
  if (msg.includes("flowcraft-issued keys are no longer accepted")) {
    return {
      title: "Bring your own API key",
      detail: "FlowCraft no longer offers free generations. Open settings to add your OpenRouter API key (openrouter.ai/keys).",
      action: "settings",
    };
  }
  if (msg.includes("402") || msg.includes("insufficient credits") || msg.includes("requires more credits")) {
    return {
      title: "Out of OpenRouter credits",
      detail: "Add credits at openrouter.ai/credits, then retry.",
      action: "billing",
    };
  }
  if (msg.includes("ratelimiterror") || msg.includes("rate limit") || msg.includes("429") || msg.includes("exceeded your current quota") || msg.includes("insufficient_quota")) {
    return {
      title: "Rate limit or quota exceeded",
      detail: "Your OpenRouter key (or the upstream model) hit its rate limit or spend cap. Check openrouter.ai/activity, then retry.",
      action: "billing",
    };
  }
  if (msg.includes("authenticationerror") || msg.includes("invalid api key") || msg.includes("incorrect api key") || msg.includes("401")) {
    return {
      title: "Invalid API key",
      detail: "OpenRouter rejected the stored key. Open settings to re-enter it.",
      action: "settings",
    };
  }
  if (msg.includes("no endpoints found") || msg.includes("is not a valid model") || msg.includes("model not found")) {
    return { title: "Model unavailable", detail: "OpenRouter doesn't offer that model slug. Pick another model in settings.", action: "settings" };
  }
  if (msg.includes("403") || msg.includes("permission")) {
    return { title: "Key lacks permission", detail: "Your key doesn't have access to the requested model." , action: "settings" };
  }
  if (msg.includes("timeout") || msg.includes("econnreset") || msg.includes("network")) {
    return { title: "Network error", detail: "FlowCraft couldn't reach the API. Check your connection and retry." };
  }
  // Fallback: strip wrappers like "Failed to generate diagram: litellm.XxxError:"
  const cleaned = raw.replace(/^(failed to generate diagram:\s*)?/i, "").trim();
  return { title: "Generation failed", detail: cleaned.slice(0, 180) };
}

/** Bucket a raw error message into a coarse, non-identifying kind for telemetry. */
function classifyErrorKind(raw: string): string {
  const msg = (raw || "").toLowerCase();
  if (msg.includes("flowcraft-issued keys are no longer accepted") || msg.includes("only openrouter api keys")) return "byok_required";
  if (msg.includes("402") || msg.includes("insufficient credits")) return "credits";
  if (msg.includes("ratelimiterror") || msg.includes("rate limit") || msg.includes("quota")) return "quota";
  if (msg.includes("authenticationerror") || msg.includes("invalid api key") || msg.includes("incorrect api key") || msg.includes("401")) return "auth";
  if (msg.includes("403") || msg.includes("permission")) return "permission";
  if (msg.includes("timeout") || msg.includes("econnreset") || msg.includes("network")) return "network";
  if (msg.includes("no api key") || msg.includes("nocredentials")) return "no_key";
  if (msg.includes("400") || msg.includes("validation") || msg.includes("unsupported")) return "validation";
  return "unknown";
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

/**
 * Resolve outgoing auth for DIAGRAM GENERATION. Always BYOK (`X-api-key`),
 * even for signed-in users — generation must never run on FlowCraft's server
 * keys (see AuthResolver.resolveByok). Sign-in/JWT is for premium endpoints
 * only. Returns null if no BYOK key is available (and surfaces an error toast).
 */
async function resolveAuth(
  authResolver: AuthResolver,
  stateManager: StateManager
): Promise<ResolvedAuth | null> {
  try {
    return await authResolver.resolveByok();
  } catch (err) {
    if (err instanceof NoCredentialsError) {
      showApiKeyError(stateManager.getSetting("defaultProvider"));
    } else {
      vscode.window.showErrorMessage(
        `FlowCraft auth error · ${(err as Error).message ?? String(err)}`
      );
    }
    return null;
  }
}

/** Build the headers object for v2/diagrams/generate, using resolved auth. */
function buildGenerateHeaders(auth: ResolvedAuth): Record<string, string> {
  return {
    "Content-Type": "application/json",
    [auth.headerName]: auth.headerValue,
  };
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
  const hadLegacyKeys = await apiKeyService.migrateOldKeys(); // Drop pre-OpenRouter keys
  modelRef = () => stateManager.getSetting("providerModels")?.[Provider.OpenRouter];
  if (hadLegacyKeys) {
    void vscode.window
      .showWarningMessage(
        "FlowCraft now runs every model through OpenRouter. Your old OpenAI / Anthropic / Google key was removed — add one OpenRouter key (sk-or-…) to keep generating.",
        "Add OpenRouter key",
        "Get a key"
      )
      .then((choice) => {
        if (choice === "Add OpenRouter key") void vscode.commands.executeCommand("flowcraft.setupApiKey");
        else if (choice === "Get a key") void vscode.env.openExternal(vscode.Uri.parse("https://openrouter.ai/keys"));
      });
  }

  const apiBaseUrl = process.env.FLOWCRAFT_API_URL || FLOWCRAFT_API_URL;
  const apiClient = new FlowCraftClient({
    baseURL: apiBaseUrl,
  });

  // Anonymous, opt-out telemetry. Honors the `telemetryEnabled` setting and
  // VS Code's global telemetry switch. Never sends keys or prompt text.
  const telemetry = new TelemetryService(
    context,
    () => apiBaseUrl,
    () => stateManager.getSetting("telemetryEnabled") !== false
  );
  context.subscriptions.push({ dispose: () => telemetry.dispose() });
  telemetryRef = telemetry;
  telemetry.track("extension_activated");

  // Auth: signed-in Supabase session + URI handler for OAuth callback.
  const authConfig = resolveAuthConfig();
  const authService = new AuthService(context, {
    supabaseUrl: authConfig.supabaseUrl,
    supabaseAnonKey: authConfig.supabaseAnonKey,
  });
  registerAuthUriHandler(context, authService);

  const authResolver = new AuthResolver({
    authService,
    apiKeyService,
    ensureProviderKey: async (provider) => {
      let key = await apiKeyService.retrieve(provider);
      if (!key) {
        key = await promptForProviderApiKey(apiKeyService, provider);
      }
      return key;
    },
    getDefaultProvider: () => stateManager.getSetting("defaultProvider"),
  });

  const usageService = new UsageService(apiClient, stateManager, apiKeyService, authService);
  usageServiceRef = usageService;
  const diagramService = new DiagramService(
    apiClient,
    stateManager,
    apiKeyService
  );

  // Premium entitlement (account-level; never gates generation, which stays BYOK).
  const entitlementService = new EntitlementService(apiClient, authService);
  context.subscriptions.push({ dispose: () => entitlementService.dispose() });

  // Premium cloud history sync — mirrors generated diagrams to the user's
  // account when signed in + subscribed. Silent on the generation path.
  const cloudSyncService = new CloudSyncService(
    apiClient,
    authService,
    entitlementService,
    stateManager,
    telemetry
  );
  context.subscriptions.push({ dispose: () => cloudSyncService.dispose() });

  // In-extension diagram viewer + render engine (M6A) — also the rasterizer
  // behind advanced exports (M4C). Free + always available.
  const renderService = new RenderService(context.extensionUri);
  context.subscriptions.push(renderService);

  // Advanced exports (M4C): free SVG/PNG/PDF; premium hi-res/batch/markdown.
  const exportService = new ExportService(
    renderService,
    { entitlementService, authService, telemetry },
    () => stateManager.getAllDiagrams()
  );

  // The viewer's "Export" toolbar button runs the export flow; "Open on web"
  // resolves a synced URL when one exists.
  renderService.onExportRequested = (diagram) => {
    telemetry.track("export_requested", { diagram_type: diagram.type });
    return exportService.exportDiagram(diagram);
  };
  renderService.webUrlFor = (diagram) => {
    const remoteId = diagram.metadata?.remoteId as string | undefined;
    if (remoteId) {
      return `https://flowcraft.app/vscode/${remoteId}`;
    }
    // Raw-fetch diagrams store the server id directly as their local id.
    if (diagram.id && !diagram.id.startsWith("diagram_")) {
      return `https://flowcraft.app/vscode/${diagram.id}`;
    }
    return undefined;
  };

  // Persist a freshly generated Mermaid diagram, then preview it in the
  // in-extension viewer (6A). The browser stays available as a fallback via the
  // toast action and the viewer's "Open on web" button.
  const showGeneratedDiagram = (params: {
    id: string;
    title: string;
    description: string;
    type: DiagramType;
    mermaidCode: string;
  }): void => {
    const diagram = persistRawFetchDiagram(stateManager, params);
    const url = `https://flowcraft.app/vscode/${params.id}`;
    if (diagram) {
      void renderService.view(diagram);
    }
    vscode.window
      .showInformationMessage(
        "FlowCraft: diagram ready — previewing in the editor.",
        "Open on web",
        "Copy Link"
      )
      .then((choice) => {
        if (choice === "Open on web") {
          vscode.env.openExternal(vscode.Uri.parse(url));
        } else if (choice === "Copy Link") {
          vscode.env.clipboard.writeText(url);
        }
      });
  };

  // Shared driver for the legacy "flowcraft › generating" Mermaid flows
  // (file / selection / class). Credentials are resolved BEFORE the progress
  // notification is shown: resolveAuth can pop an API-key InputBox, and that
  // box must never sit behind a spinning "generating" notification — that
  // overlap is what made the spinner look like it never dismissed (v2.7.0 bug).
  // The spinner now strictly wraps the network call + render.
  const runMermaidGeneration = async (opts: {
    body: { title?: string; description: string; type: string };
    diagramType: DiagramType;
    description: string;
    errorMessage: string;
  }): Promise<void> => {
    const auth = await resolveAuth(authResolver, stateManager);
    if (!auth) {
      return;
    }
    const flowCraftApiUrl = process.env.FLOWCRAFT_API_URL || FLOWCRAFT_API_URL;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "flowcraft › generating",
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 20, message: "sending to model…" });
        try {
          const response = await fetch(`${flowCraftApiUrl}/v2/diagrams/generate`, {
            method: "POST",
            headers: buildGenerateHeaders(auth),
            body: JSON.stringify(withModel(opts.body)),
          });
          const data: any = await response.json();
          progress.report({ increment: 70, message: "rendering…" });
          const _res = data?.response;
          const inserted = _res?.inserted_diagram;
          if (inserted && inserted.data && inserted.data.length > 0) {
            progress.report({ increment: 100 });
            showGeneratedDiagram({
              id: inserted.data[0].id,
              title: opts.body.title ?? "Untitled diagram",
              description: opts.description,
              type: opts.diagramType,
              mermaidCode: _res?.mermaid_code ?? "",
            });
          } else {
            vscode.window.showErrorMessage(opts.errorMessage);
          }
        } catch (error: any) {
          telemetryRef?.track("generation_failed", {
            error_kind: classifyErrorKind(error?.message ?? String(error)),
          });
          vscode.window.showErrorMessage(opts.errorMessage);
          console.error("Error generating diagram:", error);
        }
      }
    );
  };

  // Shared refinement service (used by the viewer refine loop + Markdown CodeLens).
  const refineService = new RefineService(
    authResolver,
    () => process.env.FLOWCRAFT_API_URL || FLOWCRAFT_API_URL
  );

  renderService.onRefine = async (diagram, instruction) => {
    telemetry.track("refine_requested", { diagram_type: diagram.type });
    try {
      const result = await refineService.refine({
        currentCode: diagram.content ?? "",
        instruction,
        diagramType: diagram.type,
        title: diagram.title,
      });
      telemetry.track("refine_succeeded", { diagram_type: diagram.type });
      return result.code;
    } catch (err) {
      telemetry.track("refine_failed", {
        diagram_type: diagram.type,
        error_kind: classifyErrorKind((err as Error).message),
      });
      throw err;
    }
  };

  renderService.onChangeType = async (diagram, apiType) => {
    telemetry.track("visualize_requested", {
      surface: "type_override",
      diagram_type: apiType,
    });
    await runMermaidGeneration({
      body: { title: diagram.title, description: diagram.description, type: apiType },
      diagramType: diagram.type,
      description: diagram.description,
      errorMessage: "FlowCraft couldn't re-generate as that type.",
    });
  };

  // Share-to-web: publish the current diagram as a publicly-accessible link.
  const shareService = new ShareService({
    getAccessToken: () => authService.getValidAccessToken().then((t) => t ?? undefined),
    signIn: async () => {
      await vscode.commands.executeCommand("flowcraft.signIn");
      return !!(await authService.getValidAccessToken());
    },
    rasterizePng: async (diagram) => {
      const r = await renderService.renderExport(diagram, "png", 2);
      return r.payload; // base64 data URL
    },
    webBaseUrl: authConfig.webBaseUrl,
    fetchFn: fetch,
    copyToClipboard: (t) => Promise.resolve(vscode.env.clipboard.writeText(t)),
    showInfo: (msg, ...actions) =>
      Promise.resolve(vscode.window.showInformationMessage(msg, ...actions)),
    showError: (msg) => void vscode.window.showErrorMessage(msg),
    track: (e, p) => telemetry.track(e as Parameters<typeof telemetry.track>[0], p as Parameters<typeof telemetry.track>[1]),
    openExternal: (url) => void vscode.env.openExternal(vscode.Uri.parse(url)),
    confirmFirstShare: async () => {
      const KEY = "flowcraft.share.confirmedPublic";
      if (context.globalState.get<boolean>(KEY)) { return true; }
      const ok = await vscode.window.showWarningMessage(
        "Sharing makes this diagram publicly viewable by anyone with the link. Continue?",
        { modal: true },
        "Share publicly"
      );
      if (ok === "Share publicly") {
        await context.globalState.update(KEY, true);
        return true;
      }
      return false;
    },
  });
  renderService.onShareRequested = (diagram) => shareService.share(diagram);

  // Emit `signed_in` / `signed_out` on session transitions, and label events
  // with the Supabase user id (never the email) while signed in so extension
  // activity joins to the same user on the web app.
  let wasSignedIn = authService.isSignedIn();
  void authService.getSession().then((session) => {
    if (session) {
      telemetry.setUserId(userIdFromAccessToken(session.accessToken));
    }
  });
  context.subscriptions.push(
    authService.onDidChangeSession((session) => {
      const nowSignedIn = !!session;
      if (nowSignedIn && !wasSignedIn) {
        telemetry.setUserId(userIdFromAccessToken(session.accessToken));
        telemetry.track("signed_in");
      } else if (!nowSignedIn && wasSignedIn) {
        telemetry.track("signed_out"); // still carries the user id
        telemetry.setUserId(undefined);
      }
      wasSignedIn = nowSignedIn;
    })
  );

  // Initialize View Providers
  const welcomeProvider = new WelcomeViewProvider(
    context.extensionUri,
    stateManager,
    usageService,
    authService,
    telemetry,
    apiKeyService,
    context
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WelcomeViewProvider.viewType,
      welcomeProvider
    )
  );

  // Zero-friction "free taste": lets a user with NO API key generate a few
  // diagrams via the FlowCraft backend (proof-of-work gated, no key required)
  // before being nudged to bring their own key. Construct after telemetry +
  // welcomeProvider exist (it reports remaining counts back to the Welcome view).
  const freeTaste = new FreeTasteService({
    apiBaseUrl: apiBaseUrl,
    deviceId: context.globalState.get<string>("flowcraft.installId") ?? "unknown",
    fetchFn: fetch,
    solve: (challenge, bits) => solvePow(challenge, bits),
    track: (e, p) =>
      telemetry.track(
        e as Parameters<typeof telemetry.track>[0],
        p as Parameters<typeof telemetry.track>[1]
      ),
  });

  /**
   * Run one free (no-key) generation: solve PoW, call the backend, persist +
   * preview the resulting Mermaid, and push the remaining count to the Welcome
   * view. On quota exhaustion or error, nudge the user toward adding a key.
   */
  async function runFreeTaste(prompt: string, type: string): Promise<void> {
    const trimmed = (prompt ?? "").trim();
    if (!trimmed) {
      void vscode.window.showErrorMessage("FlowCraft: enter a prompt to try a free diagram.");
      return;
    }
    if (trimmed.length > 10000) {
      void vscode.window.showErrorMessage("FlowCraft: prompt is too long (max 10,000 characters).");
      return;
    }
    try {
      const { mermaidCode, remaining } = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "flowcraft › generating (free)",
          cancellable: false,
        },
        () => freeTaste.generate(trimmed, type)
      );
      const diagram = persistRawFetchDiagram(stateManager, {
        id: `free_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        title: trimmed.slice(0, 80),
        description: trimmed,
        type: displayTypeToDiagramType(type),
        mermaidCode,
      }, true);
      if (diagram) {
        await renderService.view(diagram);
      }
      await context.globalState.update("flowcraft.freeRemaining", remaining);
      welcomeProvider.postFreeRemaining(remaining);
      if (remaining <= 0) {
        welcomeProvider.postFreeExhausted();
      }
    } catch (err) {
      if (err instanceof FreeTasteQuotaError) {
        await context.globalState.update("flowcraft.freeRemaining", 0);
        welcomeProvider.postFreeExhausted();
        void vscode.window
          .showInformationMessage(
            "You've used your free FlowCraft diagrams. Add your own API key to keep generating.",
            "Add key"
          )
          .then((choice) => {
            if (choice === "Add key") {
              void vscode.commands.executeCommand("flowcraft.setupApiKey");
            }
          });
      } else {
        void vscode.window
          .showErrorMessage(
            "Free generation failed. Try again, or add your own API key.",
            "Add key"
          )
          .then((choice) => {
            if (choice === "Add key") {
              void vscode.commands.executeCommand("flowcraft.setupApiKey");
            }
          });
      }
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("flowcraft.tryFree", async () => {
      telemetry.track("try_free_clicked");
      const prompt = await vscode.window.showInputBox({
        title: "FlowCraft: try a free diagram (no API key needed)",
        prompt: "Describe the diagram you want, e.g. user login flow with password reset",
        placeHolder: "User signs up, verifies email, then lands on the dashboard",
        ignoreFocusOut: true,
      });
      if (prompt) { await runFreeTaste(prompt, "flowchart"); }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "flowcraft.runFreeTaste",
      (prompt: string, type: string) => runFreeTaste(prompt, type ?? "flowchart")
    )
  );

  const settingsProvider = new SettingsViewProvider(
    context.extensionUri,
    stateManager,
    apiKeyService,
    authService,
    entitlementService,
    telemetry
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SettingsViewProvider.viewType,
      settingsProvider
    )
  );

  const chatParticipant = new FlowCraftChatParticipant(telemetry);

  let resetKeyCommand = vscode.commands.registerCommand(
    "flowcraft.resetApiKey",
    async () => {
      type ResetItem = vscode.QuickPickItem & { value: "all" | Provider };
      const items: ResetItem[] = [
        { label: "$(trash) OpenRouter key", description: "clear the stored key", value: Provider.OpenRouter },
      ];
      const picked = await vscode.window.showQuickPick(items, {
        title: "FlowCraft · reset API key",
        placeHolder: "Clear your stored OpenRouter key?",
      });
      if (!picked) return;

      // Also scrub the legacy single-provider secret if it still exists.
      await context.secrets.delete(OPENAI_KEY_SECRET);

      if (picked.value === "all") {
        await apiKeyService.clearAll();
        vscode.window.showInformationMessage(
          "Your OpenRouter key has been cleared. You will be prompted on next use."
        );
      } else {
        await apiKeyService.delete(picked.value);
        vscode.window.showInformationMessage(
          "Your OpenRouter key has been cleared. You will be prompted on next use."
        );
      }
      await refreshHasApiKeyContext(apiKeyService, stateManager);
    }
  );

  let setupApiKeyCommand = vscode.commands.registerCommand(
    "flowcraft.setupApiKey",
    async () => {
      const picked = { value: Provider.OpenRouter };
      stateManager.setSetting("defaultProvider", picked.value);
      const key = await promptForProviderApiKey(apiKeyService, picked.value);
      if (!key) {
        return;
      }
      await refreshHasApiKeyContext(apiKeyService, stateManager);
      const choice = await vscode.window.showInformationMessage(
        "FlowCraft: OpenRouter key saved — you're ready to generate diagrams.",
        "Generate a diagram"
      );
      if (choice === "Generate a diagram") {
        await vscode.commands.executeCommand("flowcraft.openGenerationView");
      }
    }
  );

  let openWelcomeCommand = vscode.commands.registerCommand(
    "flowcraft.openWelcome",
    async () => {
      await vscode.commands.executeCommand("flowcraft.welcomeView.focus");
    }
  );

  let signInCommand = vscode.commands.registerCommand(
    "flowcraft.signIn",
    async () => {
      await signIn({
        webBaseUrl: authConfig.webBaseUrl,
        extensionId: context.extension.id,
      });
    }
  );

  let signOutCommand = vscode.commands.registerCommand(
    "flowcraft.signOut",
    async () => {
      await signOut(authService);
    }
  );

  let openSettingsCommand = vscode.commands.registerCommand(
    "flowcraft.openSettings",
    async () => {
      // Focus the settings view
      await vscode.commands.executeCommand("flowcraft.settingsView.focus");
    }
  );

  let syncNowCommand = vscode.commands.registerCommand(
    "flowcraft.syncNow",
    async () => {
      await cloudSyncService.syncNow();
    }
  );

  let insertTemplateCommand = vscode.commands.registerCommand(
    "flowcraft.insertTemplate",
    async () => {
      type TemplateItem = vscode.QuickPickItem & { id: string; type: string };
      let items: TemplateItem[];
      try {
        const templates = await apiClient.getTemplates();
        if (templates.length === 0) {
          vscode.window.showInformationMessage("FlowCraft: no templates available right now.");
          return;
        }
        items = templates.map((t) => ({
          label: t.title,
          description: t.category ? `$(symbol-color) ${t.category}` : undefined,
          detail: t.description || undefined,
          id: t.id,
          type: t.type,
        }));
      } catch (err: any) {
        vscode.window.showErrorMessage(`FlowCraft: couldn't load templates · ${err?.message ?? err}`);
        return;
      }

      const picked = await vscode.window.showQuickPick(items, {
        title: "FlowCraft · Premium Templates",
        placeHolder: "Pick a template to insert as a new diagram",
        matchOnDetail: true,
        matchOnDescription: true,
      });
      if (!picked) return;

      // Browsing is free; inserting (fetching the code) is premium.
      const entitled = await requirePremium(
        "premiumTemplates",
        { entitlementService, authService, telemetry },
        { featureLabel: "Premium templates" }
      );
      if (!entitled) return;

      const token = await authService.getValidAccessToken();
      if (!token) {
        vscode.window.showErrorMessage("FlowCraft: please sign in to use templates.");
        return;
      }

      try {
        const tpl = await apiClient.useTemplate(token, picked.id);
        const now = new Date();
        const diagram: Diagram = {
          id: `diagram_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          title: tpl.title || "Template diagram",
          description: tpl.description || "",
          type: (tpl.type as DiagramType) ?? DiagramType.Flowchart,
          category: DiagramCategory.Mermaid,
          content: tpl.code,
          isPublic: false,
          createdAt: now,
          updatedAt: now,
          tokensUsed: 0,
        };
        // Adds to history and (if signed-in + subscribed) auto-syncs to the cloud.
        stateManager.addDiagram(diagram);
        telemetry.track("template_inserted", { diagram_type: diagram.type });

        // Open the Mermaid in an untitled markdown doc for immediate use/preview.
        const doc = await vscode.workspace.openTextDocument({
          language: "markdown",
          content: `# ${diagram.title}\n\n\`\`\`mermaid\n${tpl.code}\n\`\`\`\n`,
        });
        await vscode.window.showTextDocument(doc, { preview: false });
        vscode.window.showInformationMessage(`FlowCraft: inserted template "${diagram.title}".`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`FlowCraft: couldn't insert template · ${err?.message ?? err}`);
      }
    }
  );

  // Resolve a diagram for view/export: from an id (e.g. a future tree item),
  // from a Diagram passed directly, or by picking from local history.
  async function resolveDiagram(arg?: unknown): Promise<Diagram | undefined> {
    if (arg && typeof arg === "object" && "content" in (arg as any) && "id" in (arg as any)) {
      return arg as Diagram;
    }
    if (typeof arg === "string") {
      const found = stateManager.getDiagram(arg);
      if (found) {
        return found;
      }
    }
    const diagrams = stateManager.getAllDiagrams();
    if (diagrams.length === 0) {
      vscode.window.showInformationMessage(
        "FlowCraft: no diagrams in history yet. Generate one first."
      );
      return undefined;
    }
    type Item = vscode.QuickPickItem & { diagram: Diagram };
    const items: Item[] = diagrams.map((d) => ({
      label: d.title || d.id,
      description: d.type,
      detail: d.metadata?.remoteId ? "synced" : undefined,
      diagram: d,
    }));
    const picked = await vscode.window.showQuickPick(items, {
      title: "FlowCraft · pick a diagram",
      placeHolder: "Choose a diagram",
      matchOnDescription: true,
    });
    return picked?.diagram;
  }

  let viewDiagramCommand = vscode.commands.registerCommand(
    "flowcraft.viewDiagram",
    async (arg?: unknown) => {
      const diagram = await resolveDiagram(arg);
      if (diagram) {
        await renderService.view(diagram);
      }
    }
  );

  let exportDiagramCommand = vscode.commands.registerCommand(
    "flowcraft.exportDiagram",
    async (arg?: unknown) => {
      const diagram = await resolveDiagram(arg);
      if (diagram) {
        telemetry.track("export_requested", { diagram_type: diagram.type });
        await exportService.exportDiagram(diagram);
      }
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
            telemetry.track("generation_succeeded", {
              diagram_type: kind,
              provider: stateManager.getSetting("defaultProvider"),
            });
            openDiagramResult(result.id);
          } else {
            telemetry.track("generation_failed", {
              diagram_type: kind,
              provider: stateManager.getSetting("defaultProvider"),
              error_kind: "empty_result",
            });
            vscode.window.showErrorMessage(
              `FlowCraft didn't return a ${kind}. Try again or tweak your prompt.`
            );
          }
        } catch (error: any) {
          const rawMessage = error?.message ?? String(error);
          telemetry.track("generation_failed", {
            diagram_type: kind,
            provider: stateManager.getSetting("defaultProvider"),
            error_kind: classifyErrorKind(rawMessage),
          });
          const friendly = humanizeError(rawMessage);
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
              // Resolve auth: prefer signed-in Bearer, fall back to BYOK.
              const auth = await resolveAuth(authResolver, stateManager);
              if (!auth) return;

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
                  headers: buildGenerateHeaders(auth),
                  body: JSON.stringify(withModel(body)),
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
                showGeneratedDiagram({
                  id: inserted_diagram.data[0].id,
                  title,
                  description: codeContent,
                  type: displayTypeToDiagramType(selectedType),
                  mermaidCode: _res.mermaid_code ?? "",
                });
              } else {
                telemetry.track("generation_failed", {
                  diagram_type: selectedType,
                  provider: stateManager.getSetting("defaultProvider"),
                  error_kind: "empty_result",
                });
                vscode.window.showErrorMessage(
                  "FlowCraft didn't return a diagram. Try again or tweak your prompt."
                );
              }
            } catch (error: any) {
              const rawMessage = error?.message ?? String(error);
              telemetry.track("generation_failed", {
                diagram_type: selectedType,
                provider: stateManager.getSetting("defaultProvider"),
                error_kind: classifyErrorKind(rawMessage),
              });
              const friendly = humanizeError(rawMessage);
              const actions = friendly.action === "billing"
                ? ["Open Billing", "Change Model", "Retry"]
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
                  } else if (choice === "Change Model") {
                    vscode.commands.executeCommand("flowcraft.openSettings");
                  } else if (choice === "Open Billing") {
                    vscode.env.openExternal(vscode.Uri.parse("https://openrouter.ai/credits"));
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
      telemetry.track("history_opened");
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

  // 🪄 Visualize this — zero-typing diagram from a file / folder / selection.
  let visualizeThisCommand = vscode.commands.registerCommand(
    "flowcraft.visualizeThis",
    async (uri?: vscode.Uri) => {
      const editor = vscode.window.activeTextEditor;
      let surface: string;
      let code: string;
      let isFolder = false;
      let title = "Visualize";
      let languageId = "";

      if (uri) {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
          isFolder = true;
          surface = "folder";
          const found = await vscode.workspace.findFiles(
            new vscode.RelativePattern(uri, "**/*.{ts,tsx,js,jsx,py,java,go,rb,cs}"),
            "**/node_modules/**",
            40
          );
          const files: { relPath: string; text: string }[] = [];
          for (const file of found) {
            const bytes = await vscode.workspace.fs.readFile(file);
            files.push({
              relPath: vscode.workspace.asRelativePath(file),
              text: Buffer.from(bytes).toString("utf8"),
            });
          }
          code = summarizeFolder(uri.path.split("/").pop() || "folder", files);
          title = (uri.path.split("/").pop() || "folder").replace(/\s/g, "_");
        } else {
          surface = "file";
          const doc = await vscode.workspace.openTextDocument(uri);
          languageId = doc.languageId;
          code = buildFileContext(doc.getText());
          title = (uri.path.split("/").pop() || "file").replace(/\s/g, "_");
        }
      } else if (editor) {
        const sel = editor.document.getText(editor.selection);
        const hasSel = sel.trim().length > 0;
        surface = hasSel ? "selection" : "file";
        languageId = editor.document.languageId;
        code = buildFileContext(hasSel ? sel : editor.document.getText());
        title = (editor.document.fileName.split("/").pop() || "file").replace(/\s/g, "_");
      } else {
        vscode.window.showErrorMessage(
          "FlowCraft: open a file or pick one in the explorer to visualize."
        );
        return;
      }

      if (!code.trim()) {
        vscode.window.showErrorMessage(
          "FlowCraft: nothing to visualize (the selection/file is empty)."
        );
        return;
      }

      const diagramType = pickDiagramType(code, languageId, isFolder);
      telemetry.track("visualize_requested", { surface, diagram_type: diagramType });

      await runMermaidGeneration({
        body: { title, description: code, type: toApiType(diagramType) },
        diagramType,
        description: code,
        errorMessage:
          "FlowCraft couldn't visualize this. Try a smaller file or selection.",
      });
    }
  );
  context.subscriptions.push(visualizeThisCommand);

  // 📝 Mermaid-in-Markdown: CodeLens (Preview / Refine) + insert command.
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "markdown" },
      new MermaidCodeLensProvider()
    )
  );

  const readBlockCode = (
    doc: vscode.TextDocument,
    startLine: number,
    endLine: number
  ): string => {
    const lines: string[] = [];
    for (let i = startLine + 1; i < endLine; i++) {
      lines.push(doc.lineAt(i).text);
    }
    return lines.join("\n");
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "flowcraft.previewMermaidBlock",
      async (uri: vscode.Uri, startLine: number, endLine: number) => {
        const doc = await vscode.workspace.openTextDocument(uri);
        const code = readBlockCode(doc, startLine, endLine);
        const now = new Date();
        void renderService.view({
          id: `md_${startLine}`,
          title: "Markdown diagram",
          description: "Mermaid block",
          type: DiagramType.Flowchart,
          category: DiagramCategory.Mermaid,
          content: code,
          isPublic: false,
          createdAt: now,
          updatedAt: now,
          tokensUsed: 0,
        });
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "flowcraft.refineMermaidBlock",
      async (uri: vscode.Uri, startLine: number, endLine: number) => {
        const instruction = await vscode.window.showInputBox({
          title: "FlowCraft · refine this diagram",
          placeHolder: "e.g. make it left-to-right, add the error path…",
          ignoreFocusOut: true,
        });
        if (!instruction) {
          return;
        }
        const doc = await vscode.workspace.openTextDocument(uri);
        const code = readBlockCode(doc, startLine, endLine);
        telemetry.track("refine_requested", { surface: "markdown" });
        try {
          const result = await refineService.refine({
            currentCode: code,
            instruction,
            diagramType: DiagramType.Flowchart,
          });
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            uri,
            new vscode.Range(startLine + 1, 0, endLine, 0),
            result.code + "\n"
          );
          await vscode.workspace.applyEdit(edit);
          telemetry.track("refine_succeeded", { surface: "markdown" });
        } catch (err) {
          telemetry.track("refine_failed", {
            surface: "markdown",
            error_kind: classifyErrorKind((err as Error).message),
          });
          vscode.window.showErrorMessage(`FlowCraft: ${(err as Error).message}`);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("flowcraft.insertMermaidBlock", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage(
          "FlowCraft: open a Markdown file to insert a diagram."
        );
        return;
      }
      const prompt = await vscode.window.showInputBox({
        title: "FlowCraft · insert diagram",
        placeHolder: "Describe the diagram to insert, e.g. 'auth login sequence'…",
        ignoreFocusOut: true,
        validateInput: (v: string) =>
          !v || !v.trim()
            ? "Please describe the diagram"
            : v.length > 10000
            ? "Description is too long (max 10,000 characters)"
            : null,
      });
      if (!prompt) {
        return;
      }

      telemetry.track("markdown_insert_requested", { surface: "markdown" });
      const auth = await resolveAuth(authResolver, stateManager);
      if (!auth) {
        return;
      }
      const apiUrl = process.env.FLOWCRAFT_API_URL || FLOWCRAFT_API_URL;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "flowcraft › generating",
          cancellable: false,
        },
        async () => {
          try {
            const response = await fetch(`${apiUrl}/v2/diagrams/generate`, {
              method: "POST",
              headers: buildGenerateHeaders(auth),
              body: JSON.stringify(withModel({
                title: "Inserted diagram",
                description: prompt,
                type: "flowchart",
              })),
            });
            const data: any = await response.json();
            const code = data?.response?.mermaid_code;
            if (!code) {
              vscode.window.showErrorMessage(
                "FlowCraft didn't return a diagram. Try again."
              );
              return;
            }
            const snippet = "```mermaid\n" + code + "\n```\n";
            await editor.edit((b) => b.insert(editor.selection.active, snippet));
          } catch (err) {
            vscode.window.showErrorMessage(`FlowCraft: ${(err as Error).message}`);
          }
        }
      );
    })
  );

  let generateFlowDiagramDisposable = vscode.commands.registerCommand(
    GENERATE_FLOW_DIAGRAM,
    async () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showErrorMessage(
          "No active editor found. Please open a file to generate a diagram."
        );
        return;
      }
      const fileName = activeEditor.document.fileName;
      const fileExtension = fileName.split(".").pop();
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

      let title = fileName.split("\\").pop();
      title = title?.replace(/\s/g, "_");

      await runMermaidGeneration({
        body: { title, description: fileContent, type: "flowchart" },
        diagramType: DiagramType.Flowchart,
        description: fileContent,
        errorMessage:
          "An error occurred while generating the diagram. Please try again later.",
      });
    }
  );

  let generateSelectionDiagramDisposable = vscode.commands.registerCommand(
    GENERATE_SELECTION_FLOW_DIAGRAM,
    async () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showErrorMessage(
          "No active editor found. Please open a file to generate a diagram."
        );
        return;
      }

      const selection = activeEditor.document.getText(activeEditor.selection);
      if (selection.length === 0 || selection.length > 10000) {
        vscode.window.showErrorMessage(
          "The selection is either empty or too large (max 10,000 characters). If you have a large selection, please contact us at https://flowcraft.app/support."
        );
        return;
      }

      const fileNameOnly =
        (activeEditor.document.fileName || "Untitled").split("\\").pop() ||
        "Untitled";
      const title = fileNameOnly.replace(/\s/g, "_");

      await runMermaidGeneration({
        body: { title, description: selection, type: "flowchart" },
        diagramType: DiagramType.Flowchart,
        description: selection,
        errorMessage:
          "An error occurred while generating the diagram. Please try again later.",
      });
    }
  );

  let generateClassDiagramDisposable = vscode.commands.registerCommand(
    GENERATE_CLASS_DIAGRAM,
    async () => {
      const fileContext = await getCurrentOpenFileText();
      if (fileContext.length === 0 || fileContext.length > 10000) {
        vscode.window.showErrorMessage(
          "The file content is either empty or too large (max 10,000 characters). If you have a large file, please contact us at https://flowcraft.app/support."
        );
        return;
      }

      const title = `Class Diagram - ${new Date().toISOString()}`.replace(
        /\s/g,
        "_"
      );

      await runMermaidGeneration({
        body: { title, description: fileContext, type: "classDiagram" },
        diagramType: DiagramType.Class,
        description: fileContext,
        errorMessage:
          "An error occurred while generating the diagram. Please try again later.",
      });
    }
  );

  let generateSelectionClassDiagramDisposable = vscode.commands.registerCommand(
    GENERATE_SELECTION_CLASS_DIAGRAM,
    async () => {
      const selection = await getSelectionText();
      if (selection.length === 0 || selection.length > 10000) {
        vscode.window.showErrorMessage(
          "The selection is either empty or too large (max 10,000 characters). If you have a large selection, please contact us at https://flowcraft.app/support."
        );
        return;
      }

      const title = `Class Diagram - ${new Date().toISOString()}`.replace(
        /\s/g,
        "_"
      );

      await runMermaidGeneration({
        body: { title, description: selection, type: "classDiagram" },
        diagramType: DiagramType.Class,
        description: selection,
        errorMessage:
          "An error occurred while generating the diagram from the selection. Please try again later.",
      });
    }
  );

  // First-run onboarding: open the Get Started walkthrough exactly once, and
  // only when the user has no key yet (don't interrupt returning users).
  const hasKeyOnStartup = await refreshHasApiKeyContext(apiKeyService, stateManager);
  try {
    const onboardingSeen =
      context.globalState.get<boolean>("flowcraft.onboarding.seen") === true;
    if (!onboardingSeen && !hasKeyOnStartup) {
      await vscode.commands.executeCommand(
        "workbench.action.openWalkthrough",
        "FlowCraft.flowcraft#flowcraftGettingStarted",
        false
      );
    }
    await context.globalState.update("flowcraft.onboarding.seen", true);
  } catch (err) {
    console.error("FlowCraft: onboarding walkthrough failed to open:", err);
  }

  // The walkthrough often opens unfocused, so also surface a one-time notice
  // that leads with the free, no-key diagram.
  try {
    const freeRemaining = context.globalState.get<number>("flowcraft.freeRemaining");
    if (
      shouldShowFirstRunNotice({
        noticeSeen: context.globalState.get<boolean>(FIRST_RUN_NOTICE_KEY) === true,
        hasApiKey: hasKeyOnStartup,
        freeRemaining: typeof freeRemaining === "number" ? freeRemaining : null,
      })
    ) {
      await context.globalState.update(FIRST_RUN_NOTICE_KEY, true);
      telemetry.track("onboarding_shown");
      void vscode.window
        .showInformationMessage(
          "FlowCraft: turn a description into a diagram in seconds. Your first few are free, no API key needed.",
          "Try free",
          "Add my key"
        )
        .then((choice) => {
          if (choice === "Try free") {
            void vscode.commands.executeCommand("flowcraft.tryFree");
          } else if (choice === "Add my key") {
            void vscode.commands.executeCommand("flowcraft.setupApiKey");
          }
        });
    }
  } catch (err) {
    console.error("FlowCraft: first-run notice failed:", err);
  }

  const chatHandler = vscode.chat.createChatParticipant(
    "flowcraft.diagramAssistant",
    (req, ctx, stream, tok) => chatParticipant.handleRequest(req, ctx, stream, tok)
  );

  context.subscriptions.push(generateFlowDiagramDisposable);
  context.subscriptions.push(generateSelectionDiagramDisposable);
  context.subscriptions.push(generateClassDiagramDisposable);
  context.subscriptions.push(generateSelectionClassDiagramDisposable);
  context.subscriptions.push(resetKeyCommand);
  context.subscriptions.push(setupApiKeyCommand);
  context.subscriptions.push(openWelcomeCommand);
  context.subscriptions.push(openSettingsCommand);
  context.subscriptions.push(syncUsageCommand);
  context.subscriptions.push(syncNowCommand);
  context.subscriptions.push(insertTemplateCommand);
  context.subscriptions.push(viewDiagramCommand);
  context.subscriptions.push(exportDiagramCommand);
  context.subscriptions.push(openGenerationViewCommand);
  context.subscriptions.push(showHistoryCommand);
  context.subscriptions.push(generateFromSelectionCommand);
  context.subscriptions.push(generateFromFileCommand);
  context.subscriptions.push(signInCommand);
  context.subscriptions.push(signOutCommand);
  context.subscriptions.push(chatHandler);
}

// This method is called when your extension is deactivated
export function deactivate() {}
