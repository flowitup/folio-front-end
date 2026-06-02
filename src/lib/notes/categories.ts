/**
 * Note category constants.
 * Dot colors match the artifact exactly.
 * Labels come from i18n (notes.categories.<id>) — NOT hardcoded here.
 */

import type { NoteCategory } from "@/lib/api/notes";

export interface NoteCategoryMeta {
  id: NoteCategory;
  /** CSS hex color for the category dot */
  dotColor: string;
  /** i18n key: notes.categories.<id> */
  i18nKey: string;
}

export const NOTE_CATEGORIES: NoteCategoryMeta[] = [
  { id: "inspection", dotColor: "#1a1a1a", i18nKey: "notes.categories.inspection" },
  { id: "delivery",   dotColor: "#e8843c", i18nKey: "notes.categories.delivery" },
  { id: "payment",    dotColor: "#c98e2b", i18nKey: "notes.categories.payment" },
  { id: "decision",   dotColor: "#5a7a4a", i18nKey: "notes.categories.decision" },
  { id: "call",       dotColor: "#b3543d", i18nKey: "notes.categories.call" },
  { id: "general",    dotColor: "#b8b1a4", i18nKey: "notes.categories.general" },
];

export const CATEGORY_ORDER: NoteCategory[] = NOTE_CATEGORIES.map((c) => c.id);

/** Lookup map from category id → meta. O(1) access. */
export const CATEGORY_MAP: Record<NoteCategory, NoteCategoryMeta> = Object.fromEntries(
  NOTE_CATEGORIES.map((c) => [c.id, c])
) as Record<NoteCategory, NoteCategoryMeta>;
