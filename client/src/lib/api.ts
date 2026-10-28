/**
 * Axios API Client with Interceptors
 * Handles authentication, error handling, and request/response transformation
 */

import axios, { AxiosError, AxiosResponse } from "axios";
import {
  getWorkspaceContext,
  workspaceContextChanged,
  markWorkspaceChanged,
  rememberWorkspaceContext,
} from "./workspace-context";
import type { ApiResponse, PaginatedResponse } from "@/types";

// Create axios instance with default config
export const api = axios.create({
  // In production (Railway), frontend and backend are on same domain, so use empty baseURL
  // Development uses Vite's same-origin /api proxy unless explicitly overridden.
  // Mixing localhost API cookies with a 127.0.0.1 frontend breaks SameSite sessions.
  baseURL: import.meta.env.PROD ? "" : import.meta.env.VITE_API_URL || "",
  timeout: 30000,
  withCredentials: true, // Important for session cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const path = config.url || "";
    if (
      !path.startsWith("/api/console") &&
      path !== "/api/auth/login" &&
      path !== "/api/auth/activate"
    ) {
      if (workspaceContextChanged())
        throw new AxiosError(
          "Reload after the sign-in change",
          "WORKSPACE_SESSION_CHANGED",
        );
      const context = getWorkspaceContext();
      if (context) config.headers.set("X-EZ-Workspace", context);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => {
    const path = response.config.url;
    if (path === "/api/auth/me" || path === "/api/auth/login") {
      rememberWorkspaceContext(
        response.data?.workspaceContext,
        path === "/api/auth/login",
      );
    }
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    if (
      error.response?.status === 409 &&
      error.response.data?.error === "WORKSPACE_SESSION_CHANGED"
    )
      markWorkspaceChanged();
    // Handle common errors
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Unauthorized - let React Query handle it (don't auto-redirect)
          // The App component will show the login page
          console.log("Unauthorized: User not authenticated");
          break;
        case 403:
          // Forbidden
          console.error("Access denied:", data.message);
          break;
        case 404:
          // Not found - this is often expected (e.g., checking if a resource exists)
          // Don't log as error, let the calling code handle it gracefully
          break;
        case 429:
          // Too many requests
          console.error("Rate limit exceeded:", data.message);
          break;
        case 500:
          // Server error
          console.error("Server error:", data.message);
          break;
        default:
          console.error("API Error:", data.message);
      }
    } else if (error.request) {
      // Network error
      console.error("Network error: No response received");
    } else {
      console.error("Request error:", error.message);
    }

    return Promise.reject(error);
  },
);

/**
 * Generic GET request with type safety
 */
export async function get<T>(url: string, params?: object): Promise<T> {
  const response = await api.get<ApiResponse<T>>(url, { params });
  return response.data.data as T;
}

/**
 * Generic POST request with type safety
 */
export async function post<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.post<ApiResponse<T>>(url, data);
  return response.data.data as T;
}

/**
 * Generic PUT request with type safety
 */
export async function put<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.put<ApiResponse<T>>(url, data);
  return response.data.data as T;
}

/**
 * Generic PATCH request with type safety
 */
export async function patch<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.patch<ApiResponse<T>>(url, data);
  return response.data.data as T;
}

/**
 * Generic DELETE request with type safety
 */
export async function del<T>(url: string, params?: object): Promise<T> {
  const response = await api.delete<ApiResponse<T>>(url, { params });
  return response.data.data as T;
}

/**
 * Paginated GET request
 */
export async function getPaginated<T>(
  url: string,
  params?: object,
): Promise<PaginatedResponse<T>> {
  const response = await api.get<PaginatedResponse<T>>(url, { params });
  return response.data;
}

export default api;
