"use client";

/**
 * WarehousesDialog — manage the company's warehouses in one place: the list
 * with each one's address and the units it holds, an inline form to add or
 * rename one, and delete with a confirmation. The server refuses to delete a
 * warehouse that still holds rows (409); the dialog says so up front.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Home, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  createWarehouseAction,
  deleteWarehouseAction,
  updateWarehouseAction,
} from "@/app/[locale]/(app)/inventory/_actions/inventory-actions";
import type { UpdateWarehousePayload, Warehouse } from "@/lib/api/inventory";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  warehouses: Warehouse[];
  /** Units per warehouse id, from the current inventory. */
  unitsByWarehouse: Map<string, number>;
  onChanged: () => void | Promise<void>;
}

export function WarehousesDialog({ open, onOpenChange, companyId, warehouses, unitsByWarehouse, onChanged }: Props) {
  const t = useTranslations("inventory.warehouses");
  const tInv = useTranslations("inventory");

  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Warehouse | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormOpen(warehouses.length === 0);
    setEditing(null);
    setName("");
    setAddress("");
    setError(null);
    setConfirmDelete(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setName("");
    setAddress("");
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (w: Warehouse) => {
    setEditing(w);
    setName(w.name);
    setAddress(w.address ?? "");
    setError(null);
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return setError(t("validation.nameRequired"));
    const trimmedAddress = address.trim() || null;
    setBusy("form");
    setError(null);
    if (editing) {
      const diff: UpdateWarehousePayload = {};
      if (trimmedName !== editing.name) diff.name = trimmedName;
      if (trimmedAddress !== editing.address) diff.address = trimmedAddress;
      if (Object.keys(diff).length > 0) {
        const result = await updateWarehouseAction(editing.id, diff);
        if (!result.ok) {
          setError(result.error);
          toast.error(result.code === "Forbidden" ? tInv("toast.forbidden") : t("toast.updateError"));
          setBusy(null);
          return;
        }
        toast.success(t("toast.updated"));
        await onChanged();
      }
    } else {
      const result = await createWarehouseAction(companyId, { name: trimmedName, address: trimmedAddress });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.code === "Forbidden" ? tInv("toast.forbidden") : t("toast.createError"));
        setBusy(null);
        return;
      }
      toast.success(t("toast.created"));
      await onChanged();
    }
    setBusy(null);
    setFormOpen(false);
    setEditing(null);
    setName("");
    setAddress("");
  };

  const remove = async (w: Warehouse) => {
    setBusy(w.id);
    setError(null);
    const result = await deleteWarehouseAction(w.id);
    if (!result.ok) {
      setError(result.error);
      toast.error(
        result.code === "Forbidden"
          ? tInv("toast.forbidden")
          : result.code === "Conflict"
            ? t("deleteBlocked", { count: unitsByWarehouse.get(w.id) ?? 0 })
            : t("toast.deleteError")
      );
      setBusy(null);
      setConfirmDelete(null);
      return;
    }
    toast.success(t("toast.deleted"));
    await onChanged();
    setBusy(null);
    setConfirmDelete(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        {warehouses.length === 0 && !formOpen && (
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            {t("empty")}
          </p>
        )}

        {warehouses.length > 0 && (
          <ul className="folio-card divide-y p-0" style={{ borderColor: "var(--line)" }}>
            {warehouses.map((w) => {
              const held = unitsByWarehouse.get(w.id) ?? 0;
              const confirming = confirmDelete?.id === w.id;
              return (
                <li key={w.id} className="flex items-center gap-3 px-3 py-2.5" data-testid={`warehouse-${w.id}`}>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "var(--paper-2)" }}
                  >
                    <Home size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{w.name}</div>
                    <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                      {w.address ?? t("noAddress")}
                    </div>
                  </div>
                  <span className="num shrink-0 text-[12px]" style={{ color: "var(--muted)" }}>
                    {tInv("units", { count: held })}
                  </span>
                  {confirming ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)} disabled={busy === w.id}>
                        {tInv("actions.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => remove(w)}
                        disabled={busy === w.id}
                        style={{ background: "var(--negative)", color: "white" }}
                      >
                        {busy === w.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        {tInv("actions.delete")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon" aria-label={t("edit")} onClick={() => openEdit(w)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("delete")}
                        onClick={() => {
                          setError(held > 0 ? t("deleteBlocked", { count: held }) : null);
                          setConfirmDelete(w);
                        }}
                      >
                        <Trash2 className="h-4 w-4" style={{ color: "var(--negative)" }} />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {formOpen ? (
          <form onSubmit={submit} className="space-y-3 pt-1">
            <div className="label-cap">{editing ? t("editTitle") : t("createTitle")}</div>
            <div className="space-y-2">
              <Label htmlFor="warehouse-name">{t("fields.name")}</Label>
              <Input
                id="warehouse-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("fields.namePlaceholder")}
                maxLength={120}
                required
                autoFocus
                disabled={busy === "form"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse-address">{t("fields.address")}</Label>
              <Input
                id="warehouse-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("fields.addressPlaceholder")}
                maxLength={500}
                disabled={busy === "form"}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              {warehouses.length > 0 && (
                <Button type="button" variant="ghost" onClick={() => setFormOpen(false)} disabled={busy === "form"}>
                  {tInv("actions.cancel")}
                </Button>
              )}
              <Button type="submit" disabled={busy === "form" || !name.trim()}>
                {busy === "form" && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? tInv("actions.save") : t("add")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button type="button" size="sm" className="gap-1.5" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {t("add")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
