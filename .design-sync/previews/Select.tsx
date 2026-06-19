import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "construction-front-end";

export const Trigger = () => (
  <div style={{ display: "grid", gap: 12, width: 220 }}>
    <Select defaultValue="framing">
      <SelectTrigger style={{ width: "100%" }}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Phase</SelectLabel>
          <SelectItem value="groundworks">Groundworks</SelectItem>
          <SelectItem value="framing">Framing</SelectItem>
          <SelectItem value="electrical">Electrical</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
    <Select>
      <SelectTrigger style={{ width: "100%" }}>
        <SelectValue placeholder="Select a status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todo">To do</SelectItem>
        <SelectItem value="progress">In progress</SelectItem>
        <SelectItem value="done">Done</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

export const Sizes = () => (
  <div style={{ display: "grid", gap: 12, width: 220 }}>
    <Select defaultValue="framing">
      <SelectTrigger size="sm" style={{ width: "100%" }}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="framing">Framing</SelectItem>
      </SelectContent>
    </Select>
    <Select disabled defaultValue="framing">
      <SelectTrigger style={{ width: "100%" }}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="framing">Framing</SelectItem>
      </SelectContent>
    </Select>
  </div>
);
