// Model IDs from Google's catalog (fetchAvailableModels), keyed by lowercase display name.
// Rollout models can be listed under a different ID than the one the Antigravity app ships
// with, so requests are resolved through the display name the app shows (e.g. "Gemini 4 Argon (High)").
const modelIdsByDisplayName = new Map<string, string>();

export function rememberCatalogModel(displayName: string, modelId: string) {
  const key = displayName.trim().toLowerCase();
  if (!key || !modelId) return;
  if (modelIdsByDisplayName.get(key) !== modelId && /argon|gemini 4/i.test(displayName + " " + modelId)) {
    console.log(`[Catalog] ${displayName} -> ${modelId}`);
  }
  modelIdsByDisplayName.set(key, modelId);
}

export function getCatalogModelId(displayName: string): string | undefined {
  return modelIdsByDisplayName.get(displayName.trim().toLowerCase());
}
