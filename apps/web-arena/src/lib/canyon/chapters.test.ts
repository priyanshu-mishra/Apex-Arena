import { describe, expect, it } from 'vitest';
import { CHAPTERS, blendChapter, chapterTable, stagingTable } from './chapters';

describe('chapters', () => {
  it('has 10 chapters', () => {
    expect(CHAPTERS).toHaveLength(10);
  });
  it('blendChapter endpoints', () => {
    const a = CHAPTERS[0], b = CHAPTERS[1];
    const r0 = blendChapter(a, b, 0), r1 = blendChapter(a, b, 1);
    expect(r0.pos).toEqual(a.pos);
    expect(r0.fov).toBe(a.fov);
    expect(r0.follow).toBe(0);
    expect(r1.pos).toEqual(b.pos);
    expect(r1.tgt).toEqual(b.tgt);
    expect(r1.follow).toBe(1);
    expect(r1.orders).toBe(b.orders);
  });
  it('chapterState switches table on aspect', () => {
    expect(chapterTable(0.6)[0].pos).toEqual([0, 7, 32]);
    expect(chapterTable(1.6)[0].pos).toEqual([-1.2, 5.2, 17.5]);
  });
  it('portrait keeps non-camera fields', () => {
    expect(chapterTable(0.6)[5].score).toBe(1);
  });
  it('stagingTable applies the portrait staging and leaves landscape untouched', () => {
    expect(stagingTable(1.6)).toBe(CHAPTERS);
    const p = stagingTable(0.6);
    expect(p[0].pos).toEqual([0, 7, 32]);
    expect([p[1].agents, p[2].agents, p[5].agents, p[5].score, p[5].dim]).toEqual([0, 0, 0, 0, 0.5]);
    expect(CHAPTERS[5].score).toBe(1);
  });
});
