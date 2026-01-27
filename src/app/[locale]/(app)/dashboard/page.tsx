"use client";

import { useTranslations } from "next-intl";
import { FolderOpen, ClipboardList, Users, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("welcome")}</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* Active Projects Card */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("activeProjects")}
            </CardTitle>
            <div className="rounded-md bg-accent p-1.5">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight">--</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("awaitingData")}
            </p>
          </CardContent>
        </Card>

        {/* Pending Tasks Card */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("pendingTasks")}
            </CardTitle>
            <div className="rounded-md bg-amber-50 p-1.5 dark:bg-amber-950">
              <ClipboardList className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight">--</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("awaitingData")}
            </p>
          </CardContent>
        </Card>

        {/* Team Members Card */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("teamMembers")}
            </CardTitle>
            <div className="rounded-md bg-accent p-1.5">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight">--</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("awaitingData")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center rounded-lg bg-muted py-10">
            <div className="text-center">
              <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {t("noActivity")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
