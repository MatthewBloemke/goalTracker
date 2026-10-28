'use client';

import { useState } from 'react';
import {
  AddRounded,
  AutoAwesomeRounded,
  EditRounded,
  IosShareRounded,
  ShoppingCartOutlined,
} from '@mui/icons-material';
import {
  Alert,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
} from '@mui/material';
import { useFamily } from '@/hooks/useFamily';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { AppTextField } from '@/components/ui/AppTextField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { RecipeEditor } from '../_components/RecipeEditor';
import { RecipeImportDialog } from '../_components/RecipeImportDialog';
import { ShoppingListDialog } from '../_components/ShoppingListDialog';
import { RecipeInstructions } from '../_components/RecipeInstructions';
import { useRecipes } from '../_hooks/useRecipes';
import {
  emptyRecipe,
  filterRecipes,
  recipeToDraft,
  serializeRecipe,
  type RecipeDraft,
  type SavedRecipe,
} from '../_lib/recipes';

export default function RecipesPage() {
  const { user, loading: authLoading } = useSupabase();
  const { family, loading, error } = useFamily();
  if (loading || authLoading)
    return (
      <div className="p-8 text-center">
        <CircularProgress aria-label="Loading recipe collection" />
      </div>
    );
  if (error)
    return (
      <Alert severity="error">
        Unable to determine your recipe collection: {error}
      </Alert>
    );
  if (!user)
    return <Alert severity="info">Sign in to view your recipes.</Alert>;
  if (!family) return null;
  return (
    <RecipeLibrary
      key={`${user.id}:${family.id}`}
      familyId={family.id}
      familyName={family.name}
    />
  );
}

type EditorState = {
  draft: RecipeDraft;
  existing?: SavedRecipe;
  warnings?: string[];
};

