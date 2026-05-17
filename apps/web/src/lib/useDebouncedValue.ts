import { useEffect, useState } from "react";

/**
 * Debounces a fast-changing value (e.g. search input). Returns the value
 * after `ms` of no changes — avoids hammering the API on every keystroke.
 */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
