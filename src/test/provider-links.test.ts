import * as assert from "assert";
import { PROVIDER_KEY_PAGE, validateKeyFormat } from "../utils/provider-links";

suite("provider-links", () => {
  test("deep-link is the OpenRouter key page", () => {
    assert.strictEqual(PROVIDER_KEY_PAGE.openrouter, "https://openrouter.ai/keys");
  });

  test("validateKeyFormat requires the sk-or- prefix for OpenRouter", () => {
    assert.strictEqual(validateKeyFormat("openrouter", "sk-or-v1-abc"), true);
    assert.strictEqual(validateKeyFormat("openrouter", "sk-ant-abc"), false);
    assert.strictEqual(validateKeyFormat("openrouter", "sk-abc"), false);
  });

  test("validateKeyFormat default branch: unknown provider uses length > 10 rule", () => {
    assert.strictEqual(validateKeyFormat("mistral", "x".repeat(11)), true);
    assert.strictEqual(validateKeyFormat("mistral", "x".repeat(10)), false);
    assert.strictEqual(validateKeyFormat("mistral", "short"), false);
  });
});
