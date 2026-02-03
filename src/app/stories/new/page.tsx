import Link from "next/link";
import { StoryForm } from "@/components/story-form";
import { Button } from "@/components/ui/button";

export default function NewStoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">← Back</Link>
        </Button>
        <h1 className="text-2xl font-semibold">New story</h1>
      </div>
      <StoryForm />
    </div>
  );
}
