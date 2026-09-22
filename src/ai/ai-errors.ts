export class AiConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = 'AiConfigurationError'; }
}

export class EmbeddingValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'EmbeddingValidationError'; }
}

export class AiProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) { super(message, options); this.name = 'AiProviderError'; }
}
