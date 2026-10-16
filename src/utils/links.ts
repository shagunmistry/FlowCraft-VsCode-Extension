const UTM_SOURCE = "vscode";
const UTM_MEDIUM = "extension";

function isFlowcraftHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "flowcraft.app" || h.endsWith(".flowcraft.app");
}

/**
 * Append utm_source/utm_medium/utm_campaign to flowcraft.app URLs so web
 * analytics can attribute extension traffic. Other hosts, unparseable input and
 * params already present are left untouched. The existing query, hash and
 * encoding are preserved verbatim (the URL is edited as a string, not
 * re-serialized).
 */
export function withUtm(url: string, campaign: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || !isFlowcraftHost(parsed.hostname)) {
    return url;
  }

  const wanted: Array<[string, string]> = [
    ["utm_source", UTM_SOURCE],
    ["utm_medium", UTM_MEDIUM],
    ["utm_campaign", campaign],
  ];
  const extra = wanted
    .filter(([key]) => !parsed.searchParams.has(key))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
  if (extra.length === 0) {
    return url;
  }

  const hashAt = url.indexOf("#");
  const base = hashAt === -1 ? url : url.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : url.slice(hashAt);
  const sep = base.includes("?") ? (/[?&]$/.test(base) ? "" : "&") : "?";
  return `${base}${sep}${extra.join("&")}${hash}`;
}

/** Open a URL in the browser, tagging flowcraft.app links with the campaign. */
export async function openFlowcraft(url: string, campaign: string): Promise<boolean> {
  // Lazy import keeps withUtm usable from plain-node unit tests.
  const vscode = await import("vscode");
  return vscode.env.openExternal(vscode.Uri.parse(withUtm(url, campaign)));
}
