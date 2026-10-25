// Keep the existing receipt setting as the source of truth for both features.
// OPENAI_RECIPE_MODEL is intentionally ignored so a stale override cannot
// select a different (potentially disallowed) model for recipe imports.
export function resolveOpenAiModel(
  readEnvironment: (name: string) => string | undefined,
): string {
  return readEnvironment('OPENAI_RECEIPT_MODEL') || 'gpt-4o-mini';
}
