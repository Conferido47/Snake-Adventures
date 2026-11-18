export function jsonResponse(value: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
  responseHeaders.set('Cache-Control', 'no-store');
  responseHeaders.set('X-Content-Type-Options', 'nosniff');
  return new Response(JSON.stringify(value), { status, headers: responseHeaders });
}

export async function readSmallJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json.');
  }
  const contentLength = Number(request.headers.get('Content-Length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 8_192) {
    throw new HttpError(413, 'Request body is too large.');
  }
  const body = await readBoundedBody(request, 8_192);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new HttpError(400, 'Request body must contain valid JSON.');
  }
}

async function readBoundedBody(request: Request, maximumBytes: number): Promise<string> {
  if (!request.body) {
    return '';
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      result += decoder.decode();
      return result;
    }
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new HttpError(413, 'Request body is too large.');
    }
    result += decoder.decode(value, { stream: true });
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown, service = 'The service'): Response {
  if (error instanceof HttpError) {
    return jsonResponse({ error: error.message }, error.status);
  }
  console.error(JSON.stringify({
    message: 'Unhandled service error',
    error: error instanceof Error ? error.message : String(error),
  }));
  return jsonResponse({ error: `${service} is temporarily unavailable.` }, 500);
}
