import * as assert from "assert";
import { shouldShowFirstRunNotice, shouldPromptAfterFreeTaste } from "../services/first-run";

suite("first-run notice", () => {
  test("shows for a new keyless install", () => {
    assert.ok(shouldShowFirstRunNotice({ noticeSeen: false, hasApiKey: false, freeRemaining: null }));
  });
  test("hidden once seen", () => {
    assert.ok(!shouldShowFirstRunNotice({ noticeSeen: true, hasApiKey: false, freeRemaining: null }));
  });
  test("hidden when a key exists", () => {
    assert.ok(!shouldShowFirstRunNotice({ noticeSeen: false, hasApiKey: true, freeRemaining: null }));
  });
  test("hidden when the free quota is used up", () => {
    assert.ok(!shouldShowFirstRunNotice({ noticeSeen: false, hasApiKey: false, freeRemaining: 0 }));
  });

  test("post-taste prompt only when nearly out and signed out", () => {
    assert.ok(shouldPromptAfterFreeTaste(1, false));
    assert.ok(shouldPromptAfterFreeTaste(0, false));
    assert.ok(!shouldPromptAfterFreeTaste(3, false));
    assert.ok(!shouldPromptAfterFreeTaste(0, true));
  });
});
