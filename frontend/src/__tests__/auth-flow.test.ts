/**
 * Critical Flow Tests — Auth
 * 
 * Run with: npx vitest run src/__tests__/auth-flow.test.ts
 * 
 * These tests verify the auth module logic without a browser.
 * Integration tests against the real API would use Playwright.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock js-cookie
vi.mock("js-cookie", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

import Cookies from "js-cookie";
import { setAuth, getUser, clearAuth, isAuthenticated, hasRole } from "@/lib/auth";

describe("Auth Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setAuth", () => {
    it("stores tokens and user info in cookies", () => {
      setAuth({
        accessToken: "test-token",
        refreshToken: "test-refresh",
        userId: "user-123",
        roles: ["Customer", "Vendor"],
        expiresAt: "2026-07-01T00:00:00Z",
      });

      expect(Cookies.set).toHaveBeenCalledWith("yg_access", "test-token", { sameSite: "strict" });
      expect(Cookies.set).toHaveBeenCalledWith("yg_refresh", "test-refresh", { sameSite: "strict" });
      expect(Cookies.set).toHaveBeenCalledWith("yg_userId", "user-123", { sameSite: "strict" });
      expect(Cookies.set).toHaveBeenCalledWith("yg_roles", '["Customer","Vendor"]', { sameSite: "strict" });
    });
  });

  describe("getUser", () => {
    it("returns user from cookies", () => {
      vi.mocked(Cookies.get).mockImplementation((key: string) => {
        const map: Record<string, string> = {
          yg_access: "token",
          yg_userId: "uid",
          yg_roles: '["Vendor"]',
        };
        return map[key];
      });

      const user = getUser();
      expect(user).toEqual({ userId: "uid", roles: ["Vendor"], accessToken: "token" });
    });

    it("returns null when no token", () => {
      vi.mocked(Cookies.get).mockReturnValue(undefined);
      expect(getUser()).toBeNull();
    });
  });

  describe("clearAuth", () => {
    it("removes all auth cookies", () => {
      clearAuth();
      expect(Cookies.remove).toHaveBeenCalledWith("yg_access");
      expect(Cookies.remove).toHaveBeenCalledWith("yg_refresh");
      expect(Cookies.remove).toHaveBeenCalledWith("yg_userId");
      expect(Cookies.remove).toHaveBeenCalledWith("yg_roles");
    });
  });

  describe("isAuthenticated", () => {
    it("returns true when access token exists", () => {
      vi.mocked(Cookies.get).mockReturnValue("some-token");
      expect(isAuthenticated()).toBe(true);
    });

    it("returns false when no token", () => {
      vi.mocked(Cookies.get).mockReturnValue(undefined);
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe("hasRole", () => {
    it("returns true for matching role", () => {
      vi.mocked(Cookies.get).mockImplementation((key: string) => {
        const map: Record<string, string> = {
          yg_access: "token",
          yg_userId: "uid",
          yg_roles: '["Customer","Vendor"]',
        };
        return map[key];
      });

      expect(hasRole("Customer")).toBe(true);
      expect(hasRole("Vendor")).toBe(true);
      expect(hasRole("Admin")).toBe(false);
    });
  });
});

describe("ApiError", () => {
  it("extracts first error message", async () => {
    const { ApiError } = await import("@/lib/api-client");
    const err = new ApiError(400, ["Field required", "Invalid format"]);
    expect(err.message).toBe("Field required");
    expect(err.status).toBe(400);
    expect(err.errors).toHaveLength(2);
  });
});
