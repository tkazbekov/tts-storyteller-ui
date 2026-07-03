import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, buildUrl, formatApiErrors, getJob, deleteVoice } from "./api";

function mockFetchResponse(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("formatApiErrors", () => {
  it("formats FastAPI's native validation array", () => {
    const detail = [
      { loc: ["body", "id"], msg: "String should match pattern" },
      { loc: ["body", "language"], msg: "Field required" },
    ];
    expect(formatApiErrors(detail)).toEqual([
      "body.id: String should match pattern",
      "body.language: Field required",
    ]);
  });

  it("formats the backend's {errors: [...]} shape", () => {
    const detail = { errors: [{ loc: ["lines", 0], msg: "line must not be empty" }] };
    expect(formatApiErrors(detail)).toEqual(["lines.0: line must not be empty"]);
  });

  it("tolerates malformed entries", () => {
    expect(formatApiErrors([{ msg: 42 }, null, "x"])).toEqual(["request: Invalid value"]);
  });

  it("returns [] for string, null, and unknown shapes", () => {
    expect(formatApiErrors("plain message")).toEqual([]);
    expect(formatApiErrors(null)).toEqual([]);
    expect(formatApiErrors({ other: true })).toEqual([]);
  });
});

describe("buildUrl", () => {
  it("prefixes relative paths with the server base URL", () => {
    vi.stubEnv("API_URL", "http://gpu-box:8000/");
    expect(buildUrl("/jobs")).toBe("http://gpu-box:8000/jobs");
    expect(buildUrl("jobs")).toBe("http://gpu-box:8000/jobs");
  });

  it("passes absolute URLs through", () => {
    expect(buildUrl("http://elsewhere/x.wav")).toBe("http://elsewhere/x.wav");
  });
});

describe("request error handling", () => {
  it("throws ApiError with status and string detail", async () => {
    mockFetchResponse(
      new Response(JSON.stringify({ detail: "Story 'x' not found" }), { status: 404 })
    );

    const err = await getJob("x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.message).toBe("Story 'x' not found");
  });

  it("joins validation-array details into the message", async () => {
    const detail = [{ loc: ["body", "id"], msg: "bad id" }];
    mockFetchResponse(new Response(JSON.stringify({ detail }), { status: 422 }));

    const err = await getJob("x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.message).toBe("body.id: bad id");
    expect(err.detail).toEqual(detail);
  });

  it("falls back to statusText for non-JSON error bodies", async () => {
    mockFetchResponse(new Response("nope", { status: 502, statusText: "Bad Gateway" }));

    const err = await getJob("x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Bad Gateway");
  });

  it("treats 204 and empty bodies as undefined", async () => {
    mockFetchResponse(new Response(null, { status: 204 }));
    await expect(deleteVoice("v")).resolves.toBeUndefined();

    mockFetchResponse(new Response("", { status: 200 }));
    await expect(deleteVoice("v")).resolves.toBeUndefined();
  });

  it("sets Content-Type only when a body is present", async () => {
    const fetchMock = mockFetchResponse(new Response("{}", { status: 200 }));
    await getJob("abc");
    const [, getInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(getInit.headers).has("Content-Type")).toBe(false);
  });
});
