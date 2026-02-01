"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchUsers, addUserToProject } from "@/lib/api/projects";

interface AddMemberDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded: () => void;
}

interface SearchResult {
  id: string;
  email: string;
}

export function AddMemberDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
  onMemberAdded,
}: AddMemberDialogProps) {
  const t = useTranslations("projects");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (value: string) => {
    setQuery(value);
    setError(null);

    if (value.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await searchUsers(value);
      setResults(response.users);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleAddMember = async (userId: string) => {
    setIsAdding(userId);
    setError(null);

    try {
      await addUserToProject(projectId, userId);
      onMemberAdded();
      onOpenChange(false);
      setQuery("");
      setResults([]);
    } catch {
      setError(t("addMemberError"));
    } finally {
      setIsAdding(null);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setError(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addMemberTo", { project: projectName })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("searchUserPlaceholder")}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Search Results */}
          <div className="max-h-60 overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : results.length > 0 ? (
              <ul className="space-y-1">
                {results.map((user) => (
                  <li
                    key={user.id}
                    className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {user.email.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm">{user.email}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isAdding !== null}
                      onClick={() => handleAddMember(user.id)}
                    >
                      {isAdding === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : query.length >= 2 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("noUsersFound")}
              </p>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("searchUserHint")}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
