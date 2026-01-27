import { Badge } from "@/components/ui/badge";

interface BadgeSuccessProps {
  content?: string;
}

export function BadgeSuccess({ content = "complete" }: BadgeSuccessProps) {
  return (
    <Badge
      variant="outline"
      className="border-green-200 bg-green-50 text-green-600 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
    >
      {content}
    </Badge>
  );
}
