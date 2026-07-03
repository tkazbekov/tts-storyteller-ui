"use client";

import { useState } from "react";

type Props = {
  /** URL to the audio file (used for both playback and download). */
  src: string;
  /** Suggested filename when downloading. */
  downloadFilename?: string;
  /** Optional label for the download link. */
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
  const [failed, setFailed] = useState(false);

  return (
    <div className={className ? `flex flex-wrap items-center gap-3 ${className}` : "flex flex-wrap items-center gap-3"}>
      {failed ? (
        <p className="text-destructive flex-1 text-sm">
          Audio failed to load. It may not have been generated yet.
        </p>
      ) : (
        <audio
          controls
          src={src}
          className="h-12 min-w-52 flex-1"
          preload="metadata"
          onError={() => setFailed(true)}
        />
      )}
      <a
        href={src}
        download={downloadFilename}
        className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {downloadLabel}
      </a>
    </div>
  );
}
