import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  Button,
} from "construction-front-end";
import { Pencil, Copy, Share2, Trash2 } from "lucide-react";

export const Actions = () => (
  <DropdownMenu open>
    <DropdownMenuTrigger asChild>
      <Button variant="outline">Actions</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" sideOffset={6}>
      <DropdownMenuLabel>Project</DropdownMenuLabel>
      <DropdownMenuItem>
        <Pencil /> Edit details
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Copy /> Duplicate
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Share2 /> Share
        <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive">
        <Trash2 /> Delete project
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
