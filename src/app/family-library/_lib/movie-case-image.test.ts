import {
  getMovieCaseFileError,
  getMovieCaseResizeDimensions,
  MAX_MOVIE_CASE_SOURCE_BYTES,
} from './movie-case-image';

describe('movie case image helpers', () => {
  it('accepts supported images within the source limit', () => {
    expect(getMovieCaseFileError({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(getMovieCaseFileError({ type: 'image/webp', size: MAX_MOVIE_CASE_SOURCE_BYTES })).toBeNull();
  });

  it('rejects invalid, empty, and oversized images', () => {
    expect(getMovieCaseFileError({ type: 'image/gif', size: 100 })).toMatch(/JPEG/);
    expect(getMovieCaseFileError({ type: 'image/png', size: 0 })).toMatch(/empty/);
    expect(getMovieCaseFileError({ type: 'image/png', size: MAX_MOVIE_CASE_SOURCE_BYTES + 1 })).toMatch(/10 MB/);
  });

  it('preserves aspect ratio without upscaling', () => {
    expect(getMovieCaseResizeDimensions(4000, 2000, 2400)).toEqual({ width: 2400, height: 1200 });
    expect(getMovieCaseResizeDimensions(800, 1200, 2400)).toEqual({ width: 800, height: 1200 });
  });
});
