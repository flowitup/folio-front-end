/**
 * Suggested sections (postes) for a works project.
 *
 * The stored name is the trade term in French, as written on quotes and in
 * shops; the dialog shows a short hint in the app's language next to it.
 */

export const POSTE_TEMPLATES = [
  { key: "demolition", name: "Démolition" },
  { key: "maconnerie", name: "Maçonnerie" },
  { key: "doublage", name: "Doublage" },
  { key: "isolation", name: "Isolation" },
  { key: "electricite", name: "Électricité" },
  { key: "plomberie", name: "Plomberie" },
  { key: "chauffage", name: "Chauffage" },
  { key: "ventilation", name: "Ventilation" },
  { key: "salleDeBains", name: "Salle de bains" },
  { key: "cuisine", name: "Cuisine" },
  { key: "carrelage", name: "Carrelage" },
  { key: "sols", name: "Sols" },
  { key: "peinture", name: "Peinture" },
  { key: "menuiseries", name: "Menuiseries" },
  { key: "eclairage", name: "Éclairage" },
] as const;

export type PosteTemplateKey = (typeof POSTE_TEMPLATES)[number]["key"];

/** Case- and accent-insensitive form of a section name, to spot one already there. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}
