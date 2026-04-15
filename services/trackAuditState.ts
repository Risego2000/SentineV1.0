import { GeometryLine, Track } from '../types';

const removeLastOccurrence = (items: string[], target: string): string[] => {
  const index = items.lastIndexOf(target);
  if (index === -1) return items;

  return [...items.slice(0, index), ...items.slice(index + 1)];
};

export const resetTrackAuditState = (track: Track, line: GeometryLine): void => {
  track.audited = false;
  track.auditStatus = 'failed';
  track.crossedLine = false;
  track.processedLines = track.processedLines.filter(
    (entry) => entry !== line.id && !entry.startsWith(`${line.id}_`)
  );
  track.roiHistory = removeLastOccurrence(track.roiHistory || [], line.id);
  track.lastZoneId = track.lastZoneId === line.id ? undefined : track.lastZoneId;
};
