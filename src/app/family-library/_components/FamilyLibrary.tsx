'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import {
  AddRounded,
  CloseRounded,
  GroupsRounded,
  MovieOutlined,
  RefreshRounded,
  SearchRounded,
} from '@mui/icons-material';
import {
  Alert,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Snackbar,
  Tooltip,
} from '@mui/material';
import { AppTextField } from '@/components/ui/AppTextField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useFamilyLibrary } from '../_hooks/useFamilyLibrary';
import {
  filterLibraryMovies,
  groupLibraryMovies,
  activeMovieLoan,
  movieMediaFormatLabel,
  moviePosterUrl,
  movieReleaseYear,
  preferredMovieCopy,
} from '../_lib/family-library';
import { AddMovieDialog } from './AddMovieDialog';
import { LibraryCircleDialog } from './LibraryCircleDialog';
import { LoanStatusDialog } from './LoanStatusDialog';

export function FamilyLibrary({
  familyId,
  familyName,
  isAdmin,
}: {
  familyId: string;
  familyName: string;
  isAdmin: boolean;
}) {
  const library = useFamilyLibrary(familyId, familyName);
  const [keyword, setKeyword] = useState('');
  const [familyFilter, setFamilyFilter] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [managingCircle, setManagingCircle] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedCopy, setSelectedCopy] = useState<{
    movieId: number;
    ownerId: string;
    copyId: string;
  } | null>(null);

  const movies = useMemo(
    () => groupLibraryMovies(library.movies, library.families, library.loans),
    [library.families, library.loans, library.movies],
  );
  const visibleMovies = useMemo(
    () => filterLibraryMovies(movies, keyword, new Set(familyFilter)),
    [familyFilter, keyword, movies],
  );
  const ownedCopyKeys = useMemo(
    () =>
      new Set(
        library.movies
          .filter(({ family_id }) => family_id === familyId)
          .map(
            ({ tmdb_movie_id, media_format }) =>
              `${tmdb_movie_id}:${media_format}`,
          ),
      ),
    [familyId, library.movies],
  );
  const selected = selectedCopy
    ? (() => {
        const movie = movies.find(
          ({ tmdbMovieId }) => tmdbMovieId === selectedCopy.movieId,
        );
        const owner = movie?.owners.find(
          ({ id }) => id === selectedCopy.ownerId,
        );
        const copy = owner?.copies.find(
          ({ libraryMovieId }) => libraryMovieId === selectedCopy.copyId,
        );
        return movie && owner && copy ? { movie, owner, copy } : null;
      })()
    : null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl">Family Library</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            startIcon={<GroupsRounded />}
            onClick={() => setManagingCircle(true)}
          >
            {library.circle ? library.circle.name : 'Connect families'}
          </SecondaryButton>
          <PrimaryButton
            startIcon={<AddRounded />}
            onClick={() => setAdding(true)}
          >
            Add movie
          </PrimaryButton>
        </div>
      </header>

      {library.error && (
        <Alert severity="error">
          Unable to load the family library: {library.error}
        </Alert>
      )}
      {library.realtimeError && (
        <Alert severity="warning">{library.realtimeError}</Alert>
      )}
      {!library.circle && !library.loading && (
        <Alert
          severity="info"
          action={
            <SecondaryButton
              size="small"
              onClick={() => setManagingCircle(true)}
            >
              Connect
            </SecondaryButton>
          }
        >
          You’re viewing only {familyName}. Connect families to search
          everyone’s movies together.
        </Alert>
      )}

      <section
        className="flex flex-col gap-3 rounded-2xl border border-(--border) bg-(--surface) p-3 sm:flex-row sm:items-center"
        aria-label="Library filters"
      >
        <AppTextField
          label="Search movies"
          placeholder="Title, genre, or family"
          value={keyword}
          sx={{ flex: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: keyword ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="Clear movie search"
                    onClick={() => setKeyword('')}
                  >
                    <CloseRounded fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            },
          }}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
          <InputLabel id="library-family-filter-label">Families</InputLabel>
          <Select
            multiple
            labelId="library-family-filter-label"
            label="Families"
            value={familyFilter}
            renderValue={(selected) =>
              selected.length === 0
                ? 'All families'
                : `${selected.length} ${selected.length === 1 ? 'family' : 'families'}`
            }
            onChange={(event) =>
              setFamilyFilter(
                typeof event.target.value === 'string'
                  ? event.target.value.split(',')
                  : event.target.value,
              )
            }
          >
            {library.families.map((family) => (
              <MenuItem key={family.id} value={family.id}>
                <Checkbox checked={familyFilter.includes(family.id)} />
                <ListItemText primary={family.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title="Refresh library">
          <IconButton
            aria-label="Refresh library"
            onClick={() => void library.refresh()}
          >
            <RefreshRounded />
          </IconButton>
        </Tooltip>
      </section>

      {library.loading ? (
        <div className="p-12 text-center">
          <CircularProgress aria-label="Loading family library" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Movies</h2>
            <span className="numeric-value text-sm text-(--text-secondary)">
              {visibleMovies.length}
            </span>
          </div>
          {visibleMovies.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-(--border) p-10 text-center">
              <MovieOutlined
                sx={{ fontSize: 42 }}
                className="text-(--text-secondary)"
              />
              <p className="mt-2 font-medium">
                {movies.length
                  ? 'No movies match these filters.'
                  : 'Your library is ready for its first movie.'}
              </p>
              {!movies.length && (
                <PrimaryButton
                  sx={{ mt: 2 }}
                  startIcon={<AddRounded />}
                  onClick={() => setAdding(true)}
                >
                  Add movie
                </PrimaryButton>
              )}
            </div>
          ) : (
            <ul
              className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              aria-label="Shared movie collection"
            >
              {visibleMovies.map((movie) => {
                const poster = moviePosterUrl(movie.posterPath);
                const preferred = preferredMovieCopy(movie, familyId);
                const openCopy = (ownerId: string, copyId: string) =>
                  setSelectedCopy({
                    movieId: movie.tmdbMovieId,
                    ownerId,
                    copyId,
                  });
                return (
                  <li key={movie.tmdbMovieId} className="group min-w-0">
                    <article
                      className="relative h-full cursor-pointer"
                    >
                      <button
                        type="button"
                        aria-label={`Open ${movie.title} details`}
                        className="absolute inset-0 z-0 cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-(--accent-green)"
                        onClick={() => {
                          if (preferred) {
                            openCopy(preferred.owner.id, preferred.copy.libraryMovieId);
                          }
                        }}
                      />
                      <div className="pointer-events-none relative z-10 aspect-[2/3] cursor-pointer overflow-hidden rounded-2xl border border-(--border) bg-(--surface-2) shadow-sm transition group-hover:-translate-y-1 group-hover:shadow-lg">
                        {poster ? (
                          <Image
                            src={poster}
                            alt={`${movie.title} poster`}
                            fill
                            sizes="(max-width: 640px) 46vw, (max-width: 900px) 30vw, (max-width: 1200px) 23vw, 16vw"
                            className="cursor-pointer object-cover"
                          />
                        ) : (
                          <MovieOutlined
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-(--text-secondary)"
                            sx={{ fontSize: 54 }}
                          />
                        )}
                      </div>
                      <h3
                        className="pointer-events-none relative z-10 mt-2 truncate text-sm font-semibold"
                        title={movie.title}
                      >
                        {movie.title}
                      </h3>
                      <div className="pointer-events-none relative z-10 mt-1 flex items-center gap-1">
                        {movieReleaseYear(movie.releaseDate) && (
                          <span className="numeric-value mr-1 text-xs text-(--text-secondary)">
                            {movieReleaseYear(movie.releaseDate)}
                          </span>
                        )}
                      </div>
                      <div className="relative z-10 mt-2 flex flex-col items-start gap-1">
                        {movie.owners.flatMap((owner) =>
                          owner.copies.map((copy) => {
                            const loan = activeMovieLoan(copy);
                            const ownerLabel =
                              owner.id === familyId ? 'Ours' : owner.name;
                            return (
                              <Chip
                                key={copy.libraryMovieId}
                                clickable
                                size="small"
                                color={loan ? 'warning' : 'success'}
                                variant={owner.id === familyId ? 'filled' : 'outlined'}
                                label={`${ownerLabel} · ${movieMediaFormatLabel(copy.mediaFormat)} · ${loan ? `With ${loan.borrower_family_name}` : 'Available'}`}
                                sx={{
                                  maxWidth: '100%',
                                  height: 24,
                                  fontSize: 10,
                                  fontWeight: owner.id === familyId ? 700 : 500,
                                }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openCopy(owner.id, copy.libraryMovieId);
                                }}
                              />
                            );
                          }),
                        )}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <footer
        aria-label="Movie data credits"
        className="mt-4 border-t border-(--border) pt-4 text-xs text-(--text-secondary)"
      >
        Movie data and artwork provided by{' '}
        <a
          className="font-semibold underline"
          href="https://www.themoviedb.org"
          target="_blank"
          rel="noreferrer"
        >
          TMDB
        </a>
        . This product uses the TMDB API but is not endorsed or certified by
        TMDB.
      </footer>

      {adding && (
        <AddMovieDialog
          ownedCopyKeys={ownedCopyKeys}
          onClose={() => setAdding(false)}
          onAdded={async (title) => {
            await library.refresh();
            setAdding(false);
            setNotice(`${title} added to ${familyName}.`);
          }}
        />
      )}
      {selected && (
        <LoanStatusDialog
          movieTitle={selected.movie.title}
          owner={selected.owner}
          copy={selected.copy}
          families={library.families}
          currentFamilyId={familyId}
          onClose={() => setSelectedCopy(null)}
          onLend={async (borrowerFamilyId) => {
            await library.lendMovie(
              selected.copy.libraryMovieId,
              borrowerFamilyId,
            );
            setNotice(`${selected.movie.title} marked as borrowed.`);
          }}
          onReturn={async (loanId) => {
            await library.returnMovie(loanId);
            setNotice(`${selected.movie.title} marked as returned.`);
          }}
          onRemove={async () => {
            await library.removeMovie(selected.copy.libraryMovieId);
            setSelectedCopy(null);
            setNotice(
              `${selected.movie.title} ${movieMediaFormatLabel(selected.copy.mediaFormat)} removed.`,
            );
          }}
        />
      )}
      {managingCircle && (
        <LibraryCircleDialog
          circle={library.circle}
          families={library.families}
          familyName={familyName}
          isAdmin={isAdmin}
          onClose={() => setManagingCircle(false)}
          onCreate={async (name) => {
            await library.createCircle(name);
            setManagingCircle(false);
            setNotice('Library circle created.');
          }}
          onJoin={async (code) => {
            await library.joinCircle(code);
            setManagingCircle(false);
            setNotice('Your family joined the library circle.');
          }}
          onLeave={async () => {
            await library.leaveCircle();
            setManagingCircle(false);
            setFamilyFilter([]);
            setNotice('Your family left the library circle.');
          }}
        />
      )}
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={4000}
        onClose={() => setNotice('')}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setNotice('')}
        >
          {notice}
        </Alert>
      </Snackbar>
    </div>
  );
}
