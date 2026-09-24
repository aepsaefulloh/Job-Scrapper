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
    id: 'indeed',
    name: 'Indeed',
    available: false,
    supportsLocation: false,
    supportsFreshness: false,
    supportsWorkMode: false,
    description: 'Global job search engine',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    available: false,
    supportsLocation: false,
    supportsFreshness: false,
    supportsWorkMode: false,
    description: 'Professional networking & jobs',
  },
  {
    id: 'kitalulus',
    name: 'KitaLulus',
    available: false,
    supportsLocation: false,
    supportsFreshness: false,
    supportsWorkMode: false,
    description: 'Indonesian workforce portal',
  },
  {
    id: 'kalibrr',
    name: 'Kalibrr',
    available: false,
    supportsLocation: false,
    supportsFreshness: false,
    supportsWorkMode: false,
    description: 'Southeast Asia recruitment platform',
  },
  {
    id: 'karir-com',
    name: 'Karir.com',
    available: false,
    supportsLocation: false,
    supportsFreshness: false,
    supportsWorkMode: false,
    description: 'Indonesian job portal',
  },
] as const;

export function getAvailableJobSourceIds(): string[] {
  return JOB_SOURCE_REGISTRY.filter((s) => s.available).map((s) => s.id);
}

export function isJobSourceAvailable(sourceId: string): boolean {
  const match = JOB_SOURCE_REGISTRY.find((s) => s.id === sourceId);
  return match?.available === true;
}

export function getJobSourceDefinition(sourceId: string): JobSourceDefinition | undefined {
  return JOB_SOURCE_REGISTRY.find((s) => s.id === sourceId);
}
