import { Alert, AlertTitle, AlertDescription } from "construction-front-end";
import { Info, TriangleAlert } from "lucide-react";

export const Default = () => (
  <Alert style={{ maxWidth: 440 }}>
    <Info />
    <AlertTitle>Inspection scheduled</AlertTitle>
    <AlertDescription>
      The framing inspection is booked for Thursday at 9:00 AM. Keep the site
      accessible and have the permit on hand.
    </AlertDescription>
  </Alert>
);

export const Destructive = () => (
  <Alert variant="destructive" style={{ maxWidth: 440 }}>
    <TriangleAlert />
    <AlertTitle>Budget exceeded</AlertTitle>
    <AlertDescription>
      Electrical is 12% over estimate. Review the latest invoices before
      approving any more work on this trade.
    </AlertDescription>
  </Alert>
);
