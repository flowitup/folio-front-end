"use client";

/**
 * A dnd-kit sortable row that hands its drag handle to the caller, so postes,
 * articles and rooms all drag by the same grip.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { DragHandle } from "@/components/chiffrage/article-row";

interface Props {
  id: string;
  /** Stops the row from being dragged, e.g. while a move is being saved. */
  disabled?: boolean;
  /** Accessible name for the handle. */
  handleLabel?: string;
  children: (handle: React.ReactNode) => React.ReactNode;
}

export function SortableItem({
  id,
  disabled = false,
  handleLabel,
  children,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      {children(
        <DragHandle {...attributes} {...listeners} aria-label={handleLabel} />,
      )}
    </div>
  );
}
