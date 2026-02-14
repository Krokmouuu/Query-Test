const API_TARGET = process.env.API_URL ?? 'http://localhost:4000';
const PROXY_TIMEOUT_MS = 120_000; // 2 min for LLM + DB

type Params = { path: string[] };

function getBackendUrl(path: string[]): string {
  const segment = path.join('/');
  return `${API_TARGET}/${segment}`;
}

export async function GET(request: Request, context: { params: Promise<Params> }) {
  const { path } = await context.params;
  const url = getBackendUrl(path);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: request.headers.get('accept') ? { Accept: request.headers.get('accept')! } : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      statusText: res.statusText,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : 'Proxy error';
    const isTimeout = message.includes('abort') || (err as { name?: string }).name === 'AbortError';
    return Response.json(
      { message: isTimeout ? 'Request timed out. The query may take too long.' : message },
      { status: isTimeout ? 504 : 502 },
    );
  }
}

export async function POST(request: Request, context: { params: Promise<Params> }) {
  const { path } = await context.params;
  const url = getBackendUrl(path);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const body = await request.text();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('Content-Type') ?? 'application/json',
      },
      body: body || undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const resBody = await res.text();
    return new Response(resBody, {
      status: res.status,
      statusText: res.statusText,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : 'Proxy error';
    const isTimeout = message.includes('abort') || (err as { name?: string }).name === 'AbortError';
    return Response.json(
      { message: isTimeout ? 'Request timed out. The query may take too long.' : message },
      { status: isTimeout ? 504 : 502 },
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<Params> }) {
  const { path } = await context.params;
  const url = getBackendUrl(path);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'DELETE', signal: controller.signal });
    clearTimeout(timeoutId);
    const resBody = await res.text();
    return new Response(resBody, {
      status: res.status,
      statusText: res.statusText,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : 'Proxy error';
    const isTimeout = message.includes('abort') || (err as { name?: string }).name === 'AbortError';
    return Response.json(
      { message: isTimeout ? 'Request timed out.' : message },
      { status: isTimeout ? 504 : 502 },
    );
  }
}
