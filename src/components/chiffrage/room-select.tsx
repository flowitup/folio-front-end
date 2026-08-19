"use client";

/**
 * Pick which room of the chantier an item is for, adding one inline when it is
 * not declared yet. Rooms are project-level, so the same list serves every
 * poste — a new room added here shows up under Peinture and Sol too.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ChiffrageRoom } from "@/lib/api/chiffrage";

interface Props {
  value: string | null;
  rooms: ChiffrageRoom[];
  onChange: (roomId: string | null) => void;
  onCreateRoom: (name: string) => Promise<ChiffrageRoom | null>;
}

export function RoomSelect({ value, rooms, onChange, onCreateRoom }: Props) {
  const t = useTranslations("chiffrage");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);

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
          type="button"
          variant="outline"
          className="w-full justify-between font-normal"
          data-testid="room-select-trigger"
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected ? selected.name : t("noRoom")}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
        <div className="max-h-56 overflow-y-auto">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <span className="text-muted-foreground">{t("noRoom")}</span>
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
              placeholder={t("addRoomPlaceholder")}
              onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add();
                }
              }}
              className="h-8"
              data-testid="room-select-new"
            />
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0"
              disabled={busy || !adding.trim()}
              onClick={() => void add()}
              aria-label={t("addRoom")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
