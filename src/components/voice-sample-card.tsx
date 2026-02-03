"use client";

import { getVoiceSampleAudioUrl } from "@/lib/api";
import { AudioPlayerWithDownload } from "@/components/audio-player-with-download";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  voiceId: string;
  hasAudio: boolean;
};

export function VoiceSampleCard({ voiceId, hasAudio }: Props) {
  if (!hasAudio) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sample audio</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          No sample yet. Save the voice to generate it, or wait for generation to finish.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sample audio</CardTitle>
      </CardHeader>
      <CardContent>
        <AudioPlayerWithDownload
          src={getVoiceSampleAudioUrl(voiceId)}
          downloadFilename={`${voiceId}.wav`}
          downloadLabel="Download"
        />
      </CardContent>
    </Card>
  );
}