function RecipeLibrary({
  familyId,
  familyName,
}: {
  familyId: string;
  familyName: string;
}) {
  const { recipes, loading, error, save, remove } = useRecipes(familyId);
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [importing, setImporting] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [shopping, setShopping] = useState<SavedRecipe | null>(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const tags = [...new Set(recipes.flatMap((recipe) => recipe.tags))].sort();
  const filtered = filterRecipes(recipes, search, tag);
  const viewing = recipes.find((recipe) => recipe.id === viewingId);
  const draft = viewing ? recipeToDraft(viewing) : null;

  const shareRecipe = async (recipe: SavedRecipe) => {
    setActionError('');
    setNotice('');
    setBusy(true);
    try {
      const filename = `${
        recipe.title
          .replace(/[^a-z0-9]+/gi, '-')
          .toLowerCase()
          .slice(0, 70) || 'recipe'
      }.recipe.json`;
      const file = new File(
        [serializeRecipe(recipeToDraft(recipe))],
        filename,
        { type: 'application/json' },
      );
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: recipe.title });
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice(
          'Recipe file downloaded. Send it to another family; they can use Import recipe → Choose recipe file.',
        );
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError'))
        setActionError('Unable to share this recipe. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-(--text-secondary)">
            Meal Planning
          </p>
          <h1 className="mt-1 font-serif text-3xl text-(--text-primary)">
            Recipe collection
          </h1>
          <p className="mt-2 text-sm text-(--text-secondary)">
            {familyName}’s shared recipes · Cook, collect and share.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            startIcon={<AutoAwesomeRounded />}
            onClick={() => setImporting(true)}
          >
            Import recipe
          </SecondaryButton>
          <PrimaryButton
            startIcon={<AddRounded />}
            onClick={() => setEditor({ draft: emptyRecipe() })}
          >
            New recipe
          </PrimaryButton>
        </div>
      </header>
      {(error || actionError) && (
        <Alert
          severity="error"
          onClose={actionError ? () => setActionError('') : undefined}
        >
          {actionError || error}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" onClose={() => setNotice('')}>
          {notice}
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
        <AppTextField
          label="Search recipes or ingredients"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <AppTextField
          select
          label="Filter by tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        >
          <MenuItem value="">All tags</MenuItem>
          {[...new Set([...tags, ...(tag ? [tag] : [])])].map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </AppTextField>
      </div>
      {loading ? (
        <div className="p-10 text-center">
          <CircularProgress aria-label="Loading recipes" />
        </div>
      ) : filtered.length === 0 ? (
        <section className="glass rounded-3xl p-10 text-center">
          <h2 className="font-serif text-2xl">
            {recipes.length
              ? 'No recipes match'
              : 'Your family cookbook starts here'}
          </h2>
          <p className="mt-3 text-sm text-(--text-secondary)">
            {recipes.length
              ? 'Try a different search or tag.'
              : 'Add a favorite, import a recipe, or open one shared by another family.'}
          </p>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((recipe) => (
            <article
              key={recipe.id}
              className="glass flex flex-col gap-4 rounded-2xl p-5"
            >
              <h2 className="font-serif text-xl text-(--text-primary)">
                {recipe.title}
              </h2>
              <p className="text-sm text-(--text-secondary)">
                {recipe.recipe_ingredients.length} ingredients
                {recipe.servings ? ` · ${recipe.servings} servings` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {recipe.tags.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    size="small"
                    onClick={() => setTag(t)}
                  />
                ))}
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <SecondaryButton
                  onClick={() => {
                    setActionError('');
                    setViewingId(recipe.id);
                  }}
                >
                  View recipe
                </SecondaryButton>
                <SecondaryButton
                  startIcon={<ShoppingCartOutlined />}
                  onClick={() => setShopping(recipe)}
                >
                  Shop
                </SecondaryButton>
              </div>
            </article>
          ))}
        </section>
      )}

      {viewing && draft && (
        <Dialog
          open
          fullWidth
          maxWidth="md"
          onClose={() => {
            if (!busy) setViewingId(null);
          }}
        >
          <DialogTitle>{viewing.title}</DialogTitle>
          <DialogContent className="flex flex-col gap-5">
            {actionError && <Alert severity="error">{actionError}</Alert>}
            {notice && <Alert severity="info">{notice}</Alert>}
            <div className="flex flex-wrap gap-2">
              {viewing.servings && (
                <Chip label={`${viewing.servings} servings`} />
              )}
              {viewing.tags.map((t) => (
                <Chip key={t} label={t} variant="outlined" />
              ))}
            </div>
            <RecipeInstructions recipe={draft} />
            {draft.notes && (
              <p className="whitespace-pre-wrap rounded-xl bg-(--surface-2) p-4 text-sm">
                {draft.notes}
              </p>
            )}
            {draft.sourceUrl && (
              <a
                className="text-sm text-(--accent) underline"
                href={draft.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Original recipe source
              </a>
            )}
            <div className="flex flex-wrap gap-2">
              <PrimaryButton
                startIcon={<ShoppingCartOutlined />}
                disabled={busy}
                onClick={() => {
                  setViewingId(null);
                  setShopping(viewing);
                }}
              >
                Add to shopping list
              </PrimaryButton>
              <SecondaryButton
                startIcon={<IosShareRounded />}
                disabled={busy}
                onClick={() => void shareRecipe(viewing)}
              >
                Share recipe
              </SecondaryButton>
              <SecondaryButton
                startIcon={<EditRounded />}
                disabled={busy}
                onClick={() => {
                  setViewingId(null);
                  setEditor({ draft, existing: viewing });
                }}
              >
                Edit
              </SecondaryButton>
            </div>
            <p className="text-xs text-(--text-secondary)">
              Sharing includes the recipe’s notes and source link. The recipient
              imports a separate copy.
            </p>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
            <SecondaryButton
              sx={{ color: 'error.main' }}
              disabled={busy}
              onClick={async () => {
                if (
                  !window.confirm(
                    `Delete “${viewing.title}”? Existing shopping tasks and copies shared with others will remain.`,
                  )
                )
                  return;
                setBusy(true);
                setActionError('');
                try {
                  await remove(viewing.id);
                  setViewingId(null);
                } catch (error) {
                  setActionError(
                    error instanceof Error
                      ? error.message
                      : 'Unable to delete recipe.',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete recipe
            </SecondaryButton>
            <SecondaryButton disabled={busy} onClick={() => setViewingId(null)}>
              Close
            </SecondaryButton>
          </DialogActions>
        </Dialog>
      )}
      {importing && (
        <RecipeImportDialog
          onClose={() => setImporting(false)}
          onReview={(draft, warnings) => {
            setImporting(false);
            setEditor({ draft, warnings });
          }}
        />
      )}
      {editor && (
        <RecipeEditor
          initial={editor.draft}
          title={
            editor.existing
              ? 'Edit recipe'
              : editor.warnings
                ? 'Review imported recipe'
                : 'New recipe'
          }
          warnings={editor.warnings}
          onClose={() => setEditor(null)}
          onSave={async (draft) => {
            const id = await save(draft, editor.existing);
            setEditor(null);
            setViewingId(id);
            setNotice('Recipe saved.');
          }}
        />
      )}
      {shopping && (
        <ShoppingListDialog
          recipe={shopping}
          onClose={() => setShopping(null)}
        />
      )}
    </div>
  );
}
