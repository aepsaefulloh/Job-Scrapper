import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { parseCandidateMarkdown } from '../../../src/domain/profile/markdown-profile-parser.js';

const fixturePath = new URL('../../fixtures/candidate-valid.md', import.meta.url);
const crlfFixturePath = new URL('../../fixtures/candidate-crlf.md', import.meta.url);

describe('parseCandidateMarkdown', () => {
  it('parses recognized sections and normalizes duplicate skills', async () => {
    const validMarkdown = await readFile(fixturePath, 'utf8');

    expect(parseCandidateMarkdown(validMarkdown)).toEqual({
      displayName: 'Ada Lovelace',
      headline: 'Analytical Engine Pioneer',
      summary: 'Writes notes about the analytical engine.',
      experience: 'Mathematical research and algorithm design.',
      careerPreferences: 'Remote engineering roles.',
      skills: [
        { displayName: 'TypeScript', canonicalName: 'typescript' },
        { displayName: 'PostgreSQL', canonicalName: 'postgresql' }
      ]
    });
  });

  it('reports every missing required section', () => {
    expect(() => parseCandidateMarkdown('## Summary\nExample'))
      .toThrow('Invalid candidate profile Markdown: missing # Name; missing ## Skills');
  });

  it('accepts UTF-8 BOM and CRLF input', async () => {
    const crlfMarkdown = (await readFile(crlfFixturePath, 'utf8')).replace(/\n/g, '\r\n');

    expect(parseCandidateMarkdown(`\uFEFF${crlfMarkdown}`).displayName).toBe('Ada Lovelace');
  });

  it('parses natural converted markdown CV format', async () => {
    const fixturePath = new URL('../../fixtures/candidate-natural.md', import.meta.url);
    const naturalMarkdown = await readFile(fixturePath, 'utf8');

    const result = parseCandidateMarkdown(naturalMarkdown);
    expect(result.displayName).toBe('Siti Nurhaliza');
    expect(result.headline).toContain('Staff Administrasi Manajemen');
    expect(result.summary).toContain('Lulusan S1 Manajemen');
    expect(result.experience).toContain('PT Nusantara Abadi');
    expect(result.experience).toContain('Staff Administrasi Operasional');
    expect(result.skills.length).toBeGreaterThan(8);
    expect(result.skills.some((s) => s.displayName === 'Administrasi Perkantoran')).toBe(true);
    expect(result.skills.some((s) => s.displayName === 'ChatGPT')).toBe(true);
  });
});

