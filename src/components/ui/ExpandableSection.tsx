"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrganicDivider } from "./OrganicDivider";

/**
 * Trips, Maintenance, and Garden stay collapsed until relevant (spec §6).
 * `defaultOpen` lets the caller decide relevance — e.g. a plant with an
 * open "today" task should render expanded, a dormant one collapsed.
 */
export function ExpandableSection({
  title,
  icon,
  accent = "pine",
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  accent?: "pine" | "sand";
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl bg-white/60 border border-sage/20 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          {icon && (
            <span className={cn(accent === "pine" ? "text-pine" : "text-sand")}>{icon}</span>
          )}
          <span className="font-serif text-lg text-ink">{title}</span>
          {badge}
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-sage transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">
            <OrganicDivider className="mb-3" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
