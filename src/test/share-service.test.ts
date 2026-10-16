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
    assert.ok(copied.includes("⚡ [Made with FlowCraft](https://flowcraft.app/?utm_source=vscode&utm_medium=extension&utm_campaign=embed_badge)"));
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

  test("emits share_failed with render error_kind and does not call fetchFn when rasterizePng throws", async () => {
    const calledUrls: string[] = [];
    let trackedEvents: Array<{ event: string; props?: Record<string, unknown> }> = [];
    const deps = baseDeps({
      rasterizePng: async () => { throw new Error("render error"); },
      fetchFn: (async (url: string) => {
        calledUrls.push(url);
        return { ok: true, json: async () => ({}) } as any;
      }) as typeof fetch,
      track: (event: string, props?: Record<string, unknown>) => { trackedEvents.push({ event, props }); },
    });
    await new ShareService(deps).share(baseDiagram());
    const failedEvent = trackedEvents.find(e => e.event === "share_failed");
    assert.ok(failedEvent !== undefined, "share_failed should be emitted");
    assert.strictEqual(failedEvent!.props?.error_kind, "render");
    assert.strictEqual(calledUrls.length, 0, "fetchFn must not be called when render fails");
  });

  test("POST body uses diagramData field (not data) and sends correct content", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const diagram = baseDiagram();
    const deps = baseDeps({
      fetchFn: (async (_url: string, init?: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return {
          ok: true,
          json: async () => ({ result: { link: "https://flowcraft.app/shared/x", imageUrl: undefined } }),
        } as any;
      }) as typeof fetch,
    });
    await new ShareService(deps).share(diagram);
    assert.ok(capturedBody !== undefined, "fetchFn should have been called");
    assert.strictEqual(capturedBody!.diagramData, diagram.content, "diagramData should equal diagram.content");
    assert.strictEqual(capturedBody!.data, undefined, "legacy 'data' field must not be present");
  });
});
