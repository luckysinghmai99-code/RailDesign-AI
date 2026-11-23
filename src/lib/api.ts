let memoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  memoryToken = token;
}

export function getAuthToken(): string | null {
  return memoryToken;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { rawResponse?: boolean } = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (memoryToken) {
    headers.set('Authorization', `Bearer ${memoryToken}`);
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (options.rawResponse) {
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `Request failed (${res.status})`);
    }
    return res as unknown as T;
  }

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    throw new Error(String(data.error || data.message || `Request failed (${res.status})`));
  }

  return data as T;
}
