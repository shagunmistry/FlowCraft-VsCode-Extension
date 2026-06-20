import { Diagram } from "../types/diagram";
import { buildEmbedSnippet } from "../utils/embed-snippet";

export interface ShareDeps {
  getAccessToken: () => Promise<string | undefined>;
  signIn: () => Promise<boolean>;
  rasterizePng: (diagram: Diagram) => Promise<string>;
  webBaseUrl: string;
  fetchFn: typeof fetch;
  copyToClipboard: (text: string) => Promise<void>;
  showInfo: (msg: string, ...actions: string[]) => Promise<string | undefined>;
  showError: (msg: string) => void;
  track: (event: string, props?: Record<string, unknown>) => void;
  openExternal: (url: string) => void;
  confirmFirstShare: () => Promise<boolean>;
}

interface GenerateLinkResponse {
  result: {
    link: string;
    imageUrl?: string;
  };
}

export class ShareService {
  constructor(private readonly deps: ShareDeps) {}

  async share(diagram: Diagram): Promise<void> {
    const d = this.deps;
    d.track("share_requested", { diagram_type: diagram.type });

    // 1. auth
    let token = await d.getAccessToken();
    if (!token) {
      const ok = await d.signIn();
      if (!ok) { return; }
      token = await d.getAccessToken();
      if (!token) { return; }
    }

    // 2. explicit opt-in (first time)
    if (!(await d.confirmFirstShare())) { return; }

    // 3. rasterize
    let imagePng: string | undefined;
    try {
      imagePng = await d.rasterizePng(diagram);
    } catch {
      d.showError("Could not render the diagram image to share.");
      d.track("share_failed", { diagram_type: diagram.type, error_kind: "render" });
      return;
    }

    // 4. create link
    let shareUrl: string;
    let imageUrl: string | undefined;
    try {
      const requestBody: {
        title: string;
        type: string;
        diagramData: string;
        diagramId: string;
        imagePng?: string;
      } = {
        title: diagram.title,
        type: diagram.type,
        diagramData: diagram.content,
        diagramId: diagram.metadata?.remoteId ?? diagram.id,
        imagePng,
      };
      const res = await d.fetchFn(`${d.webBaseUrl}/api/generate-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) {
        d.showError(`Sharing failed (${res.status}).`);
        d.track("share_failed", { diagram_type: diagram.type, error_kind: "network" });
        return;
      }
      const json = (await res.json()) as GenerateLinkResponse;
      shareUrl = json.result.link;
      imageUrl = json.result.imageUrl;
    } catch {
      d.showError("Sharing failed. Check your connection and try again.");
      d.track("share_failed", { diagram_type: diagram.type, error_kind: "network" });
      return;
    }

    // 5. snippet + clipboard + toast
    const snippet = buildEmbedSnippet(diagram.title, shareUrl, imageUrl);
    await d.copyToClipboard(snippet);
    d.track("share_succeeded", { diagram_type: diagram.type });
    const choice = await d.showInfo(
      "Share link copied as a Markdown embed. The diagram is now publicly viewable.",
      "Open share page",
      "Copy again"
    );
    if (choice === "Open share page") { d.openExternal(shareUrl); }
    if (choice === "Copy again") { await d.copyToClipboard(snippet); }
  }
}
