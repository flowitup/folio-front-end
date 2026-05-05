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

const CSRF_COOKIE_NAME = "csrf_access_token";
const REFRESH_CSRF_COOKIE_NAME = "csrf_refresh_token";
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const prefix = `${name}=`;
    const match = document.cookie
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(prefix));
    return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

/**
 * Read the backend-issued CSRF cookie from document.cookie. Returns null on
 * the server (Next.js server actions handle CSRF via the same-origin Action
 * boundary) or when the cookie is absent.
 *
 * Flask-JWT-Extended skips the cookie-CSRF check when an Authorization Bearer
 * header is present, so this is defense-in-depth that closes F-2: if a future
 * change ever falls back to cookie-only auth, mutations still carry a CSRF
 * token paired against the cookie.
 */
export function getCsrfToken(): string | null {
    return readCookie(CSRF_COOKIE_NAME);
}

/**
 * Read the refresh-token CSRF cookie. Required as the X-CSRF-TOKEN header on
 * POST /auth/refresh when JWT_COOKIE_CSRF_PROTECT is on (production default).
 * Flask-JWT-Extended uses a SEPARATE CSRF token for refresh — the one sent on
 * regular mutations (csrf_access_token) does not match.
 */
export function getRefreshCsrfToken(): string | null {
    return readCookie(REFRESH_CSRF_COOKIE_NAME);
}

/**
 * Build the headers needed for a CSRF-protected mutating request. Exposed for
 * direct fetch() callers (FormData uploads, blob downloads) that bypass the
 * `http()` wrapper.
 */
export function getCsrfHeader(method: string): Record<string, string> {
    if (!MUTATION_METHODS.has(method.toUpperCase())) return {};
    const token = getCsrfToken();
    return token ? { "X-CSRF-TOKEN": token } : {};
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
        // Flask-JWT-Extended's refresh endpoint requires the refresh-token CSRF
        // header in production (JWT_COOKIE_CSRF_PROTECT=True). Without it,
        // refresh always 401s, bricking every mutating call once the access
        // token expires (~15 min).
        const csrfRefresh = getRefreshCsrfToken();
        const headers: Record<string, string> = {};
        if (csrfRefresh) {
            headers["X-CSRF-TOKEN"] = csrfRefresh;
        }
        const response = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
            method: "POST",
            credentials: "include",
            headers,
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
        ...getCsrfHeader(method),
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
