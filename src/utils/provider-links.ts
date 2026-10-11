export const PROVIDER_KEY_PAGE: Record<"openrouter", string> = {
  openrouter: "https://openrouter.ai/keys",
};

export function validateKeyFormat(provider: string, key: string): boolean {
  const k = key.trim();
  switch (provider) {
    case "openrouter":
      return k.startsWith("sk-or-");
    default:
      return k.length > 10;
  }
}
