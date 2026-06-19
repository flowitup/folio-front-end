import { Combobox } from "construction-front-end";

const trades = [
  { value: "groundworks", label: "Groundworks" },
  { value: "framing", label: "Framing", meta: "Phase 2" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
];

const field: React.CSSProperties = {
  border: "1px solid var(--line-2)",
  borderRadius: 10,
  padding: "8px 12px",
  width: 240,
  background: "var(--card-paper)",
};

export const Selected = () => (
  <div style={field}>
    <Combobox value="framing" onChange={() => {}} options={trades} placeholder="Select a trade" />
  </div>
);

export const Placeholder = () => (
  <div style={field}>
    <Combobox value="" onChange={() => {}} options={trades} placeholder="Select a trade" />
  </div>
);

export const Loading = () => (
  <div style={field}>
    <Combobox value="" onChange={() => {}} options={[]} loading placeholder="Loading trades…" />
  </div>
);

export const Disabled = () => (
  <div style={{ ...field, opacity: 0.6 }}>
    <Combobox value="electrical" onChange={() => {}} options={trades} disabled />
  </div>
);
