export type ScoreWeights = { skills: number; experience: number; role: number; preference: number };
export type RuleScore = { total: number; breakdown: ScoreWeights; matchedSkills: string[]; missingSkills: string[] };
export type CandidateScoringInput = { skills: string[]; headline?: string; experienceYears?: number; preferences?: { location?: string } };
export type JobScoringInput = { skills: string[]; title: string; experienceYears?: number; workplaceType?: string; location?: string };
