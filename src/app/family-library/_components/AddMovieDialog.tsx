'use client';

import Image from 'next/image';
import { useState } from 'react';
import { AddRounded, MovieOutlined, SearchRounded } from '@mui/icons-material';
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import { AppTextField } from '@/components/ui/AppTextField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import {
  moviePosterUrl,
  movieReleaseYear,
  movieMediaFormatLabel,
  MOVIE_MEDIA_FORMATS,
  parseMovieSearchResults,
  type TmdbMovieSearchResult,
} from '../_lib/family-library';
import type { MovieMediaFormat } from '@/types';

export function AddMovieDialog({
  ownedCopyKeys,
  onClose,
  onAdded,
}: {
  ownedCopyKeys: ReadonlySet<string>;
  onClose: () => void;
  onAdded: (title: string) => Promise<void>;
}) {
  const { supabase } = useSupabase();
  const [query, setQuery] = useState('');
  const [mediaFormat, setMediaFormat] = useState<MovieMediaFormat>('dvd');
  const [results, setResults] = useState<TmdbMovieSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const search = async (searchQuery = query) => {
    if (searchQuery.trim().length < 2 || searching) return;
    setSearching(true);
    setError('');
    setSearched(false);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('tmdb-movies', {
        body: { action: 'search', query: searchQuery.trim() },
      });
      if (functionError) throw new Error(await readFunctionError(functionError, 'Movie search failed.'));
      setResults(parseMovieSearchResults(data));
      setSearched(true);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Movie search failed.');
    } finally {
      setSearching(false);
    }
  };

  const busy = searching || addingId !== null;
  return (
    <Dialog open fullWidth maxWidth="md" onClose={() => !busy && onClose()}>
      <DialogTitle>Add a movie</DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        {error && <Alert severity="error">{error}</Alert>}
        <div>
          <p className="mb-2 text-sm font-medium">Physical format</p>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={mediaFormat}
            aria-label="Movie format"
            disabled={busy}
            onChange={(_, value: MovieMediaFormat | null) => {
              if (value) setMediaFormat(value);
            }}
          >
            {MOVIE_MEDIA_FORMATS.map((format) => (
              <ToggleButton key={format} value={format}>
                {movieMediaFormatLabel(format)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <AppTextField
            autoFocus
            label="Movie title"
            placeholder="Jurassic Park"
            value={query}
            disabled={busy}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Search TMDB">
                      <span>
                        <IconButton
                          aria-label="Search movies"
                          disabled={query.trim().length < 2 || busy}
                          onClick={() => void search()}
                        >
                          <SearchRounded />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </InputAdornment>
                ),
              },
            }}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void search();
              }
            }}
          />
        </div>
        {searched && results.length === 0 && (
          <div className="rounded-2xl border border-(--border) p-6 text-center text-sm text-(--text-secondary)">
            No movies found. Try the title without the edition or format.
          </div>
        )}
        {results.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Movie search results">
            {results.map((movie) => {
              const owned = ownedCopyKeys.has(`${movie.id}:${mediaFormat}`);
              const poster = moviePosterUrl(movie.posterPath, 'w342');
              return (
                <li key={movie.id} className="flex min-w-0 gap-3 rounded-2xl border border-(--border) bg-(--surface) p-3">
                  <div className="relative h-[102px] w-[68px] shrink-0 overflow-hidden rounded-lg bg-(--surface-2)">
                    {poster ? (
                      <Image src={poster} alt="" fill sizes="68px" className="object-cover" />
                    ) : (
                      <MovieOutlined className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-(--text-secondary)" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <strong className="line-clamp-2 text-sm">{movie.title}</strong>
                    <span className="numeric-value text-xs text-(--text-secondary)">
                      {movieReleaseYear(movie.releaseDate) || 'Year unavailable'}
                    </span>
                    <p className="mt-1 line-clamp-2 text-xs text-(--text-secondary)">{movie.overview}</p>
                    <PrimaryButton
                      size="small"
                      sx={{ mt: 'auto', ml: 'auto', minWidth: 92, px: 1.5, py: 0.5 }}
                      startIcon={!owned ? <AddRounded /> : undefined}
                      disabled={owned || busy}
                      loading={addingId === movie.id}
                      onClick={async () => {
                        setAddingId(movie.id);
                        setError('');
                        try {
                          const { error: addError } = await supabase.functions.invoke('tmdb-movies', {
                            body: {
                              action: 'add',
                              movieId: movie.id,
                              mediaFormat,
                            },
                          });
                          if (addError) throw new Error(await readFunctionError(addError, 'Unable to add this movie.'));
                          await onAdded(movie.title);
                        } catch (addError) {
                          setError(addError instanceof Error ? addError.message : 'Unable to add this movie.');
                        } finally {
                          setAddingId(null);
                        }
                      }}
                    >
                      {owned ? `${movieMediaFormatLabel(mediaFormat)} owned` : `Add ${movieMediaFormatLabel(mediaFormat)}`}
                    </PrimaryButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <SecondaryButton disabled={busy} onClick={onClose}>Close</SecondaryButton>
      </DialogActions>
    </Dialog>
  );
}

async function readFunctionError(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json() as { error?: unknown };
        if (typeof body.error === 'string') return body.error;
      } catch { /* Keep the safe fallback. */ }
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
