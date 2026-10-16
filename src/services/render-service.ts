/**
 * Render Service — the single mermaid rendering surface for the extension.
 *
 * It owns one reusable WebviewPanel that:
 *   - renders a diagram's mermaid into an SVG (the in-extension *viewer*, M6A), and
 *   - produces export artifacts (SVG / PNG / JPEG) from the rendered diagram (M4C).
 *
 * VS Code has no truly headless webview, so exports render through this same
 * (visible) panel rather than a flashing throwaway one. PDF is assembled in the
 * extension from a JPEG produced here (see ExportService).
 *
 * Generation is never touched here — it stays free + BYOK.
 */

import * as vscode from "vscode";
import { getNonce, getThemeKind } from "../utils/webview-utils";
import { getLogger } from "../utils/logger";
import { openFlowcraft } from "../utils/links";
import { Diagram, DiagramCategory } from "../types";

const RENDER_TIMEOUT_MS = 20000;
const EXPORT_TIMEOUT_MS = 20000;

export type ExportArtifactFormat = "svg" | "png" | "jpeg";

export interface RenderExportResult {
  format: ExportArtifactFormat;
  /** SVG markup for "svg"; a base64 data URL ("data:image/...") for png/jpeg. */
  payload: string;
  width: number;
  height: number;
}

interface Waiter<T> {
  resolve: (value: T) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class RenderService implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private current: Diagram | undefined;
  private themeOverride: "light" | "dark" | undefined;
  /** Whether the most recent render of `current` succeeded. Undefined = not rendered yet. */
  private lastRenderOk: boolean | undefined;

  private ready: Promise<void> | undefined;
  private readyResolve: (() => void) | undefined;
  private renderWaiter: Waiter<void> | undefined;
  private pending = new Map<string, Waiter<RenderExportResult>>();
  private reqCounter = 0;

  private disposables: vscode.Disposable[] = [];

  /** Wired by extension.ts so the viewer's "Export" toolbar button runs the export flow. */
  public onExportRequested: ((diagram: Diagram) => void | Promise<void>) | undefined;
  /** Wired by extension.ts so "Open on web" can resolve the right URL (or undefined). */
  public webUrlFor: ((diagram: Diagram) => string | undefined) | undefined;

  /** Wired by extension.ts to run a refinement; returns updated Mermaid code. */
  public onRefine:
    | ((diagram: Diagram, instruction: string) => Promise<string>)
    | undefined;

  /** Wired by extension.ts to re-generate the current diagram as another type. */
  public onChangeType:
    | ((diagram: Diagram, apiType: string) => void | Promise<void>)
    | undefined;

  /** Wired by extension.ts to publish the current diagram to the web. */
  public onShareRequested: ((diagram: Diagram) => Promise<void>) | undefined;

  /** Per-active-diagram refine history (Mermaid versions), oldest first. */
  private refineStack: string[] = [];

  constructor(private readonly extensionUri: vscode.Uri) {}

  /** Reveal the viewer panel and render `diagram` (the interactive in-extension viewer). */
  async view(diagram: Diagram): Promise<void> {
    if (diagram.category !== DiagramCategory.Mermaid) {
      vscode.window.showInformationMessage(
        "FlowCraft: in-extension preview is available for Mermaid diagrams."
      );
      return;
    }
    this.current = diagram;
    this.themeOverride = undefined;
    this.lastRenderOk = undefined;
    this.refineStack = [diagram.content ?? ""];
    const panel = this.ensurePanel();
    panel.title = `FlowCraft · ${diagram.title || "diagram"}`;
    panel.reveal(vscode.ViewColumn.Beside, false);
    try {
      await this.renderCurrent();
    } catch (err) {
      vscode.window.showErrorMessage(
        `FlowCraft: couldn't render diagram · ${(err as Error).message}`
      );
    }
  }

  /**
   * Render `diagram` and return an export artifact. Reuses the viewer panel
   * (revealed without stealing focus) so there is no throwaway-panel flash.
   */
  async renderExport(
    diagram: Diagram,
    format: ExportArtifactFormat,
    scale = 1,
    background?: string
  ): Promise<RenderExportResult> {
    if (diagram.category !== DiagramCategory.Mermaid) {
      throw new Error("Only Mermaid diagrams can be rendered for export.");
    }
    this.current = diagram;
    const panel = this.ensurePanel();
    panel.reveal(panel.viewColumn ?? vscode.ViewColumn.Beside, true);
    await this.renderCurrent();
    return this.requestExport(format, scale, background);
  }

