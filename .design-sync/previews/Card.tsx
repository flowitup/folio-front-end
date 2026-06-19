import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
  Button,
  Badge,
} from "construction-front-end";

export const ProjectSummary = () => (
  <Card style={{ width: 380 }}>
    <CardHeader>
      <CardTitle>Maple Street House</CardTitle>
      <CardDescription>Foundation &amp; framing · Phase 2 of 6</CardDescription>
      <CardAction>
        <Badge variant="secondary">On track</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
        Concrete pour completed Tuesday. Framing crew starts Monday; lumber
        delivery is confirmed for the 14th.
      </p>
    </CardContent>
    <CardFooter style={{ gap: 8 }}>
      <Button size="sm">Open journal</Button>
      <Button size="sm" variant="outline">
        Add note
      </Button>
    </CardFooter>
  </Card>
);

export const StatCard = () => (
  <Card style={{ width: 260 }}>
    <CardHeader>
      <CardDescription>Spent this month</CardDescription>
      <CardTitle style={{ fontSize: 28 }} className="num">
        €18,240
      </CardTitle>
    </CardHeader>
    <CardContent>
      <span style={{ color: "var(--positive)", fontSize: 13, fontWeight: 500 }}>
        €3,100 under budget
      </span>
    </CardContent>
  </Card>
);
