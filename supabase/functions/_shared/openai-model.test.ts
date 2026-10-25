import { resolveOpenAiModel } from './openai-model';

test('uses the configured receipt model without consulting a recipe override', () => {
  const settings: Record<string, string> = {
    OPENAI_RECEIPT_MODEL: 'configured-receipt-model',
    OPENAI_RECIPE_MODEL: 'disallowed-recipe-model',
  };
  const readEnvironment = jest.fn((name: string) => settings[name]);
  expect(resolveOpenAiModel(readEnvironment)).toBe('configured-receipt-model');
  expect(readEnvironment.mock.calls).toEqual([['OPENAI_RECEIPT_MODEL']]);
});

test.each([undefined, ''])('retains the receipt default when its setting is %s', (value) => {
  expect(resolveOpenAiModel(() => value)).toBe('gpt-4o-mini');
});

test('ignores a legacy recipe override even when no receipt override exists', () => {
  const readEnvironment = (name: string) =>
    name === 'OPENAI_RECIPE_MODEL' ? 'disallowed-recipe-model' : undefined;
  expect(resolveOpenAiModel(readEnvironment)).toBe('gpt-4o-mini');
});

test('reads the current setting for each request instead of caching it', () => {
  const readEnvironment = jest.fn()
    .mockReturnValueOnce('first-receipt-model')
    .mockReturnValueOnce('updated-receipt-model');
  expect(resolveOpenAiModel(readEnvironment)).toBe('first-receipt-model');
  expect(resolveOpenAiModel(readEnvironment)).toBe('updated-receipt-model');
});
