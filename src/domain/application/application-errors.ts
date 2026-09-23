export class ApplicationNotFoundError extends Error {
  public constructor(message = 'Application was not found.') {
    super(message);
    this.name = 'ApplicationNotFoundError';
  }
}

export class ApplicationValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ApplicationValidationError';
  }
}

export class ApplicationConflictError extends Error {
  public constructor(message = 'An active application already exists for this job.') {
    super(message);
    this.name = 'ApplicationConflictError';
  }
}

export class ApplicationMaterialGenerationError extends Error {
  public constructor(message = 'Failed to generate application material.', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ApplicationMaterialGenerationError';
  }
}
