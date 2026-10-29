import type { FamilyMovie } from '@/types';
import {
  filterLibraryMovies,
  groupLibraryMovies,
  moviePosterUrl,
  movieReleaseYear,
  parseMovieSearchResults,
} from './family-library';

const row = (overrides: Partial<FamilyMovie>): FamilyMovie => ({
  id: 'row-1', family_id: 'family-1', tmdb_movie_id: 329,
  title: 'Jurassic Park', original_title: 'Jurassic Park', release_date: '1993-06-11',
  poster_path: '/poster.jpg', backdrop_path: null, overview: 'Dinosaurs escape.',
  genres: ['Adventure', 'Science Fiction'], created_by: 'user-1',
  created_at: '2026-10-29T00:00:00Z', updated_at: '2026-10-29T00:00:00Z',
  ...overrides,
});

describe('family library helpers', () => {
  it('groups the same movie and lists each owning family once', () => {
    const grouped = groupLibraryMovies([
      row({}),
      row({ id: 'row-2', family_id: 'family-2' }),
      row({ id: 'row-3', family_id: 'family-2' }),
    ], [
      { id: 'family-1', name: 'Bloemke' },
      { id: 'family-2', name: 'Smith' },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].owners.map(({ name }) => name)).toEqual(['Bloemke', 'Smith']);
  });

  it('ignores rows from unavailable families and sorts movies by title', () => {
    const grouped = groupLibraryMovies([
      row({ tmdb_movie_id: 2, title: 'Zoolander' }),
      row({ id: '2', tmdb_movie_id: 1, title: 'Arrival' }),
      row({ id: '3', family_id: 'hidden' }),
    ], [{ id: 'family-1', name: 'Bloemke' }]);
    expect(grouped.map(({ title }) => title)).toEqual(['Arrival', 'Zoolander']);
  });

  it('filters by all keyword terms and owning family', () => {
    const movies = groupLibraryMovies([
      row({}),
      row({ id: '2', tmdb_movie_id: 10, title: 'Toy Story', genres: ['Animation'] }),
    ], [{ id: 'family-1', name: 'Bloemke' }]);
    expect(filterLibraryMovies(movies, 'science dinosaurs', new Set())).toHaveLength(1);
    expect(filterLibraryMovies(movies, 'toy', new Set(['family-2']))).toHaveLength(0);
    expect(filterLibraryMovies(movies, 'bloemke', new Set(['family-1']))).toHaveLength(2);
  });

  it('builds poster URLs and extracts release years', () => {
    expect(moviePosterUrl('/abc.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
    expect(moviePosterUrl(null)).toBeNull();
    expect(movieReleaseYear('1993-06-11')).toBe('1993');
    expect(movieReleaseYear(null)).toBe('');
  });

  it('validates TMDB search responses', () => {
    expect(parseMovieSearchResults({ movies: [{
      id: 329, title: 'Jurassic Park', originalTitle: 'Jurassic Park',
      releaseDate: '1993-06-11', posterPath: '/poster.jpg', overview: '',
    }] })[0].id).toBe(329);
    expect(() => parseMovieSearchResults({ movies: [{ id: 'bad' }] })).toThrow('invalid response');
    expect(() => parseMovieSearchResults(null)).toThrow('invalid response');
  });
});
