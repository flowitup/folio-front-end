"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { takeFlashToast } from "@/lib/flash-toast";

/** Shows the success toast an action queued before a full page load. */
export function FlashToast() {
  useEffect(() => {
    const message = takeFlashToast();
    if (message) toast.success(message);
  }, []);
  return null;
}
