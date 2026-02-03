"use client";

import { Button } from "@/components/ui/button";

type Props = {
  /** URL to the audio file (used for both playback and download). */
  src: string;
  /** Suggested filename when downloading. */
  downloadFilename?: string;
  /** Optional label for the download button. */
  downloadLabel?: string;
  /** Extra class for the wrapper. */
  className?: string;
};

export function AudioPlayerWithDownload({
  src,
  downloadFilename,
  downloadLabel = "Download",
  className,
}: Props) {
  return (
    <div className={className ? `flex flex-wrap items-center gap-3 ${className}` : "flex flex-wrap items-center gap-3"}>
      <audio controls src={src} className="h-12 w-full" preload="metadata" />
    </div>
  );
}
