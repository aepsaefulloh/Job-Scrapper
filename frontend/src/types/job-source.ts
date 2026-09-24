export interface JobSourceDefinition {
  id: string;
  name: string;
  available: boolean;
  supportsLocation?: boolean;
  supportsFreshness?: boolean;
  supportsWorkMode?: boolean;
  description?: string;
}
