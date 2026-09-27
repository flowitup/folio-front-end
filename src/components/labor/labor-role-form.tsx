"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleColorPicker } from "@/app/[locale]/(app)/projects/[id]/labor/components/role-color-picker";

const DEFAULT_COLOR = "#7C3AED";

interface LaborRoleFormProps {
  palette: string[];
  initialName?: string;
  initialColor?: string;
  submitLabel: string;
  submitting: boolean;
  /** Server-side failure to show under the fields. */
  error: string | null;
  onSubmit: (values: { name: string; color: string }) => void;
  onCancel: () => void;
  /** Rendered at the end of the button row — the delete button when editing. */
  extraAction?: React.ReactNode;
}

/**
 * Name + color form shared by every labor-role editor: create and edit in the
 * role picker, create and edit in Settings › Company › Labor roles.
 *
 * Deliberately not a <form>: the picker renders it inside the add-worker
 * dialog's own form (portaled, but React still bubbles submit through the
 * portal), so Enter is handled on the input instead.
 *
 * The parent keys this component by the role being edited: name and color are
 * seeded from the props once.
 */
export function LaborRoleForm({
  palette,
  initialName = "",
  initialColor,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onCancel,
  extraAction,
}: LaborRoleFormProps) {
  const t = useTranslations("labor.role");
  const nameId = React.useId();
  const startColor = initialColor ?? palette[0] ?? DEFAULT_COLOR;
  const [name, setName] = React.useState(initialName);
  const [color, setColor] = React.useState(startColor);
  const [nameError, setNameError] = React.useState<string | null>(null);

  // A role may carry a color that is not (or no longer) in the suggested
  // palette; keep it selectable so opening the editor does not silently
  // swap it for the first swatch.
  const colors = React.useMemo(() => {
    const base = palette.length > 0 ? palette : [DEFAULT_COLOR];
    return base.some((c) => c.toLowerCase() === startColor.toLowerCase())
      ? base
      : [...base, startColor];
  }, [palette, startColor]);

  function submit() {
    if (submitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t("nameRequired"));
      return;
    }
    setNameError(null);
    onSubmit({ name: trimmed, color });
  }

  const shownError = nameError ?? error;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={nameId} className="text-xs">
          {t("roleName")}
        </Label>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(null);
          }}
          placeholder={t("roleName")}
          className="h-8 text-sm"
          maxLength={100}
          autoFocus
          aria-invalid={shownError ? true : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t("roleColor")}</Label>
        <RoleColorPicker palette={colors} value={color} onChange={setColor} />
      </div>
      {shownError && (
        <p role="alert" className="text-destructive text-xs">
          {shownError}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={submitting || !name.trim()}
          className="flex-1"
        >
          {submitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          {submitLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
        >
          {t("cancel")}
        </Button>
        {extraAction}
      </div>
    </div>
  );
}
