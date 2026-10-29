import type { FamilyMovie } from '@/types';
import {
  activeMovieLoan,
  filterLibraryMovies,
  formatLoanTimestamp,
  groupLibraryMovies,
  movieMediaFormatLabel,
  moviePosterUrl,
  movieReleaseYear,
  parseMovieSearchResults,
  preferredMovieCopy,
  type LibraryLoanRow,
} from './family-library';

const row = (overrides: Partial<FamilyMovie>): FamilyMovie => ({
  id: 'row-1', family_id: 'family-1', tmdb_movie_id: 329,
  title: 'Jurassic Park', original_title: 'Jurassic Park', release_date: '1993-06-11',
  poster_path: '/poster.jpg', backdrop_path: null, overview: 'Dinosaurs escape.',
  genres: ['Adventure', 'Science Fiction'], created_by: 'user-1',
  media_format: 'dvd',
  created_at: '2026-10-29T00:00:00Z', updated_at: '2026-10-29T00:00:00Z',
  ...overrides,
});

const loan = (overrides: Partial<LibraryLoanRow> = {}): LibraryLoanRow => ({
  id: 'loan-1',
  family_movie_id: 'row-1',
  borrower_family_id: 'family-2',
  borrower_family_name: 'Smith',
  borrowed_at: '2026-10-20T15:00:00Z',
  returned_at: null,
  created_at: '2026-10-20T15:00:00Z',
  updated_at: '2026-10-20T15:00:00Z',
  ...overrides,
});

describe('family library helpers', () => {
  it('groups the same movie by family while retaining each physical format', () => {
    const grouped = groupLibraryMovies([
      row({}),
      row({ id: 'row-2', family_id: 'family-2' }),
      row({ id: 'row-3', family_id: 'family-2', media_format: '4k_uhd' }),
    ], [
      { id: 'family-1', name: 'Bloemke' },
      { id: 'family-2', name: 'Smith' },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].owners.map(({ name }) => name)).toEqual(['Bloemke', 'Smith']);
    expect(grouped[0].owners[1].copies.map(({ mediaFormat }) => mediaFormat)).toEqual(['dvd', '4k_uhd']);
  });

  it('attaches dated loan history to the correct physical copy', () => {
    const grouped = groupLibraryMovies([
      row({}),
      row({ id: 'row-2', media_format: 'blu_ray' }),
    ], [
      { id: 'family-1', name: 'Bloemke' },
      { id: 'family-2', name: 'Smith' },
    ], [
      loan({ id: 'older', returned_at: '2026-10-22T15:00:00Z' }),
      loan({ id: 'active', borrowed_at: '2026-10-25T15:00:00Z' }),
      loan({ id: 'other-copy', family_movie_id: 'row-2' }),
    ]);

    const [dvdCopy, bluRayCopy] = grouped[0].owners[0].copies;
    expect(dvdCopy.loans.map(({ id }) => id)).toEqual(['active', 'older']);
    expect(activeMovieLoan(dvdCopy)?.id).toBe('active');
    expect(activeMovieLoan(bluRayCopy)?.id).toBe('other-copy');
  });

  it('prefers our copy for a card click, then an available connected copy', () => {
    const families = [
      { id: 'family-1', name: 'Bloemke' },
      { id: 'family-2', name: 'Smith' },
    ];
    const connectedOnly = groupLibraryMovies([
      row({ id: 'borrowed', family_id: 'family-2' }),
      row({ id: 'available', family_id: 'family-2', media_format: 'blu_ray' }),
    ], families, [loan({ family_movie_id: 'borrowed' })])[0];
    expect(preferredMovieCopy(connectedOnly, 'family-1')?.copy.libraryMovieId).toBe('available');

    const withOurBorrowedCopy = groupLibraryMovies([
      row({ id: 'ours' }),
      row({ id: 'theirs', family_id: 'family-2', media_format: 'blu_ray' }),
    ], families, [loan({ family_movie_id: 'ours' })])[0];
    expect(preferredMovieCopy(withOurBorrowedCopy, 'family-1')?.copy.libraryMovieId).toBe('ours');
    expect(preferredMovieCopy({ ...withOurBorrowedCopy, owners: [] }, 'family-1')).toBeNull();
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

  it('formats physical formats and loan dates for display', () => {
    expect(movieMediaFormatLabel('dvd')).toBe('DVD');
    expect(movieMediaFormatLabel('blu_ray')).toBe('Blu-ray');
    expect(movieMediaFormatLabel('4k_uhd')).toBe('4K');
    expect(formatLoanTimestamp('2026-10-20T15:00:00Z')).toMatch(/Oct 20, 2026/);
    expect(formatLoanTimestamp('not-a-date')).toBe('Unknown date');
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
