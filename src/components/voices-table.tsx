"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { DeleteVoiceButton } from "@/components/delete-voice-button";
import { VoiceAudioCell } from "@/components/voice-audio-cell";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Voice } from "@/lib/api-types";
import { cn } from "@/lib/utils";

type Props = {
  voices: Voice[];
};

export function VoicesTable({ voices }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <div className="w-full">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="border-b">
          <tr>
            <th className="h-10 w-12 px-2 text-left align-middle font-medium text-foreground" aria-label="Expand" />
            <th className="h-10 px-2 text-left align-middle font-medium text-foreground">ID</th>
            <th className="h-10 px-2 text-left align-middle font-medium text-foreground">Language</th>
          </tr>
        </thead>
        <tbody>
          {voices.map((v) => {
            const isExpanded = expandedId === v.id;
            return (
              <Fragment key={v.id}>
                <tr
                  className={cn(
                    "cursor-pointer select-none border-b transition-colors hover:bg-muted/50",
                    isExpanded && "bg-muted/50 border-b-0"
                  )}
                  onClick={() => toggle(v.id)}
                >
                  <td className="w-12 p-2 align-middle text-muted-foreground">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    )}
                  </td>
                  <td className="p-2 align-middle font-medium">{v.id}</td>
                  <td className="p-2 align-middle">{v.language}</td>
                </tr>
                {isExpanded && (
                  <tr className="border-b bg-muted/30">
                    <td colSpan={3} className="p-3 align-middle">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="w-full sm:flex-1">
                          <VoiceAudioCell
                            voiceId={v.id}
                            hasAudio={!!v.refAudioPath}
                          />
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" asChild>
                            <Link
                              href={`/voices/${encodeURIComponent(v.id)}/edit`}
                            >
                              Edit
                            </Link>
                          </Button>
                          <DeleteVoiceButton voiceId={v.id} size="sm" />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
