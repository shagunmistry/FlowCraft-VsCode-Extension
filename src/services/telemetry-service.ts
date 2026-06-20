/**
 * Telemetry Service — anonymous, opt-out usage telemetry.
 *
 * The extension is BYOK and mostly unauthenticated, so its users are otherwise
 * invisible to the backend. This service emits a small set of allow-listed events
 * (activation, generation success/failure, upgrade funnel) keyed by a random
 * per-install UUID. It NEVER sends API keys, prompt text, or generated content.
 *
 * Opt-out is double-gated: the user's `telemetryEnabled` setting AND VS Code's
 * global `vscode.env.isTelemetryEnabled`. Sending is fire-and-forget with a short
 * timeout — telemetry must never block or fail a user-facing action.
 */

import * as vscode from "vscode";
import { randomUUID } from "crypto";

const INSTALL_ID_KEY = "flowcraft.installId";
const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_AT_COUNT = 10;
const MAX_BATCH = 50;
const SEND_TIMEOUT_MS = 5_000;

export type TelemetryEventName =
  | "extension_activated"
  | "generation_succeeded"
  | "generation_failed"
  | "upgrade_prompt_shown"
  | "upgrade_clicked"
  | "upgrade_link_clicked"
  | "free_limit_exhausted"
  | "signed_in"
  | "refine_requested"
  | "refine_succeeded"
  | "refine_failed"
  | "visualize_requested"
  | "markdown_insert_requested"
  | "share_requested"
  | "share_succeeded"
  | "share_failed";

export interface TelemetryProps {
  diagram_type?: string;
  provider?: string;
  outcome?: string;
  error_kind?: string;
  /** Entry surface for visualize/refine, e.g. "file" | "folder" | "selection" | "markdown". */
  surface?: string;
}

interface QueuedEvent extends TelemetryProps {
  event: TelemetryEventName;
}

export class TelemetryService {
  private queue: QueuedEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly installId: string;
  private readonly common: {
    ext_version: string;
    vscode_version: string;
    os: string;
  };

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly getBaseUrl: () => string,
    private readonly isUserEnabled: () => boolean
  ) {
    let id = this.context.globalState.get<string>(INSTALL_ID_KEY);
    if (!id) {
      id = randomUUID();
      void this.context.globalState.update(INSTALL_ID_KEY, id);
    }
    this.installId = id;

    this.common = {
      ext_version: context.extension.packageJSON?.version ?? "unknown",
      vscode_version: vscode.version,
      os: process.platform,
    };
  }

  /** True only when both the user setting and VS Code's global telemetry allow it. */
  private enabled(): boolean {
    return this.isUserEnabled() && vscode.env.isTelemetryEnabled;
  }

  track(event: TelemetryEventName, props: TelemetryProps = {}): void {
    if (!this.enabled()) {
      return;
    }
    this.queue.push({ event, ...props });
    if (this.queue.length >= FLUSH_AT_COUNT) {
      void this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  /** Send queued events. Best-effort: drops the batch on any failure. */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    if (this.queue.length === 0) {
      return;
    }
    // If the user opted out after queuing, discard rather than send.
    if (!this.enabled()) {
      this.queue = [];
      return;
    }

    const batch = this.queue.splice(0, MAX_BATCH);
    const events = batch.map((e) => ({
      install_id: this.installId,
      ...this.common,
      ...e,
    }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
      await fetch(`${this.getBaseUrl()}/v2/extension-events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FlowCraft-Client": "vscode",
        },
        body: JSON.stringify({ events }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch {
      // Fire-and-forget: never surface telemetry errors to the user, and drop
      // the batch so the queue can't grow unbounded across a long session.
    }
  }

  /** Flush remaining events on extension shutdown. */
  dispose(): void {
    void this.flush();
  }
}