  private ensurePanel(): vscode.WebviewPanel {
    if (this.panel) {
      return this.panel;
    }

    this.ready = new Promise<void>((resolve) => {
      this.readyResolve = resolve;
    });

    const panel = vscode.window.createWebviewPanel(
      "flowcraft.viewer",
      "FlowCraft · diagram",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, "media"),
          vscode.Uri.joinPath(this.extensionUri, "node_modules"),
        ],
      }
    );

    panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      undefined,
      this.disposables
    );

    panel.onDidDispose(
      () => {
        this.panel = undefined;
        this.ready = undefined;
        this.readyResolve = undefined;
        this.failAllPending(new Error("Viewer panel was closed."));
      },
      undefined,
      this.disposables
    );

    // Re-render on theme change unless the user pinned a theme via the toolbar.
    this.disposables.push(
      vscode.window.onDidChangeActiveColorTheme(() => {
        if (!this.themeOverride && this.panel && this.current) {
          void this.renderCurrent().catch(() => {
            /* transient — ignore */
          });
        }
      })
    );

    panel.webview.html = this.getHtml(panel.webview);
    this.panel = panel;
    return panel;
  }

  private async renderCurrent(): Promise<void> {
    const panel = this.ensurePanel();
    if (this.ready) {
      await this.ready;
    }
    const theme = this.themeOverride ?? getThemeKind();

    // Tell the webview whether "Open on web" can resolve a URL for this diagram,
    // so it can disable the button instead of looking like a dead no-op.
    const canOpenWeb = !!(this.current && this.webUrlFor?.(this.current));
    panel.webview.postMessage({ command: "uiState", data: { canOpenWeb } });

    panel.webview.postMessage({
      command: "refineState",
      data: { steps: this.refineStack.length, busy: false },
    });

    const done = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.renderWaiter = undefined;
        reject(new Error("Render timed out."));
      }, RENDER_TIMEOUT_MS);
      this.renderWaiter = { resolve, reject, timer };
    });

    panel.webview.postMessage({
      command: "render",
      data: { code: this.current?.content ?? "", theme },
    });

    await done;
  }

  private requestExport(
    format: ExportArtifactFormat,
    scale: number,
    background: string | undefined
  ): Promise<RenderExportResult> {
    const panel = this.ensurePanel();
    const requestId = `r${++this.reqCounter}`;
    return new Promise<RenderExportResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("Export timed out."));
      }, EXPORT_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, reject, timer });
      panel.webview.postMessage({
        command: "produceExport",
        data: { requestId, format, scale, background },
      });
    });
  }

  private handleMessage(msg: any): void {
    const command = msg?.command;
    const data = msg?.data ?? {};

    switch (command) {
      case "ready": {
        this.readyResolve?.();
        break;
      }
      case "rendered": {
        const waiter = this.renderWaiter;
        this.renderWaiter = undefined;
        if (!waiter) {
          break;
        }
        clearTimeout(waiter.timer);
        this.lastRenderOk = !!data.ok;
        if (data.ok) {
          waiter.resolve();
        } else {
          waiter.reject(new Error(data.error || "Mermaid render failed."));
        }
        break;
      }
      case "exportResult": {
        const waiter = this.pending.get(data.requestId);
        if (!waiter) {
          break;
        }
        this.pending.delete(data.requestId);
        clearTimeout(waiter.timer);
        if (data.ok) {
          waiter.resolve({
            format: data.format,
            payload: data.payload,
            width: data.width ?? 0,
            height: data.height ?? 0,
          });
        } else {
          waiter.reject(new Error(data.error || "Export failed."));
        }
        break;
      }
      case "toolbar": {
        void this.handleToolbar(data.action, data.type);
        break;
      }
      case "refine": {
        void this.handleRefine(String(data.instruction ?? ""));
        break;
      }
      case "refineUndo": {
        void this.handleRefineUndo();
        break;
      }
      default:
        break;
    }
  }

  private async handleRefine(instruction: string): Promise<void> {
    const diagram = this.current;
    if (!diagram || !instruction.trim() || !this.onRefine) {
      return;
    }
    this.panel?.webview.postMessage({
      command: "refineState",
      data: { steps: this.refineStack.length, busy: true },
    });
    try {
      const newCode = await this.onRefine(diagram, instruction.trim());
      diagram.content = newCode;
      this.refineStack.push(newCode);
      await this.renderCurrent();
    } catch (err) {
      this.panel?.webview.postMessage({
        command: "refineError",
        data: { message: (err as Error).message || "Refine failed." },
      });
    }
  }

  private async handleRefineUndo(): Promise<void> {
    const diagram = this.current;
    if (!diagram || this.refineStack.length <= 1) {
      return;
    }
    this.refineStack.pop();
    diagram.content = this.refineStack[this.refineStack.length - 1];
    await this.renderCurrent();
  }

  private async handleToolbar(action: string, type?: string): Promise<void> {
    const diagram = this.current;
    if (!diagram) {
      return;
    }
    switch (action) {
      case "copyCode":
        await vscode.env.clipboard.writeText(diagram.content ?? "");
        vscode.window.showInformationMessage("FlowCraft: diagram code copied.");
        break;
      case "export":
        if (this.onExportRequested) {
          await this.onExportRequested(diagram);
        }
        break;
      case "toggleTheme": {
        // Don't bother re-rendering a diagram whose Mermaid is broken — it will
        // just fail again. Tell the user to fix the code first.
        if (this.lastRenderOk === false) {
          vscode.window.showWarningMessage(
            "FlowCraft: this diagram has a Mermaid error — fix the code before switching themes."
          );
          break;
        }
        const currently = this.themeOverride ?? getThemeKind();
        this.themeOverride = currently === "dark" ? "light" : "dark";
        await this.renderCurrent().catch((err) =>
          getLogger().error("RenderService: theme re-render failed", err)
        );
        break;
      }
      case "openWeb": {
        const url = this.webUrlFor?.(diagram);
        if (url) {
          await openFlowcraft(url, "viewer_open_web");
        } else {
          // No web URL — almost always because the diagram was created locally
          // and never synced. Offer the path that fixes it instead of a dead-end toast.
          const choice = await vscode.window.showInformationMessage(
            "FlowCraft: this diagram isn't on the web yet. Sign in to sync your diagrams to flowcraft.app.",
            "Sign in to sync"
          );
          if (choice === "Sign in to sync") {
            await vscode.commands.executeCommand("flowcraft.signIn");
          }
        }
        break;
      }
      case "changeType": {
        if (type && this.onChangeType && this.current) {
          await this.onChangeType(this.current, type);
        }
        break;
      }
      case "share":
        if (this.onShareRequested && this.current) {
          await this.onShareRequested(this.current);
        }
        break;
      default:
        break;
    }
  }

  private failAllPending(err: Error): void {
    if (this.renderWaiter) {
      clearTimeout(this.renderWaiter.timer);
      this.renderWaiter.reject(err);
      this.renderWaiter = undefined;
    }
    for (const waiter of this.pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(err);
    }
    this.pending.clear();
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const mermaidUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        "node_modules",
        "mermaid",
        "dist",
        "mermaid.min.js"
      )
    );
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} https: data: blob:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource} data:`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FlowCraft diagram</title>
  <style>
    :root { color-scheme: light dark; }
    html, body { margin: 0; padding: 0; height: 100%; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      display: flex; flex-direction: column;
    }
    .toolbar {
      display: flex; gap: 6px; align-items: center;
      padding: 8px 10px;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.35));
      flex: 0 0 auto;
    }
    .toolbar button {
      font: inherit; cursor: pointer;
      color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
      background: var(--vscode-button-secondaryBackground, transparent);
      border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.4));
      border-radius: 4px; padding: 4px 10px;
    }
    .toolbar button:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground, rgba(128,128,128,0.18)); }
    .toolbar button:disabled { opacity: 0.4; cursor: default; }
    .toolbar .spacer { flex: 1 1 auto; }
    .stage { flex: 1 1 auto; overflow: auto; padding: 16px; }
    #diagram { display: flex; justify-content: center; }
    #diagram svg { max-width: 100%; height: auto; }
    .err { padding: 16px; max-width: 720px; margin: 0 auto; }
    .err h3 {
      margin: 0 0 8px; font-size: 13px; font-weight: 600;
      color: var(--vscode-errorForeground, #f14c4c);
    }
    .err p { margin: 0 0 10px; color: var(--vscode-descriptionForeground, var(--vscode-foreground)); }
    .err pre {
      white-space: pre-wrap; word-break: break-word; margin: 0;
      padding: 10px; border-radius: 4px;
      background: var(--vscode-textCodeBlock-background, rgba(128,128,128,0.12));
      color: var(--vscode-errorForeground, #f14c4c);
      font-family: var(--vscode-editor-font-family, monospace); font-size: 12px;
    }
    .toolbar select {
      font: inherit; cursor: pointer;
      color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
      background: var(--vscode-button-secondaryBackground, transparent);
      border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.4));
      border-radius: 4px; padding: 4px 6px;
    }
    .refinebar {
      display: flex; gap: 6px; align-items: center;
      padding: 8px 10px;
      border-top: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.35));
      flex: 0 0 auto;
    }
    .refinebar input {
      flex: 1 1 auto; font: inherit;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.4));
      border-radius: 4px; padding: 5px 8px;
    }
    .refinebar button {
      font: inherit; cursor: pointer;
      color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
      background: var(--vscode-button-secondaryBackground, transparent);
      border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.4));
      border-radius: 4px; padding: 4px 10px;
    }
    .refinebar button:disabled { opacity: 0.4; cursor: default; }
    .refinebar .hint { color: var(--vscode-descriptionForeground); font-size: 11px; }
    .refinebar .err { color: var(--vscode-errorForeground, #f14c4c); font-size: 11px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="tb-copy" title="Copy Mermaid code">Copy code</button>
    <button id="tb-export" title="Export this diagram">Export…</button>
    <select id="tb-type" title="Re-generate as a different diagram type">
      <option value="">Type…</option>
      <option value="flowchart">Flowchart</option>
      <option value="classDiagram">Class</option>
      <option value="sequenceDiagram">Sequence</option>
      <option value="stateDiagram">State</option>
      <option value="erDiagram">ER</option>
    </select>
    <span class="spacer"></span>
    <button id="tb-theme" title="Toggle light / dark rendering">Theme</button>
    <button id="tb-web" title="Open the synced diagram on flowcraft.app" disabled>Open on web</button>
    <button id="tb-share" title="Share to web">Share</button>
  </div>
  <div class="stage"><div id="diagram"></div></div>
  <div class="refinebar">
    <input id="rf-input" type="text" placeholder="Refine: e.g. 'make it left-to-right', 'add the error path'…" />
    <button id="rf-go" title="Apply this change">Refine</button>
    <button id="rf-undo" title="Step back to the previous version" disabled>↶ Back</button>
    <span id="rf-status" class="hint"></span>
  </div>

  <script nonce="${nonce}" src="${mermaidUri}"></script>
  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const container = document.getElementById("diagram");
      let renderSeq = 0;

      function initMermaid(theme) {
        try {
          mermaid.initialize({
            startOnLoad: false,
            theme: theme === "dark" ? "dark" : "default",
            securityLevel: "loose",
          });
        } catch (e) { /* ignore */ }
      }

      function setEnabled(id, on) {
        const el = document.getElementById(id);
        if (el) { el.disabled = !on; }
      }

      function showRenderError(msg) {
        container.innerHTML = "";
        const wrap = document.createElement("div");
        wrap.className = "err";
        const h = document.createElement("h3");
        h.textContent = "This diagram couldn't be rendered";
        const p = document.createElement("p");
        p.textContent = "Mermaid rejected the diagram code. Fix the syntax error below, then regenerate or edit the source.";
        const pre = document.createElement("pre");
        pre.textContent = msg;
        wrap.appendChild(h);
        wrap.appendChild(p);
        wrap.appendChild(pre);
        container.appendChild(wrap);
      }

      async function render(code, theme) {
        initMermaid(theme);
        const id = "fc-graph-" + (++renderSeq);
        try {
          const out = await mermaid.render(id, code || "");
          container.innerHTML = out.svg;
          const svgEl = container.querySelector("svg");
          const dims = svgDims(svgEl);
          // Render succeeded — Theme + Export are meaningful again.
          setEnabled("tb-theme", true);
          setEnabled("tb-export", true);
          vscode.postMessage({ command: "rendered", data: { ok: true, width: dims.w, height: dims.h } });
        } catch (e) {
          const msg = (e && e.message) ? e.message : String(e);
          showRenderError(msg);
          // Nothing is rendered — Theme would just re-fail and Export has nothing to produce.
          setEnabled("tb-theme", false);
          setEnabled("tb-export", false);
          vscode.postMessage({ command: "rendered", data: { ok: false, error: msg } });
        }
      }

      function svgDims(svgEl) {
        let w = 0, h = 0;
        if (svgEl) {
          const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
          if (vb && vb.width) { w = vb.width; h = vb.height; }
          if (!w || !h) {
            const r = svgEl.getBoundingClientRect();
            w = r.width || w; h = r.height || h;
          }
        }
        return { w: Math.max(1, Math.ceil(w)), h: Math.max(1, Math.ceil(h)) };
      }

      function prepareSvg(svgEl, w, h) {
        const clone = svgEl.cloneNode(true);
        clone.setAttribute("width", String(w));
        clone.setAttribute("height", String(h));
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        if (clone.style) { clone.style.maxWidth = "none"; }
        return clone;
      }

      async function rasterize(svgEl, scale, background, mime) {
        const d = svgDims(svgEl);
        const clone = prepareSvg(svgEl, d.w, d.h);
        const str = new XMLSerializer().serializeToString(clone);
        const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(str);
        const img = new Image();
        await new Promise(function (res, rej) {
          img.onload = res;
          img.onerror = function () { rej(new Error("Could not rasterize the SVG.")); };
          img.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(d.w * scale));
        canvas.height = Math.max(1, Math.round(d.h * scale));
        const ctx = canvas.getContext("2d");
        if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const quality = mime === "image/jpeg" ? 0.92 : undefined;
        return { dataUrl: canvas.toDataURL(mime, quality), width: canvas.width, height: canvas.height };
      }

      async function produceExport(requestId, format, scale, background) {
        const svgEl = container.querySelector("svg");
        if (!svgEl) {
          vscode.postMessage({ command: "exportResult", data: { requestId, ok: false, error: "Nothing is rendered to export." } });
          return;
        }
        try {
          if (format === "svg") {
            const d = svgDims(svgEl);
            const clone = prepareSvg(svgEl, d.w, d.h);
            const str = '<?xml version="1.0" encoding="UTF-8"?>\\n' + new XMLSerializer().serializeToString(clone);
            vscode.postMessage({ command: "exportResult", data: { requestId, ok: true, format: "svg", payload: str, width: d.w, height: d.h } });
            return;
          }
          const mime = format === "jpeg" ? "image/jpeg" : "image/png";
          const out = await rasterize(svgEl, scale || 1, background, mime);
          vscode.postMessage({ command: "exportResult", data: { requestId, ok: true, format: format, payload: out.dataUrl, width: out.width, height: out.height } });
        } catch (e) {
          const msg = (e && e.message) ? e.message : String(e);
          vscode.postMessage({ command: "exportResult", data: { requestId, ok: false, error: msg } });
        }
      }

      window.addEventListener("message", function (ev) {
        const m = ev.data || {};
        if (m.command === "render") { render(m.data.code, m.data.theme); }
        else if (m.command === "produceExport") { produceExport(m.data.requestId, m.data.format, m.data.scale, m.data.background); }
        else if (m.command === "uiState") { setEnabled("tb-web", !!(m.data && m.data.canOpenWeb)); }
        else if (m.command === "refineState") {
          const busy = !!(m.data && m.data.busy);
          rfGo.disabled = busy;
          rfInput.disabled = busy;
          rfUndo.disabled = !(m.data && m.data.steps > 1);
          rfStatus.className = "hint";
          rfStatus.textContent = busy ? "Refining…" : "";
          if (!busy) { rfInput.value = ""; }
        }
        else if (m.command === "refineError") {
          rfGo.disabled = false; rfInput.disabled = false;
          rfStatus.className = "err";
          rfStatus.textContent = (m.data && m.data.message) || "Refine failed.";
        }
      });

      document.getElementById("tb-copy").addEventListener("click", function () { vscode.postMessage({ command: "toolbar", data: { action: "copyCode" } }); });
      document.getElementById("tb-export").addEventListener("click", function () { vscode.postMessage({ command: "toolbar", data: { action: "export" } }); });
      document.getElementById("tb-theme").addEventListener("click", function () { vscode.postMessage({ command: "toolbar", data: { action: "toggleTheme" } }); });
      document.getElementById("tb-web").addEventListener("click", function () { vscode.postMessage({ command: "toolbar", data: { action: "openWeb" } }); });
      document.getElementById("tb-share").addEventListener("click", function () { vscode.postMessage({ command: "toolbar", data: { action: "share" } }); });
      document.getElementById("tb-type").addEventListener("change", function (e) {
        const type = e.target.value;
        if (type) { vscode.postMessage({ command: "toolbar", data: { action: "changeType", type: type } }); }
        e.target.value = "";
      });

      const rfInput = document.getElementById("rf-input");
      const rfGo = document.getElementById("rf-go");
      const rfUndo = document.getElementById("rf-undo");
      const rfStatus = document.getElementById("rf-status");

      function submitRefine() {
        const instruction = (rfInput.value || "").trim();
        if (!instruction) { return; }
        vscode.postMessage({ command: "refine", data: { instruction: instruction } });
      }
      rfGo.addEventListener("click", submitRefine);
      rfInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { submitRefine(); }
      });
      rfUndo.addEventListener("click", function () {
        vscode.postMessage({ command: "refineUndo" });
      });

      vscode.postMessage({ command: "ready" });
    })();
  </script>
</body>
</html>`;
  }

  dispose(): void {
    this.failAllPending(new Error("RenderService disposed."));
    this.panel?.dispose();
    this.panel = undefined;
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
