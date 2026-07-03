/**
 * Map server-side validation errors onto react-hook-form fields.
 * Handles both FastAPI 422 (detail: [{loc, msg}]) and this backend's custom
 * 400 story validation (detail: {errors: [{loc, msg}]}).
 */

import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ApiError } from "@/lib/api";

type ErrorEntry = { loc?: unknown; msg?: unknown };

export function extractErrorEntries(detail: unknown): ErrorEntry[] {
  if (Array.isArray(detail)) {
    return detail.filter((e): e is ErrorEntry => Boolean(e) && typeof e === "object");
  }
  if (detail && typeof detail === "object" && Array.isArray((detail as { errors?: unknown }).errors)) {
    return (detail as { errors: ErrorEntry[] }).errors;
  }
  return [];
}

/** ["body","lines",0,"line"] → "lines.0.line"; ["lines",0] → "lines.0". */
export function locToPath(loc: unknown): string | null {
  if (!Array.isArray(loc)) return null;
  const parts = loc.filter((p): p is string | number => typeof p === "string" || typeof p === "number");
  const trimmed = parts[0] === "body" ? parts.slice(1) : parts;
  return trimmed.length ? trimmed.join(".") : null;
}

/**
 * Apply server validation errors to form fields via `setError`.
 * `pathMap` translates API paths to form paths (null = unmappable).
 * Focuses the first mapped field. Returns the unmapped messages — the caller
 * renders those as a root error / toast so nothing is silently lost.
 */
export function applyServerErrors<T extends FieldValues>(
  err: ApiError,
  setError: UseFormSetError<T>,
  pathMap: (apiPath: string) => string | null
): string[] {
  const unmapped: string[] = [];
  let focused = false;
  for (const entry of extractErrorEntries(err.detail)) {
    const msg = typeof entry.msg === "string" ? entry.msg : "Invalid value";
    const apiPath = locToPath(entry.loc);
    const formPath = apiPath ? pathMap(apiPath) : null;
    if (formPath) {
      setError(formPath as Path<T>, { type: "server", message: msg }, { shouldFocus: !focused });
      focused = true;
    } else {
      unmapped.push(apiPath ? `${apiPath}: ${msg}` : msg);
    }
  }
  if (unmapped.length === 0 && !focused && typeof err.detail === "string") {
    unmapped.push(err.detail);
  }
  return unmapped;
}
