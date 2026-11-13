import { describe, expect, it } from 'vitest';
import { lambda, market, midBase } from './model';

describe('canyon market model', () => {
  it('market is calm with no events', () => {
    const m = market(30, []);
    expect(m.hs).toBe(0.16);
    expect(m.sh).toBe(0);
  });
  it('a shock widens the spread', () => {
    const ev = [{ t: 30, mag: 1, dir: -1 as const }];
    const m = market(31, ev);
    expect(m.hs).toBeGreaterThan(0.16);
    expect(m.cx).toBeLessThan(midBase(31));
  });
  it('lambda is 0.20 when calm', () => {
    expect(lambda(30, [])).toBe(0.2);
  });
});
