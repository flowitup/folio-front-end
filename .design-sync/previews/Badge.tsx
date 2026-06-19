import { Badge } from "construction-front-end";
import { Check, Clock, TriangleAlert } from "lucide-react";

export const Variants = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
    <Badge>Default</Badge>
    <Badge variant="secondary">Secondary</Badge>
    <Badge variant="destructive">Destructive</Badge>
    <Badge variant="outline">Outline</Badge>
    <Badge variant="ghost">Ghost</Badge>
    <Badge variant="link">Link</Badge>
  </div>
);

export const StatusWithIcons = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
    <Badge variant="secondary">
      <Check /> Approved
    </Badge>
    <Badge variant="outline">
      <Clock /> Pending
    </Badge>
    <Badge variant="destructive">
      <TriangleAlert /> Overdue
    </Badge>
  </div>
);
