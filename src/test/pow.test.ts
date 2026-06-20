import * as assert from "assert";
import { createHash } from "crypto";
import { leadingZeroBits, solvePow } from "../utils/pow";

suite("pow", () => {
  test("leadingZeroBits matches byte patterns", () => {
    assert.strictEqual(leadingZeroBits(Buffer.from([0x00, 0x80])), 8);
    assert.strictEqual(leadingZeroBits(Buffer.from([0x0f])), 4);
    assert.strictEqual(leadingZeroBits(Buffer.from([0xff])), 0);
  });

  test("solvePow finds a nonce whose digest meets difficulty", () => {
    const challenge = "abc.def";
    const nonce = solvePow(challenge, 10, 5_000_000);
    assert.ok(nonce !== null);
    const digest = createHash("sha256").update(`${challenge}:${nonce}`).digest();
    assert.ok(leadingZeroBits(digest) >= 10);
  });

  test("returns null when maxAttempts exhausted", () => {
    assert.strictEqual(solvePow("x.y", 64, 1000), null);
  });
});
