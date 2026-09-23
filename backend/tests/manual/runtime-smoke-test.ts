import { parseCandidateMarkdown } from '../../src/domain/profile/markdown-profile-parser.js';
import { SearchProfileService } from '../../src/search/search-profile.service.js';
import { SearchPlanner } from '../../src/search/search-planner.js';
import { applyHardFilters } from '../../src/search/eligibility-filter.js';
import type { CandidateProfileDetail } from '../../src/infrastructure/supabase/profile-repository.js';
import type { SearchProfileRepository } from '../../src/search/search-profile.repository.js';
import type { CandidateSearchProfile } from '../../src/search/search-types.js';

// In-memory mock repo for test
class InMemorySearchProfileRepository implements SearchProfileRepository {
  private store = new Map<string, CandidateSearchProfile>();
  async get(candidateId: string): Promise<CandidateSearchProfile | null> {
    return this.store.get(candidateId) ?? null;
  }
  async save(profile: CandidateSearchProfile): Promise<void> {
    this.store.set(profile.candidateId, profile);
  }
}

async function runSmokeTests() {
  console.log('=== RUNTIME SMOKE TEST ===\n');
  const repo = new InMemorySearchProfileRepository();
  const service = new SearchProfileService(repo);
  const planner = new SearchPlanner();

  // 1. NON-TECHNICAL CANDIDATE (Accountant)
  const nonTechCandidate: CandidateProfileDetail = {
    id: 'prof-acc-01',
    candidateId: 'cand-accountant-001',
    displayName: 'Siti Rahmawati',
    headline: 'Senior Accountant',
    summary: 'Akuntan berpengalaman 4 tahun mengelola laporan keuangan dan perpajakan perusahaan.',
    experience: 'PT Maju Bersama | Akuntan | 2021-2025',
    careerPreferences: null,
    skills: [
      { displayName: 'Financial Reporting', canonicalName: 'financial reporting' },
      { displayName: 'Microsoft Excel', canonicalName: 'microsoft excel' },
      { displayName: 'Tax', canonicalName: 'tax' },
      { displayName: 'General Ledger', canonicalName: 'general ledger' },
      { displayName: 'Rekonsiliasi Bank', canonicalName: 'rekonsiliasi bank' },
    ],
    updatedAt: new Date().toISOString(),
  };

  const nonTechSearchProfile = await service.getOrDerive(nonTechCandidate.candidateId, nonTechCandidate);
  // Add preferred location & exclusions
  nonTechSearchProfile.preferredLocations = ['Jakarta', 'Tangerang'];
  nonTechSearchProfile.excludedRoles = ['internship', 'sales'];
  nonTechSearchProfile.excludedCompanies = ['BlacklistedFinanceCorp'];
  await service.save(nonTechSearchProfile);

  const nonTechIntents = planner.createIntents(nonTechSearchProfile, { defaultMaxPages: 3 });

  console.log('--- 1. Non-Technical Candidate (Accountant) ---');
  console.log('Target Roles:', nonTechSearchProfile.targetRoles);
  console.log('Primary Skills:', nonTechSearchProfile.primarySkills);
  console.log('Generated Search Intents (' + nonTechIntents.length + '):');
  for (const intent of nonTechIntents) {
    console.log(`  - [${intent.source}] keyword="${intent.keyword}", location="${intent.location}", maxPages=${intent.maxPages}`);
  }

  // Verify non-tech assertions
  const techKeywords = ['developer', 'software', 'engineer', 'react', 'node', 'coding', 'frontend', 'backend'];
  const hasTechAssumption = nonTechIntents.some(i => techKeywords.some(tk => i.keyword.includes(tk)));
  if (hasTechAssumption) {
    throw new Error('FAIL: Non-tech profile contains tech/software keywords!');
  }
  console.log('✔ Non-tech profile has NO tech/software assumptions.');

  // Verify duplicates
  const keys = nonTechIntents.map(i => `${i.source}:${i.keyword}:${i.location}`);
  const uniqueKeys = new Set(keys);
  if (keys.length !== uniqueKeys.size) {
    throw new Error('FAIL: Duplicate search intents detected!');
  }
  console.log('✔ Duplicate query removed: all intents are unique.');

  // Verify location
  const locationsUsed = new Set(nonTechIntents.map(i => i.location));
  if (!locationsUsed.has('Jakarta') || !locationsUsed.has('Tangerang')) {
    throw new Error('FAIL: Preferred locations not respected!');
  }
  console.log('✔ Preferred locations respected (Jakarta, Tangerang).');

  // Verify eligibility filter
  const sampleNonTechJobGood = {
    title: 'Senior Accountant & Tax',
    companyName: 'PT Finansial Sejahtera',
    location: 'Jakarta',
    employmentType: 'full-time',
  };
  const filterGood = applyHardFilters(sampleNonTechJobGood, nonTechSearchProfile);
  console.log('Eligibility check valid job:', filterGood);

  const sampleNonTechJobBlockedCompany = {
    title: 'Senior Accountant',
    companyName: 'BlacklistedFinanceCorp',
    location: 'Jakarta',
  };
  const filterBlocked = applyHardFilters(sampleNonTechJobBlockedCompany, nonTechSearchProfile);
  console.log('Eligibility check blocked company:', filterBlocked);
  if (filterBlocked.eligible !== false) throw new Error('FAIL: Blocked company was not rejected!');

  const sampleNonTechJobExcludedRole = {
    title: 'Sales & Accounting Representative',
    companyName: 'PT Niaga Maju',
    location: 'Jakarta',
  };
  const filterExcluded = applyHardFilters(sampleNonTechJobExcludedRole, nonTechSearchProfile);
  console.log('Eligibility check excluded role in title:', filterExcluded);
  if (filterExcluded.eligible !== false) throw new Error('FAIL: Excluded role was not rejected!');

  // 2. TECHNICAL CANDIDATE (Full Stack / Frontend Developer)
  const techCandidate: CandidateProfileDetail = {
    id: 'prof-tech-01',
    candidateId: 'cand-tech-001',
    displayName: 'Ahmad Faisal',
    headline: 'Senior Frontend Developer',
    summary: 'Frontend developer dengan pengalaman 5 tahun membangun aplikasi web Vue.js dan TypeScript.',
    experience: 'Tech StartUp | Frontend Lead | 2022-2025',
    careerPreferences: null,
    skills: [
      { displayName: 'Vue.js', canonicalName: 'vue.js' },
      { displayName: 'TypeScript', canonicalName: 'typescript' },
      { displayName: 'Tailwind CSS', canonicalName: 'tailwind css' },
      { displayName: 'REST API', canonicalName: 'rest api' },
    ],
    updatedAt: new Date().toISOString(),
  };

  const techSearchProfile = await service.getOrDerive(techCandidate.candidateId, techCandidate);
  techSearchProfile.preferredLocations = ['Jakarta', 'Remote'];
  techSearchProfile.excludedRoles = ['internship'];
  await service.save(techSearchProfile);

  const techIntents = planner.createIntents(techSearchProfile, { defaultMaxPages: 2 });

  console.log('\n--- 2. Technical Candidate (Frontend Developer) ---');
  console.log('Target Roles:', techSearchProfile.targetRoles);
  console.log('Primary Skills:', techSearchProfile.primarySkills);
  console.log('Generated Search Intents (' + techIntents.length + '):');
  for (const intent of techIntents) {
    console.log(`  - [${intent.source}] keyword="${intent.keyword}", location="${intent.location}", maxPages=${intent.maxPages}`);
  }

  // Verify tech assertions
  const hasFrontendKeywords = techIntents.some(i => i.keyword.includes('frontend') || i.keyword.includes('developer'));
  if (!hasFrontendKeywords) {
    throw new Error('FAIL: Tech profile missing frontend keywords!');
  }
  console.log('✔ Tech profile generated relevant developer intents.');

  // 3. VERIFY LIFECYCLE INVALIDATION TEST
  console.log('\n--- 3. Verifying Invalidation Lifecycle ---');
  // Cache check: same profile returns cached
  const cachedProfile = await service.getOrDerive(techCandidate.candidateId, techCandidate);
  if (cachedProfile.generatedAt !== techSearchProfile.generatedAt) {
    throw new Error('FAIL: Profile was unnecessarily regenerated without changes!');
  }
  console.log('✔ Unchanged profile uses cached search profile (no regeneration).');

  // Candidate updates profile headline & skills
  const updatedTechCandidate: CandidateProfileDetail = {
    ...techCandidate,
    id: 'prof-tech-02',
    headline: 'Engineering Manager',
    updatedAt: new Date(Date.now() + 10000).toISOString(),
    skills: [
      { displayName: 'Engineering Management', canonicalName: 'engineering management' },
      { displayName: 'Agile', canonicalName: 'agile' },
    ],
  };

  const refreshedSearchProfile = await service.getOrDerive(techCandidate.candidateId, updatedTechCandidate);
  console.log('Refreshed Target Roles:', refreshedSearchProfile.targetRoles);
  console.log('Refreshed Skills:', refreshedSearchProfile.primarySkills);
  console.log('Preserved Preferred Locations:', refreshedSearchProfile.preferredLocations);
  if (refreshedSearchProfile.targetRoles[0] !== 'Engineering Manager') {
    throw new Error('FAIL: Search profile was not invalidated upon candidate profile update!');
  }
  if (!refreshedSearchProfile.preferredLocations.includes('Jakarta')) {
    throw new Error('FAIL: User preferences were lost during invalidation!');
  }
  console.log('✔ Updated profile successfully invalidated old cache and derived fresh profile while preserving preferences.');

  console.log('\n=== ALL RUNTIME SMOKE TESTS PASSED ===');
}

runSmokeTests().catch(err => {
  console.error(err);
  process.exit(1);
});
