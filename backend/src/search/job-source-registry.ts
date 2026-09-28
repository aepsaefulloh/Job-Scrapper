export interface JobSourceDefinition {
  id: string;
  name: string;
  available: boolean;
  supportsLocation: boolean;
  supportsFreshness: boolean;
  supportsWorkMode: boolean;
  description?: string;
}

export const JOB_SOURCE_REGISTRY: readonly JobSourceDefinition[] = [
  {
    id: 'jobstreet',
    name: 'Jobstreet',
    available: true,
    supportsLocation: true,
    supportsFreshness: true,
    supportsWorkMode: true,
    description: 'Southeast Asia jobs portal',
  },
  {
    id: 'loker-id',
    name: 'Loker.id',
    available: true,
    supportsLocation: true,
    supportsFreshness: true,
    supportsWorkMode: false,
    description: 'Indonesian job vacancy network',
  },
  {
    id: 'dealls',
    name: 'Dealls',
    available: true,
    supportsLocation: true,
    supportsFreshness: true,
    supportsWorkMode: true,
    description: 'Tech & business jobs in SEA',
  },
  {
    id: 'glints',
    name: 'Glints',
    available: true,
    supportsLocation: true,
    supportsFreshness: true,
    supportsWorkMode: true,
    description: 'Career discovery platform',
  },
  {
    id: 'kitalulus',
    name: 'KitaLulus',
    available: true,
    supportsLocation: true,
    supportsFreshness: true,
    supportsWorkMode: true,
    description: 'Indonesian workforce portal',
  },
  {
    id: 'kalibrr',
    name: 'Kalibrr',
    available: true,
    supportsLocation: true,
    supportsFreshness: true,
    supportsWorkMode: true,
    description: 'Southeast Asia recruitment platform',
  },
  {
    id: 'karir',
    name: 'Karir.com',
    available: true,
    supportsLocation: true,
    supportsFreshness: true,
    supportsWorkMode: false,
    description: 'Indonesian job portal',
  },
  {
    id: 'indeed',
    name: 'Indeed',
    available: true,
    supportsLocation: true,
    supportsFreshness: true,
    supportsWorkMode: true,
    description: 'Global job search engine (ID)',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    available: true,
    supportsLocation: true,
    supportsFreshness: true,
    supportsWorkMode: true,
    description: 'Professional networking & jobs (Guest)',
  },
] as const;

function resolveSourceId(sourceId: string): string {
  const normalized = sourceId.toLowerCase().trim();
  if (normalized === 'karir-com') return 'karir';
  return normalized;
}

export function getAvailableJobSourceIds(): string[] {
  return JOB_SOURCE_REGISTRY.filter((s) => s.available).map((s) => s.id);
}

export function isJobSourceAvailable(sourceId: string): boolean {
  const resolved = resolveSourceId(sourceId);
  const match = JOB_SOURCE_REGISTRY.find((s) => s.id === resolved);
  return match?.available === true;
}

export function getJobSourceDefinition(sourceId: string): JobSourceDefinition | undefined {
  const resolved = resolveSourceId(sourceId);
  return JOB_SOURCE_REGISTRY.find((s) => s.id === resolved);
}
