/**
 * Shape of the in-app workflow guide. The prose lives in one module per locale rather than in
 * `src/messages/*.json`, which is sized for UI labels; a parity test keeps the three locales
 * from drifting apart.
 */
export type HelpTopic = {
  /** Stable id, matching the sidebar/message key of the area it documents. */
  id: string
  title: string
  /** One or two sentences: what this area is for, in the user's language. */
  purpose: string
  /** The concrete actions, in order. */
  steps: string[]
  /** The role or permission the workflow needs, phrased for a reader. */
  whoCanDoIt: string
  /** Things a first-time user gets wrong. */
  gotchas?: string[]
}

export type HelpCatalogue = HelpTopic[]
