import type { FamilyMovie, LibraryCircle } from '@/types';

export type LibraryMovieRow = Omit<FamilyMovie, 'created_by'>;
export type LibraryCircleView = Omit<LibraryCircle, 'created_by_user_id'>;

export interface LibraryFamily {
  id: string;
  name: string;
}

export interface MovieOwner extends LibraryFamily {
  libraryMovieId: string;
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
): SharedLibraryMovie[] {
  const familyById = new Map(families.map((family) => [family.id, family]));
  const movies = new Map<number, SharedLibraryMovie>();

  for (const row of rows) {
    const family = familyById.get(row.family_id);
    if (!family) continue;
    const owner = { ...family, libraryMovieId: row.id };
    const existing = movies.get(row.tmdb_movie_id);
    if (existing) {
      if (!existing.owners.some(({ id }) => id === family.id)) {
        existing.owners.push(owner);
      }
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
      owners: [owner],
    });
  }

  return [...movies.values()]
    .map((movie) => ({
      ...movie,
      owners: movie.owners.sort((a, b) => a.name.localeCompare(b.name)),
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
