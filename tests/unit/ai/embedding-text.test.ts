import { describe, expect, it } from 'vitest';
import { buildProfileEmbeddingText } from '../../../src/ai/embedding/profile-embedding-text.js';
import { buildJobEmbeddingText } from '../../../src/ai/embedding/job-embedding-text.js';

describe('embedding text builders', () => {
  it('builds profile text from structured fields without Markdown formatting', () => {
    const text = buildProfileEmbeddingText({ displayName: 'A', headline: 'Backend Engineer', summary: 'Build APIs', experience: '3 years', careerPreferences: 'Remote', skills: [{ displayName: 'TypeScript', canonicalName: 'typescript' }] });
    expect(text).toContain('Role: Backend Engineer');
    expect(text).toContain('Skills: TypeScript');
    expect(text).not.toContain('#');
  });

  it('builds job text with normalized fields and skills', () => {
    const text = buildJobEmbeddingText({ title: 'Engineer', companyName: 'Example', description: 'Build APIs', location: 'Remote', workplaceType: 'remote' }, [{ displayName: 'TypeScript', canonicalName: 'typescript', matchMethod: 'keyword' }]);
    expect(text).toContain('Title: Engineer');
    expect(text).toContain('Skills: TypeScript');
  });
});
