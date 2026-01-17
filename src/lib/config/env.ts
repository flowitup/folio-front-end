/**
 * Environment configuration
 * Reads and validates required environment variables
 */

interface EnvConfig {
    apiBaseUrl: string;
}

function getEnvVar(name: string, required: boolean = true): string {
    const value = process.env[name];

    if (required && !value) {
        throw new Error(
            `Missing required environment variable: ${name}. ` +
            `Please check your .env.local file.`
        );
    }

    return value || "";
}

/**
 * Validated environment configuration
 * Throws an error if required variables are missing
 */
export const env: EnvConfig = {
    apiBaseUrl: getEnvVar("NEXT_PUBLIC_API_BASE_URL"),
};

/**
 * Check if we're running in development mode
 */
export const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Check if we're running in production mode
 */
export const isProduction = process.env.NODE_ENV === "production";
