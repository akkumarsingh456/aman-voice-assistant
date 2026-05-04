// Models served by the Lovable AI Gateway (no key required) plus
// Bring-Your-Own-Key (BYOK) entries that call DeepSeek / OpenAI directly
// using a key the user pastes into the in-app KeyVault (stored only in
// their browser's localStorage, sent over HTTPS to our /api/chat route,
// never persisted server-side).
export type ModelId =
  // Lovable Gateway (free)
  | "google/gemini-3-flash-preview"
  | "google/gemini-3.1-pro-preview"
  | "google/gemini-2.5-pro"
  | "google/gemini-2.5-flash"
  | "google/gemini-2.5-flash-lite"
  | "openai/gpt-5"
  | "openai/gpt-5-mini"
  | "openai/gpt-5-nano"
  | "openai/gpt-5.2"
  // BYOK
  | "deepseek/deepseek-chat"
  | "deepseek/deepseek-reasoner"
  | "openai-direct/gpt-4o"
  | "openai-direct/gpt-4o-mini";

export type Provider = "lovable" | "deepseek" | "openai";

export interface ModelOption {
  id: ModelId;
  label: string;
  hint: string;
  badge?: string;
  provider: Provider;
}

export const MODELS: ModelOption[] = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", hint: "Fast • Default", badge: "Free", provider: "lovable" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", hint: "Strongest reasoning", badge: "Free", provider: "lovable" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", hint: "Multimodal • Long ctx", badge: "Free", provider: "lovable" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Balanced", badge: "Free", provider: "lovable" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Lite", hint: "Cheapest", badge: "Free", provider: "lovable" },
  { id: "openai/gpt-5", label: "GPT-5", hint: "All-rounder", badge: "Free", provider: "lovable" },
  { id: "openai/gpt-5-mini", label: "GPT-5 mini", hint: "Lower cost", badge: "Free", provider: "lovable" },
  { id: "openai/gpt-5-nano", label: "GPT-5 nano", hint: "Fastest GPT", badge: "Free", provider: "lovable" },
  { id: "openai/gpt-5.2", label: "GPT-5.2", hint: "Latest reasoning", badge: "Free", provider: "lovable" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat", hint: "Your key", badge: "BYOK", provider: "deepseek" },
  { id: "deepseek/deepseek-reasoner", label: "DeepSeek R1", hint: "Reasoning • Your key", badge: "BYOK", provider: "deepseek" },
  { id: "openai-direct/gpt-4o", label: "GPT-4o (direct)", hint: "Your OpenAI key", badge: "BYOK", provider: "openai" },
  { id: "openai-direct/gpt-4o-mini", label: "GPT-4o mini (direct)", hint: "Your OpenAI key", badge: "BYOK", provider: "openai" },
];

export const DEFAULT_MODEL: ModelId = "google/gemini-3-flash-preview";

const KEY = "aman:selected-model";
const OPENAI_KEY = "aman:byok:openai";
const DEEPSEEK_KEY = "aman:byok:deepseek";

export function getStoredModel(): ModelId {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  const v = window.localStorage.getItem(KEY) as ModelId | null;
  return v && MODELS.some((m) => m.id === v) ? v : DEFAULT_MODEL;
}

export function setStoredModel(id: ModelId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, id);
}

export function getModelLabel(id: ModelId): string {
  return MODELS.find((m) => m.id === id)?.label ?? "Gemini 3 Flash";
}

export function getProvider(id: ModelId): Provider {
  return MODELS.find((m) => m.id === id)?.provider ?? "lovable";
}

// ─── BYOK key vault (browser-local only) ───
export function getOpenAIKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(OPENAI_KEY) ?? "";
}
export function setOpenAIKey(v: string) {
  if (typeof window === "undefined") return;
  if (v) window.localStorage.setItem(OPENAI_KEY, v);
  else window.localStorage.removeItem(OPENAI_KEY);
}
export function getDeepSeekKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(DEEPSEEK_KEY) ?? "";
}
export function setDeepSeekKey(v: string) {
  if (typeof window === "undefined") return;
  if (v) window.localStorage.setItem(DEEPSEEK_KEY, v);
  else window.localStorage.removeItem(DEEPSEEK_KEY);
}

export function getKeyForModel(id: ModelId): string {
  const p = getProvider(id);
  if (p === "openai") return getOpenAIKey();
  if (p === "deepseek") return getDeepSeekKey();
  return "";
}
