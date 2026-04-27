"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchUsersAction } from "./actions";
import type { UserSearchItem } from "@/lib/api/admin";

interface UserSearchProps {
  onSelect: (user: UserSearchItem) => void;
}

export function UserSearch({ onSelect }: UserSearchProps) {
  const t = useTranslations("admin.bulkAdd");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current);

    if (query.length < 3) {
      setResults([]);
      setIsOpen(false);
      setHasSearched(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setIsLoading(true);
      setHasSearched(false);
      try {
        const { items } = await searchUsersAction(query);
        setResults(items);
        setIsOpen(true);
        setHasSearched(true);
      } catch {
        setResults([]);
        setIsOpen(true);
        setHasSearched(true);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(user: UserSearchItem) {
    onSelect(user);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setHasSearched(false);
  }

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <Label htmlFor="user-search" aria-required="true">
        {t("userLabel")}
      </Label>
      <Input
        id="user-search"
        type="text"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("userPlaceholder")}
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls="user-search-listbox"
      />
      {isLoading && (
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t("searching")}
        </p>
      )}

      {isOpen && !isLoading && (
        <ul
          id="user-search-listbox"
          role="listbox"
          className="absolute z-50 w-full mt-1 rounded-md border shadow-md overflow-auto max-h-52"
          style={{
            backgroundColor: "var(--background)",
            borderColor: "var(--border)",
          }}
        >
          {results.length === 0 && hasSearched ? (
            <li
              className="px-3 py-2 text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t("noUsersFound")}
            </li>
          ) : (
            results.map((user) => (
              <li
                key={user.id}
                role="option"
                aria-selected={false}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                onMouseDown={(e) => {
                  // Use mousedown so it fires before input blur
                  e.preventDefault();
                  handleSelect(user);
                }}
              >
                <span className="font-medium">
                  {user.display_name ?? user.email}
                </span>
                {user.display_name && (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {user.email}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
