import * as assert from "assert";
import { PROVIDER_KEY_PAGE, validateKeyFormat } from "../utils/provider-links";

suite("provider-links", () => {
  test("deep-links are the canonical key pages", () => {
    assert.strictEqual(PROVIDER_KEY_PAGE.openai, "https://platform.openai.com/api-keys");
    assert.strictEqual(PROVIDER_KEY_PAGE.anthropic, "https://console.anthropic.com/settings/keys");
    assert.strictEqual(PROVIDER_KEY_PAGE.google, "https://aistudio.google.com/app/apikey");
  });

  test("validateKeyFormat enforces per-provider prefixes/lengths", () => {
    assert.strictEqual(validateKeyFormat("openai", "sk-abc"), true);
    assert.strictEqual(validateKeyFormat("openai", "abc"), false);
    assert.strictEqual(validateKeyFormat("anthropic", "sk-ant-abc"), true);
    assert.strictEqual(validateKeyFormat("anthropic", "sk-abc"), false);
    assert.strictEqual(validateKeyFormat("google", "x".repeat(25)), true);
    assert.strictEqual(validateKeyFormat("google", "short"), false);
  });

  test("validateKeyFormat default branch: unknown provider uses length > 10 rule", () => {
    assert.strictEqual(validateKeyFormat("mistral", "x".repeat(11)), true);
    assert.strictEqual(validateKeyFormat("mistral", "x".repeat(10)), false);
    assert.strictEqual(validateKeyFormat("mistral", "short"), false);
  });
});