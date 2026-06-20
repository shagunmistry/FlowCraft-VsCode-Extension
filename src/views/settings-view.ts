import * as vscode from 'vscode';
import { StateManager } from '../state/state-manager';
import { APIKeyService } from '../services/api-key-service';
import { AuthService } from '../services/auth-service';
import { EntitlementService } from '../services/entitlement-service';
import { TelemetryService } from '../services/telemetry-service';
import { FLOWCRAFT_PRICING_URL, FLOWCRAFT_BILLING_URL } from '../services/premium-gate';
import { Settings, Provider, Entitlement } from '../types';
import { setupMessageListener, getNonce, getWebviewUri } from '../utils/webview-utils';

export class SettingsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'flowcraft.settingsView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly stateManager: StateManager,
    private readonly apiKeyService: APIKeyService,
    private readonly authService: AuthService,
    private readonly entitlementService: EntitlementService,
    private readonly telemetry: TelemetryService
  ) {}

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media'),
        vscode.Uri.joinPath(this.extensionUri, 'out'),
        vscode.Uri.joinPath(this.extensionUri, 'node_modules')
      ]
    };

    webviewView.webview.html = await this.getHtmlContent(webviewView.webview);

    // Handle messages from webview
    setupMessageListener(webviewView.webview, {
      loadSettings: async () => this.sendSettingsData(),
      saveSettings: async (data: any) => this.saveSettings(data),
      testConnection: async (data: { provider: string, apiKey: string }) => this.testConnection(data),
      resetSettings: async () => this.resetSettings(),
      resetApiKeys: async () => { await vscode.commands.executeCommand('flowcraft.resetApiKey'); },
      signIn:  async () => { await vscode.commands.executeCommand('flowcraft.signIn'); },
      signOut: async () => { await vscode.commands.executeCommand('flowcraft.signOut'); },
      upgrade: async () => { await vscode.env.openExternal(vscode.Uri.parse(FLOWCRAFT_PRICING_URL)); },
      manageSubscription: async () => { await vscode.env.openExternal(vscode.Uri.parse(FLOWCRAFT_BILLING_URL)); }
    });

    // Update on state changes
    this.stateManager.onStateChange(() => {
      this.sendSettingsData();
    });

    // Update on auth changes
    this.authService.onDidChangeSession(() => {
      this.sendAccountData();
    });

    // Update when entitlement resolves/changes (sign-in, subscription flip).
    this.entitlementService.onDidChange(() => {
      this.sendAccountData();
    });
  }

  /** Build the account payload sent to the webview (sign-in + premium state). */
  private async buildAccountPayload(): Promise<Record<string, unknown>> {
    const session = await this.authService.getSession();
    if (!session) {
      return { signedIn: false, subscribed: false };
    }
    let entitlement: Entitlement | null = null;
    try {
      entitlement = await this.entitlementService.get();
    } catch {
      entitlement = null;
    }
    return {
      signedIn: true,
      email: session.email,
      subscribed: !!entitlement?.subscribed,
      plan: entitlement?.plan ?? null,
    };
  }

  private async sendAccountData(): Promise<void> {
    if (!this._view) return;
    this._view.webview.postMessage({
      command: 'accountUpdated',
      data: await this.buildAccountPayload(),
    });
  }

  private async sendSettingsData(): Promise<void> {
    if (this._view) {
      const settings = this.stateManager.getSettings();
      
      // Get configured providers (don't send actual keys back for security/display simplified)
      // Actually for settings UI we probably need to show if a key is set or not
      const providers: Record<string, boolean> = {};
      for (const provider of Object.values(Provider)) {
        providers[provider] = await this.apiKeyService.has(provider);
      }

      this._view.webview.postMessage({
        command: 'updateSettings',
        data: {
          settings,
          providers,
          account: await this.buildAccountPayload()
        }
      });
    }
  }

  private async saveSettings(data: { settings: Settings, apiKeys: Record<string, string> }): Promise<void> {
    try {
      // Update Config Settings
      this.stateManager.updateSettings(data.settings);

      // Update API Keys if provided
      let keysUpdated = 0;
      for (const [providerKey, key] of Object.entries(data.apiKeys)) {
        if (key && key.trim().length > 0) {
           // Validate provider key cast
           const provider = providerKey as Provider;
           if (Object.values(Provider).includes(provider)) {
              // Validate key format
              if (this.apiKeyService.validate(provider, key)) {
                await this.apiKeyService.store(provider, key);
                this.telemetry.track('key_added', { provider });
                keysUpdated++;
              } else {
                vscode.window.showWarningMessage(`Invalid API key format for ${provider}`);
              }
           }
        }
      }

      // Success message
      const message = keysUpdated > 0 
        ? `Settings saved. ${keysUpdated} API key(s) updated.`
        : 'Settings saved successfully';
      
      vscode.window.showInformationMessage(message);
      
      // Send updated data back to webview
      this.sendSettingsData();
      
      // Notify webview that save completed
      if (this._view) {
        this._view.webview.postMessage({
          command: 'saveComplete',
          data: { success: true }
        });
      }
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      vscode.window.showErrorMessage('Failed to save settings: ' + (error instanceof Error ? error.message : String(error)));
      
      if (this._view) {
        this._view.webview.postMessage({
          command: 'saveComplete',
          data: { success: false }
        });
      }
    }
  }

  private async testConnection(data: { provider: string, apiKey: string }): Promise<void> {
      try {
          const provider = data.provider as Provider;
          const isValid = await this.apiKeyService.test(provider, data.apiKey);
          
          if (this._view) {
              this._view.webview.postMessage({
                  command: 'connectionResult',
                  data: {
                      provider: data.provider,
                      success: isValid,
                      message: isValid ? 'Connection successful!' : 'Connection failed. Please check your API key.'
                  }
              });
          }
      } catch (error) {
           if (this._view) {
              this._view.webview.postMessage({
                  command: 'connectionResult',
                  data: {
                      provider: data.provider,
                      success: false,
                      message: 'Connection error: ' + (error instanceof Error ? error.message : String(error))
                  }
              });
          }
      }
  }

  private async resetSettings(): Promise<void> {
    const result = await vscode.window.showWarningMessage(
      'Are you sure you want to reset all settings? This will not delete API keys.',
      'Yes', 'No'
    );

    if (result === 'Yes') {
        this.stateManager.resetSettings();
        vscode.window.showInformationMessage('Settings reset to defaults');
        this.sendSettingsData();
    }
  }

  private async getHtmlContent(webview: vscode.Webview): Promise<string> {
    const nonce = getNonce();
    
    const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'webview', 'settings', 'index.html');
    const htmlBytes = await vscode.workspace.fs.readFile(htmlPath);
    let html = Buffer.from(htmlBytes).toString('utf-8');

    // URIs
    const themeCss = getWebviewUri(webview, this.extensionUri, ['media', 'webview', 'shared', 'styles', 'theme.css']);
    const componentsCss = getWebviewUri(webview, this.extensionUri, ['media', 'webview', 'shared', 'styles', 'components.css']);
    const settingsCss = getWebviewUri(webview, this.extensionUri, ['media', 'webview', 'settings', 'settings.css']);
    const codiconCss = getWebviewUri(webview, this.extensionUri, ['node_modules', '@vscode', 'codicons', 'dist', 'codicon.css']);

    const settingsJs = getWebviewUri(webview, this.extensionUri, ['media', 'webview', 'settings', 'settings.js']);

    html = html.replace(/{{cspSource}}/g, webview.cspSource)
      .replace(/{{nonce}}/g, nonce)
      .replace(/{{themeCss}}/g, themeCss.toString())
      .replace(/{{componentsCss}}/g, componentsCss.toString())
      .replace(/{{settingsCss}}/g, settingsCss.toString())
      .replace(/{{codiconCss}}/g, codiconCss.toString())
      .replace(/{{settingsJs}}/g, settingsJs.toString());

    return html;
  }
}
