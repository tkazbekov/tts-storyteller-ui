import Link from "next/link";
import { listVoices } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
        <Link href="/" className="text-muted-foreground text-sm hover:text-foreground">
          ← Stories
        </Link>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-destructive">{error}</CardContent>
        </Card>
      )}

      {!error && voices.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No voices found. Create voices via the API or CLI to use them in stories.
          </CardContent>
        </Card>
      )}

      {!error && voices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available voices</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Instruction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {voices.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.id}</TableCell>
                    <TableCell>{v.language}</TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {v.instruction}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
