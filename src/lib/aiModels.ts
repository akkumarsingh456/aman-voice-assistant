// Free models available via Lovable AI Gateway — no user API key needed.
// Claude / DeepSeek aren't on the gateway today, so we don't expose them.
export type ModelId =
  | "google/gemini-3-flash-preview"
  | "google/gemini-3.1-pro-preview"
  | "google/gemini-2.5-pro"
  | "google/gemini-2.5-flash"
  | "google/gemini-2.5-flash-lite"
  | "openai/gpt-5"
  | "openai/gpt-5-mini"
  | "openai/gpt-5-nano"
  | "openai/gpt-5.2";

export interface ModelOption {
  id: ModelId;
  label: string;
  hint: string;
  badge?: string;
}

export const MODELS: ModelOption[] = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", hint: "Fast • Default", badge: "Free" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", hint: "Strongest reasoning" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", hint: "Multimodal • Long context" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Balanced" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Lite", hint: "Cheapest • Quick" },
  { id: "openai/gpt-5", label: "GPT-5", hint: "All-rounder" },
  { id: "openai/gpt-5-mini", label: "GPT-5 mini", hint: "Lower cost" },
  { id: "openai/gpt-5-nano", label: "GPT-5 nano", hint: "Fastest GPT" },
  { id: "openai/gpt-5.2", label: "GPT-5.2", hint: "Latest reasoning" },
];

export const DEFAULT_MODEL: ModelId = "google/gemini-3-flash-preview";

const KEY = "aman:selected-model";

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
