export class MarkdownProfileValidationError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(`Invalid candidate profile Markdown: ${issues.join('; ')}`);
    this.name = 'MarkdownProfileValidationError';
    this.issues = issues;
  }
}
