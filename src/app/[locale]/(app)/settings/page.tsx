"use client";

import { useTranslations } from "next-intl";
import { User, Bell, Building } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-5">
        {/* Profile Settings */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-accent p-1.5">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">{t("profile")}</CardTitle>
                <CardDescription className="text-xs">
                  {t("profileDesc")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <div className="flex items-center justify-center rounded-lg bg-muted py-6">
              <p className="text-sm text-muted-foreground">
                {t("profile")} {t("comingSoon")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-accent p-1.5">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">{t("notifications")}</CardTitle>
                <CardDescription className="text-xs">
                  {t("notificationsDesc")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <div className="flex items-center justify-center rounded-lg bg-muted py-6">
              <p className="text-sm text-muted-foreground">
                {t("notifications")} {t("comingSoon")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Organization Settings */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-amber-50 p-1.5 dark:bg-amber-950">
                <Building className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-sm">{t("organization")}</CardTitle>
                <CardDescription className="text-xs">
                  {t("organizationDesc")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <div className="flex items-center justify-center rounded-lg bg-muted py-6">
              <p className="text-sm text-muted-foreground">
                {t("organization")} {t("comingSoon")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
