import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, getVoice } from "@/lib/api";
import { VoiceForm } from "@/components/voice-form";
import { VoiceSampleCard } from "@/components/voice-sample-card";
import { DeleteVoiceButton } from "@/components/delete-voice-button";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ voiceId: string }> };

export default async function EditVoicePage({ params }: Props) {
  const { voiceId } = await params;
  let voice;
  try {
    voice = await getVoice(voiceId);
  } catch (err) {
    // Only a real 404 means "voice doesn't exist"; anything else (backend
    // down, 500) must surface via the error boundary instead.
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/voices">← Voices</Link>
          </Button>
          <h1 className="text-2xl font-semibold">Edit voice: {voice.id}</h1>
        </div>
        <DeleteVoiceButton voiceId={voiceId} />
      </div>

      <VoiceForm initialVoice={voice} voiceId={voiceId} />

      <VoiceSampleCard voiceId={voiceId} hasAudio={!!voice.refAudioPath} />
    </div>
  );
}
