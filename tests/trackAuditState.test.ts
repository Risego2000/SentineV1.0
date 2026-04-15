import { describe, expect, it } from 'vitest';
import { resetTrackAuditState } from '../services/trackAuditState';
import { GeometryLine, Track } from '../types';

describe('trackAuditState', () => {
  it('releases a failed track so it can be audited again', () => {
    const track = {
      audited: true,
      auditStatus: 'processing',
      crossedLine: true,
      processedLines: ['line-1', 'line-1_box', 'other-line'],
      roiHistory: ['roi-a', 'line-1'],
      lastZoneId: 'line-1',
    } as Track;
    const line = { id: 'line-1' } as GeometryLine;

    resetTrackAuditState(track, line);

    expect(track.audited).toBe(false);
    expect(track.auditStatus).toBe('failed');
    expect(track.crossedLine).toBe(false);
    expect(track.processedLines).toEqual(['other-line']);
    expect(track.roiHistory).toEqual(['roi-a']);
    expect(track.lastZoneId).toBeUndefined();
  });
});
