"use client";

/**
 * The chantier's rooms, in the order every poste groups its items by.
 *
 * Reorder them by dragging or with the arrows, rename, delete, or add one. The
 * dialog only asks: the page owns the tree and the requests. Every control is
 * disabled while one change is in flight, so two moves computed from the same
 * list can never race each other to the server.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SortableItem } from "@/components/chiffrage/sortable-item";
import type { ChiffrageRoom } from "@/lib/api/chiffrage";

interface Props {
  open: boolean;
  /** The project's rooms, already in display order. */
  rooms: ChiffrageRoom[];
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<boolean>;
  onRename: (room: ChiffrageRoom, name: string) => Promise<boolean>;
  onDelete: (room: ChiffrageRoom) => Promise<boolean>;
  /** Move `roomId` into the slot `overId` holds now. */
  onReorder: (roomId: string, overId: string) => Promise<boolean>;
}

const iconButton = "h-8 w-8 shrink-0 p-0";

export function RoomsDialog({
  open,
  rooms,
  onOpenChange,
  onCreate,
  onRename,
  onDelete,
  onReorder,
}: Props) {
  const t = useTranslations("chiffrage");
  const [pending, setPending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [adding, setAdding] = useState("");

  // Same sensors as the poste and item lists: the distance keeps a click on a
  // row button from starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /** Run one change at a time and report whether it went through. */
  const run = async (fn: () => Promise<boolean>): Promise<boolean> => {
    setPending(true);
    try {
      return await fn();
    } finally {
      setPending(false);
    }
  };

  const move = (roomId: string, overId: string) =>
    void run(() => onReorder(roomId, overId));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(false);
    if (!over || active.id === over.id) return;
    move(String(active.id), String(over.id));
  };

  const saveRename = async (room: ChiffrageRoom) => {
    const name = editing?.name.trim() ?? "";
    if (!name) return;
    if (name === room.name) {
      setEditing(null);
      return;
    }
    if (await run(() => onRename(room, name))) setEditing(null);
  };

  const remove = async (room: ChiffrageRoom) => {
    if (!confirm(t("confirmDeleteRoom", { name: room.name }))) return;
    if ((await run(() => onDelete(room))) && editing?.id === room.id) {
      setEditing(null);
    }
  };

  const add = async () => {
    const name = adding.trim();
    if (!name) return;
    if (await run(() => onCreate(name))) setAdding("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto"
        onEscapeKeyDown={(e) => {
          // Escape cancels the gesture in progress — dnd-kit drops the drag
          // back, a rename is abandoned — rather than closing the whole list.
          if (dragging) e.preventDefault();
          else if (editing) {
            e.preventDefault();
            setEditing(null);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("rooms")}</DialogTitle>
          <DialogDescription>{t("roomsDialogHint")}</DialogDescription>
        </DialogHeader>

        {rooms.length === 0 ? (
          <p
            className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground"
            data-testid="rooms-empty"
          >
            {t("noRoomsYet")}
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={() => setDragging(true)}
            onDragCancel={() => setDragging(false)}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={rooms.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              <ol className="divide-y rounded-md border" aria-busy={pending}>
                {rooms.map((room, index) => (
                  <li key={room.id} data-testid="room-row">
                    <SortableItem
                      id={room.id}
                      disabled={pending || editing !== null}
                      handleLabel={t("dragToReorder")}
                    >
                      {(handle) => (
                        <div className="flex items-center gap-1 bg-background px-2 py-1.5">
                          {handle}
                          {editing?.id === room.id ? (
                            <form
                              className="flex min-w-0 flex-1 items-center gap-1"
                              onSubmit={(e) => {
                                e.preventDefault();
                                void saveRename(room);
                              }}
                            >
                              <Input
                                value={editing.name}
                                maxLength={120}
                                aria-label={t("roomName")}
                                autoFocus
                                disabled={pending}
                                className="h-8"
                                onChange={(e) =>
                                  setEditing({
                                    id: room.id,
                                    name: e.target.value,
                                  })
                                }
                              />
                              <Button
                                type="submit"
                                size="sm"
                                className={iconButton}
                                disabled={pending || !editing.name.trim()}
                                aria-label={t("save")}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={iconButton}
                                disabled={pending}
                                onClick={() => setEditing(null)}
                                aria-label={t("cancel")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </form>
                          ) : (
                            <>
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {room.name}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={iconButton}
                                disabled={pending || index === 0}
                                onClick={() =>
                                  move(room.id, rooms[index - 1].id)
                                }
                                aria-label={t("moveUp")}
                                title={t("moveUp")}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={iconButton}
                                disabled={pending || index === rooms.length - 1}
                                onClick={() =>
                                  move(room.id, rooms[index + 1].id)
                                }
                                aria-label={t("moveDown")}
                                title={t("moveDown")}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={iconButton}
                                disabled={pending}
                                onClick={() =>
                                  setEditing({ id: room.id, name: room.name })
                                }
                                aria-label={t("renameRoom")}
                                title={t("renameRoom")}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={iconButton}
                                disabled={pending}
                                onClick={() => void remove(room)}
                                aria-label={t("deleteRoom")}
                                title={t("deleteRoom")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </SortableItem>
                  </li>
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Input
            value={adding}
            maxLength={120}
            placeholder={t("addRoomPlaceholder")}
            aria-label={t("addRoom")}
            disabled={pending}
            onChange={(e) => setAdding(e.target.value)}
            data-testid="rooms-new"
          />
          <Button
            type="submit"
            className="shrink-0"
            disabled={pending || !adding.trim()}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("add")}
          </Button>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
