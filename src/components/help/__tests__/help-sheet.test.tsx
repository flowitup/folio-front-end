/**
 * The help panel is the only way into the workflow guide, so what matters is the path through
 * it: the trigger is reachable by its label, the index lists the topics, a topic opens its own
 * steps, and back returns to the index. Assertions read from the real catalogue so the test
 * stays true as the documentation grows.
 *
 * The catalogue is a per-locale chunk fetched on first open, so every assertion that expects
 * content waits for it rather than reading synchronously.
 */

import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { HelpSheet } from "../help-sheet"
import { helpCatalogueEn } from "@/content/help/en"

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}))

const [firstTopic] = helpCatalogueEn

describe("HelpSheet", () => {
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

    await user.click(screen.getByText("help.back"))

    expect(screen.getByTestId(`help-topic-${firstTopic.id}`)).toBeInTheDocument()
    expect(screen.queryByText(firstTopic.steps[0])).not.toBeInTheDocument()
  })

  it("moves focus to the back control on drill-in, and to the row on the way out", async () => {
    const user = userEvent.setup()
    render(<HelpSheet />)

    await user.click(screen.getByLabelText("help.aria.open"))
    await user.click(await screen.findByTestId(`help-topic-${firstTopic.id}`))

    expect(screen.getByText("help.back").closest("button")).toHaveFocus()

    await user.click(screen.getByText("help.back"))

    expect(screen.getByTestId(`help-topic-${firstTopic.id}`)).toHaveFocus()
  })

  it.each([
    ["escape", async (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
    [
      "the close button",
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByText("help.aria.close")),
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
})
