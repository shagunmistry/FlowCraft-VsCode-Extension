export interface FreeTasteDeps {
  apiBaseUrl: string;
  deviceId: string;
  fetchFn: typeof fetch;
  solve: (challenge: string, bits: number) => string | null;
  track: (event: string, props?: Record<string, unknown>) => void;
}

export class FreeTasteQuotaError extends Error {
  constructor(public remaining: number) {
    super("quota");
  }
}

export class FreeTasteService {
  constructor(private readonly deps: FreeTasteDeps) {}

  async generate(
    prompt: string,
    type: string
  ): Promise<{ mermaidCode: string; remaining: number }> {
    const d = this.deps;
    d.track("free_taste_requested", { diagram_type: type });

    const chRes = await d.fetchFn(`${d.apiBaseUrl}/v2/free/challenge`);
    if (!chRes.ok) {
      d.track("free_taste_failed", { error_kind: "challenge" });
      throw new Error("challenge_failed");
    }
    const ch = (await chRes.json()) as { challenge: string; difficulty: number };

    const nonce = d.solve(ch.challenge, ch.difficulty);
    if (nonce === null) {
      d.track("free_taste_failed", { error_kind: "pow" });
      throw new Error("pow_failed");
    }

    const genRes = await d.fetchFn(`${d.apiBaseUrl}/v2/free/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: d.deviceId,
        challenge_token: ch.challenge,
        pow_nonce: nonce,
        title: prompt.slice(0, 80),
        description: prompt.slice(0, 10000),
        type,
      }),
    });

    if (genRes.status === 429) {
      const body = (await genRes.json().catch(() => ({}))) as {
        detail?: { remaining?: number };
      };
      const remaining = body.detail?.remaining ?? 0;
      d.track("free_limit_exhausted", { diagram_type: type });
      throw new FreeTasteQuotaError(remaining);
    }

    if (!genRes.ok) {
      d.track("free_taste_failed", { error_kind: "server" });
      throw new Error("generate_failed");
    }

    const json = (await genRes.json()) as {
      mermaid_code: string;
      remaining: number;
    };
    d.track("free_taste_succeeded", { diagram_type: type });
    return { mermaidCode: json.mermaid_code, remaining: json.remaining };
  }
}
