import Link from "next/link";
import { VoiceForm } from "@/components/voice-form";
import { Button } from "@/components/ui/button";

export default function NewVoicePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/voices">← Voices</Link>
        </Button>
        <h1 className="text-2xl font-semibold">New voice</h1>
      </div>
      <VoiceForm />
    </div>
  );
}
