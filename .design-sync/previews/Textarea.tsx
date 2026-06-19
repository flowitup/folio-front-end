import { Textarea } from "construction-front-end";

export const Default = () => (
  <div style={{ width: 320 }}>
    <Textarea placeholder="What happened on site today?" />
  </div>
);

export const WithValue = () => (
  <div style={{ width: 320 }}>
    <Textarea
      rows={4}
      defaultValue={
        "Framing crew finished the second floor. Windows arrive Thursday — confirm the crane booking with the supplier."
      }
    />
  </div>
);

export const Disabled = () => (
  <div style={{ width: 320 }}>
    <Textarea placeholder="Read-only log entry" disabled />
  </div>
);
