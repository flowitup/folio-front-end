import { env } from "@/lib/config/env";

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
}

/**
 * Typed fetch wrapper with error handling
 * Uses the base URL from environment configuration
 */
export async function http<TResponse, TBody = unknown>(
    endpoint: string,
    options: RequestOptions<TBody> = {}
): Promise<TResponse> {
    const { method = "GET", body, headers = {}, signal } = options;

    const url = `${env.apiBaseUrl}${endpoint}`;

    const defaultHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        // TODO: Add authorization header when auth is implemented
        // "Authorization": `Bearer ${getToken()}`,
    };

    const response = await fetch(url, {
        method,
        headers: { ...defaultHeaders, ...headers },
        body: body ? JSON.stringify(body) : undefined,
        signal,
    });

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
