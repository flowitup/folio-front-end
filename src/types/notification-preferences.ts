/**
 * Push notification preference shapes shared by the server-only API wrapper and the
 * client settings section. Kept free of server imports so the client bundle never pulls
 * in next/headers through `@/lib/api/notifications`.
 */

/** Mutable event families; mirrors `app/domain/notifications/categories.py`. */
export const NOTIFICATION_CATEGORIES = [
  "chat",
  "attendance",
  "tasks",
  "membership",
  "billing",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** GET /notifications/preferences — every field present; a user with no stored row reads all true. */
export type NotificationPreferences = { push_enabled: boolean } & Record<NotificationCategory, boolean>;

/** PUT body: omitted fields keep their value. */
export type NotificationPreferencesUpdate = Partial<NotificationPreferences>;
