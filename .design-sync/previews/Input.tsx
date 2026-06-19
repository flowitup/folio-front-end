import { Input, Label } from "construction-front-end";

export const Default = () => (
  <div style={{ display: "grid", gap: 12, width: 280 }}>
    <Input placeholder="Search projects…" />
    <Input defaultValue="Maple Street House" />
    <Input type="email" placeholder="you@example.com" />
  </div>
);

export const WithLabel = () => (
  <div style={{ display: "grid", gap: 6, width: 280 }}>
    <Label htmlFor="budget">Project budget</Label>
    <Input id="budget" type="text" defaultValue="€240,000" />
  </div>
);

export const States = () => (
  <div style={{ display: "grid", gap: 12, width: 280 }}>
    <Input placeholder="Disabled field" disabled />
    <Input defaultValue="Invalid value" aria-invalid />
  </div>
);
