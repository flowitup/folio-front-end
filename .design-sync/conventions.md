# Folio — Build Journal design system

A warm, editorial UI for managing a house build: cream "paper" surfaces, ink
text, a terracotta accent. Components are shadcn/ui (new-york) primitives styled
with Tailwind v4 utilities bound to Folio design tokens. Render with
`window.Folio.*` (e.g. `window.Folio.Button`, `window.Folio.Card`).

## Setup & wrapping

No provider is needed for styling — the Folio tokens are global CSS shipped in
`styles.css`; every component is styled the moment that stylesheet is present.
Build in the **default (light) theme** — the cream-paper look is the intended
default. A `.dark` class on an ancestor switches to dark mode (next-themes), but
default/no-class is the Folio brand. `Toaster` is the only component that must
be mounted once near the app root; fire toasts with sonner's `toast()`.

## Styling idiom — Tailwind utilities bound to Folio tokens

Style with **semantic utility classes**, never hardcoded colors. The token
behind each class is what carries the brand, so `bg-primary` is the ink color,
`bg-destructive` is terracotta, etc.

| Role | Utilities |
|---|---|
| Surfaces | `bg-background` (paper), `bg-card` (white), `bg-secondary` / `bg-muted` (warm paper-2), `bg-popover` |
| Text | `text-foreground` (ink), `text-muted-foreground`, `text-primary-foreground`, `text-destructive` |
| Accent / actions | `bg-primary` (ink), `bg-destructive` (terracotta), `bg-accent` + `text-accent-foreground` (terracotta tint) |
| Lines / focus | `border`, `border-input`, `ring-ring` |
| Radius | `rounded-md`, `rounded-lg`, `rounded-xl` |

Type: Inter is the default body font (no class needed). `.font-display`
(Fraunces serif) for display headings; `.num` or `font-mono` (JetBrains Mono)
for money/figures/tabular numbers. Other helpers: `.label-cap` (uppercase
caption), `.folio-card` (the paper card surface), `.hairline`.

**For your own layout glue, prefer the raw tokens** — `styles.css` is a compiled
Tailwind snapshot scoped to the classes the app already uses, so an arbitrary
new utility (e.g. an uncommon `gap-*` or opacity modifier) may not be present,
but the `var(--*)` tokens are always defined in `:root`:
`var(--paper)`, `var(--ink)`, `var(--accent)` (terracotta), `var(--accent-ink)`,
`var(--muted)`, `var(--line)`, `var(--positive)`, `var(--warning)`,
`var(--negative)` (each with a `-tint` variant), plus `var(--radius)` and
`var(--shadow-card)`.

## Where the truth lives

Read the bound `styles.css` and the `_ds_bundle.css` it imports for the full
token + utility list before styling. Each component's `<Name>.prompt.md` has its
API and usage examples.

## Idiomatic example

```tsx
const { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction, Badge, Button } = window.Folio;

<Card className="w-[380px]">
  <CardHeader>
    <CardTitle>Maple Street House</CardTitle>
    <CardDescription>Foundation & framing · Phase 2 of 6</CardDescription>
    <CardAction><Badge variant="secondary">On track</Badge></CardAction>
  </CardHeader>
  <CardContent>
    <p style={{ color: "var(--muted)" }}>Concrete pour completed Tuesday.</p>
  </CardContent>
  <CardFooter className="gap-2">
    <Button size="sm">Open journal</Button>
    <Button size="sm" variant="outline">Add note</Button>
  </CardFooter>
</Card>
```
