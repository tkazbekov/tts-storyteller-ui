import { describe, expect, it, vi } from "vitest";
import { applyServerErrors, extractErrorEntries, locToPath } from "./server-errors";
import { ApiError } from "@/lib/api";

describe("locToPath", () => {
  it("strips the body prefix and joins segments", () => {
    expect(locToPath(["body", "id"])).toBe("id");
    expect(locToPath(["body", "lines", 0, "line"])).toBe("lines.0.line");
  });

  it("handles the custom 400 shape without a body prefix", () => {
    expect(locToPath(["lines", 0])).toBe("lines.0");
  });

  it("returns null for non-arrays and empty locs", () => {
    expect(locToPath("nope")).toBeNull();
    expect(locToPath(["body"])).toBeNull();
    expect(locToPath(null)).toBeNull();
  });
});

describe("extractErrorEntries", () => {
  it("reads FastAPI 422 arrays and the custom {errors} shape", () => {
    const fastapi = [{ loc: ["body", "id"], msg: "bad" }];
    expect(extractErrorEntries(fastapi)).toEqual(fastapi);

    const custom = { errors: [{ loc: ["lines", 0], msg: "empty" }] };
    expect(extractErrorEntries(custom)).toEqual(custom.errors);
  });

  it("returns [] for strings and garbage, filtering bad entries", () => {
    expect(extractErrorEntries("plain")).toEqual([]);
    expect(extractErrorEntries(null)).toEqual([]);
    expect(extractErrorEntries([null, "x", { loc: [], msg: "ok" }])).toEqual([{ loc: [], msg: "ok" }]);
  });
});

describe("applyServerErrors", () => {
  it("maps entries onto fields, focusing only the first", () => {
    const err = new ApiError("bad", 422, [
      { loc: ["body", "id"], msg: "bad id" },
      { loc: ["body", "sample_text"], msg: "required" },
    ]);
    const setError = vi.fn();
    const pathMap = (p: string) => (p === "id" ? "id" : p === "sample_text" ? "sampleText" : null);

    const unmapped = applyServerErrors(err, setError, pathMap);

    expect(unmapped).toEqual([]);
    expect(setError).toHaveBeenNthCalledWith(
      1,
      "id",
      { type: "server", message: "bad id" },
      { shouldFocus: true }
    );
    expect(setError).toHaveBeenNthCalledWith(
      2,
      "sampleText",
      { type: "server", message: "required" },
      { shouldFocus: false }
    );
  });

  it("routes unmappable paths to the returned list", () => {
    const err = new ApiError("bad", 422, [{ loc: ["body", "mystery"], msg: "nope" }]);
    const setError = vi.fn();

    const unmapped = applyServerErrors(err, setError, () => null);

    expect(setError).not.toHaveBeenCalled();
    expect(unmapped).toEqual(["mystery: nope"]);
  });

  it("falls back to a string detail when nothing was mapped", () => {
    const err = new ApiError("conflict", 409, "Voice 'x' already exists");
    const unmapped = applyServerErrors(err, vi.fn(), () => null);
    expect(unmapped).toEqual(["Voice 'x' already exists"]);
  });
});
