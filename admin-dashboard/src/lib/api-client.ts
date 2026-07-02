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
        if (retryRes.status === 204) return undefined as T;
        const retryText = await retryRes.text();
        if (!retryText) return undefined as T;
        return JSON.parse(retryText) as T;
      }
    }
    // Refresh failed — redirect to admin login
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError(401, ["Session expired. Please log in again."]);
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const errors: string[] = errorBody.errors ?? [`Request failed with ${res.status}`];
    throw new ApiError(res.status, errors, res);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
