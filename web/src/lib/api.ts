import type { AccountUser, GeocodeResult, Op, Snapshot, UserRole, WeatherPayload } from '../../../shared/types';

export interface UsersPayload {
  sharing: boolean;
  users: AccountUser[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
/** Error de red (sin respuesta del servidor). */
export class NetworkError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new NetworkError('Sin conexión');
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) throw new NetworkError('Servidor no disponible');
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string } | null)?.error ?? res.statusText, (body as { details?: unknown } | null)?.details);
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  authStatus: () => request<{ required: boolean; authenticated: boolean; user: AccountUser | null; sharingOff?: boolean }>('/api/auth/status'),
  authStart: (email: string) => request<{ state: 'login' | 'setup'; email: string }>('/api/auth/start', { method: 'POST', body: JSON.stringify({ email }) }),
  login: (email: string, password: string) => request<{ ok: true; user: AccountUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  setup: (email: string, code: string, password: string) =>
    request<{ ok: true; user: AccountUser }>('/api/auth/setup', { method: 'POST', body: JSON.stringify({ email, code, password }) }),
  changePassword: (current: string, next: string) => request<{ ok: true }>('/api/auth/password', { method: 'POST', body: JSON.stringify({ current, next }) }),
  users: () => request<UsersPayload>('/api/users'),
  addUser: (email: string, role: UserRole = 'member') => request<UsersPayload>('/api/users', { method: 'POST', body: JSON.stringify({ email, role }) }),
  patchUser: (id: string, patch: { role?: UserRole; resetPassword?: boolean }) => request<UsersPayload>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removeUser: (id: string) => request<UsersPayload>(`/api/users/${id}`, { method: 'DELETE' }),
  setSharing: (enabled: boolean) => request<UsersPayload>('/api/sharing', { method: 'PUT', body: JSON.stringify({ enabled }) }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  health: () => request<{ ok: boolean; rev: number }>('/api/health', { cache: 'no-store' }),
  snapshot: () => request<Snapshot>('/api/snapshot'),
  ops: (ops: Op[]) => request<{ rev: number }>('/api/ops', { method: 'POST', body: JSON.stringify({ ops }) }),
  weather: (refresh = false) => request<WeatherPayload>(`/api/weather${refresh ? '?refresh=1' : ''}`),
  geocode: (q: string, near?: string, around?: { lat: number; lng: number }) =>
    request<GeocodeResult[]>(`/api/geocode?q=${encodeURIComponent(q)}${near ? `&near=${near}` : ''}${around ? `&around=${around.lat.toFixed(5)},${around.lng.toFixed(5)}` : ''}`),
  walk: (pts: Array<{ lat: number; lng: number }>, signal?: AbortSignal) =>
    request<{ distance: number; duration: number; geometry: Array<[number, number]>; legs: Array<{ distance: number; duration: number }> }>(
      `/api/walk?pts=${pts.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')}`,
      { signal },
    ),
  routes: (from: { lat: number; lng: number }, to: { lat: number; lng: number }, signal?: AbortSignal) =>
    request<Record<'foot' | 'bike' | 'car', { distance: number; duration: number; geometry: Array<[number, number]> } | null>>(
      `/api/routes?from=${from.lat.toFixed(5)},${from.lng.toFixed(5)}&to=${to.lat.toFixed(5)},${to.lng.toFixed(5)}`,
      { signal },
    ),
  importData: (data: unknown) => request<{ rev: number }>('/api/import', { method: 'POST', body: JSON.stringify(data) }),
  reset: () => request<{ rev: number }>('/api/reset', { method: 'POST' }),
  putAttachment: (id: string, body: { reservationId: string; name: string; label?: string; mime: string; data: string }) =>
    request<{ rev: number }>(`/api/attachments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  labelAttachment: (id: string, label: string) => request<{ rev: number }>(`/api/attachments/${id}`, { method: 'PATCH', body: JSON.stringify({ label }) }),
  deleteAttachment: (id: string) => request<{ rev: number }>(`/api/attachments/${id}`, { method: 'DELETE' }),
  calendarLink: () => request<{ url: string }>('/api/calendar-link'),
};
