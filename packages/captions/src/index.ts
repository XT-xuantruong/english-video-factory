export interface CaptionCue {
  text: string;
  startSec: number;
  durationSec: number;
}

export function formatSrtTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const milliseconds = totalMs % 1000;
  const pad = (value: number, length: number) => String(value).padStart(length, "0");
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(milliseconds, 3)}`;
}

export function buildSrt(cues: CaptionCue[]): string {
  return cues
    .map((cue, index) => {
      const end = cue.startSec + cue.durationSec;
      return `${index + 1}\n${formatSrtTimestamp(cue.startSec)} --> ${formatSrtTimestamp(end)}\n${cue.text.trim()}\n`;
    })
    .join("\n");
}
