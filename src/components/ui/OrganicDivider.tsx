import { cn } from "@/lib/utils";

/**
 * The signature hand-drawn-feeling divider used across every module card
 * (spec §6 "Signature element") — a soft, slightly irregular rounded line
 * rather than a hairline rule, so it reads as considered rather than
 * default-Tailwind.
 */
export function OrganicDivider({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 8"
      preserveAspectRatio="none"
      className={cn("h-2 w-full text-sage/40", className)}
      aria-hidden="true"
    >
      <path
        d="M0 4 C 20 1, 35 7, 55 4 S 90 1, 110 4 S 145 7, 165 4 S 190 1, 200 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
