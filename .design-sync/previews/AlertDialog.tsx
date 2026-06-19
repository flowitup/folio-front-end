import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "construction-front-end";

export const ConfirmDelete = () => (
  <AlertDialog open>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this project?</AlertDialogTitle>
        <AlertDialogDescription>
          This permanently removes the build journal, photos, and invoices for
          Maple Street House. This can&rsquo;t be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction variant="destructive">Delete project</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
