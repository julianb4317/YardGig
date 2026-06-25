/**
 * Auth state management — stores tokens in cookies, user data in memory.
 */

import Cookies from "js-cookie";
import { apiClient } from "./api-client";

export interface AuthUser {
  userId: string;
  roles: string[];
  accessToken: string;
}

let currentUser: AuthUser | null = null;

export function getUser(): AuthUser | null {
  if (currentUser) return currentUser;

  const token = Cookies.get("yg_access");
  const roles = Cookies.get("yg_roles");
  const userId = Cookies.get("yg_userId");

  if (token && userId) {
    currentUser = {
      userId,
      roles: roles ? JSON.parse(roles) : [],
      accessToken: token,
    };
    return currentUser;
  }
  return null;
}

export function setAuth(data: {
  accessToken: string;
  refreshToken: string;
  userId: string;
  roles: string[];
  expiresAt: string;
}) {
  Cookies.set("yg_access", data.accessToken, { sameSite: "strict" });
  Cookies.set("yg_refresh", data.refreshToken, { sameSite: "strict" });
  Cookies.set("yg_userId", data.userId, { sameSite: "strict" });
  Cookies.set("yg_roles", JSON.stringify(data.roles), { sameSite: "strict" });

  currentUser = {
    userId: data.userId,
    roles: data.roles,
    accessToken: data.accessToken,
  };
}

export function clearAuth() {
  Cookies.remove("yg_access");
  Cookies.remove("yg_refresh");
  Cookies.remove("yg_userId");
  Cookies.remove("yg_roles");
  currentUser = null;
}

export async function logout() {
  const refreshToken = Cookies.get("yg_refresh");
  if (refreshToken) {
    try {
      await apiClient("/api/auth/revoke", {
        method: "POST",
        body: { refreshToken },
      });
    } catch {
      // Ignore revoke failure
    }
  }
  clearAuth();
}

export function isAuthenticated(): boolean {
  return !!Cookies.get("yg_access");
}

export function hasRole(role: string): boolean {
  const user = getUser();
  return user?.roles.includes(role) ?? false;
}
