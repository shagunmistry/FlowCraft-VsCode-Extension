export const PROVIDER_KEY_PAGE: Record<"openai" | "anthropic" | "google", string> = {
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  google: "https://aistudio.google.com/app/apikey",
};

export function validateKeyFormat(provider: string, key: string): boolean {
  const k = key.trim();
  switch (provider) {
    case "openai":
      return k.startsWith("sk-");
    case "anthropic":
      return k.startsWith("sk-ant-");
    case "google":
      return k.length > 20;
    default:
      return k.length > 10;
  }
}
