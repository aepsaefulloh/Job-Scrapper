/** Normalize a keyword: trim, collapse whitespace, lowercase. */
export function normalizeKeyword(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Small, extensible alias map. Keys are normalized role names.
 * Add new entries as needed — keep it concise.
 */
const ALIAS_MAP: Record<string, string[]> = {
  accountant: ['accountant', 'accounting staff', 'finance accounting', 'general ledger accountant', 'junior accountant'],
  'human resources': ['human resources', 'hr', 'hr officer', 'hr staff', 'people operations', 'rekrutmen'],
  'hr manager': ['hr manager', 'human resources manager', 'hr officer', 'people manager'],
  recruitment: ['recruitment', 'recruiter', 'talent acquisition', 'hr recruitment'],
  'digital marketing': ['digital marketing', 'digital marketing specialist', 'digital marketing executive', 'performance marketing', 'growth marketing'],
  marketing: ['marketing', 'marketing staff', 'marketing executive', 'marketing officer', 'brand marketing'],
  seo: ['seo', 'seo specialist', 'seo analyst'],
  'content writer': ['content writer', 'content creator', 'copywriter', 'content strategist'],
  'frontend developer': ['frontend developer', 'frontend engineer', 'web developer', 'ui developer', 'vue developer', 'react developer'],
  'backend developer': ['backend developer', 'backend engineer', 'software engineer', 'node.js developer'],
  'software engineer': ['software engineer', 'software developer', 'programmer', 'developer'],
  'data analyst': ['data analyst', 'business analyst', 'junior data analyst', 'analytics'],
  'product manager': ['product manager', 'product owner', 'product management'],
  'project manager': ['project manager', 'project officer', 'project coordinator'],
  finance: ['finance', 'finance staff', 'finance officer', 'finance analyst', 'keuangan'],
  sales: ['sales', 'sales executive', 'sales officer', 'sales representative', 'business development'],
  'customer service': ['customer service', 'customer support', 'cs', 'customer relations'],
  operations: ['operations', 'operational staff', 'operations officer', 'ops'],
  logistics: ['logistics', 'supply chain', 'procurement', 'warehouse'],
  administration: ['administration', 'admin', 'staff administrasi', 'administrator', 'office administration'],
  'graphic designer': ['graphic designer', 'desainer grafis', 'visual designer', 'creative designer'],
  'ui ux designer': ['ui ux designer', 'ui designer', 'ux designer', 'product designer'],
  teacher: ['teacher', 'guru', 'pengajar', 'educator', 'instructor', 'tutor'],
  legal: ['legal', 'legal staff', 'legal officer', 'corporate legal', 'compliance'],
  accounting: ['accounting', 'accountant', 'accounting officer', 'staf akuntansi'],
};

/**
 * Expand a role string to its known aliases.
 * Falls back gracefully to [role] if no alias entry exists.
 * Result is deduplicated.
 */
export function expandRoleAliases(role: string): string[] {
  const normalized = normalizeKeyword(role);
  const aliases = ALIAS_MAP[normalized];
  if (!aliases) return [normalized];
  const seen = new Set<string>();
  return aliases.map(normalizeKeyword).filter(a => {
    if (seen.has(a)) return false;
    seen.add(a);
    return true;
  });
}
