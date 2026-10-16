/**
 * Premium gating — the single entry point feature code uses to require a paid
 * entitlement before running a premium action (cloud sync, premium templates,
 * advanced exports).
 *
 * This NEVER touches diagram generation, which is free + BYOK for everyone.
 *
 * Usage:
 *   if (!(await requirePremium("cloudSync", gateDeps, { featureLabel: "Cloud sync" }))) {
 *     return; // not entitled — the modal has already been shown
 *   }
 */

import * as vscode from "vscode";
import { EntitlementService } from "./entitlement-service";
import { AuthService } from "./auth-service";
import { TelemetryService } from "./telemetry-service";
import { PremiumFeature } from "../types";
import { openFlowcraft } from "../utils/links";

export const FLOWCRAFT_PRICING_URL = "https://flowcraft.app/dashboard/pricing";
export const FLOWCRAFT_BILLING_URL = "https://flowcraft.app/dashboard/settings";

export interface PremiumGateDeps {
  entitlementService: EntitlementService;
  authService: AuthService;
  telemetry?: TelemetryService;
}

/**
 * Returns true if the user is entitled to `feature`. If not, shows an upgrade
 * (or sign-in) modal and returns false. Fires upgrade telemetry so the funnel
 * can measure prompt → click conversion.
 */
export async function requirePremium(
  feature: PremiumFeature,
  deps: PremiumGateDeps,
  opts: { featureLabel?: string } = {}
): Promise<boolean> {
  const label = opts.featureLabel ?? "This feature";

  if (await deps.entitlementService.has(feature)) {
    return true;
  }

  deps.telemetry?.track("upgrade_prompt_shown");

  const signedIn = deps.authService.isSignedIn();
  const UPGRADE = "Upgrade";
  const SIGN_IN = "Sign in";

  const actions = signedIn ? [UPGRADE] : [SIGN_IN, UPGRADE];
  const detail = signedIn
    ? `${label} is part of FlowCraft Premium. Upgrade your account to unlock cloud sync, premium templates, and advanced exports.`
    : `${label} is part of FlowCraft Premium. Sign in to your FlowCraft account (or upgrade) to unlock cloud sync, premium templates, and advanced exports.`;

  const choice = await vscode.window.showInformationMessage(
    `${label} requires FlowCraft Premium`,
    { modal: true, detail },
    ...actions
  );

  if (choice === UPGRADE) {
    deps.telemetry?.track("upgrade_clicked");
    await openFlowcraft(FLOWCRAFT_PRICING_URL, "pricing_gate");
  } else if (choice === SIGN_IN) {
    await vscode.commands.executeCommand("flowcraft.signIn");
  }

  return false;
}
