import { DEFAULT_SCORE_WEIGHTS } from './rules.js';
import type { CandidateScoringInput, JobScoringInput, RuleScore, ScoreWeights } from './types.js';

export function scoreJob(candidate: CandidateScoringInput, job: JobScoringInput, weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS): RuleScore {
  const candidateSkills = new Set(candidate.skills.map((skill) => skill.toLowerCase()));
  const jobSkills = job.skills.map((skill) => skill.toLowerCase());
  const matchedSkills = jobSkills.filter((skill) => candidateSkills.has(skill));
  const missingSkills = jobSkills.filter((skill) => !candidateSkills.has(skill));
  const breakdown = {
    skills: jobSkills.length ? Math.round((matchedSkills.length / jobSkills.length) * weights.skills) : weights.skills,
    experience: candidate.experienceYears !== undefined && job.experienceYears !== undefined && candidate.experienceYears >= job.experienceYears ? weights.experience : 0,
    role: candidate.headline?.trim() && job.title.toLowerCase().includes(candidate.headline.trim().toLowerCase().split(/\s+/)[0] ?? '') ? weights.role : 0,
    preference: candidate.preferences?.location && (job.workplaceType?.toLowerCase() === candidate.preferences.location.toLowerCase() || job.location?.toLowerCase() === candidate.preferences.location.toLowerCase()) ? weights.preference : 0,
    careerPreference: candidate.preferences?.career && job.title.toLowerCase().includes(candidate.preferences.career.toLowerCase()) ? weights.careerPreference : 0,
  };
  const total = Math.min(100, Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  return { total, breakdown, matchedSkills, missingSkills };
}
