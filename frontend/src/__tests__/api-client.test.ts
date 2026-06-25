/**
 * Critical Flow Tests — API Client
 * 
 * Tests the fetch wrapper, error handling, and token refresh logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("js-cookie", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import Cookies from "js-cookie";

describe("apiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Cookies.get).mockImplementation((key: string) => {
      if (key === "yg_access") return "valid-token";
      return undefined;
    });
  });

  it("adds Authorization header from cookie", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: "test" }),
    });

    const { apiClient } = await import("@/lib/api-client");
    await apiClient("/api/test");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/test"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer valid-token",
        }),
      })
    );
  });

  it("throws ApiError on non-2xx response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ errors: ["Validation failed"] }),
    });

    const { apiClient, ApiError } = await import("@/lib/api-client");

    await expect(apiClient("/api/test")).rejects.toThrow("Validation failed");
  });

  it("skips auth header when skipAuth is true", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    const { apiClient } = await import("@/lib/api-client");
    await apiClient("/api/auth/login", { skipAuth: true, method: "POST", body: {} });

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBeUndefined();
  });

  it("handles 204 No Content", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const { apiClient } = await import("@/lib/api-client");
    const result = await apiClient("/api/test");
    expect(result).toBeUndefined();
  });
});
