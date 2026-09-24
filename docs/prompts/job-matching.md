# Job Matching Prompt

Prompt version: `job-match-v2`.

Evaluate only the compact, structured candidate and job fields supplied by the matching pipeline. Use the deterministic rule score as supporting evidence. Do not invent candidate experience or job requirements.

Return only this JSON shape:

```json
{
  "score": 82,
  "recommendation": "strong_match",
  "strengths": ["Strong TypeScript evidence"],
  "gaps": ["No AWS evidence"],
  "summary": "Good fit for the core backend responsibilities."
}
```

`recommendation` must be `strong_match`, `potential_match`, or `weak_match`. Return no more than three strengths and three gaps. Each list item must be at most 160 characters, and the summary must be at most 280 characters.
