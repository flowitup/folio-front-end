"use client";

/**
 * The room divider inside a poste, with what that room costs.
 *
 * The figures come straight from the backend's room_subtotals — recomputing
 * them here would risk the rooms not adding up to the poste total the user is
 * reading two lines above.
 */

import { useTranslations } from "next-intl";
import { DoorOpen } from "lucide-react";

import { money } from "@/components/chiffrage/format";
import type { ChiffrageRoomSubtotal } from "@/lib/api/chiffrage";

interface Props {
  name: string | null;
  subtotal: ChiffrageRoomSubtotal | undefined;
}

export function RoomHeading({ name, subtotal }: Props) {
  const t = useTranslations("chiffrage");

  return (
    <div
      className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5"
      data-testid="room-heading"
    >
      <DoorOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {name ?? t("noRoom")}
      </span>
      {subtotal ? (
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
          {money(subtotal.subtotal_ht)}
        </span>
      ) : null}
    </div>
  );
}
