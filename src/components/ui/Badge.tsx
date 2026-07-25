import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  pine: "bg-pine/10 text-pine",
  sand: "bg-sand/20 text-[#8a6a3f]",
  sage: "bg-sage/15 text-sage",
  ink: "bg-ink/10 text-ink",
} as const;

export function Badge({
  children,
  tone = "sage",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
