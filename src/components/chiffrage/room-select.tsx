"use client";

/**
 * Pick which room of the chantier an item is for, adding one inline when it is
 * not declared yet. Rooms are project-level, so the same list serves every
 * poste — a new room added here shows up under Peinture and Sol too.
 */

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ChiffrageRoom } from "@/lib/api/chiffrage";

/** Texts of the picker, so the same control can pick a stage (giai đoạn). */
export interface NamedSelectLabels {
  none: string;
  addPlaceholder: string;
  add: string;
}

interface Props {
  /** The trigger's id, so the field's <Label htmlFor> focuses it. */
  id?: string;
  /** The field label's id: the trigger is named by it plus the shown room. */
  labelledBy?: string;
  value: string | null;
  rooms: ChiffrageRoom[];
  onChange: (roomId: string | null) => void;
  onCreateRoom: (name: string) => Promise<ChiffrageRoom | null>;
  /** Defaults to the room texts. */
  labels?: NamedSelectLabels;
  /** Prefix of the test ids; "room-select" by default. */
  testId?: string;
}

export function RoomSelect({
  id,
  labelledBy,
  value,
  rooms,
  onChange,
  onCreateRoom,
  labels,
  testId = "room-select",
}: Props) {
  const t = useTranslations("chiffrage");
  const text = labels ?? {
    none: t("noRoom"),
    addPlaceholder: t("addRoomPlaceholder"),
    add: t("addRoom"),
  };
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const valueId = useId();

  const selected = rooms.find((r) => r.id === value) ?? null;

  const add = async () => {
    const name = adding.trim();
    if (!name) return;
    setBusy(true);
    const created = await onCreateRoom(name);
    setBusy(false);
    if (created) {
      setAdding("");
      onChange(created.id);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
          className="w-full justify-between font-normal"
          data-testid={`${testId}-trigger`}
        >
          <span id={valueId} className={selected ? "" : "text-muted-foreground"}>
            {selected ? selected.name : text.none}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-1"
        align="start"
      >
        <div className="max-h-56 overflow-y-auto">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <span className="text-muted-foreground">{text.none}</span>
            {value === null ? <Check className="h-4 w-4" /> : null}
          </button>
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => {
                onChange(room.id);
                setOpen(false);
              }}
            >
              <span>{room.name}</span>
              {value === room.id ? <Check className="h-4 w-4" /> : null}
            </button>
          ))}
        </div>

        <div className="mt-1 border-t pt-1">
          <div className="flex gap-1">
            <Input
              value={adding}
              maxLength={120}
              placeholder={text.addPlaceholder}
              onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add();
                }
              }}
              className="h-8"
              data-testid={`${testId}-new`}
            />
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0"
              disabled={busy || !adding.trim()}
              onClick={() => void add()}
              aria-label={text.add}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
