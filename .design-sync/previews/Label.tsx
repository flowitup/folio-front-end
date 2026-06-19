import { Label, Input, Textarea } from "construction-front-end";

export const FieldLabels = () => (
  <div style={{ display: "grid", gap: 16, width: 300 }}>
    <div style={{ display: "grid", gap: 6 }}>
      <Label htmlFor="name">Project name</Label>
      <Input id="name" defaultValue="Maple Street House" />
    </div>
    <div style={{ display: "grid", gap: 6 }}>
      <Label htmlFor="notes">Site notes</Label>
      <Textarea id="notes" placeholder="What happened on site today?" />
    </div>
  </div>
);
