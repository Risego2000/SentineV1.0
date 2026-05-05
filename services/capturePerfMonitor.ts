export interface CapturePerfSample {
  ts: number;
  label: string;
  trackId: number;
  totalMs: number;
  generalMs: number;
  detailMs: number;
}

export interface CapturePerfSnapshot {
  enabled: boolean;
  count: number;
  avgTotalMs: number;
  maxTotalMs: number;
  last?: CapturePerfSample;
}

class CapturePerfMonitor {
  private count = 0;
  private totalAccum = 0;
  private maxTotalMs = 0;
  private last?: CapturePerfSample;

  isEnabled(): boolean {
    try {
      return localStorage.getItem('sentinel_debug_perf') === '1';
    } catch {
      return false;
    }
  }

  report(sample: CapturePerfSample): void {
    this.last = sample;
    this.count += 1;
    this.totalAccum += sample.totalMs;
    this.maxTotalMs = Math.max(this.maxTotalMs, sample.totalMs);
  }

  getSnapshot(): CapturePerfSnapshot {
    return {
      enabled: this.isEnabled(),
      count: this.count,
      avgTotalMs: this.count > 0 ? this.totalAccum / this.count : 0,
      maxTotalMs: this.maxTotalMs,
      last: this.last,
    };
  }
}

export const capturePerfMonitor = new CapturePerfMonitor();
