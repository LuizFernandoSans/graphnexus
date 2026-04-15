import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useState, useEffect } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Escapes PostgreSQL LIKE/ILIKE metacharacters (%, _, \) so they are
 * treated as literal characters in pattern matching.
 */
export function escapeLikePattern(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

/**
 * Returns a debounced version of the input value that only updates
 * after the specified delay (in ms) of inactivity.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
