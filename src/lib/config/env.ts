/**
 * Environment configuration
 * Reads and validates required environment variables
 */

interface EnvConfig {
    apiBaseUrl: string;
}

/**
 * Validated environment configuration.
 *
 * Two-URL strategy for Docker deployments:
 *   - Browser (client) → NEXT_PUBLIC_API_BASE_URL  (e.g. http://localhost:5000/api/v1)
 *   - Server actions   → API_INTERNAL_BASE_URL      (e.g. http://api:5000/api/v1)
 *
 * API_INTERNAL_BASE_URL is a runtime env var (no NEXT_PUBLIC_ prefix) so it is
 * never baked into the build and can be set per-environment in docker-compose.
 */
export const env: EnvConfig = {
    get apiBaseUrl(): string {
        // Server-side: prefer the internal Docker network URL when available
        const isServer = typeof window === "undefined";
        if (isServer && process.env.API_INTERNAL_BASE_URL) {
            return process.env.API_INTERNAL_BASE_URL;
        }

        const value = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (!value) {
            // Fallback for development
            if (process.env.NODE_ENV === "development") {
                return "http://localhost:5000/api/v1";
            }
            throw new Error(
                "Missing required environment variable: NEXT_PUBLIC_API_BASE_URL. " +
                "Please check your .env.local file."
            );
        }
        return value;
    },
};

/**
 * Check if we're running in development mode
 */
export const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Check if we're running in production mode
 */
export const isProduction = process.env.NODE_ENV === "production";
