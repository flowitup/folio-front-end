"use client";

/**
 * InventoryGroups — the rows grouped by where they are, one table per place:
 * warehouses first (with their address), then sites, then rows pointing at a
 * place the client no longer knows. Quantity leads the row; a damaged tool is
 * flagged in red so it is spotted without reading.
 */

import { useTranslations } from "next-intl";
import { Home, MapPin, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InventoryItem } from "@/lib/api/inventory";
import { localizeInventoryCategory, type InventoryLocationGroup } from "@/lib/inventory/inventory";

interface Props {
  groups: InventoryLocationGroup[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}

export function InventoryGroups({ groups, onEdit, onDelete }: Props) {
  const t = useTranslations("inventory");

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const Icon = group.kind === "warehouse" ? Home : MapPin;
        return (
          <section key={group.key} data-testid={`inventory-group-${group.key}`}>
            <div className="mb-2 flex items-center gap-2">
              <Icon size={14} style={{ color: "var(--muted)" }} />
              <div className="min-w-0 flex-1">
                <div className="label-cap">{group.title ?? t("unknownLocation")}</div>
                {group.subtitle && (
                  <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                    {group.subtitle}
                  </div>
                )}
              </div>
              <span className="num text-[12px]" style={{ color: "var(--muted)" }}>
                {t("units", { count: group.quantity })}
              </span>
            </div>
            <div className="folio-card overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-right">{t("fields.quantity")}</TableHead>
                    <TableHead>{t("fields.name")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("fields.category")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("fields.reference")}</TableHead>
                    <TableHead>{t("fields.condition")}</TableHead>
                    <TableHead className="w-24 text-right">
                      <span className="sr-only">{t("actions.rowActions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((item) => (
                    <TableRow key={item.id} data-testid={`inventory-item-${item.id}`}>
                      <TableCell className="num text-right text-[14px]">{item.quantity}</TableCell>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        {item.description && (
                          <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                            {item.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell" style={{ color: "var(--muted)" }}>
                        {localizeInventoryCategory(item.category, t)}
                      </TableCell>
                      <TableCell className="num hidden md:table-cell" style={{ color: "var(--muted)" }}>
                        {item.reference ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`stamp ${item.condition === "damaged" ? "negative" : "positive"}`}
                          data-testid={`inventory-item-${item.id}-condition`}
                        >
                          {t(`condition.${item.condition}`)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("actions.edit")}
                            onClick={() => onEdit(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("actions.delete")}
                            onClick={() => onDelete(item)}
                          >
                            <Trash2 className="h-4 w-4" style={{ color: "var(--negative)" }} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
