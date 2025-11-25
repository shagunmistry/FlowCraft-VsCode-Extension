/**
 * Webview utility functions
 */

import * as vscode from 'vscode';

/**
 * Get webview options with proper CSP
 */
export function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
  return {
    enableScripts: true,
    localResourceRoots: [
      vscode.Uri.joinPath(extensionUri, 'media'),
      vscode.Uri.joinPath(extensionUri, 'out'),
      vscode.Uri.joinPath(extensionUri, 'node_modules')
    ]
  };
}

/**
 * Get URI for a webview resource
 */
export function getWebviewUri(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  pathSegments: string[]
): vscode.Uri {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathSegments));
}

/**
 * Generate a nonce for CSP
 */
export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Get HTML template with CSP
 */
export function getHtmlTemplate(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  title: string,
  cssFiles: string[] = [],
  jsFiles: string[] = []
): string {
  const nonce = getNonce();

  // Convert file paths to webview URIs
  const cssUris = cssFiles.map(file =>
    getWebviewUri(webview, extensionUri, ['src', 'webview', ...file.split('/')])
  );

  const jsUris = jsFiles.map(file =>
    getWebviewUri(webview, extensionUri, ['src', 'webview', ...file.split('/')])
  );

  // Get codiconUri for VS Code icons
  const codiconUri = getWebviewUri(webview, extensionUri, [
    'node_modules',
    '@vscode',
    'codicons',
    'dist',
    'codicon.css'
  ]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   style-src ${webview.cspSource} 'unsafe-inline';
                   script-src 'nonce-${nonce}';
                   font-src ${webview.cspSource};
                   img-src ${webview.cspSource} https: data:;">
    <title>${title}</title>

    ${cssUris.map(uri => `<link rel="stylesheet" href="${uri}">`).join('\n    ')}
    <link rel="stylesheet" href="${codiconUri}">
</head>
<body>
    <div id="root"></div>

    ${jsUris.map(uri => `<script nonce="${nonce}" src="${uri}"></script>`).join('\n    ')}
</body>
</html>`;
}

/**
 * Post message to webview
 */
export function postMessageToWebview(
  webview: vscode.Webview,
  command: string,
  data?: any
): void {
  webview.postMessage({
    command,
    data
  });
}

/**
 * Setup message listener for webview
 */
export function setupMessageListener(
  webview: vscode.Webview,
  handlers: { [command: string]: (data: any) => void | Promise<void> }
): vscode.Disposable {
  return webview.onDidReceiveMessage(async (message) => {
    const handler = handlers[message.command];
    if (handler) {
      try {
        await handler(message.data);
      } catch (error) {
        console.error(`Error handling command ${message.command}:`, error);
      }
    } else {
      console.warn(`No handler for command: ${message.command}`);
    }
  });
}

/**
 * Get theme kind (light or dark)
 */
export function getThemeKind(): 'light' | 'dark' {
  const theme = vscode.window.activeColorTheme;
  return theme.kind === vscode.ColorThemeKind.Dark ||
         theme.kind === vscode.ColorThemeKind.HighContrast
    ? 'dark'
    : 'light';
}

/**
 * Setup theme change listener
 */
export function setupThemeListener(
  callback: (theme: 'light' | 'dark') => void
): vscode.Disposable {
  return vscode.window.onDidChangeActiveColorTheme(() => {
    callback(getThemeKind());
  });
}

/**
 * Load HTML file content
 */
export async function loadHtmlFile(
  extensionUri: vscode.Uri,
  relativePath: string
): Promise<string> {
  const htmlPath = vscode.Uri.joinPath(extensionUri, relativePath);
  const htmlBytes = await vscode.workspace.fs.readFile(htmlPath);
  return Buffer.from(htmlBytes).toString('utf-8');
}

/**
 * Inject webview URIs into HTML
 */
export function injectWebviewUris(
  html: string,
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  replacements: { [key: string]: string[] }
): string {
  let result = html;

  for (const [placeholder, pathSegments] of Object.entries(replacements)) {
    const uri = getWebviewUri(webview, extensionUri, pathSegments);
    result = result.replace(new RegExp(`{{${placeholder}}}`, 'g'), uri.toString());
  }

  return result;
}

/**
 * Create webview panel with standard options
 */
export function createWebviewPanel(
  extensionUri: vscode.Uri,
  viewType: string,
  title: string,
  column: vscode.ViewColumn = vscode.ViewColumn.One,
  options?: vscode.WebviewPanelOptions
): vscode.WebviewPanel {
  return vscode.window.createWebviewPanel(
    viewType,
    title,
    column,
    {
      ...getWebviewOptions(extensionUri),
      ...options
    }
  );
}
