import type {
  FamilyMovie,
  LibraryCircle,
  MovieLoan,
  MovieMediaFormat,
} from '@/types';

export type LibraryMovieRow = Omit<FamilyMovie, 'created_by'>;
export type LibraryLoanRow = Omit<MovieLoan, 'created_by' | 'returned_by'>;
export type LibraryCircleView = Omit<LibraryCircle, 'created_by_user_id'>;

export const MOVIE_MEDIA_FORMATS: MovieMediaFormat[] = ['dvd', 'blu_ray', '4k_uhd'];

export interface LibraryFamily {
  id: string;
  name: string;
}

export interface MovieOwner extends LibraryFamily {
  copies: MovieCopy[];
}

export interface MovieCopy {
  libraryMovieId: string;
  mediaFormat: MovieMediaFormat;
  loans: LibraryLoanRow[];
}

export interface SharedLibraryMovie {
  tmdbMovieId: number;
  title: string;
  originalTitle: string;
  releaseDate: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  genres: string[];
  owners: MovieOwner[];
}

export interface TmdbMovieSearchResult {
  id: number;
  title: string;
  originalTitle: string;
  releaseDate: string | null;
  posterPath: string | null;
  overview: string;
}

export function groupLibraryMovies(
  rows: LibraryMovieRow[],
  families: LibraryFamily[],
  loans: LibraryLoanRow[] = [],
): SharedLibraryMovie[] {
  const familyById = new Map(families.map((family) => [family.id, family]));
  const loansByCopy = new Map<string, LibraryLoanRow[]>();
  for (const loan of loans) {
    const history = loansByCopy.get(loan.family_movie_id) ?? [];
    history.push(loan);
    loansByCopy.set(loan.family_movie_id, history);
  }
  for (const history of loansByCopy.values()) {
    history.sort((a, b) => b.borrowed_at.localeCompare(a.borrowed_at));
  }
  const movies = new Map<number, SharedLibraryMovie>();

  for (const row of rows) {
    const family = familyById.get(row.family_id);
    if (!family) continue;
    const copy: MovieCopy = {
      libraryMovieId: row.id,
      mediaFormat: row.media_format,
      loans: loansByCopy.get(row.id) ?? [],
    };
    const existing = movies.get(row.tmdb_movie_id);
    if (existing) {
      const owner = existing.owners.find(({ id }) => id === family.id);
      if (owner) owner.copies.push(copy);
      else existing.owners.push({ ...family, copies: [copy] });
      continue;
    }
    movies.set(row.tmdb_movie_id, {
      tmdbMovieId: row.tmdb_movie_id,
      title: row.title,
      originalTitle: row.original_title,
      releaseDate: row.release_date,
      posterPath: row.poster_path,
      backdropPath: row.backdrop_path,
      overview: row.overview,
      genres: row.genres,
      owners: [{ ...family, copies: [copy] }],
    });
  }

  return [...movies.values()]
    .map((movie) => ({
      ...movie,
      owners: movie.owners
        .map((owner) => ({
          ...owner,
          copies: owner.copies.sort(
            (a, b) => MOVIE_MEDIA_FORMATS.indexOf(a.mediaFormat)
              - MOVIE_MEDIA_FORMATS.indexOf(b.mediaFormat),
          ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function filterLibraryMovies(
  movies: SharedLibraryMovie[],
  keyword: string,
  familyIds: ReadonlySet<string>,
) {
  const words = keyword.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return movies.filter((movie) => {
    if (familyIds.size > 0 && !movie.owners.some(({ id }) => familyIds.has(id))) {
      return false;
    }
    if (words.length === 0) return true;
    const searchable = [
      movie.title,
      movie.originalTitle,
      movie.overview,
      ...movie.genres,
      ...movie.owners.map(({ name }) => name),
      ...movie.owners.flatMap(({ copies }) => copies.map(({ mediaFormat }) => movieMediaFormatLabel(mediaFormat))),
    ].join(' ').toLocaleLowerCase();
    return words.every((word) => searchable.includes(word));
  });
}

export function moviePosterUrl(path: string | null, size: 'w342' | 'w500' = 'w500') {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export function movieReleaseYear(date: string | null) {
  return date?.match(/^\d{4}/)?.[0] ?? '';
}

export function movieMediaFormatLabel(format: MovieMediaFormat) {
  if (format === 'blu_ray') return 'Blu-ray';
  if (format === '4k_uhd') return '4K';
  return 'DVD';
}

export function activeMovieLoan(copy: MovieCopy) {
  return copy.loans.find(({ returned_at }) => returned_at === null) ?? null;
}

export function preferredMovieCopy(
  movie: SharedLibraryMovie,
  currentFamilyId: string,
) {
  return movie.owners
    .flatMap((owner) => owner.copies.map((copy) => ({ owner, copy })))
    .sort((a, b) => {
      const ownershipPriority = Number(a.owner.id !== currentFamilyId)
        - Number(b.owner.id !== currentFamilyId);
      if (ownershipPriority !== 0) return ownershipPriority;
      return Number(activeMovieLoan(a.copy) !== null)
        - Number(activeMovieLoan(b.copy) !== null);
    })[0] ?? null;
}

export function formatLoanTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function parseMovieSearchResults(value: unknown): TmdbMovieSearchResult[] {
  if (!isRecord(value) || !Array.isArray(value.movies)) {
    throw new Error('The movie search returned an invalid response.');
  }
  return value.movies.map((movie) => {
    if (!isRecord(movie)
      || !Number.isSafeInteger(movie.id)
      || Number(movie.id) <= 0
      || typeof movie.title !== 'string'
      || typeof movie.originalTitle !== 'string'
      || (movie.releaseDate !== null && typeof movie.releaseDate !== 'string')
      || (movie.posterPath !== null && typeof movie.posterPath !== 'string')
      || typeof movie.overview !== 'string') {
      throw new Error('The movie search returned an invalid response.');
    }
    return movie as unknown as TmdbMovieSearchResult;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
