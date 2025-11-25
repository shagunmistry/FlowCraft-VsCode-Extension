/**
 * File utility functions
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Get current file content
 */
export async function getCurrentFileContent(): Promise<string | undefined> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  return editor.document.getText();
}

/**
 * Get selected text
 */
export function getSelectedText(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    return undefined;
  }

  return editor.document.getText(selection);
}

/**
 * Get file name from URI
 */
export function getFileName(uri: vscode.Uri): string {
  return path.basename(uri.fsPath);
}

/**
 * Get file extension
 */
export function getFileExtension(uri: vscode.Uri): string {
  return path.extname(uri.fsPath);
}

/**
 * Get file name without extension
 */
export function getFileNameWithoutExtension(uri: vscode.Uri): string {
  const fileName = getFileName(uri);
  const ext = getFileExtension(uri);
  return fileName.substring(0, fileName.length - ext.length);
}

/**
 * Read file content
 */
export async function readFile(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString('utf-8');
}

/**
 * Write file content
 */
export async function writeFile(uri: vscode.Uri, content: string): Promise<void> {
  const bytes = Buffer.from(content, 'utf-8');
  await vscode.workspace.fs.writeFile(uri, bytes);
}

/**
 * Check if file exists
 */
export async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create directory if it doesn't exist
 */
export async function ensureDirectory(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.createDirectory(uri);
  } catch (error) {
    // Directory might already exist, ignore error
  }
}

/**
 * Get workspace root
 */
export function getWorkspaceRoot(): vscode.Uri | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  return workspaceFolders[0].uri;
}

/**
 * Get relative path from workspace root
 */
export function getRelativePathFromWorkspace(uri: vscode.Uri): string | undefined {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    return undefined;
  }

  return path.relative(workspaceRoot.fsPath, uri.fsPath);
}

/**
 * Show file save dialog
 */
export async function showSaveDialog(
  defaultFileName: string,
  filters?: { [name: string]: string[] }
): Promise<vscode.Uri | undefined> {
  const workspaceRoot = getWorkspaceRoot();
  const defaultUri = workspaceRoot
    ? vscode.Uri.joinPath(workspaceRoot, defaultFileName)
    : vscode.Uri.file(defaultFileName);

  return await vscode.window.showSaveDialog({
    defaultUri,
    filters: filters || { 'All Files': ['*'] }
  });
}

/**
 * Show file open dialog
 */
export async function showOpenDialog(
  canSelectMany: boolean = false,
  filters?: { [name: string]: string[] }
): Promise<vscode.Uri[] | undefined> {
  return await vscode.window.showOpenDialog({
    canSelectMany,
    filters: filters || { 'All Files': ['*'] }
  });
}

/**
 * Get language ID from file extension
 */
export function getLanguageFromExtension(extension: string): string {
  const languageMap: { [key: string]: string } = {
    '.ts': 'typescript',
    '.js': 'javascript',
    '.tsx': 'typescriptreact',
    '.jsx': 'javascriptreact',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala'
  };

  return languageMap[extension.toLowerCase()] || 'plaintext';
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Get file size
 */
export async function getFileSize(uri: vscode.Uri): Promise<number> {
  const stat = await vscode.workspace.fs.stat(uri);
  return stat.size;
}
