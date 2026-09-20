"use client";

/**
 * InventoryItemDialog — create or edit one inventory row: what it is, how
 * many, working or damaged, and where it is (one of the company's warehouses
 * or one of its sites). Edit sends a diff-only PATCH; a location change also
 * sends the id of the new place and null for the other one.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createInventoryItemAction,
  updateInventoryItemAction,
} from "@/app/[locale]/(app)/inventory/_actions/inventory-actions";
import {
  INVENTORY_CATEGORY_SLUGS,
  isInventoryCategorySlug,
  localizeInventoryCategory,
  parseQuantity,
  type SiteRef,
} from "@/lib/inventory/inventory";
import type {
  CreateInventoryItemPayload,
  InventoryCondition,
  InventoryItem,
  InventoryLocationType,
  UpdateInventoryItemPayload,
  Warehouse,
} from "@/lib/api/inventory";

// shadcn Select does not allow value="" for an item, so "no category" is a sentinel.
const NO_CATEGORY = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  /** Null creates a new row; a row edits it. */
  item: InventoryItem | null;
  warehouses: Warehouse[];
  sites: SiteRef[];
  onSaved: (item: InventoryItem) => void | Promise<void>;
}

const orNull = (value: string) => value.trim() || null;

export function InventoryItemDialog({ open, onOpenChange, companyId, item, warehouses, sites, onSaved }: Props) {
  const t = useTranslations("inventory");
  const editing = item !== null;

  const [name, setName] = useState("");
  const [category, setCategory] = useState(NO_CATEGORY);
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState<InventoryCondition>("working");
  const [locationType, setLocationType] = useState<InventoryLocationType>("warehouse");
  const [warehouseId, setWarehouseId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from the row (edit) or reset (create) whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(item?.name ?? "");
    setCategory(item?.category ?? NO_CATEGORY);
    setQuantity(item ? String(item.quantity) : "1");
    setCondition(item?.condition ?? "working");
    setLocationType(item?.location_type ?? (warehouses.length > 0 ? "warehouse" : "site"));
    setWarehouseId(item?.warehouse_id ?? warehouses[0]?.id ?? "");
    setProjectId(item?.project_id ?? sites[0]?.id ?? "");
    setReference(item?.reference ?? "");
    setDescription(item?.description ?? "");
    setError(null);
    setIsSubmitting(false);
  }, [open, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = (isOpen: boolean) => {
    if (!isSubmitting) onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const parsedQuantity = parseQuantity(quantity);
    if (!trimmedName) return setError(t("validation.nameRequired"));
    if (parsedQuantity === null) return setError(t("validation.quantityInvalid"));
    if (locationType === "warehouse" && !warehouseId)
      return setError(warehouses.length ? t("validation.warehouseRequired") : t("validation.noWarehouseYet"));
    if (locationType === "site" && !projectId) return setError(t("validation.siteRequired"));

    const payload: CreateInventoryItemPayload = {
      name: trimmedName,
      category: isInventoryCategorySlug(category) ? category : null,
      reference: orNull(reference),
      description: orNull(description),
      quantity: parsedQuantity,
      condition,
      location_type: locationType,
      warehouse_id: locationType === "warehouse" ? warehouseId : null,
      project_id: locationType === "site" ? projectId : null,
    };

    setIsSubmitting(true);
    setError(null);

    if (!item) {
      const result = await createInventoryItemAction(companyId, payload);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.code === "Forbidden" ? t("toast.forbidden") : t("toast.createError"));
        setIsSubmitting(false);
        return;
      }
      toast.success(t("toast.created"));
      await onSaved(result.data);
      onOpenChange(false);
      return;
    }

    const diff: UpdateInventoryItemPayload = {};
    if (payload.name !== item.name) diff.name = payload.name;
    if (payload.category !== item.category) diff.category = payload.category;
    if (payload.reference !== item.reference) diff.reference = payload.reference;
    if (payload.description !== item.description) diff.description = payload.description;
    if (payload.quantity !== item.quantity) diff.quantity = payload.quantity;
    if (payload.condition !== item.condition) diff.condition = payload.condition;
    if (
      payload.location_type !== item.location_type ||
      payload.warehouse_id !== item.warehouse_id ||
      payload.project_id !== item.project_id
    ) {
      diff.location_type = payload.location_type;
      diff.warehouse_id = payload.warehouse_id;
      diff.project_id = payload.project_id;
    }
    if (Object.keys(diff).length === 0) {
      onOpenChange(false);
      return;
    }
    const result = await updateInventoryItemAction(item.id, diff);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.code === "Forbidden" ? t("toast.forbidden") : t("toast.updateError"));
      setIsSubmitting(false);
      return;
    }
    toast.success(t("toast.updated"));
    await onSaved(result.data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("createTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="inventory-item-name">{t("fields.name")}</Label>
            <Input
              id="inventory-item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("fields.namePlaceholder")}
              maxLength={200}
              required
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("fields.category")}</Label>
              <Select value={category} onValueChange={setCategory} disabled={isSubmitting}>
                <SelectTrigger className="w-full" aria-label={t("fields.category")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>{t("uncategorized")}</SelectItem>
                  {INVENTORY_CATEGORY_SLUGS.map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {localizeInventoryCategory(slug, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventory-item-quantity">{t("fields.quantity")}</Label>
              <Input
                id="inventory-item-quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputMode="numeric"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("fields.condition")}</Label>
              <div className="flex gap-2" role="group" aria-label={t("fields.condition")}>
                {(["working", "damaged"] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={condition === value ? "default" : "outline"}
                    aria-pressed={condition === value}
                    onClick={() => setCondition(value)}
                    disabled={isSubmitting}
                  >
                    {t(`condition.${value}`)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("fields.location")}</Label>
              <div className="flex gap-2" role="group" aria-label={t("fields.location")}>
                {(["warehouse", "site"] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={locationType === value ? "default" : "outline"}
                    aria-pressed={locationType === value}
                    onClick={() => setLocationType(value)}
                    disabled={isSubmitting}
                  >
                    {t(`location.${value}`)}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {locationType === "warehouse" ? (
            warehouses.length > 0 ? (
              <div className="space-y-2">
                <Label>{t("fields.warehouse")}</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId} disabled={isSubmitting}>
                  <SelectTrigger className="w-full" aria-label={t("fields.warehouse")}>
                    <SelectValue placeholder={t("fields.warehousePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                        {w.address ? ` — ${w.address}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-[12px]" style={{ color: "var(--negative)" }}>
                {t("validation.noWarehouseYet")}
              </p>
            )
          ) : (
            <div className="space-y-2">
              <Label>{t("fields.site")}</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={isSubmitting}>
                <SelectTrigger className="w-full" aria-label={t("fields.site")}>
                  <SelectValue placeholder={t("fields.sitePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.address ? ` — ${s.address}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="inventory-item-reference">{t("fields.reference")}</Label>
            <Input
              id="inventory-item-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={120}
              disabled={isSubmitting}
            />
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              {t("fields.referenceHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inventory-item-description">{t("fields.description")}</Label>
            <Textarea
              id="inventory-item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => handleClose(false)} disabled={isSubmitting}>
              {t("actions.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? t("actions.save") : t("actions.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
