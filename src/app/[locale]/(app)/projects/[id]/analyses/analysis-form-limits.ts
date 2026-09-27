/** The API's limits on an analysis's metadata (project_analysis.py). */
export const MAX_ANALYSIS_TAGS = 20;
export const MAX_ANALYSIS_TAG_LENGTH = 100;

/** The API accepts a source link only when it starts with http:// or https://. */
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}
