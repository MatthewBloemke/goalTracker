import { isRecord } from '../_shared/recipe.ts';
import { readBoundedText } from './recipe-import.ts';

// Do not log arbitrary error.message, body, headers, or exception text. OpenAI
// can echo a credential or user input in an error. Only known metadata is kept.
const ERROR_CODES = new Set([
  'invalid_api_key',
  'invalid_request_error',
  'invalid_json_schema',
  'invalid_value',
  'unsupported_value',
  'unsupported_parameter',
  'missing_required_parameter',
  'model_not_found',
  'invalid_model',
  'permission_denied',
  'access_denied',
  'insufficient_permissions',
  'insufficient_quota',
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
  'rate_limit_exceeded',
  'rate_limit_error',
  'slow_down',
  'server_is_overloaded',
  'server_error',
  'internal_server_error',
  'context_length_exceeded',
]);
const ERROR_TYPES = new Set([
  'invalid_request_error',
  'authentication_error',
  'permission_error',
  'insufficient_quota',
  'rate_limit_error',
  'server_error',
  'service_unavailable_error',
  'api_error',
]);
const ERROR_PARAMS = new Set([
  'model',
  'input',
  'max_output_tokens',
  'reasoning',
  'reasoning.effort',
  'text',
  'text.format',
  'text.format.type',
  'text.format.name',
  'text.format.schema',
  'response_format',
  'store',
  'service_tier',
  'temperature',
  'top_p',
]);
const BILLING_CODES = new Set([
  'insufficient_quota',
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
]);

export interface OpenAiFailure {
  status: number;
  body: { error: string; referenceId: string };
  diagnostics: {
    referenceId: string;
    failureKind: 'http_error' | 'timeout' | 'network_error';
    upstreamStatus: number | null;
    openaiRequestId: string | null;
    errorCode: string | null;
    errorType: string | null;
    errorParam: string | null;
    errorBodyState: 'parsed' | 'unreadable' | 'not_received';
  };
}

function knownMetadata(value: unknown, allowed: Set<string>): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' && allowed.has(value)
    ? value
    : 'unrecognized';
}

function httpErrorMessage(
  status: number,
  code: string | null,
  type: string | null,
) {
  if (status === 401)
    return {
      status: 502,
      message:
        'OpenAI authentication failed. Ask an administrator to check OPENAI_API_KEY and the OpenAI project’s access restrictions.',
    };
  if (status === 404 || code === 'model_not_found' || code === 'invalid_model')
    return {
      status: 502,
      message:
        'The configured recipe model is unavailable or inaccessible. Ask an administrator to check OPENAI_RECIPE_MODEL and model access.',
    };
  if (status === 403)
    return {
      status: 502,
      message:
        'OpenAI denied access. Ask an administrator to check API key permissions, model access and project restrictions.',
    };
  if (
    status === 429 &&
    (BILLING_CODES.has(code ?? '') || type === 'insufficient_quota')
  )
    return {
      status: 503,
      message:
        'OpenAI credits or usage/spending limits are blocking recipe import. Check the OpenAI project’s billing and limits before retrying.',
    };
  if (status === 429)
    return {
      status: 429,
      message:
        'OpenAI is limiting recipe import requests. Wait before retrying; an administrator can check the project’s API limits.',
    };
  if (status === 400 || status === 422)
    return {
      status: 502,
      message:
        'OpenAI rejected the recipe-analysis request. An administrator should check the function logs for a request or model configuration error.',
    };
  if (status >= 500)
    return {
      status: 503,
      message: 'OpenAI is temporarily unavailable. Please retry later.',
    };
  return {
    status: 502,
    message:
      'OpenAI could not process the recipe request. Ask an administrator to check the function logs.',
  };
}

export async function readOpenAiHttpFailure(
  response: Response,
  referenceId: string,
): Promise<OpenAiFailure> {
  let error: Record<string, unknown> = {};
  let errorBodyState: 'parsed' | 'unreadable' = 'unreadable';
  try {
    const payload: unknown = JSON.parse(
      await readBoundedText(response, 16_384),
    );
    if (isRecord(payload) && isRecord(payload.error)) {
      error = payload.error;
      errorBodyState = 'parsed';
    }
  } catch {
    // HTML gateway errors, large bodies and failed reads still retain the
    // upstream status and request ID; never print the body or parsing error.
  }
  const errorCode = knownMetadata(error.code, ERROR_CODES);
  const errorType = knownMetadata(error.type, ERROR_TYPES);
  const errorParam = knownMetadata(error.param, ERROR_PARAMS);
  const rawRequestId = response.headers.get('x-request-id');
  const openaiRequestId =
    rawRequestId && /^req_[a-zA-Z0-9_-]{8,128}$/.test(rawRequestId)
      ? rawRequestId
      : null;
  const { status, message } = httpErrorMessage(
    response.status,
    errorCode,
    errorType,
  );
  return {
    status,
    body: {
      error: `${message} Nothing was saved. Reference: ${referenceId}`,
      referenceId,
    },
    diagnostics: {
      referenceId,
      failureKind: 'http_error',
      upstreamStatus: response.status,
      openaiRequestId,
      errorCode,
      errorType,
      errorParam,
      errorBodyState,
    },
  };
}

export function createOpenAiTransportFailure(
  error: unknown,
  referenceId: string,
): OpenAiFailure {
  const timedOut =
    error instanceof Error &&
    ['TimeoutError', 'AbortError'].includes(error.name);
  const message = timedOut
    ? 'The OpenAI recipe request timed out. Please retry later.'
    : 'Unable to connect to OpenAI for recipe import. Please retry later.';
  return {
    status: 503,
    body: {
      error: `${message} Nothing was saved. Reference: ${referenceId}`,
      referenceId,
    },
    diagnostics: {
      referenceId,
      failureKind: timedOut ? 'timeout' : 'network_error',
      upstreamStatus: null,
      openaiRequestId: null,
      errorCode: null,
      errorType: null,
      errorParam: null,
      errorBodyState: 'not_received',
    },
  };
}
