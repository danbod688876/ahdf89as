import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OrganicDivider } from "./OrganicDivider";

/**
 * Shared shell for every module. Visual weight is controlled by the caller
 * via `size` — calendar is "primary", side-column modules are "compact",
 * expandable sections (trips/maintenance/garden) are "collapsible" — rather
 * than every module getting an identical widget card (spec §6 layout concept).
 */
export function ModuleCard({
  title,
  icon,
  accent = "pine",
  size = "default",
  children,
  headerRight,
}: {
  title: string;
  icon?: ReactNode;
  accent?: "pine" | "sand";
  size?: "primary" | "default" | "compact";
  children: ReactNode;
  headerRight?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl bg-white/60 border border-sage/20 shadow-sm backdrop-blur-sm",
        size === "primary" && "p-6",
        size === "default" && "p-5",
        size === "compact" && "p-4"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon && (
            <span className={cn("shrink-0", accent === "pine" ? "text-pine" : "text-sand")}>
              {icon}
            </span>
          )}
          <h2
            className={cn(
              "font-serif text-ink",
              size === "primary" ? "text-2xl" : size === "default" ? "text-xl" : "text-lg"
            )}
          >
            {title}
          </h2>
        </div>
        {headerRight}
      </div>
      <OrganicDivider className="my-3" />
      <div>{children}</div>
    </section>
  );
}
