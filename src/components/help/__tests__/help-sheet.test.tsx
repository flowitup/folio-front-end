/**
 * The help panel is the only way into the workflow guide, so what matters is the path through
 * it: the trigger is reachable by its label, the index lists the topics, a topic opens its own
 * steps, and back returns to the index. Assertions read from the real catalogue so the test
 * stays true as the documentation grows.
 *
 * The catalogue is a per-locale chunk fetched on first open, so every assertion that expects
 * content waits for it rather than reading synchronously.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { HelpSheet } from "../help-sheet"
import { helpCatalogueEn, helpChromeEn } from "@/content/help/en"
import { helpCatalogueFr, helpChromeFr } from "@/content/help/fr"

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}))

// The panel narrows the catalogue to what this reader's navigation shows, so it reads the same
// two contexts the sidebar does. Default here is the widest reader; one test narrows it.
let mockCompanyRole = "admin"
let mockProjectPermissions: string[] = ["project:update"]

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { permissions: [], companies: [{ id: "c1", role: mockCompanyRole }] },
  }),
}))

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({
    selectedProject: { id: "p1", my_permissions: mockProjectPermissions },
  }),
}))

const [firstTopic] = helpCatalogueEn

describe("HelpSheet", () => {
  beforeEach(() => {
    mockCompanyRole = "admin"
    mockProjectPermissions = ["project:update"]
  })

  it("labels the trigger for assistive technology", () => {
    render(<HelpSheet />)
    expect(screen.getByLabelText("help.aria.open")).toBeInTheDocument()
  })

  it("keeps the catalogue out of the page until the panel is opened", () => {
    render(<HelpSheet />)
    expect(
      screen.queryByTestId(`help-topic-${firstTopic.id}`)
    ).not.toBeInTheDocument()
  })

  it("lists every documented workflow once opened", async () => {
    const user = userEvent.setup()
    render(<HelpSheet />)

    await user.click(screen.getByLabelText("help.aria.open"))
    await screen.findByTestId(`help-topic-${firstTopic.id}`)

    for (const topic of helpCatalogueEn) {
      expect(screen.getByTestId(`help-topic-${topic.id}`)).toBeInTheDocument()
    }
  })

  it("drills into a topic and comes back to the index", async () => {
    const user = userEvent.setup()
    render(<HelpSheet />)

    await user.click(screen.getByLabelText("help.aria.open"))
    await user.click(await screen.findByTestId(`help-topic-${firstTopic.id}`))

    expect(screen.getByText(firstTopic.steps[0])).toBeInTheDocument()
    expect(screen.getByText(firstTopic.whoCanDoIt)).toBeInTheDocument()
    expect(
      screen.queryByTestId(`help-topic-${firstTopic.id}`)
    ).not.toBeInTheDocument()

    await user.click(screen.getByText(helpChromeEn.back))

    expect(screen.getByTestId(`help-topic-${firstTopic.id}`)).toBeInTheDocument()
    expect(screen.queryByText(firstTopic.steps[0])).not.toBeInTheDocument()
  })

  it("moves focus to the back control on drill-in, and to the row on the way out", async () => {
    const user = userEvent.setup()
    render(<HelpSheet />)

    await user.click(screen.getByLabelText("help.aria.open"))
    await user.click(await screen.findByTestId(`help-topic-${firstTopic.id}`))

    expect(screen.getByText(helpChromeEn.back).closest("button")).toHaveFocus()

    await user.click(screen.getByText(helpChromeEn.back))

    expect(screen.getByTestId(`help-topic-${firstTopic.id}`)).toHaveFocus()
  })

  it.each([
    ["escape", async (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
    [
      "the close button",
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByText(helpChromeEn.close)),
    ],
  ])("reopens on the index after being dismissed with %s", async (_name, dismiss) => {
    const user = userEvent.setup()
    render(<HelpSheet />)

    await user.click(screen.getByLabelText("help.aria.open"))
    await user.click(await screen.findByTestId(`help-topic-${firstTopic.id}`))
    await dismiss(user)
    await user.click(screen.getByLabelText("help.aria.open"))

    expect(
      await screen.findByTestId(`help-topic-${firstTopic.id}`)
    ).toBeInTheDocument()
  })

  it("leaves out the topics this reader's navigation hides", async () => {
    mockCompanyRole = "member"
    mockProjectPermissions = ["project:read"]
    const user = userEvent.setup()
    render(<HelpSheet />)

    await user.click(screen.getByLabelText("help.aria.open"))
    await screen.findByTestId("help-topic-getting-started")

    // Documents needs project:update; billing is company-admin only.
    expect(screen.queryByTestId("help-topic-documents")).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("help-topic-billing-devis")
    ).not.toBeInTheDocument()
    // What they can reach is still there.
    expect(screen.getByTestId("help-topic-planning")).toBeInTheDocument()
  })

  it("reads the guide in another language without touching the app's", async () => {
    const user = userEvent.setup()
    render(<HelpSheet />)

    await user.click(screen.getByLabelText("help.aria.open"))
    await screen.findByTestId(`help-topic-${firstTopic.id}`)
    // Starts in the app's language.
    expect(screen.getByText(helpChromeEn.subtitle)).toBeInTheDocument()

    await user.click(screen.getByTestId("help-language-fr"))

    // Panel labels and topic titles both follow the choice.
    expect(await screen.findByText(helpChromeFr.subtitle)).toBeInTheDocument()
    expect(screen.getByText(helpCatalogueFr[0].title)).toBeInTheDocument()
    expect(screen.queryByText(helpCatalogueEn[0].title)).not.toBeInTheDocument()
    // The trigger belongs to the app shell and keeps the app's language.
    expect(screen.getByLabelText("help.aria.open")).toBeInTheDocument()
  })

  it("keeps you on the same topic when the guide language changes", async () => {
    const user = userEvent.setup()
    render(<HelpSheet />)

    await user.click(screen.getByLabelText("help.aria.open"))
    await user.click(await screen.findByTestId("help-topic-planning"))

    const english = helpCatalogueEn.find((topic) => topic.id === "planning")!
    expect(screen.getByText(english.steps[0])).toBeInTheDocument()

    await user.click(screen.getByTestId("help-language-fr"))

    const french = helpCatalogueFr.find((topic) => topic.id === "planning")!
    expect(await screen.findByText(french.steps[0])).toBeInTheDocument()
  })

  it("marks the active language for assistive technology", async () => {
    const user = userEvent.setup()
    render(<HelpSheet />)

    await user.click(screen.getByLabelText("help.aria.open"))
    await screen.findByTestId(`help-topic-${firstTopic.id}`)

    expect(screen.getByTestId("help-language-en")).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId("help-language-fr")).toHaveAttribute("aria-pressed", "false")
  })
})
