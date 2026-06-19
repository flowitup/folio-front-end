// design-sync bundle entry. Re-exports the 16 shadcn/ui primitives (and their
// sub-components) from src/components/ui so esbuild produces one IIFE exposing
// every export on window.Folio. Narrow on purpose: re-exporting the whole app
// (synth-entry default) would pull in server components, next/navigation, and
// data fetching, none of which bundle for a static preview.
export * from "@/components/ui/alert";
export * from "@/components/ui/alert-dialog";
export * from "@/components/ui/badge";
export * from "@/components/ui/button";
export * from "@/components/ui/card";
export * from "@/components/ui/combobox";
export * from "@/components/ui/command";
export * from "@/components/ui/dialog";
export * from "@/components/ui/dropdown-menu";
export * from "@/components/ui/input";
export * from "@/components/ui/label";
export * from "@/components/ui/popover";
export * from "@/components/ui/select";
export * from "@/components/ui/sonner";
export * from "@/components/ui/table";
export * from "@/components/ui/textarea";
