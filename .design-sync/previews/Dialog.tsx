import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Label,
  Input,
} from "construction-front-end";

export const NewProject = () => (
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
        <DialogDescription>
          Start a build journal for a new house or renovation.
        </DialogDescription>
      </DialogHeader>
      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="pname">Project name</Label>
        <Input id="pname" placeholder="e.g. Maple Street House" />
      </div>
      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button>Create project</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
