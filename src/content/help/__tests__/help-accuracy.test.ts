/**
 * The guide must not describe controls the app does not have, nor contradict
 * the phone rule the forms apply (a leading 0 is accepted).
 */
import { describe, expect, it } from "vitest"

import { helpCatalogueEn } from "../en"
import { helpCatalogueFr } from "../fr"
import { helpCatalogueVi } from "../vi"

const TEXT = {
  en: JSON.stringify(helpCatalogueEn),
  fr: JSON.stringify(helpCatalogueFr),
  vi: JSON.stringify(helpCatalogueVi),
}

describe("help guide accuracy", () => {
  it("names no light/dark switch, which the top bar does not have", () => {
    expect(TEXT.en).not.toMatch(/light and dark|dark mode|theme/i)
    expect(TEXT.fr).not.toMatch(/thème clair|sombre/i)
    expect(TEXT.vi).not.toMatch(/sáng tối/i)
  })

  it("describes the projects list as it is: a search, no All/Active toggle", () => {
    expect(TEXT.en).not.toMatch(/“Active” toggle|“All projects”/)
    expect(TEXT.fr).not.toMatch(/“Actifs”|“Tous les projets”/)
    expect(TEXT.vi).not.toMatch(/“Đang chạy”/)
  })

  it("points at the column's “+” button, whose only text is its accessible name", () => {
    const planning = (catalogue: typeof helpCatalogueEn) =>
      JSON.stringify(catalogue.find((topic) => topic.id === "planning"))
    expect(planning(helpCatalogueEn)).toContain("“+” (“Add task”)")
    expect(planning(helpCatalogueFr)).toContain("“+” (“Ajouter une tâche”)")
    expect(planning(helpCatalogueVi)).toContain("“+” (“Thêm công việc”)")
  })

  it("does not tell people to drop the leading 0 from their number", () => {
    expect(TEXT.en).not.toMatch(/without the leading zero/i)
    expect(TEXT.fr).not.toMatch(/sans le 0 initial/i)
    expect(TEXT.vi).not.toMatch(/bỏ số 0/i)
  })

  it("uses the board's Vietnamese words for the backlog and tasks", () => {
    const planning = JSON.stringify(helpCatalogueVi.find((topic) => topic.id === "planning"))
    expect(planning).not.toMatch(/\b(task|backlog)\b/i)
    expect(planning).toContain("“Thêm công việc”")
    expect(planning).toContain("“Việc tồn đọng”")
  })

  it("does not say everyone can delete tasks: deleting needs project-editing rights", () => {
    const who = (catalogue: typeof helpCatalogueEn) =>
      catalogue.find((topic) => topic.id === "planning")?.whoCanDoIt ?? ""
    expect(who(helpCatalogueEn)).not.toMatch(/no permission gate|delete tasks/i)
    expect(who(helpCatalogueEn)).toMatch(/Deleting a task needs project-editing rights/)
    expect(who(helpCatalogueFr)).not.toMatch(/supprimer des tâches/)
    expect(who(helpCatalogueFr)).toMatch(/Supprimer une tâche demande/)
    expect(who(helpCatalogueVi)).not.toMatch(/xóa công việc được/)
    expect(who(helpCatalogueVi)).toMatch(/Xóa công việc cần quyền chỉnh sửa dự án/)
  })
})
