import Link from "next/link";
import { listStories } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  let stories: Awaited<ReturnType<typeof listStories>> = [];
  let error: string | null = null;
  try {
    stories = await listStories();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load stories";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stories</h1>
        <Button asChild>
          <Link href="/stories/new">New story</Link>
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-destructive">{error}</CardContent>
        </Card>
      )}

      {!error && stories.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <p>No stories yet.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/stories/new">Create your first story</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && stories.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((s) => (
            <li key={s.slug}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <Link href={`/stories/${s.slug}`} className="block h-full">
                  <CardHeader className="pb-2">
                    <h2 className="font-medium leading-tight line-clamp-2">{s.title}</h2>
                    <p className="text-muted-foreground text-sm">{s.slug}</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <span className="text-muted-foreground text-sm underline-offset-4 hover:underline">
                      Open →
                    </span>
                  </CardContent>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
