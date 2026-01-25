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
    <div className="flex w-[700px] items-center border-b-[1px] border-[#1F1F1F] py-[12px]">
      {/* Cell 1: Invoice ID and Project */}
      <div className="flex w-[140px] flex-col items-center gap-[2px]">
        <span className="font-jetbrains text-[12px] font-medium text-[#E5E5E5]">
          {invoiceId}
        </span>
        <span className="font-jetbrains text-[10px] font-normal text-[#525252]">
          {project}
        </span>
      </div>

      {/* Cell 2: Client Name */}
      <div className="flex flex-1 items-center">
        <span className="font-jetbrains text-[12px] font-normal text-[#737373]">
          {client}
        </span>
      </div>

      {/* Cell 3: Date */}
      <div className="flex w-[100px] items-center">
        <span className="font-jetbrains text-[11px] font-normal text-[#737373]">
          {date}
        </span>
      </div>

      {/* Cell 4: Amount */}
      <div className="flex w-[120px] items-center">
        <span className="font-jetbrains text-[12px] font-semibold text-[#E5E5E5]">
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
