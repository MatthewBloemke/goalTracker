/** @jest-environment node */
import {
  createOpenAiTransportFailure,
  readOpenAiHttpFailure,
} from './openai-errors';

const referenceId = 'd39c6b71-d181-4b36-9d08-2411a20fef45';
const upstreamId = 'req_0123456789abcdef0123456789abcdef';
function failureResponse(
  status: number,
  code: unknown = null,
  type: unknown = 'invalid_request_error',
  param: unknown = null,
) {
  return new Response(
    JSON.stringify({
      error: { code, type, param, message: 'NEVER_LOG_THIS_RAW_MESSAGE' },
    }),
    {
      status,
      headers: {
        'x-request-id': upstreamId,
        'content-type': 'application/json',
      },
    },
  );
}

describe('OpenAI recipe error diagnostics', () => {
  test('captures safe schema-error metadata and a matching UI reference', async () => {
    const failure = await readOpenAiHttpFailure(
      failureResponse(
        400,
        'invalid_json_schema',
        'invalid_request_error',
        'text.format.schema',
      ),
      referenceId,
    );
    expect(failure.status).toBe(502);
    expect(failure.diagnostics).toEqual({
      referenceId,
      failureKind: 'http_error',
      upstreamStatus: 400,
      openaiRequestId: upstreamId,
      errorCode: 'invalid_json_schema',
      errorType: 'invalid_request_error',
      errorParam: 'text.format.schema',
      errorBodyState: 'parsed',
    });
    expect(failure.body.error).toContain(
      'OpenAI rejected the recipe-analysis request',
    );
    expect(failure.body.error).toContain(referenceId);
    expect(failure.body.error).toContain('Nothing was saved.');
    expect(JSON.stringify(failure)).not.toContain('NEVER_LOG_THIS_RAW_MESSAGE');
  });

  test.each([
    [401, 'invalid_api_key', 502, 'authentication failed'],
    [403, 'permission_denied', 502, 'OpenAI denied access'],
    [404, null, 502, 'recipe model is unavailable'],
    [400, 'model_not_found', 502, 'recipe model is unavailable'],
    [400, 'invalid_model', 502, 'recipe model is unavailable'],
    [429, 'rate_limit_exceeded', 429, 'limiting recipe import requests'],
    [429, null, 429, 'limiting recipe import requests'],
    [422, 'unsupported_parameter', 502, 'rejected the recipe-analysis request'],
    [500, 'server_error', 503, 'temporarily unavailable'],
    [503, 'server_is_overloaded', 503, 'temporarily unavailable'],
    [418, null, 502, 'could not process the recipe request'],
  ])(
    'classifies upstream %s / %s without exposing raw messages',
    async (status, code, publicStatus, text) => {
      const failure = await readOpenAiHttpFailure(
        failureResponse(status as number, code),
        referenceId,
      );
      expect(failure.status).toBe(publicStatus);
      expect(failure.body.error).toContain(text as string);
      expect(failure.diagnostics.upstreamStatus).toBe(status);
      expect(failure.diagnostics.errorCode).toBe(code);
      expect(JSON.stringify(failure)).not.toContain(
        'NEVER_LOG_THIS_RAW_MESSAGE',
      );
    },
  );

  test.each([
    'insufficient_quota',
    'credit_balance_exhausted',
    'organization_spend_limit_exceeded',
    'project_spend_limit_exceeded',
    'organization_usage_limit_exceeded',
  ])(
    'distinguishes billing/limits from transient rate limiting: %s',
    async (code) => {
      const failure = await readOpenAiHttpFailure(
        failureResponse(429, code, 'insufficient_quota'),
        referenceId,
      );
      expect(failure.status).toBe(503);
      expect(failure.body.error).toContain(
        'billing and limits before retrying',
      );
      expect(failure.diagnostics.errorCode).toBe(code);
    },
  );

  test('recognizes insufficient_quota type even without a code', async () => {
    const failure = await readOpenAiHttpFailure(
      failureResponse(429, null, 'insufficient_quota'),
      referenceId,
    );
    expect(failure.body.error).toContain('credits or usage/spending limits');
  });

  test.each([
    '<html>gateway failure with sensitive content</html>',
    JSON.stringify({ error: 'Unexpected string' }),
    JSON.stringify({ error: null }),
    JSON.stringify({}),
    'x'.repeat(16_385),
  ])(
    'keeps status and request ID when the error body is unusable %#',
    async (body) => {
      const failure = await readOpenAiHttpFailure(
        new Response(body, {
          status: 502,
          headers: { 'x-request-id': upstreamId },
        }),
        referenceId,
      );
      expect(failure.diagnostics).toMatchObject({
        upstreamStatus: 502,
        openaiRequestId: upstreamId,
        errorBodyState: 'unreadable',
        errorCode: null,
        errorType: null,
        errorParam: null,
      });
      expect(JSON.stringify(failure)).not.toContain('sensitive content');
    },
  );

  test('handles null bodies and failed streams without a secondary exception', async () => {
    for (const response of [
      new Response(null, { status: 500 }),
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error('sensitive read error'));
          },
        }),
        { status: 500 },
      ),
    ]) {
      const failure = await readOpenAiHttpFailure(response, referenceId);
      expect(failure.diagnostics.errorBodyState).toBe('unreadable');
      expect(failure.diagnostics.openaiRequestId).toBeNull();
      expect(JSON.stringify(failure)).not.toContain('sensitive read error');
    }
  });

  test('does not echo secrets or recipe content even if embedded in error metadata', async () => {
    const secret = 'sk-proj-EXAMPLE_NOT_A_REAL_KEY';
    const recipe = 'Grandma’s secret chicken with paprika';
    const response = new Response(
      JSON.stringify({
        error: {
          code: secret,
          type: recipe,
          param: { input: recipe },
          message: `Incorrect API key provided: ${secret}. Input: ${recipe}`,
        },
        input: recipe,
      }),
      {
        status: 401,
        headers: { 'x-request-id': secret, authorization: `Bearer ${secret}` },
      },
    );
    const failure = await readOpenAiHttpFailure(response, referenceId);
    expect(failure.diagnostics).toMatchObject({
      errorCode: 'unrecognized',
      errorType: 'unrecognized',
      errorParam: 'unrecognized',
      openaiRequestId: null,
    });
    expect(JSON.stringify(failure)).not.toContain(secret);
    expect(JSON.stringify(failure)).not.toContain(recipe);
    expect(JSON.stringify(failure)).not.toContain('Bearer');
  });

  test('drops unknown enum values, header formats and control characters', async () => {
    const response = failureResponse(
      400,
      'future_error_code',
      'arbitrary\ntext',
      'input[0].content',
    );
    response.headers.set('x-request-id', 'x'.repeat(500));
    const failure = await readOpenAiHttpFailure(response, referenceId);
    expect(failure.diagnostics).toMatchObject({
      errorCode: 'unrecognized',
      errorType: 'unrecognized',
      errorParam: 'unrecognized',
      openaiRequestId: null,
    });
  });

  test.each(['TimeoutError', 'AbortError', 'TypeError'])(
    'logs only the transport failure kind: %s',
    (name) => {
      const error = new Error('NEVER_LOG_THIS_RAW_MESSAGE');
      error.name = name;
      const failure = createOpenAiTransportFailure(error, referenceId);
      expect(failure.status).toBe(503);
      expect(failure.diagnostics.failureKind).toBe(
        name === 'TypeError' ? 'network_error' : 'timeout',
      );
      expect(failure.diagnostics.upstreamStatus).toBeNull();
      expect(failure.diagnostics.errorBodyState).toBe('not_received');
      expect(failure.body.error).toContain(referenceId);
      expect(JSON.stringify(failure)).not.toContain(
        'NEVER_LOG_THIS_RAW_MESSAGE',
      );
    },
  );

  test('handles non-Error transport failures without inspecting their contents', () => {
    const failure = createOpenAiTransportFailure(
      { secret: 'do-not-log' },
      referenceId,
    );
    expect(failure.diagnostics.failureKind).toBe('network_error');
    expect(JSON.stringify(failure)).not.toContain('do-not-log');
  });
});
