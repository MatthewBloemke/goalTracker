import {
  buildMovieCaseRequest,
  MOVIE_CASE_MAX_OUTPUT_TOKENS,
  validateMovieCaseIdentification,
} from './movie-case';

describe('movie case OpenAI request', () => {
  it('uses high image detail, structured output, and a small output cap', () => {
    const request = buildMovieCaseRequest('gpt-4o-mini', {
      data: 'YWJj',
      mimeType: 'image/jpeg',
    });
    expect(request.max_output_tokens).toBe(MOVIE_CASE_MAX_OUTPUT_TOKENS);
    expect(request.store).toBe(false);
    expect(request.text.format.strict).toBe(true);
    expect(request.input[1].content[1]).toMatchObject({
      type: 'input_image',
      detail: 'high',
      image_url: 'data:image/jpeg;base64,YWJj',
    });
    expect(request).not.toHaveProperty('reasoning');
  });

  it('disables reasoning for supported GPT-5 models', () => {
    expect(buildMovieCaseRequest('gpt-5.1-mini', {
      data: 'YWJj',
      mimeType: 'image/png',
    })).toHaveProperty('reasoning.effort', 'none');
  });
});

describe('movie case validation', () => {
  it('accepts a clear identification', () => {
    expect(validateMovieCaseIdentification({
      title: 'Jurassic Park',
      releaseYear: 1993,
      confidence: 0.98,
      requiresReview: false,
      alternatives: [],
    })).toEqual({
      title: 'Jurassic Park',
      releaseYear: 1993,
      confidence: 0.98,
      requiresReview: false,
      alternatives: [],
    });
  });

  it('forces review for low confidence or no title', () => {
    expect(validateMovieCaseIdentification({
      title: 'Arrival', releaseYear: null, confidence: 0.4,
      requiresReview: false, alternatives: [],
    }).requiresReview).toBe(true);
    expect(validateMovieCaseIdentification({
      title: null, releaseYear: null, confidence: 0,
      requiresReview: false, alternatives: [{ title: 'Alien', releaseYear: 1979 }],
    }).requiresReview).toBe(true);
  });

  it('rejects invalid years, confidence, and alternatives', () => {
    expect(() => validateMovieCaseIdentification({
      title: 'Movie', releaseYear: 1200, confidence: 1,
      requiresReview: false, alternatives: [],
    })).toThrow('Invalid');
    expect(() => validateMovieCaseIdentification({
      title: 'Movie', releaseYear: null, confidence: 2,
      requiresReview: false, alternatives: [],
    })).toThrow('Invalid');
    expect(() => validateMovieCaseIdentification({
      title: 'Movie', releaseYear: null, confidence: 1,
      requiresReview: false, alternatives: [{}, {}, {}],
    })).toThrow('Invalid');
  });
});
