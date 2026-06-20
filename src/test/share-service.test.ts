import * as assert from "assert";
import { ShareService, ShareDeps } from "../services/share-service";
import { Diagram, DiagramType, DiagramCategory } from "../types/diagram";

function baseDiagram(): Diagram {
  return {
    id: "1",
    title: "My Flow",
    description: "",
    type: DiagramType.Flowchart,
    category: DiagramCategory.Mermaid,
    content: "graph TD;A-->B",
    isPublic: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    tokensUsed: 0,
  };
}

function baseDeps(overrides: Partial<ShareDeps> = {}): ShareDeps {
  return {
    getAccessToken: async () => "tok",
    signIn: async () => true,
    rasterizePng: async () => "data:image/png;base64,AAAA",
    webBaseUrl: "https://flowcraft.app",
    fetchFn: (async () =>
      ({
        ok: true,
        json: async () => ({ result: { link: "https://flowcraft.app/shared/x", imageUrl: "https://cdn/x.png" } }),
      }) as any) as typeof fetch,
    copyToClipboard: async () => {},
    showInfo: async () => undefined,
    showError: () => {},
    track: () => {},
    openExternal: () => {},
    confirmFirstShare: async () => true,
    ...overrides,
  };
}

suite("ShareService", () => {
  test("prompts sign-in when no token, then proceeds", async () => {
    let signedIn = false;
    let token: string | undefined = undefined;
    const deps = baseDeps({
      getAccessToken: async () => token,
      signIn: async () => {
        signedIn = true;
        token = "tok";
        return true;
      },
    });
    await new ShareService(deps).share(baseDiagram());
    assert.strictEqual(signedIn, true);
  });

  test("copies the embed snippet on success", async () => {
    let copied = "";
    const deps = baseDeps({ copyToClipboard: async (t: string) => { copied = t; } });
    await new ShareService(deps).share(baseDiagram());
    assert.ok(copied.includes("https://flowcraft.app/shared/x"));
    assert.ok(copied.includes("⚡ [Made with FlowCraft](https://flowcraft.app)"));
  });

  test("aborts when sign-in cancelled", async () => {
    let fetched = false;
    const deps = baseDeps({
      getAccessToken: async () => undefined,
      signIn: async () => false,
      fetchFn: (async () => {
        fetched = true;
        return { ok: true, json: async () => ({}) } as any;
      }) as typeof fetch,
    });
    await new ShareService(deps).share(baseDiagram());
    assert.strictEqual(fetched, false);
  });

  test("reports error and emits share_failed on non-ok response", async () => {
    let failedEvent = "";
    const deps = baseDeps({
      fetchFn: (async () => ({ ok: false, status: 500, json: async () => ({}) }) as any) as typeof fetch,
      track: (e: string) => { if (e === "share_failed") { failedEvent = e; } },
    });
    await new ShareService(deps).share(baseDiagram());
    assert.strictEqual(failedEvent, "share_failed");
  });
});
