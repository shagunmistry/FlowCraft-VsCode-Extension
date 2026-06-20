import * as assert from "assert";
import { buildEmbedSnippet } from "../utils/embed-snippet";

suite("buildEmbedSnippet", () => {
  test("builds image embed linking to share page with badge", () => {
    const out = buildEmbedSnippet("My Flow", "https://flowcraft.app/shared/abc", "https://cdn/x.png");
    assert.strictEqual(
      out,
      "[![My Flow](https://cdn/x.png)](https://flowcraft.app/shared/abc)\n\n⚡ [Made with FlowCraft](https://flowcraft.app)"
    );
  });

  test("falls back to text link when imageUrl missing", () => {
    const out = buildEmbedSnippet("My Flow", "https://flowcraft.app/shared/abc");
    assert.strictEqual(
      out,
      "[My Flow](https://flowcraft.app/shared/abc)\n\n⚡ [Made with FlowCraft](https://flowcraft.app)"
    );
  });

  test("escapes markdown-significant characters in title alt text", () => {
    const out = buildEmbedSnippet("a]b[c", "https://flowcraft.app/shared/abc", "https://cdn/x.png");
    assert.ok(out.startsWith("[![a\\]b\\[c](https://cdn/x.png)]"));
  });

  test("uses fallback alt text when title is empty", () => {
    const out = buildEmbedSnippet("", "https://flowcraft.app/shared/abc", "https://cdn/x.png");
    assert.ok(out.startsWith("[![Diagram](https://cdn/x.png)]"));
  });
});
