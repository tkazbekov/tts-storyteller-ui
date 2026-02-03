"use client";

import { getVoiceSampleAudioUrl } from "@/lib/api";
import { AudioPlayerWithDownload } from "@/components/audio-player-with-download";

type Props = {
  voiceId: string;
  /** When true, the voice has reference audio and we show the player. */
  hasAudio: boolean;
};

export function VoiceAudioCell({ voiceId, hasAudio }: Props) {
  if (!hasAudio) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  return (
    <AudioPlayerWithDownload
      src={getVoiceSampleAudioUrl(voiceId)}
      downloadFilename={`${voiceId}.wav`}
      downloadLabel="Download"
      className="flex-wrap"
    />
  );
}
