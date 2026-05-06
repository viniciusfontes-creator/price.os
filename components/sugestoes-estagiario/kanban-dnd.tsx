"use client"

import { ReactNode } from "react"
import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core"
import { cn } from "@/lib/utils"

export function DraggableCard({
  id,
  disabled,
  children,
}: {
  id: string | number
  disabled?: boolean
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: String(id),
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "transition-opacity touch-none",
        isDragging && "opacity-40",
        !disabled && "cursor-grab active:cursor-grabbing",
      )}
    >
      {children}
    </div>
  )
}

export function DroppableColumn({
  id,
  disabled,
  children,
}: {
  id: string
  disabled?: boolean
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg transition-colors h-full",
        isOver && !disabled && "ring-2 ring-primary ring-offset-1",
        isOver && disabled && "ring-2 ring-rose-300 ring-offset-1",
      )}
    >
      {children}
    </div>
  )
}

export function KanbanDnDProvider({
  children,
  onDrop,
}: {
  children: ReactNode
  onDrop: (cardId: string, columnId: string) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )
  return (
    <DndContext
      sensors={sensors}
      onDragEnd={(e: DragEndEvent) => {
        if (e.over) onDrop(String(e.active.id), String(e.over.id))
      }}
    >
      {children}
      <DragOverlay />
    </DndContext>
  )
}
