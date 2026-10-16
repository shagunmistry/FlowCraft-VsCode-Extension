/**
 * First-run decision: whether to nudge a brand-new, keyless install toward the
 * free (no-key) diagram instead of the BYOK key prompt. Pure so it is testable.
 */
export interface FirstRunState {
  noticeSeen: boolean;
  hasApiKey: boolean;
  /** Free generations left, or null when the user has never used one. */
  freeRemaining: number | null;
}

export function shouldShowFirstRunNotice(s: FirstRunState): boolean {
  if (s.noticeSeen || s.hasApiKey) { return false; }
  return s.freeRemaining === null || s.freeRemaining > 0;
}

export const FIRST_RUN_NOTICE_KEY = "flowcraft.firstRunNotice.seen";

/** After a free diagram, nudge toward sign-in/key only when the quota is nearly gone. */
export function shouldPromptAfterFreeTaste(remaining: number, signedIn: boolean): boolean {
  return !signedIn && remaining <= 1;
}
