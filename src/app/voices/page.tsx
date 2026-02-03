import Link from "next/link";
import { listVoices } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VoicesTable } from "@/components/voices-table";

export const dynamic = "force-dynamic";

export default async function VoicesPage() {
  let voices: Awaited<ReturnType<typeof listVoices>> = [];
  let error: string | null = null;
  try {
    voices = await listVoices();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load voices";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Voices</h1>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/voices/new">New voice</Link>
          </Button>
          <Link href="/" className="text-muted-foreground text-sm hover:text-foreground">
            ← Stories
          </Link>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-destructive">{error}</CardContent>
        </Card>
      )}

      {!error && voices.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <p>No voices found.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/voices/new">Create your first voice</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && voices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available voices</CardTitle>
          </CardHeader>
          <CardContent>
            <VoicesTable voices={voices} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
