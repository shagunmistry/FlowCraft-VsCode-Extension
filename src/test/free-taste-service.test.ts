import * as assert from "assert";
import { FreeTasteService, FreeTasteDeps, FreeTasteQuotaError } from "../services/free-taste-service";

function deps(overrides: Partial<FreeTasteDeps> = {}): FreeTasteDeps {
  const responses: Record<string, any> = {
    "/v2/free/challenge": { ok: true, json: async () => ({ challenge: "c.h", difficulty: 4, expires: 9 }) },
    "/v2/free/generate": { ok: true, json: async () => ({ mermaid_code: "```mermaid\ngraph TD;A-->B\n```", remaining: 3 }) },
  };
  return {
    apiBaseUrl: "https://api",
    deviceId: "device-abcdef12",
    fetchFn: (async (url: string) => responses[new URL(url).pathname]) as any,
    solve: () => "42",
    track: () => {},
    ...overrides,
  };
}

suite("FreeTasteService", () => {
  test("solves challenge and returns mermaid + remaining", async () => {
    const out = await new FreeTasteService(deps()).generate("make a flow", "flowchart");
    assert.ok(out.mermaidCode.includes("mermaid"));
    assert.strictEqual(out.remaining, 3);
  });

  test("throws FreeTasteQuotaError on 429", async () => {
    const d = deps({
      fetchFn: (async (url: string) => {
        if (new URL(url).pathname === "/v2/free/challenge")
          return { ok: true, json: async () => ({ challenge: "c.h", difficulty: 4 }) } as any;
        return { ok: false, status: 429, json: async () => ({ detail: { remaining: 0 } }) } as any;
      }) as any,
    });
    await assert.rejects(() => new FreeTasteService(d).generate("x", "flowchart"), FreeTasteQuotaError);
  });

  test("throws when PoW cannot be solved", async () => {
    await assert.rejects(() => new FreeTasteService(deps({ solve: () => null })).generate("x", "flowchart"));
  });
});
