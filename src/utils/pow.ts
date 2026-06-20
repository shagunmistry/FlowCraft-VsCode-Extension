import { createHash } from "crypto";

export function leadingZeroBits(digest: Buffer): number {
  let bits = 0;
  for (const byte of digest) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    for (let i = 7; i >= 0; i--) {
      if (byte & (1 << i)) {
        return bits;
      }
      bits++;
    }
    break;
  }
  return bits;
}

export function solvePow(challenge: string, difficultyBits: number, maxAttempts = 5_000_000): string | null {
  for (let n = 0; n < maxAttempts; n++) {
    const nonce = String(n);
    const digest = createHash("sha256").update(`${challenge}:${nonce}`).digest();
    if (leadingZeroBits(digest) >= difficultyBits) {
      return nonce;
    }
  }
  return null;
}
