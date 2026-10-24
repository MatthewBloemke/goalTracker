'use client';

import { useRef, useState } from 'react';
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
} from '@mui/material';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { AppTextField } from '@/components/ui/AppTextField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import {
  isRecord,
  parseRecipeFile,
  RECIPE_FILE_MAX_BYTES,
  RECIPE_TEXT_MAX_LENGTH,
  safeSourceUrl,
  validateRecipe,
  type RecipeDraft,
} from '../_lib/recipes';

export function RecipeImportDialog({
  onClose,
  onReview,
}: {
  onClose: () => void;
  onReview: (recipe: RecipeDraft, warnings: string[]) => void;
}) {
  const { supabase } = useSupabase();
  const fileInput = useRef<HTMLInputElement>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <DialogTitle>Import a recipe</DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        {error && <Alert severity="error">{error}</Alert>}
        {busy && (
          <Alert severity="info" role="status">
            Preparing your recipe draft… Nothing will be saved yet.
          </Alert>
        )}
        <p className="text-sm text-(--text-secondary)">
          Have a recipe shared by another family? Import their recipe file.
          You’ll review it and save your own independent copy.
        </p>
        <SecondaryButton
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          Choose recipe file
        </SecondaryButton>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Import recipe file"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setError('');
            setBusy(true);
            try {
              if (file.size > RECIPE_FILE_MAX_BYTES)
                throw new Error('Recipe files must be under 100 KB.');
              onReview(parseRecipeFile(await file.text()), [
                'Review the shared recipe and shopping quantities before saving your copy.',
              ]);
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : 'Unable to read recipe file.',
              );
            } finally {
              setBusy(false);
            }
          }}
        />
        <Divider>Or extract with AI</Divider>
        <Alert severity="info">
          AI import requires approval. It reads recipe webpages or pasted text,
          not the video itself. If a video link does not expose the recipe text,
          paste its caption or transcript below.
        </Alert>
        <AppTextField
          label="Recipe website / source link"
          value={sourceUrl}
          disabled={busy}
          onChange={(e) => setSourceUrl(e.target.value)}
          helperText="Try any public recipe website. Some sites block automated access or require a login; you can paste the recipe text instead."
        />
        <AppTextField
          label="Recipe text, caption or transcript"
          multiline
          minRows={6}
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          helperText={`${text.length.toLocaleString()} / ${RECIPE_TEXT_MAX_LENGTH.toLocaleString()} characters. Pasted text takes priority over fetching the link.`}
        />
        <p className="text-xs text-(--text-secondary)">
          The text is sent to OpenAI for extraction. Nothing is saved until you
          review and confirm. Import only content you’re permitted to use.
        </p>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <SecondaryButton disabled={busy} onClick={onClose}>
          Cancel
        </SecondaryButton>
        <PrimaryButton
          loading={busy}
          aria-label={busy ? 'Preparing recipe draft' : 'Extract recipe'}
          disabled={
            (!sourceUrl.trim() && !text.trim()) ||
            text.length > RECIPE_TEXT_MAX_LENGTH
          }
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setError('');
            try {
              const url = safeSourceUrl(sourceUrl);
              const { data, error } = await supabase.functions.invoke(
                'analyze-recipe',
                { body: { sourceUrl: url, text } },
              );
              if (error) {
                let message =
                  'AI import failed. Please try again or enter the recipe manually.';
                if (error.context instanceof Response) {
                  try {
                    const body = await error.context.json();
                    if (isRecord(body) && typeof body.error === 'string')
                      message = body.error;
                  } catch {
                    /* Keep safe fallback. */
                  }
                }
                throw new Error(message);
              }
              if (
                !isRecord(data) ||
                !Array.isArray(data.warnings) ||
                data.warnings.some((w) => typeof w !== 'string')
              )
                throw new Error('Invalid import result. Nothing was saved.');
              onReview(validateRecipe(data.recipe), [
                'AI draft: check ingredients, amounts, temperatures and steps. Shopping amounts are estimates.',
                ...(data.warnings as string[]),
              ]);
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : 'Unable to import recipe.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Extract recipe
        </PrimaryButton>
      </DialogActions>
    </Dialog>
  );
}
