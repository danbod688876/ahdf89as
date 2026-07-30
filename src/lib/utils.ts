import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function currency(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
