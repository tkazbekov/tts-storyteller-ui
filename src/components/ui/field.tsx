import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** aria wiring for an input inside a <Field>: pass the same id to both. */
export function fieldAria(id: string, error?: string) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const;
}

type FieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
};

/** Label + control + inline error/description. Pairs with fieldAria(). */
export function Field({ label, htmlFor, error, description, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {description && !error && <p className="text-muted-foreground text-xs">{description}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
