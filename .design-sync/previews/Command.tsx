import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "construction-front-end";
import { Plus, Receipt, Users, Hammer, FileText } from "lucide-react";

export const Palette = () => (
  <div
    style={{
      width: 360,
      border: "1px solid var(--line)",
      borderRadius: 12,
      boxShadow: "var(--shadow-card)",
      overflow: "hidden",
      background: "var(--card-paper)",
    }}
  >
    <Command>
      <CommandInput placeholder="Search or jump to…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick actions">
          <CommandItem>
            <Plus /> Log a day
          </CommandItem>
          <CommandItem>
            <Receipt /> Add invoice
          </CommandItem>
          <CommandItem>
            <Users /> Invite a worker
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Projects">
          <CommandItem>
            <Hammer /> Maple Street House
          </CommandItem>
          <CommandItem>
            <FileText /> Lakeside Cabin
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </div>
);
