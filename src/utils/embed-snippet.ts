import { withUtm } from "./links";

const BADGE = `⚡ [Made with FlowCraft](${withUtm("https://flowcraft.app/", "embed_badge")})`;

function escapeAlt(title: string): string {
  const t = title.trim() || "Diagram";
  return t.replace(/[\[\]]/g, (c) => "\\" + c);
}

export function buildEmbedSnippet(title: string, shareUrl: string, imageUrl?: string): string {
  const alt = escapeAlt(title);
  const body = imageUrl
    ? `[![${alt}](${imageUrl})](${shareUrl})`
    : `[${alt}](${shareUrl})`;
  return `${body}\n\n${BADGE}`;
}
