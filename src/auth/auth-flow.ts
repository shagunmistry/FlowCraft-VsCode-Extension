/**
 * Sign-in / sign-out flow + URI handler for the OAuth callback.
 *
 * Flow:
 *   1. User runs flowcraft.signIn → picks Google or GitHub.
 *   2. We generate a state nonce, register it as pending, and open
 *      `${webBaseUrl}/vscode/auth/start?provider=...&state=...` in the browser.
 *   3. The web app runs Supabase OAuth, then redirects to
 *      vscode://FlowCraft.flowcraft/auth/callback?access_token=...&...&state=...
 *   4. registerAuthUriHandler parses the callback, validates state, and stores
 *      the tokens via AuthService.
 */

import * as vscode from "vscode";
import { randomUUID } from "crypto";
import { openFlowcraft } from "../utils/links";
import { AuthService, AuthSession } from "../services/auth-service";

const NONCE_TTL_MS = 5 * 60 * 1000;

interface PendingNonce {
  createdAt: number;
  resolve: (session: AuthSession) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

const pending = new Map<string, PendingNonce>();

export interface AuthFlowConfig {
  /** Web base URL, e.g. https://flowcraft.app */
  webBaseUrl: string;
  /** Extension publisher.id, used in the vscode:// callback. */
  extensionId: string;
}

export function registerAuthUriHandler(
  context: vscode.ExtensionContext,
  authService: AuthService
): void {
  const handler: vscode.UriHandler = {
    handleUri(uri: vscode.Uri): void {
      if (uri.path !== "/auth/callback") {
        return;
      }
      const params = new URLSearchParams(uri.query);
      const state = params.get("state") ?? "";
      const accessToken = params.get("access_token") ?? "";
      const refreshToken = params.get("refresh_token") ?? "";
      const expiresAtRaw = params.get("expires_at");
      const email = params.get("email") ?? "";
      const errorParam = params.get("error");

      const entry = pending.get(state);
      if (!entry) {
        vscode.window.showErrorMessage(
          "FlowCraft sign-in callback was rejected (unknown or expired state)."
        );
        return;
      }
      pending.delete(state);
      clearTimeout(entry.timer);

      if (errorParam) {
        entry.reject(new Error(errorParam));
        vscode.window.showErrorMessage(`FlowCraft sign-in failed: ${errorParam}`);
        return;
      }

      if (!accessToken || !refreshToken || !expiresAtRaw) {
        entry.reject(new Error("Missing tokens"));
        vscode.window.showErrorMessage(
          "FlowCraft sign-in failed: callback missing tokens."
        );
        return;
      }

      const session: AuthSession = {
        accessToken,
        refreshToken,
        expiresAt: Number(expiresAtRaw),
        email,
      };
      authService
        .storeSession(session)
        .then(() => {
          entry.resolve(session);
          vscode.window.showInformationMessage(
            email
              ? `Signed in to FlowCraft as ${email}`
              : "Signed in to FlowCraft"
          );
        })
        .catch((err) => {
          entry.reject(err);
          vscode.window.showErrorMessage(
            `FlowCraft sign-in failed while storing session: ${err.message ?? err}`
          );
        });
    },
  };

  context.subscriptions.push(vscode.window.registerUriHandler(handler));
}

export async function signIn(config: AuthFlowConfig): Promise<AuthSession | undefined> {
  type ProviderItem = vscode.QuickPickItem & { value: "google" | "github" };
  const providerPick = await vscode.window.showQuickPick<ProviderItem>(
    [
      { label: "$(github) GitHub", value: "github", description: "Continue with GitHub" },
      { label: "$(globe) Google", value: "google", description: "Continue with Google" },
    ],
    {
      title: "FlowCraft · sign in",
      placeHolder: "Choose a sign-in provider",
    }
  );
  if (!providerPick) return undefined;

  const state = randomUUID();
  const startUrl =
    `${config.webBaseUrl.replace(/\/$/, "")}/vscode/auth/start` +
    `?provider=${encodeURIComponent(providerPick.value)}` +
    `&state=${encodeURIComponent(state)}`;

  const session = new Promise<AuthSession>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(state);
      reject(new Error("Sign-in timed out"));
    }, NONCE_TTL_MS);
    pending.set(state, { createdAt: Date.now(), resolve, reject, timer });
  });

  await openFlowcraft(startUrl, "sign_in");

  try {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Waiting for FlowCraft sign-in…",
        cancellable: true,
      },
      (_progress, token) => {
        token.onCancellationRequested(() => {
          const entry = pending.get(state);
          if (entry) {
            pending.delete(state);
            clearTimeout(entry.timer);
            entry.reject(new Error("Sign-in cancelled"));
          }
        });
        return session;
      }
    );
  } catch (err: any) {
    if (err?.message && err.message !== "Sign-in cancelled") {
      vscode.window.showErrorMessage(`FlowCraft sign-in failed: ${err.message}`);
    }
    return undefined;
  }
}

export async function signOut(authService: AuthService): Promise<void> {
  const session = await authService.getSession();
  if (!session) {
    vscode.window.showInformationMessage("FlowCraft: you're not signed in.");
    return;
  }
  await authService.signOutRemote();
  await authService.clearSession();
  vscode.window.showInformationMessage("Signed out of FlowCraft.");
}
