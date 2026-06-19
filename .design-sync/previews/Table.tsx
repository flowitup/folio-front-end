import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  Badge,
} from "construction-front-end";

const rows = [
  ["Concrete — foundation", "Groundworks", "Paid", "secondary", "€12,400"],
  ["Timber framing package", "Framing", "Approved", "secondary", "€9,250"],
  ["Rough-in wiring", "Electrical", "Pending", "outline", "€4,100"],
  ["Window units (×8)", "Supply", "Overdue", "destructive", "€3,150"],
] as const;

export const InvoiceLines = () => (
  <div style={{ width: "100%", maxWidth: 700 }}>
    <Table>
      <TableCaption>Invoices · Maple Street House · Phase 2</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Trade</TableHead>
          <TableHead>Status</TableHead>
          <TableHead style={{ textAlign: "right" }}>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([item, trade, status, variant, amount]) => (
          <TableRow key={item}>
            <TableCell style={{ fontWeight: 500 }}>{item}</TableCell>
            <TableCell style={{ color: "var(--muted)" }}>{trade}</TableCell>
            <TableCell>
              <Badge variant={variant as "secondary" | "outline" | "destructive"}>
                {status}
              </Badge>
            </TableCell>
            <TableCell className="num" style={{ textAlign: "right" }}>
              {amount}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total outstanding</TableCell>
          <TableCell className="num" style={{ textAlign: "right" }}>
            €28,900
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  </div>
);
