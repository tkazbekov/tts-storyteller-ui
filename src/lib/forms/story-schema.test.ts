import { describe, expect, it } from "vitest";
import {
  fromStoryTemplate,
  storyFieldPath,
  storyFormSchema,
  toStoryTemplate,
  type StoryFormValues,
} from "./story-schema";
import type { StoryTemplate, Voice } from "@/lib/api-types";

const validValues: StoryFormValues = {
  title: "My Story",
  language: "English",
  defaultVoiceId: "narrator",
  roles: [
    { roleId: 0, name: "Narrator", notes: "", voiceId: "" },
    { roleId: 1, name: "Hero", notes: "brave", voiceId: "hero_voice" },
  ],
  lines: [
    { lineId: 0, roleId: 0, line: "Once upon a time.", extra: "", actorId: "" },
    { lineId: 1, roleId: 1, line: "Onward!", extra: "excited", actorId: "cameo" },
  ],
};

const template: StoryTemplate = {
  id: "uuid-1",
  slug: "my_story",
  schemaVersion: 1,
  title: "My Story",
  language: "English",
  defaultVoiceId: "narrator",
  roles: [
    { roleId: 0, name: "Narrator", notes: null },
    { roleId: 1, name: "Hero", notes: "brave" },
  ],
  casting: { "1": "hero_voice" },
  lines: [
    { id: 0, roleId: 0, line: "Once upon a time.", extra: null, actorId: null },
    { id: 1, roleId: 1, line: "Onward!", extra: "excited", actorId: "cameo" },
  ],
};

const voices: Voice[] = [
  { id: "narrator", language: "English", instruction: "", sample_text: null, backend: "qwen", promptPath: null, refAudioPath: null },
];

function issuePaths(values: unknown): string[] {
  const result = storyFormSchema.safeParse(values);
  if (result.success) return [];
  return result.error.issues.map((i) => i.path.join("."));
}

describe("storyFormSchema", () => {
  it("accepts a valid story", () => {
    expect(storyFormSchema.safeParse(validValues).success).toBe(true);
  });

  it("flags empty title, defaultVoiceId, role name, and line text at exact paths", () => {
    const paths = issuePaths({
      ...validValues,
      title: "  ",
      defaultVoiceId: "",
      roles: [{ roleId: 0, name: "", notes: "", voiceId: "" }],
      lines: [{ lineId: 0, roleId: 0, line: " ", extra: "", actorId: "" }],
    });
    expect(paths).toContain("title");
    expect(paths).toContain("defaultVoiceId");
    expect(paths).toContain("roles.0.name");
    expect(paths).toContain("lines.0.line");
  });

  it("flags the second occurrence of a duplicate roleId", () => {
    const paths = issuePaths({
      ...validValues,
      roles: [
        { roleId: 0, name: "A", notes: "", voiceId: "" },
        { roleId: 0, name: "B", notes: "", voiceId: "" },
      ],
      lines: [{ lineId: 0, roleId: 0, line: "x", extra: "", actorId: "" }],
    });
    expect(paths).toEqual(["roles.1.roleId"]);
  });

  it("flags duplicate lineIds and dangling role references", () => {
    const paths = issuePaths({
      ...validValues,
      lines: [
        { lineId: 0, roleId: 0, line: "a", extra: "", actorId: "" },
        { lineId: 0, roleId: 99, line: "b", extra: "", actorId: "" },
      ],
    });
    expect(paths).toContain("lines.1.lineId");
    expect(paths).toContain("lines.1.roleId");
  });

  it("rejects NaN roleId (empty number input) with the custom message", () => {
    const result = storyFormSchema.safeParse({
      ...validValues,
      roles: [{ roleId: NaN, name: "A", notes: "", voiceId: "" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "Role ID must be a number")).toBe(true);
    }
  });
});

describe("fromStoryTemplate", () => {
  it("merges the casting map into role voiceIds", () => {
    const values = fromStoryTemplate(template, voices);
    expect(values.roles[0].voiceId).toBe("");
    expect(values.roles[1].voiceId).toBe("hero_voice");
  });

  it("renames line id to lineId and nulls to empty strings", () => {
    const values = fromStoryTemplate(template, voices);
    expect(values.lines[0]).toEqual({ lineId: 0, roleId: 0, line: "Once upon a time.", extra: "", actorId: "" });
  });

  it("provides defaults and first-voice preselect for a new story", () => {
    const values = fromStoryTemplate(null, voices);
    expect(values.defaultVoiceId).toBe("narrator");
    expect(values.roles).toHaveLength(1);
    expect(values.roles[0].name).toBe("Narrator");
    expect(values.lines[0].line).toBe("Once upon a time.");
  });
});

describe("toStoryTemplate", () => {
  it("rebuilds casting only from non-empty voiceIds", () => {
    const out = toStoryTemplate(validValues, template);
    expect(out.casting).toEqual({ "1": "hero_voice" });
  });

  it("emits casting null when no overrides and maps empty strings to null", () => {
    const out = toStoryTemplate(
      {
        ...validValues,
        roles: [{ roleId: 0, name: "A", notes: "", voiceId: "" }],
        lines: [{ lineId: 0, roleId: 0, line: "x", extra: "", actorId: "" }],
      },
      null
    );
    expect(out.casting).toBeNull();
    expect(out.roles[0].notes).toBeNull();
    expect(out.lines[0].extra).toBeNull();
    expect(out.lines[0].actorId).toBeNull();
    expect(out.lines[0].id).toBe(0);
  });

  it("preserves initial id/slug and round-trips a normalized template", () => {
    const out = toStoryTemplate(fromStoryTemplate(template, voices), template);
    expect(out).toEqual(template);
  });
});

describe("storyFieldPath", () => {
  const roles = validValues.roles;

  it("resolves casting.<roleId> to the role's voiceId field", () => {
    expect(storyFieldPath("casting.1", roles)).toBe("roles.1.voiceId");
    expect(storyFieldPath("casting.99", roles)).toBeNull();
  });

  it("renames lines.<i>.id and points container paths at leaf fields", () => {
    expect(storyFieldPath("lines.0.id", roles)).toBe("lines.0.lineId");
    expect(storyFieldPath("lines.2", roles)).toBe("lines.2.line");
    expect(storyFieldPath("roles.1", roles)).toBe("roles.1.name");
  });

  it("passes through known fields and rejects unknown ones", () => {
    expect(storyFieldPath("title", roles)).toBe("title");
    expect(storyFieldPath("lines.0.line", roles)).toBe("lines.0.line");
    expect(storyFieldPath("schemaVersion", roles)).toBeNull();
  });
});
