import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeJob, canonicalizeJobUrl } from '../../../src/domain/job/job-normalizer.js';
import type { RawJobInput } from '../../../src/domain/job/job-types.js';

describe('Zero-LLM Scraping & Normalization Verification', () => {
  it('ensures no scraping or normalizer source files import any LLM or AI completion modules', () => {
    const scrapingDir = path.resolve(import.meta.dirname, '../../../src/scraping');
    const domainDir = path.resolve(import.meta.dirname, '../../../src/domain/job');

    const checkDirForLlmImports = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          const fullPath = path.join(entry.parentPath || dir, entry.name);
          const content = fs.readFileSync(fullPath, 'utf8');

          // Strict rule: No LLM imports, no completion calls, no OpenAI/Anthropic/SumoPod completion imports
          expect(content).not.toContain('LlmService');
          expect(content).not.toContain('completeJson');
          expect(content).not.toContain('completeText');
          expect(content).not.toContain('SumoPodProvider');
        }
      }
    };

    checkDirForLlmImports(scrapingDir);
    checkDirForLlmImports(domainDir);
  });

  it('proves raw job normalization and canonicalization are 100% deterministic', () => {
    const rawJob: RawJobInput = {
      source: 'jobstreet',
      url: 'https://www.jobstreet.co.id/en/job/123456?utm_source=test',
      fetchedAt: '2026-09-28T00:00:00.000Z',
      payload: {
        title: ' Senior Financial Accountant  ',
        company: ' Ernst & Young ',
        location: ' Jakarta Selatan ',
        description: 'Prepare balance sheets, tax returns, and general ledgers.',
        publishedAt: '2026-09-25T10:00:00.000Z',
      },
    };

    const firstResult = normalizeJob(rawJob);
    const secondResult = normalizeJob(rawJob);

    // Exact deterministic equality
    expect(firstResult.title).toBe('Senior Financial Accountant');
    expect(firstResult.companyName).toBe('Ernst & Young');
    expect(firstResult.canonicalUrl).toBe('https://www.jobstreet.co.id/en/job/123456');
    expect(canonicalizeJobUrl(rawJob.url)).toBe('https://www.jobstreet.co.id/en/job/123456');
    expect(firstResult).toEqual(secondResult);
  });
});
