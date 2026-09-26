import { API_BASE_URL, STORAGE_KEYS } from '../constants/index.js';

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { requiresAuth = true, headers = {}, ...customConfig } = options;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...customConfig,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // If access token expired, try refreshing
    if (response.status === 403 && requiresAuth) {
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          const refreshData = await refreshRes.json();
          if (refreshData.success && refreshData.data?.accessToken) {
            localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, refreshData.data.accessToken);
            if (refreshData.data.refreshToken) {
              localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshData.data.refreshToken);
            }
            // Retry initial request
            defaultHeaders['Authorization'] = `Bearer ${refreshData.data.accessToken}`;
            const retryRes = await fetch(`${API_BASE_URL}${endpoint}`, {
              ...customConfig,
              headers: { ...defaultHeaders, ...headers },
            });
            return await retryRes.json();
          }
        } catch {
          // Token refresh failed, clear local session
          localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        }
      }
    }

    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data.data !== undefined ? data.data : data;
}
