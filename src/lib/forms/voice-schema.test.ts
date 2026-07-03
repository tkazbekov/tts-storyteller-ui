import { describe, expect, it } from "vitest";
import {
  makeVoiceFormSchema,
  toVoiceCloneConfig,
  toVoiceConfig,
  voiceFieldPath,
} from "./voice-schema";

const designValues = {
  mode: "design" as const,
  id: "narrator_male-2",
  language: "English",
  instruction: "Deep and calm",
  backend: "qwen" as const,
  sampleText: "Hello there.",
};

const cloneValues = {
  mode: "clone" as const,
  id: "cloned_voice",
  language: "English",
  instruction: "Reference speaker",
  backend: "vibevoice" as const,
  referenceAudio: new File(["x"], "ref.wav"),
  referenceText: "",
};

describe("makeVoiceFormSchema", () => {
  const schema = makeVoiceFormSchema({ isEdit: false });

  it("accepts valid design and clone values", () => {
    expect(schema.safeParse(designValues).success).toBe(true);
    expect(schema.safeParse(cloneValues).success).toBe(true);
  });

  it("requires sampleText only in design mode", () => {
    const result = schema.safeParse({ ...designValues, sampleText: " " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["sampleText"]);
    }
  });

  it("enforces the backend id pattern", () => {
    expect(schema.safeParse({ ...designValues, id: "bad id!" }).success).toBe(false);
    expect(schema.safeParse({ ...designValues, id: "a".repeat(101) }).success).toBe(false);
    expect(schema.safeParse({ ...designValues, id: "" }).success).toBe(false);
    expect(schema.safeParse({ ...designValues, id: "ok_id-123" }).success).toBe(true);
  });

  it("requires referenceAudio for new clones but not for edits", () => {
    const create = makeVoiceFormSchema({ isEdit: false }).safeParse({
      ...cloneValues,
      referenceAudio: null,
    });
    expect(create.success).toBe(false);
    if (!create.success) {
      expect(create.error.issues[0].path).toEqual(["referenceAudio"]);
    }

    const edit = makeVoiceFormSchema({ isEdit: true }).safeParse({
      ...cloneValues,
      referenceAudio: null,
    });
    expect(edit.success).toBe(true);
  });
});

describe("mappers", () => {
  it("toVoiceConfig always emits qwen and trims", () => {
    const config = toVoiceConfig({ ...designValues, language: "  " });
    expect(config.backend).toBe("qwen");
    expect(config.language).toBe("English");
    expect(config.sample_text).toBe("Hello there.");
  });

  it("toVoiceCloneConfig maps empty referenceText to null", () => {
    const config = toVoiceCloneConfig(cloneValues, "uploads/reference_audio/x.wav");
    expect(config.ref_text).toBeNull();
    expect(config.ref_audio_url).toBe("uploads/reference_audio/x.wav");
    expect(config.backend).toBe("vibevoice");
  });
});

describe("voiceFieldPath", () => {
  it("maps API field names onto form fields", () => {
    expect(voiceFieldPath("sample_text")).toBe("sampleText");
    expect(voiceFieldPath("ref_audio_url")).toBe("referenceAudio");
    expect(voiceFieldPath("id")).toBe("id");
    expect(voiceFieldPath("unknown_field")).toBeNull();
  });
});
