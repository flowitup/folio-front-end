import { env } from "@/lib/config/env";

/**
 * Token storage for client-side API calls
 */
let accessToken: string | null = null;

export function setApiAccessToken(token: string | null) {
    accessToken = token;
}

export function getApiAccessToken(): string | null {
    return accessToken;
}

/**
 * Custom API error class
 */
export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public data?: unknown
    ) {
        super(message);
        this.name = "ApiError";
    }
}

/**
 * HTTP request options
 */
interface RequestOptions<TBody = unknown> {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: TBody;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    _isRetry?: boolean;
}

/**
 * Refresh the access token using the refresh token cookie
 */
async function refreshAccessToken(): Promise<boolean> {
    try {
        const response = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
            method: "POST",
            credentials: "include",
        });
        if (response.ok) {
            const data = await response.json();
            if (data.access_token) {
                accessToken = data.access_token;
            }
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Typed fetch wrapper with error handling and automatic token refresh
 */
export async function http<TResponse, TBody = unknown>(
    endpoint: string,
    options: RequestOptions<TBody> = {}
): Promise<TResponse> {
    const { method = "GET", body, headers = {}, signal, _isRetry = false } = options;

    const url = `${env.apiBaseUrl}${endpoint}`;

    const defaultHeaders: Record<string, string> = {
        "Content-Type": "application/json",
    };

    // Add Authorization header if we have an access token
    if (accessToken) {
        defaultHeaders["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
        method,
        headers: { ...defaultHeaders, ...headers },
        body: body ? JSON.stringify(body) : undefined,
        signal,
        credentials: "include",
    });

    // Handle 401 - try to refresh token once
    if (response.status === 401 && !_isRetry) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            // Retry the original request
            return http<TResponse, TBody>(endpoint, { ...options, _isRetry: true });
        }
    }

    // Handle non-2xx responses
    if (!response.ok) {
        let errorData: unknown;
        try {
            errorData = await response.json();
        } catch {
            errorData = await response.text();
        }

        throw new ApiError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            errorData
        );
    }

    // Handle empty responses (e.g., 204 No Content)
    if (response.status === 204) {
        return undefined as TResponse;
    }

    return response.json() as Promise<TResponse>;
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
    get: <TResponse>(endpoint: string, options?: Omit<RequestOptions, "method" | "body">) =>
        http<TResponse>(endpoint, { ...options, method: "GET" }),

    post: <TResponse, TBody = unknown>(endpoint: string, body: TBody, options?: Omit<RequestOptions<TBody>, "method" | "body">) =>
        http<TResponse, TBody>(endpoint, { ...options, method: "POST", body }),

    put: <TResponse, TBody = unknown>(endpoint: string, body: TBody, options?: Omit<RequestOptions<TBody>, "method" | "body">) =>
        http<TResponse, TBody>(endpoint, { ...options, method: "PUT", body }),

    patch: <TResponse, TBody = unknown>(endpoint: string, body: TBody, options?: Omit<RequestOptions<TBody>, "method" | "body">) =>
        http<TResponse, TBody>(endpoint, { ...options, method: "PATCH", body }),

    delete: <TResponse>(endpoint: string, options?: Omit<RequestOptions, "method" | "body">) =>
        http<TResponse>(endpoint, { ...options, method: "DELETE" }),
};
