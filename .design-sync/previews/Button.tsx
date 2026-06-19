import { Button } from "construction-front-end";
import { Plus, Trash2, Download } from "lucide-react";

export const Variants = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
    <Button>Save changes</Button>
    <Button variant="secondary">Cancel</Button>
    <Button variant="outline">Add photo</Button>
    <Button variant="ghost">Skip for now</Button>
    <Button variant="destructive">Delete project</Button>
    <Button variant="link">View invoice</Button>
  </div>
);

export const Sizes = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
    <Button size="icon" aria-label="Add entry">
      <Plus />
    </Button>
  </div>
);

export const WithIcon = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
    <Button>
      <Plus /> Log a day
    </Button>
    <Button variant="outline">
      <Download /> Export PDF
    </Button>
    <Button variant="destructive">
      <Trash2 /> Remove
    </Button>
  </div>
);

export const Disabled = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
    <Button disabled>Saving…</Button>
    <Button variant="outline" disabled>
      Unavailable
    </Button>
  </div>
);
