import { describe, expect, it } from 'vitest';
import { extractJobSkills } from '../../../src/domain/job/job-skills.js';

describe('job skill extraction', () => {
  it('matches configured skills with token boundaries', () => {
    const skills = extractJobSkills('Build services with Go and Google Cloud using TypeScript.', [
      { displayName: 'Go', canonicalName: 'go' },
      { displayName: 'TypeScript', canonicalName: 'typescript' },
    ]);

    expect(skills.map((skill) => skill.canonicalName)).toEqual(['go', 'typescript']);
  });
});
