import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, getStory } from "@/lib/api";
import { StoryForm } from "@/components/story-form";
import { StoryActions } from "@/components/story-actions";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ id: string }> };

export default async function StoryDetailPage({ params }: Props) {
  const { id } = await params;
  let story;
  try {
    story = await getStory(id);
  } catch (err) {
    // Only a real 404 means "story doesn't exist"; anything else (backend
    // down, 500) must surface via the error boundary instead.
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const storyId = story.slug ?? story.id ?? id;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">← Stories</Link>
        </Button>
        <h1 className="text-2xl font-semibold">{story.title}</h1>
      </div>

      <StoryForm initialStory={story} storyId={storyId} />

      <StoryActions storyId={storyId} />
    </div>
  );
}
