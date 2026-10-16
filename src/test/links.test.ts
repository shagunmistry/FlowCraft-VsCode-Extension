import * as assert from "assert";
import { withUtm } from "../utils/links";

suite("withUtm", () => {
  test("adds utm params to a bare flowcraft.app url", () => {
    assert.strictEqual(
      withUtm("https://flowcraft.app/dashboard/pricing", "pricing"),
      "https://flowcraft.app/dashboard/pricing?utm_source=vscode&utm_medium=extension&utm_campaign=pricing"
    );
  });

  test("preserves existing query and hash", () => {
    assert.strictEqual(
      withUtm("https://flowcraft.app/x?a=1&state=a%20b#frag", "c"),
      "https://flowcraft.app/x?a=1&state=a%20b&utm_source=vscode&utm_medium=extension&utm_campaign=c#frag"
    );
  });

  test("handles a bare origin with a hash", () => {
    assert.strictEqual(
      withUtm("https://flowcraft.app#top", "c"),
      "https://flowcraft.app?utm_source=vscode&utm_medium=extension&utm_campaign=c#top"
    );
  });

  test("tags subdomains", () => {
    assert.ok(withUtm("https://app.flowcraft.app/x", "c").includes("utm_campaign=c"));
  });

  test("does not tag other hosts, including lookalikes", () => {
    for (const u of [
      "https://openrouter.ai/keys",
      "https://notflowcraft.app/x",
      "https://flowcraft.app.evil.com/x",
    ]) {
      assert.strictEqual(withUtm(u, "c"), u);
    }
  });

  test("does not overwrite utm params already present", () => {
    assert.strictEqual(
      withUtm("https://flowcraft.app/x?utm_source=other", "c"),
      "https://flowcraft.app/x?utm_source=other&utm_medium=extension&utm_campaign=c"
    );
    const full = "https://flowcraft.app/x?utm_source=a&utm_medium=b&utm_campaign=c";
    assert.strictEqual(withUtm(full, "z"), full);
  });

  test("returns unparseable and non-http input unchanged", () => {
    assert.strictEqual(withUtm("not a url", "c"), "not a url");
    assert.strictEqual(withUtm("command:flowcraft.tryFree", "c"), "command:flowcraft.tryFree");
  });
});
