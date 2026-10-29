import { createClient } from 'npm:@supabase/supabase-js@2'

const TMDB_API_URL = 'https://api.themoviedb.org/3'
const MAX_RESULTS = 12
const MOVIE_MEDIA_FORMATS = new Set(['dvd', 'blu_ray', '4k_uhd'])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) {
      throw new PublicError('Authentication is required.', 401)
    }

    const supabase = createClient(
      requiredEnvironmentValue('SUPABASE_URL'),
      getSupabasePublicKey(),
      { global: { headers: { Authorization: authorization } } },
    )
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new PublicError('Authentication is required.', 401)

    const { data: membership, error: membershipError } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (membershipError) throw new PublicError('Unable to verify your family.', 503)
    if (!membership) throw new PublicError('Create a family before using the library.', 403)

    const body = await readBody(request)
    const action = body.action
    if (action === 'search') {
      const query = readQuery(body.query)
      const url = new URL(`${TMDB_API_URL}/search/movie`)
      url.searchParams.set('query', query)
      url.searchParams.set('include_adult', 'false')
      url.searchParams.set('language', 'en-US')
      url.searchParams.set('page', '1')
      const payload = await fetchTmdb(url)
      const results = isRecord(payload) && Array.isArray(payload.results)
        ? payload.results
        : []
      return json({
        movies: results
          .map(normalizeSearchMovie)
          .filter((movie): movie is TmdbMovieSummary => movie !== null)
          .slice(0, MAX_RESULTS),
      })
    }

    if (action === 'add') {
      const movieId = readMovieId(body.movieId)
      const mediaFormat = readMediaFormat(body.mediaFormat)
      const payload = await fetchTmdb(
        new URL(`${TMDB_API_URL}/movie/${movieId}?language=en-US`),
      )
      const movie = normalizeMovieDetails(payload)
      if (!movie || movie.adult) {
        throw new PublicError('That movie could not be added.', 422)
      }

      const { data, error } = await supabase
        .from('family_movies')
        .upsert({
          family_id: membership.family_id,
          created_by: user.id,
          tmdb_movie_id: movie.id,
          media_format: mediaFormat,
          title: movie.title,
          original_title: movie.originalTitle,
          release_date: movie.releaseDate,
          poster_path: movie.posterPath,
          backdrop_path: movie.backdropPath,
          overview: movie.overview,
          genres: movie.genres,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'family_id,tmdb_movie_id,media_format' })
        .select('id, family_id, tmdb_movie_id, media_format, title, original_title, release_date, poster_path, backdrop_path, overview, genres, created_at, updated_at')
        .single()
      if (error) {
        console.error('TMDB movie save failed', { userId: user.id, code: error.code })
        throw new PublicError('Unable to add this movie to your library.', 503)
      }
      return json({ movie: data })
    }

    throw new PublicError('Choose a valid movie-library action.', 400)
  } catch (error) {
    if (!(error instanceof PublicError)) console.error('TMDB movie function failed', error)
    return json(
      { error: error instanceof PublicError ? error.message : 'The movie service is temporarily unavailable.' },
      error instanceof PublicError ? error.status : 500,
    )
  }
})

interface TmdbMovieSummary {
  id: number
  title: string
  originalTitle: string
  releaseDate: string | null
  posterPath: string | null
  overview: string
}

function normalizeSearchMovie(value: unknown): TmdbMovieSummary | null {
  if (!isRecord(value)) return null
  const id = positiveInteger(value.id)
  const title = nonEmptyString(value.title)
  if (!id || !title || value.adult === true) return null
  return {
    id,
    title,
    originalTitle: stringValue(value.original_title),
    releaseDate: dateValue(value.release_date),
    posterPath: imagePath(value.poster_path),
    overview: stringValue(value.overview),
  }
}

function normalizeMovieDetails(value: unknown) {
  if (!isRecord(value)) return null
  const summary = normalizeSearchMovie(value)
  if (!summary) return null
  const genres = Array.isArray(value.genres)
    ? value.genres
      .map((genre) => isRecord(genre) ? nonEmptyString(genre.name) : null)
      .filter((name): name is string => Boolean(name))
    : []
  return {
    ...summary,
    adult: value.adult === true,
    backdropPath: imagePath(value.backdrop_path),
    genres,
  }
}

async function fetchTmdb(url: URL) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${requiredEnvironmentValue('TMDB_API_READ_TOKEN')}`,
      Accept: 'application/json',
    },
  })
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new PublicError('The movie service returned an invalid response.', 502)
  }
  if (!response.ok) {
    console.error('TMDB request failed', { status: response.status })
    throw new PublicError('The movie service is temporarily unavailable.', 502)
  }
  return payload
}

function readBody(request: Request): Promise<Record<string, unknown>> {
  return request.json().then((value) => {
    if (!isRecord(value)) throw new PublicError('Invalid request body.', 400)
    return value
  }).catch((error) => {
    if (error instanceof PublicError) throw error
    throw new PublicError('Invalid request body.', 400)
  })
}

function readQuery(value: unknown) {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 120) {
    throw new PublicError('Enter between 2 and 120 characters to search.', 400)
  }
  return value.trim()
}

function readMovieId(value: unknown) {
  const id = positiveInteger(value)
  if (!id) throw new PublicError('A valid TMDB movie ID is required.', 400)
  return id
}

function readMediaFormat(value: unknown) {
  if (typeof value !== 'string' || !MOVIE_MEDIA_FORMATS.has(value)) {
    throw new PublicError('Choose DVD, Blu-ray, or 4K.', 400)
  }
  return value
}

function imagePath(value: unknown) {
  return typeof value === 'string' && /^\/[A-Za-z0-9._/-]+$/.test(value)
    ? value
    : null
}

function dateValue(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null
}

function positiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null
}

function nonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getSupabasePublicKey() {
  const legacyKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (legacyKey) return legacyKey
  const keys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>
      if (parsed.default) return parsed.default
    } catch { /* Safe configuration error below. */ }
  }
  throw new Error('Missing Supabase publishable key')
}

function requiredEnvironmentValue(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

class PublicError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}
