import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  Label,
  Input,
} from "construction-front-end";

export const EditBudget = () => (
  <Popover open>
    <PopoverTrigger asChild>
      <Button variant="outline">Edit budget</Button>
    </PopoverTrigger>
    <PopoverContent align="start">
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Phase budget</div>
        <div style={{ display: "grid", gap: 6 }}>
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" defaultValue="€42,000" />
        </div>
        <Button size="sm">Save</Button>
      </div>
    </PopoverContent>
  </Popover>
);
