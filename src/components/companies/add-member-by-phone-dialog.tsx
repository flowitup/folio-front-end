"use client";

/**
 * AddMemberByPhoneDialog — company admin onboards a worker/manager by phone.
 *
 * Handles the 409 "several candidates" response: the backend can't tell
 * which un-linked profile the phone matches, so it returns a candidate list;
 * the dialog switches into a picker step and resends with `personId` set.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addMemberByPhoneAction } from "@/app/[locale]/(app)/settings/_actions/company-settings-actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onAdded: () => void;
}

type Candidate = { person_id: string; name: string };

export function AddMemberByPhoneDialog({ open, onOpenChange, companyId, onAdded }: Props) {
  const t = useTranslations("companySettings.addByPhone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"manager" | "member">("member");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setPhone("");
    setName("");
    setRole("member");
    setCandidates(null);
    setSelectedCandidateId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await addMemberByPhoneAction(companyId, {
        phone: phone.trim(),
        name: name.trim() || undefined,
        role,
        personId: candidates ? selectedCandidateId || undefined : undefined,
      });
      if (result.ok) {
        toast.success(t("addedToast", { name: result.data.name || result.data.phone }));
        reset();
        onOpenChange(false);
        onAdded();
        return;
      }
      if (result.error.code === "multiple_candidates" && result.error.candidates) {
        setCandidates(result.error.candidates);
        return;
      }
      toast.error(result.error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!candidates ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="add-phone-number" aria-required="true">
                  {t("phoneLabel")}
                </Label>
                <Input
                  id="add-phone-number"
                  type="tel"
                  required
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+33 6 12 34 56 78"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-phone-name">{t("nameLabel")}</Label>
                <Input
                  id="add-phone-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  maxLength={255}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-phone-role">{t("roleLabel")}</Label>
                <Select value={role} onValueChange={(v) => setRole(v as "manager" | "member")} disabled={isSubmitting}>
                  <SelectTrigger id="add-phone-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">{t("roleMember")}</SelectItem>
                    <SelectItem value="manager">{t("roleManager")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-[13px]" style={{ color: "var(--muted)" }}>
                {t("candidatesHint")}
              </p>
              <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue placeholder={t("candidatesPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.person_id} value={c.person_id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (candidates !== null && !selectedCandidateId)}
              className="gap-1.5"
            >
              {isSubmitting && <Loader2 aria-hidden="true" className="animate-spin" size={14} />}
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
