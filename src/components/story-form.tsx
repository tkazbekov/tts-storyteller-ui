"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { StoryTemplate, Voice } from "@/lib/api-types";
import { ApiError, createStory, updateStory, listVoices } from "@/lib/api";
import {
  fromStoryTemplate,
  storyFieldPath,
  storyFormSchema,
  toStoryTemplate,
  type StoryFormValues,
} from "@/lib/forms/story-schema";
import { applyServerErrors } from "@/lib/forms/server-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, fieldAria } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  initialStory?: StoryTemplate | null;
  storyId?: string | null;
};

/**
 * Loader shell: form defaultValues (incl. first-voice preselect) must be
 * computed synchronously, so the actual form mounts only once voices load.
 */
export function StoryForm({ initialStory, storyId }: Props) {
  const [voices, setVoices] = useState<Voice[] | null>(null);

  useEffect(() => {
    listVoices()
      .then(setVoices)
      .catch(() => {
        toast.error("Failed to load voices");
        setVoices([]);
      });
  }, []);

  if (voices === null) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading voices…
        </CardContent>
      </Card>
    );
  }

  return <StoryFormFields voices={voices} initialStory={initialStory} storyId={storyId} />;
}

type InnerProps = Props & { voices: Voice[] };

function StoryFormFields({ voices, initialStory, storyId }: InnerProps) {
  const router = useRouter();
  const isEdit = Boolean(storyId && initialStory);
  const noVoices = voices.length === 0;

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    // Compiler-safety: destructure formState here, in the component that owns
    // useForm; never pass the proxy object down.
    formState: { errors, isSubmitting },
  } = useForm<StoryFormValues>({
    resolver: zodResolver(storyFormSchema),
    defaultValues: fromStoryTemplate(initialStory, voices),
  });

  const roleArray = useFieldArray({ control, name: "roles" });
  const lineArray = useFieldArray({ control, name: "lines" });
  // Line role-selects need the live role list (fields snapshots go stale).
  const watchedRoles = useWatch({ control, name: "roles" });

  const addRole = () => {
    const roles = getValues("roles");
    const nextId = roles.length ? Math.max(...roles.map((r) => r.roleId)) + 1 : 0;
    roleArray.append({ roleId: nextId, name: "", notes: "", voiceId: "" });
  };

  const removeRole = (index: number) => {
    if (roleArray.fields.length <= 1) return;
    const removedRoleId = getValues(`roles.${index}.roleId`);
    roleArray.remove(index);
    // Reassign orphaned lines to the first remaining role.
    const fallback = getValues("roles")[0]?.roleId ?? 0;
    getValues("lines").forEach((l, i) => {
      if (l.roleId === removedRoleId) {
        setValue(`lines.${i}.roleId`, fallback, { shouldDirty: true });
      }
    });
  };

  const addLine = () => {
    const lines = getValues("lines");
    const nextId = lines.length ? Math.max(...lines.map((l) => l.lineId)) + 1 : 0;
    lineArray.append({
      lineId: nextId,
      roleId: getValues("roles")[0]?.roleId ?? 0,
      line: "",
      extra: "",
      actorId: "",
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload = toStoryTemplate(values, initialStory);
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
      if (err instanceof ApiError) {
        const unmapped = applyServerErrors(err, setError, (apiPath) =>
          storyFieldPath(apiPath, getValues("roles"))
        );
        if (unmapped.length) {
          setError("root.serverError", { message: unmapped.join("; ") });
          unmapped.forEach((m) => toast.error(m));
        }
      } else {
        toast.error(err instanceof Error ? err.message : "Request failed");
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Story</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors.root?.serverError && (
            <p role="alert" className="text-destructive text-sm">
              {errors.root.serverError.message}
            </p>
          )}

          <Field label="Title" htmlFor="title" error={errors.title?.message}>
            <Input
              {...register("title")}
              {...fieldAria("title", errors.title?.message)}
              placeholder="My Story"
            />
          </Field>

          <Field label="Language" htmlFor="language" error={errors.language?.message}>
            <Input
              {...register("language")}
              {...fieldAria("language", errors.language?.message)}
              placeholder="English"
            />
          </Field>

          <Field
            label="Default voice"
            htmlFor="default-voice"
            error={errors.defaultVoiceId?.message}
          >
            {noVoices ? (
              <p className="text-muted-foreground text-sm">
                No voices available. Create voices via the API or CLI, then refresh.
              </p>
            ) : (
              <Controller
                name="defaultVoiceId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="default-voice" className="w-full" ref={field.ref}>
                      <SelectValue placeholder="Select voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {voices.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.id} ({v.language})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>
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
          {(errors.roles?.root?.message ?? errors.roles?.message) && (
            <p role="alert" className="text-destructive text-sm">
              {errors.roles?.root?.message ?? errors.roles?.message}
            </p>
          )}
          {roleArray.fields.map((field, i) => (
            <div key={field.id} className="flex flex-wrap items-end gap-2 rounded-md border p-3">
              <Field
                label="ID"
                htmlFor={`role-${i}-id`}
                error={errors.roles?.[i]?.roleId?.message}
                className="flex-1 min-w-[80px] space-y-1"
              >
                <Controller
                  name={`roles.${i}.roleId`}
                  control={control}
                  render={({ field: f }) => (
                    <Input
                      {...fieldAria(`role-${i}-id`, errors.roles?.[i]?.roleId?.message)}
                      type="number"
                      min={0}
                      ref={f.ref}
                      value={Number.isNaN(f.value) ? "" : f.value}
                      onChange={(e) => {
                        const prev = f.value;
                        const next = e.target.valueAsNumber;
                        f.onChange(next);
                        // Renumber lines that referenced the old roleId.
                        if (Number.isInteger(next) && next >= 0 && prev !== next) {
                          getValues("lines").forEach((l, li) => {
                            if (l.roleId === prev) {
                              setValue(`lines.${li}.roleId`, next, { shouldDirty: true });
                            }
                          });
                        }
                      }}
                    />
                  )}
                />
              </Field>
              <Field
                label="Name"
                htmlFor={`role-${i}-name`}
                error={errors.roles?.[i]?.name?.message}
                className="flex-[2] min-w-[120px] space-y-1"
              >
                <Input
                  {...register(`roles.${i}.name`)}
                  {...fieldAria(`role-${i}-name`, errors.roles?.[i]?.name?.message)}
                  placeholder="Narrator"
                />
              </Field>
              <Field
                label="Notes"
                htmlFor={`role-${i}-notes`}
                error={errors.roles?.[i]?.notes?.message}
                className="flex-[2] min-w-[120px] space-y-1"
              >
                <Input
                  {...register(`roles.${i}.notes`)}
                  {...fieldAria(`role-${i}-notes`, errors.roles?.[i]?.notes?.message)}
                  placeholder="Optional"
                />
              </Field>
              <Field
                label="Voice override"
                htmlFor={`role-${i}-voice`}
                error={errors.roles?.[i]?.voiceId?.message}
                className="w-[140px] space-y-1"
              >
                <Controller
                  name={`roles.${i}.voiceId`}
                  control={control}
                  render={({ field: f }) => (
                    <Select
                      value={f.value || "__default__"}
                      onValueChange={(v) => f.onChange(v === "__default__" ? "" : v)}
                    >
                      <SelectTrigger id={`role-${i}-voice`} className="w-full" ref={f.ref}>
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
                  )}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRole(i)}
                disabled={roleArray.fields.length <= 1}
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
          {(errors.lines?.root?.message ?? errors.lines?.message) && (
            <p role="alert" className="text-destructive text-sm">
              {errors.lines?.root?.message ?? errors.lines?.message}
            </p>
          )}
          {lineArray.fields.map((field, i) => (
            <div key={field.id} className="flex flex-wrap items-start gap-2 rounded-md border p-3">
              <Field
                label="Role"
                htmlFor={`line-${i}-role`}
                error={errors.lines?.[i]?.roleId?.message ?? errors.lines?.[i]?.lineId?.message}
                className="w-16 space-y-1"
              >
                <Controller
                  name={`lines.${i}.roleId`}
                  control={control}
                  render={({ field: f }) => (
                    <Select
                      value={String(f.value)}
                      onValueChange={(v) => f.onChange(Number(v))}
                    >
                      <SelectTrigger id={`line-${i}-role`} className="w-full" ref={f.ref}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {watchedRoles.map((r) => (
                          <SelectItem key={r.roleId} value={String(r.roleId)}>
                            {r.roleId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field
                label="Line"
                htmlFor={`line-${i}-text`}
                error={errors.lines?.[i]?.line?.message}
                className="flex-1 min-w-[200px] space-y-1"
              >
                <Input
                  {...register(`lines.${i}.line`)}
                  {...fieldAria(`line-${i}-text`, errors.lines?.[i]?.line?.message)}
                  placeholder="Text to speak"
                />
              </Field>
              <Field
                label="Extra"
                htmlFor={`line-${i}-extra`}
                error={errors.lines?.[i]?.extra?.message}
                className="w-24 space-y-1"
              >
                <Input
                  {...register(`lines.${i}.extra`)}
                  {...fieldAria(`line-${i}-extra`, errors.lines?.[i]?.extra?.message)}
                  placeholder="Hint"
                />
              </Field>
              <Field
                label="Voice (line)"
                htmlFor={`line-${i}-voice`}
                error={errors.lines?.[i]?.actorId?.message}
                className="w-[120px] space-y-1"
              >
                <Controller
                  name={`lines.${i}.actorId`}
                  control={control}
                  render={({ field: f }) => (
                    <Select
                      value={f.value || "__none__"}
                      onValueChange={(v) => f.onChange(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger id={`line-${i}-voice`} className="w-full" ref={f.ref}>
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
                  )}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => lineArray.fields.length > 1 && lineArray.remove(i)}
                disabled={lineArray.fields.length <= 1}
              >
                Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting || (!isEdit && noVoices)}>
          {isSubmitting ? "Saving…" : isEdit ? "Update story" : "Create story"}
        </Button>
        {isEdit && (
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
