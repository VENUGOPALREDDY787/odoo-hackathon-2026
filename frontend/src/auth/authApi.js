const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const ACCESS_TOKEN_KEY = 'dealflow360.accessToken';
const REFRESH_TOKEN_KEY = 'dealflow360.refreshToken';
const USER_KEY = 'dealflow360.user';

// Silent access-token refresh: the token expires after 15 minutes, and
// without this every action (e.g. creating a quotation) failed with
// "Access token expired" until a full page reload. Concurrent 401s share a
// single in-flight refresh; a failed refresh clears the session.
let refreshInFlight = null;

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) throw new Error('Session expired. Please sign in again.');  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error?.message || 'Refresh failed');
        localStorage.setItem(ACCESS_TOKEN_KEY, body.data.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, body.data.refreshToken);
        localStorage.setItem(USER_KEY, JSON.stringify(body.data.user));
        return body.data.accessToken;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export { refreshAccessToken };

export async function apiRequest(path, options = {}) {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 && !path.startsWith('/auth/')) {
    try {
      await refreshAccessToken();
      const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem(ACCESS_TOKEN_KEY)}`,
          ...(options.headers || {}),
        },
      });
      const retryBody = await retryResponse.json().catch(() => ({}));
      if (!retryResponse.ok) {
        throw new Error(retryBody?.error?.message || 'Request failed');
      }
      return retryBody;
    } catch {
      throw new Error('Session expired. Please sign in again.');
    }
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || 'Request failed');
  }
  return body;
}

function saveSession(data) {
  localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export async function signIn(email, password) {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return saveSession(response.data);
}

export async function signUp(fullName, email, password) {
  const response = await apiRequest('/auth/register/customer', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, password }),
  });
  return saveSession(response.data);
}

export async function requestMagicLink(email) {
  return apiRequest('/auth/magic-link/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function recoverSession() {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!accessToken && !refreshToken) return null;

  try {
    const response = await apiRequest('/auth/profile');
    const user = response.data;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch {
    if (!refreshToken) {
      clearSession();
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error('Refresh failed');
      return saveSession(body.data);
    } catch {
      clearSession();
      return null;
    }
  }
}

export async function updateProfile(fields) {
  const response = await apiRequest('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
  localStorage.setItem(USER_KEY, JSON.stringify(response.data));
  return response.data;
}

export async function changePassword(currentPassword, newPassword) {
  return apiRequest('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function listProducts(params = {}) {
  const searchParams = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
  const response = await apiRequest(`/products${searchParams.toString() ? `?${searchParams}` : ''}`);
  return response;
}

export async function createProduct(product) {
  return apiRequest('/products', { method: 'POST', body: JSON.stringify(product) });
}

export async function updateProduct(productId, product) {
  return apiRequest(`/products/${productId}`, { method: 'PUT', body: JSON.stringify(product) });
}

export async function deleteProduct(productId) {
  return apiRequest(`/products/${productId}`, { method: 'DELETE' });
}

export async function createProductVariant(productId, variant) {
  return apiRequest(`/products/${productId}/variants`, { method: 'POST', body: JSON.stringify(variant) });
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}
