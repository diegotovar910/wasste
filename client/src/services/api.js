/**
 * The only place the front end talks to the network.
 *
 * Gemini and MongoDB are never touched from the browser - the API key lives on
 * the server and stays there (sections 26 and 37).
 */
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, signal, isFormData = false } = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      headers: isFormData || !body ? undefined : { 'Content-Type': 'application/json' },
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach the Wasste server. Is the API running?', 0);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(payload?.error || `Request failed with status ${response.status}`, response.status);
  }

  return payload;
}

export const api = {
  health: (signal) => request('/health', { signal }),

  dashboard: (days = 30, signal) => request(`/dashboard?days=${days}`, { signal }),

  bins: (signal) => request('/bins', { signal }),
  bin: (id, days = 30, signal) => request(`/bins/${id}?days=${days}`, { signal }),
  simulateSensor: (id, reading = {}) => request(`/bins/${id}/sensor`, { method: 'POST', body: reading }),

  wasteEvents: ({ binId, limit = 25, category } = {}, signal) => {
    const params = new URLSearchParams();
    if (binId) params.set('binId', binId);
    if (category) params.set('category', category);
    params.set('limit', String(limit));
    return request(`/waste/events?${params}`, { signal });
  },
  wasteStats: ({ binId, days = 30 } = {}, signal) => {
    const params = new URLSearchParams({ days: String(days) });
    if (binId) params.set('binId', binId);
    return request(`/waste/stats?${params}`, { signal });
  },

  /** Uploads one image for Gemini Vision classification. */
  classify: ({ file, binId, record = true }) => {
    const form = new FormData();
    form.append('image', file);
    if (binId) form.append('binId', binId);
    form.append('record', String(record));
    return request('/waste/classify', { method: 'POST', body: form, isFormData: true });
  },

  analyse: ({ binId, days = 30 } = {}) => request('/ai/analyze', { method: 'POST', body: { binId, days } }),
  recommendations: (binId, days = 30, signal) =>
    request(`/ai/recommendations/${binId}?days=${days}`, { signal }),
};

export { ApiError };
