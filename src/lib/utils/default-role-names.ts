/**
 * Seed role UUID → i18n key mapping.
 *
 * The two default roles are seeded in the DB migration with Vietnamese
 * names. This map lets the FE resolve locale-appropriate display names
 * for them. User-created roles are not mapped and display their literal
 * DB name.
 */
export const DEFAULT_ROLE_I18N_KEYS: Record<string, string> = {
  "b08f0bdb-9e78-40ca-aca9-96016de45c7c": "masterCraftsman",
  "de417d58-3d38-4658-a5f7-02b51fb749fc": "assistant",
};
