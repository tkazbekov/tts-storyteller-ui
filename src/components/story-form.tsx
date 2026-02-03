"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Role, StoryLine, StoryTemplate } from "@/lib/api-types";
import { createStory, updateStory, listVoices } from "@/lib/api";
import type { Voice } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatApiErrors(detail: unknown): string[] {
  if (!detail || typeof detail !== "object") return [];
  const d = detail as { errors?: Array<{ loc: string[]; msg: string }> };
  if (!Array.isArray(d.errors)) return [];
  return d.errors.map((e) => `${e.loc.join(".")}: ${e.msg}`);
}

type Props = {
  initialStory?: StoryTemplate | null;
  storyId?: string | null;
};

export function StoryForm({ initialStory, storyId }: Props) {
  const router = useRouter();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState(initialStory?.title ?? "");
  const [language, setLanguage] = useState(initialStory?.language ?? "English");
  const [defaultVoiceId, setDefaultVoiceId] = useState(
    initialStory?.defaultVoiceId ?? ""
  );
  const [roles, setRoles] = useState<Role[]>(
    initialStory?.roles?.length
      ? initialStory.roles
      : [{ roleId: 0, name: "Narrator", notes: null }]
  );
  const [casting, setCasting] = useState<Record<string, string>>(
    initialStory?.casting ?? {}
  );
  const [lines, setLines] = useState<StoryLine[]>(
    initialStory?.lines?.length
      ? initialStory.lines
      : [{ id: 0, roleId: 0, line: "Once upon a time.", extra: null, actorId: null }]
  );

  const isEdit = Boolean(storyId && initialStory);

  useEffect(() => {
    listVoices()
      .then(setVoices)
      .catch(() => toast.error("Failed to load voices"))
      .finally(() => setLoadingVoices(false));
  }, []);

  const addRole = () => {
    const nextId =
      roles.length === 0 ? 0 : Math.max(...roles.map((r) => r.roleId)) + 1;
    setRoles((prev) => [...prev, { roleId: nextId, name: "", notes: null }]);
  };

  const updateRole = (index: number, field: keyof Role, value: string | number | null) => {
    setRoles((prev) => {
      const next = [...prev];
      const r = { ...next[index], [field]: value };
      if (field === "name" && typeof value === "string") r.name = value;
      if (field === "notes") r.notes = value === "" ? null : (value as string);
      if (field === "roleId") r.roleId = Number(value);
      next[index] = r;
      return next;
    });
  };

  const removeRole = (index: number) => {
    if (roles.length <= 1) return;
    const roleId = roles[index].roleId;
    setRoles((prev) => prev.filter((_, i) => i !== index));
    setCasting((prev) => {
      const next = { ...prev };
      delete next[String(roleId)];
      return next;
    });
    setLines((prev) =>
      prev.map((l) => (l.roleId === roleId ? { ...l, roleId: roles[0].roleId } : l))
    );
  };

  const addLine = () => {
    const nextId =
      lines.length === 0 ? 0 : Math.max(...lines.map((l) => l.id)) + 1;
    setLines((prev) => [
      ...prev,
      {
        id: nextId,
        roleId: roles[0]?.roleId ?? 0,
        line: "",
        extra: null,
        actorId: null,
      },
    ]);
  };

  const updateLine = (
    index: number,
    field: keyof StoryLine,
    value: string | number | null
  ) => {
    setLines((prev) => {
      const next = [...prev];
      const l = { ...next[index], [field]: value };
      if (field === "line") l.line = value as string;
      if (field === "extra") l.extra = value === "" ? null : (value as string);
      if (field === "actorId") l.actorId = value === "" ? null : (value as string);
      if (field === "roleId") l.roleId = Number(value);
      if (field === "id") l.id = Number(value);
      next[index] = l;
      return next;
    });
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!defaultVoiceId && voices.length > 0) {
      toast.error("Please select a default voice");
      return;
    }
    const roleNames = roles.map((r) => r.name.trim()).filter(Boolean);
    if (roleNames.length === 0) {
      toast.error("At least one role with a name is required");
      return;
    }
    const validRoles = roles
      .map((r, i) => ({ ...r, name: r.name.trim() || `Role ${i}`, notes: r.notes || null }))
      .filter((_, i) => roleNames[i] !== undefined);
    const validLines = lines
      .map((l) => ({ ...l, line: l.line.trim() || ".", extra: l.extra || null, actorId: l.actorId || null }))
      .filter((l) => l.line.length > 0);
    if (validLines.length === 0) {
      toast.error("At least one line is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload: StoryTemplate = {
        id: initialStory?.id ?? null,
        slug: initialStory?.slug ?? null,
        schemaVersion: 1,
        title: title.trim(),
        language: language.trim() || "English",
        defaultVoiceId: defaultVoiceId || (voices[0]?.id ?? ""),
        roles: validRoles,
        casting: Object.keys(casting).length ? casting : null,
        lines: validLines,
      };

      if (isEdit && storyId) {
        await updateStory(storyId, payload);
        toast.success("Story updated");
        router.refresh();
      } else {
        const created = await createStory(payload);
        toast.success("Story created");
        const target = created.slug ?? created.id ?? "";
        router.push(`/stories/${target}`);
      }
    } catch (err: unknown) {
      const e = err as Error & { status?: number; detail?: unknown };
      const messages = formatApiErrors(e.detail);
      if (messages.length) messages.forEach((m) => toast.error(m));
      else toast.error(e.message ?? "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingVoices && voices.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading voices…
        </CardContent>
      </Card>
    );
  }

  const noVoices = voices.length === 0;
  const defaultVoiceOptions = noVoices ? [] : voices;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Story</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Story"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Input
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="English"
            />
          </div>
          <div className="space-y-2">
            <Label>Default voice</Label>
            {noVoices ? (
              <p className="text-muted-foreground text-sm">
                No voices available. Create voices via the API or CLI, then refresh.
              </p>
            ) : (
              <Select
                value={defaultVoiceId || (voices[0]?.id ?? "")}
                onValueChange={setDefaultVoiceId}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  {defaultVoiceOptions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.id} ({v.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Roles</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addRole}>
            Add role
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {roles.map((r, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border p-3">
              <div className="space-y-1 flex-1 min-w-[80px]">
                <Label>ID</Label>
                <Input
                  type="number"
                  min={0}
                  value={r.roleId}
                  onChange={(e) => updateRole(i, "roleId", e.target.value)}
                />
              </div>
              <div className="space-y-1 flex-[2] min-w-[120px]">
                <Label>Name</Label>
                <Input
                  value={r.name}
                  onChange={(e) => updateRole(i, "name", e.target.value)}
                  placeholder="Narrator"
                />
              </div>
              <div className="space-y-1 flex-[2] min-w-[120px]">
                <Label>Notes</Label>
                <Input
                  value={r.notes ?? ""}
                  onChange={(e) => updateRole(i, "notes", e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1 w-[140px]">
                <Label>Voice override</Label>
                <Select
                  value={casting[String(r.roleId)] ?? "__default__"}
                  onValueChange={(v) =>
                    setCasting((prev) => {
                      if (!v || v === "__default__") {
                        const next = { ...prev };
                        delete next[String(r.roleId)];
                        return next;
                      }
                      return { ...prev, [String(r.roleId)]: v };
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Default</SelectItem>
                    {voices.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRole(i)}
                disabled={roles.length <= 1}
              >
                Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lines</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            Add line
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.map((l, i) => (
            <div key={i} className="flex flex-wrap items-start gap-2 rounded-md border p-3">
              <div className="space-y-1 w-16">
                <Label>Role</Label>
                <Select
                  value={String(l.roleId)}
                  onValueChange={(v) => updateLine(i, "roleId", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.roleId} value={String(r.roleId)}>
                        {r.roleId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label>Line</Label>
                <Input
                  value={l.line}
                  onChange={(e) => updateLine(i, "line", e.target.value)}
                  placeholder="Text to speak"
                  required
                />
              </div>
              <div className="space-y-1 w-24">
                <Label>Extra</Label>
                <Input
                  value={l.extra ?? ""}
                  onChange={(e) => updateLine(i, "extra", e.target.value)}
                  placeholder="Hint"
                />
              </div>
              <div className="space-y-1 w-[120px]">
                <Label>Voice (line)</Label>
                <Select
                  value={l.actorId ?? "__none__"}
                  onValueChange={(v) => updateLine(i, "actorId", v === "__none__" ? null : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {voices.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLine(i)}
                disabled={lines.length <= 1}
              >
                Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || (!isEdit && noVoices)}>
          {submitting ? "Saving…" : isEdit ? "Update story" : "Create story"}
        </Button>
        {isEdit && (
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
