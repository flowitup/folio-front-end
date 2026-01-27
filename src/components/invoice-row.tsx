import React from "react";
import { BadgeSuccess } from "./badge-success";

interface InvoiceRowProps {
  invoiceId?: string;
  project?: string;
  client?: string;
  date?: string;
  amount?: string;
  status?: string;
}

export function InvoiceRow({
  invoiceId = "INV-2024-0042",
  project = "riverside_tower",
  client = "Apex Developers Inc.",
  date = "2024-01-10",
  amount = "$24,500.00",
  status = "paid",
}: InvoiceRowProps) {
  return (
    <div
      className="flex w-[700px] items-center py-3"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      {/* Cell 1: Invoice ID and Project */}
      <div className="flex w-[140px] flex-col items-center gap-0.5">
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--text-primary)' }}
        >
          {invoiceId}
        </span>
        <span
          className="text-[10px]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {project}
        </span>
      </div>

      {/* Cell 2: Client Name */}
      <div className="flex flex-1 items-center">
        <span
          className="text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          {client}
        </span>
      </div>

      {/* Cell 3: Date */}
      <div className="flex w-[100px] items-center">
        <span
          className="text-[11px]"
          style={{ color: 'var(--text-secondary)' }}
        >
          {date}
        </span>
      </div>

      {/* Cell 4: Amount */}
      <div className="flex w-[120px] items-center">
        <span
          className="text-xs font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {amount}
        </span>
      </div>

      {/* Cell 5: Status Badge */}
      <div className="flex w-[100px] items-center justify-center">
        <BadgeSuccess content={status} />
      </div>
    </div>
  );
}
