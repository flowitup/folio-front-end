/**
 * Environment configuration
 * Reads and validates required environment variables
 */

interface EnvConfig {
    apiBaseUrl: string;
}

/**
 * Validated environment configuration
 * Uses getters for lazy evaluation to avoid issues during SSR/hydration
 */
export const env: EnvConfig = {
    get apiBaseUrl(): string {
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
