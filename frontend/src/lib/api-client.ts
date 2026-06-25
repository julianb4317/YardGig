/**
 * Centralized API client with JWT auth token injection and refresh logic.
 */

import Cookies from "js-cookie";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5209";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuth?: boolean;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public errors: string[],
    public raw?: Response
  ) {
    super(errors[0] ?? `API error ${status}`);
    this.name = "ApiError";
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = Cookies.get("yg_refresh");
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      Cookies.remove("yg_access");
      Cookies.remove("yg_refresh");
      return null;
    }

    const data = await res.json();
    Cookies.set("yg_access", data.accessToken, { sameSite: "strict" });
    return data.accessToken;
  } catch {
    return null;
  }
}

export async function apiClient<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, skipAuth, ...init } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };

  if (!skipAuth) {
    let token = Cookies.get("yg_access");
    if (!token) {
      token = (await refreshAccessToken()) ?? undefined;
    }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle 401 with token refresh retry
  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      const retryRes = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (retryRes.ok) {
        return retryRes.status === 204 ? (undefined as T) : retryRes.json();
      }
    }
    // Refresh failed — redirect to login
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
    throw new ApiError(401, ["Session expired. Please log in again."]);
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const errors: string[] = errorBody.errors
      ?? [errorBody.error ?? `Request failed with ${res.status}`];
    // In development, include inner error details if present
    if (errorBody.innerError) {
      errors.push(errorBody.innerError);
    }
    throw new ApiError(res.status, errors, res);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
