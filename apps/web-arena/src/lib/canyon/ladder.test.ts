import { describe, expect, it } from 'vitest';
import { REAL } from './real';
import { walkAsks } from './ladder';

describe('walkAsks', () => {
  it('matches the prototype at 12 ETH', () => {
    const r = walkAsks(12, REAL.asks, REAL.mid);
    expect(r.levelsCleared).toBe(3);
    expect(r.avgFill).toBeCloseTo(2144.33, 2);
    expect(r.impactBps).toBeCloseTo(17.3, 1);
  });
  it('clamps to available depth', () => {
    const total = REAL.asks.reduce((s, [, z]) => s + z, 0);
    const r = walkAsks(1000, REAL.asks, REAL.mid);
    expect(r.levelsCleared).toBe(7);
    expect(r.filled).toBeCloseTo(total, 9);
    expect(Number.isFinite(r.avgFill)).toBe(true);
    const last = REAL.asks[REAL.asks.length - 1][0];
    expect(r.impactBps).toBeCloseTo(((last - REAL.mid) / REAL.mid) * 1e4, 9);
  });
  it('walkAsks of zero', () => {
    const r = walkAsks(0, REAL.asks, REAL.mid);
    expect(r.filled).toBe(0);
    expect(r.levelsCleared).toBe(0);
    expect(r.impactBps).toBe(0);
    expect(r.avgFill).toBe(REAL.asks[0][0]);
  });
});
