import * as vscode from 'vscode';
import { StateManager } from '../state/state-manager';
import { UsageService } from '../services/usage-service';
import { setupMessageListener, getNonce, getWebviewUri } from '../utils/webview-utils';

export class WelcomeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'flowcraft.welcomeView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly stateManager: StateManager,
    private readonly usageService: UsageService
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
        vscode.Uri.joinPath(this.extensionUri, 'src', 'webview'),
        vscode.Uri.joinPath(this.extensionUri, 'node_modules')
      ]
    };

    webviewView.webview.html = await this.getHtmlContent(webviewView.webview);

    // Handle messages from webview
    setupMessageListener(webviewView.webview, {
      generateDiagram: async () => { await vscode.commands.executeCommand('flowcraft.openGenerationView'); },
      createInfographic: async () => { await vscode.commands.executeCommand('flowcraft.openGenerationView', 'infographic'); },
      generateImage: async () => { await vscode.commands.executeCommand('flowcraft.openGenerationView', 'image'); },
      viewHistory: async () => { await vscode.commands.executeCommand('flowcraft.showHistory'); },
      openSettings: async () => { await vscode.commands.executeCommand('flowcraft.openSettings'); },
      checkUsage: async () => this.sendUsageData()
    });

    // Update on state changes
    this.stateManager.onStateChange(() => {
      this.sendUsageData();
    });
  }

  private sendUsageData(): void {
    if (this._view) {
      const usage = this.usageService.getUsage();
      this._view.webview.postMessage({
        command: 'updateUsage',
        data: usage
      });
    }
  }

  private async getHtmlContent(webview: vscode.Webview): Promise<string> {
    const nonce = getNonce();
    
    // Read HTML file
    const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'welcome', 'index.html');
    const htmlBytes = await vscode.workspace.fs.readFile(htmlPath);
    let html = Buffer.from(htmlBytes).toString('utf-8');

    // URIs
    const themeCss = getWebviewUri(webview, this.extensionUri, ['src', 'webview', 'shared', 'styles', 'theme.css']);
    const componentsCss = getWebviewUri(webview, this.extensionUri, ['src', 'webview', 'shared', 'styles', 'components.css']);
    const welcomeCss = getWebviewUri(webview, this.extensionUri, ['src', 'webview', 'welcome', 'welcome.css']);
    const codiconCss = getWebviewUri(webview, this.extensionUri, ['node_modules', '@vscode', 'codicons', 'dist', 'codicon.css']);
    
    const welcomeJs = getWebviewUri(webview, this.extensionUri, ['src', 'webview', 'welcome', 'welcome.js']);

    // Replacements
    html = html.replace(/{{cspSource}}/g, webview.cspSource)
      .replace(/{{nonce}}/g, nonce)
      .replace(/{{themeCss}}/g, themeCss.toString())
      .replace(/{{componentsCss}}/g, componentsCss.toString())
      .replace(/{{welcomeCss}}/g, welcomeCss.toString())
      .replace(/{{codiconCss}}/g, codiconCss.toString())
      .replace(/{{welcomeJs}}/g, welcomeJs.toString());

    return html;
  }
}
