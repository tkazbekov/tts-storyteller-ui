/**
 * Story form schema and form↔API mappers. Pure module — no React imports.
 *
 * The form-internal shape deliberately differs from the API shape:
 * - The `casting` map lives INSIDE each role item as `voiceId` ("" = story
 *   default), so editing a role's roleId can't orphan its voice override.
 * - Line `id` is renamed `lineId` in form state: useFieldArray's generated
 *   render key is also called `id` and would shadow a data field of that name.
 * - Nullable API strings are ""-able strings in form state; mappers do ""→null.
 */

import { z } from "zod";
import type { StoryTemplate, Voice } from "@/lib/api-types";

const roleItemSchema = z.object({
  roleId: z
    .number({ error: "Role ID must be a number" })
    .int("Role ID must be an integer")
    .min(0, "Role ID must be ≥ 0"),
  name: z.string().trim().min(1, "Role name is required"),
  notes: z.string(),
  voiceId: z.string(),
});

const lineItemSchema = z.object({
  lineId: z.number().int().min(0),
  roleId: z.number().int().min(0),
  line: z.string().trim().min(1, "Line text is required. Remove blank lines instead of saving them."),
  extra: z.string(),
  actorId: z.string(),
});

export const storyFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    language: z.string(),
    defaultVoiceId: z.string().min(1, "Select a default voice"),
    roles: z.array(roleItemSchema).min(1, "At least one role is required"),
    lines: z.array(lineItemSchema).min(1, "At least one line is required"),
  })
  .superRefine((data, ctx) => {
    const seenRoleIds = new Set<number>();
    data.roles.forEach((r, i) => {
      if (seenRoleIds.has(r.roleId)) {
        ctx.addIssue({
          code: "custom",
          path: ["roles", i, "roleId"],
          message: `Duplicate role ID ${r.roleId}`,
        });
      } else {
        seenRoleIds.add(r.roleId);
      }
    });
    const seenLineIds = new Set<number>();
    data.lines.forEach((l, i) => {
      if (seenLineIds.has(l.lineId)) {
        ctx.addIssue({
          code: "custom",
          path: ["lines", i, "lineId"],
          message: `Duplicate line ID ${l.lineId}`,
        });
      } else {
        seenLineIds.add(l.lineId);
      }
      if (!seenRoleIds.has(l.roleId)) {
        ctx.addIssue({
          code: "custom",
          path: ["lines", i, "roleId"],
          message: "Line must reference an existing role",
        });
      }
    });
  });

export type StoryFormValues = z.infer<typeof storyFormSchema>;

/** API → form: merge the casting map into role items; preselect first voice. */
export function fromStoryTemplate(
  initial: StoryTemplate | null | undefined,
  voices: Voice[]
): StoryFormValues {
  const casting = initial?.casting ?? {};
  const roles = (
    initial?.roles?.length ? initial.roles : [{ roleId: 0, name: "Narrator", notes: null }]
  ).map((r) => ({
    roleId: r.roleId,
    name: r.name,
    notes: r.notes ?? "",
    voiceId: casting[String(r.roleId)] ?? "",
  }));
  const lines = (
    initial?.lines?.length
      ? initial.lines
      : [{ id: 0, roleId: 0, line: "Once upon a time.", extra: null, actorId: null }]
  ).map((l) => ({
    lineId: l.id,
    roleId: l.roleId,
    line: l.line,
    extra: l.extra ?? "",
    actorId: l.actorId ?? "",
  }));
  return {
    title: initial?.title ?? "",
    language: initial?.language ?? "English",
    defaultVoiceId: initial?.defaultVoiceId || (voices[0]?.id ?? ""),
    roles,
    lines,
  };
}

/** Form → API: rebuild casting from per-role voiceId; ""→null; lineId→id. */
export function toStoryTemplate(
  v: StoryFormValues,
  initial?: StoryTemplate | null
): StoryTemplate {
  const casting = Object.fromEntries(
    v.roles.filter((r) => r.voiceId.trim()).map((r) => [String(r.roleId), r.voiceId])
  );
  return {
    id: initial?.id ?? null,
    slug: initial?.slug ?? null,
    schemaVersion: 1,
    title: v.title.trim(),
    language: v.language.trim() || "English",
    defaultVoiceId: v.defaultVoiceId,
    roles: v.roles.map((r) => ({
      roleId: r.roleId,
      name: r.name.trim(),
      notes: r.notes.trim() || null,
    })),
    casting: Object.keys(casting).length ? casting : null,
    lines: v.lines.map((l) => ({
      id: l.lineId,
      roleId: l.roleId,
      line: l.line.trim(),
      extra: l.extra.trim() || null,
      actorId: l.actorId || null,
    })),
  };
}

/**
 * Maps API error paths to story-form field paths. `roles` is the current
 * form value, needed to resolve `casting.<roleId>` to a role index.
 */
export function storyFieldPath(
  apiPath: string,
  roles: Array<{ roleId: number }>
): string | null {
  // casting.<roleId> → roles.<idx>.voiceId (casting is per-role in the form)
  const castingMatch = apiPath.match(/^casting\.(\d+)$/);
  if (castingMatch) {
    const idx = roles.findIndex((r) => r.roleId === Number(castingMatch[1]));
    return idx >= 0 ? `roles.${idx}.voiceId` : null;
  }
  // lines.<i>.id → lines.<i>.lineId (renamed in form state)
  const lineIdMatch = apiPath.match(/^lines\.(\d+)\.id$/);
  if (lineIdMatch) return `lines.${lineIdMatch[1]}.lineId`;
  // Container paths from the custom 400 shape → point at the likely leaf.
  const lineMatch = apiPath.match(/^lines\.(\d+)$/);
  if (lineMatch) return `lines.${lineMatch[1]}.line`;
  const roleMatch = apiPath.match(/^roles\.(\d+)$/);
  if (roleMatch) return `roles.${roleMatch[1]}.name`;
  // Pass-through for known top-level and nested fields.
  if (/^(title|language|defaultVoiceId)$/.test(apiPath)) return apiPath;
  if (/^roles\.\d+\.(roleId|name|notes)$/.test(apiPath)) return apiPath;
  if (/^lines\.\d+\.(roleId|line|extra|actorId)$/.test(apiPath)) return apiPath;
  return null;
}
