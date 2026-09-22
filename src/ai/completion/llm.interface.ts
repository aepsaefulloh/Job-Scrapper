export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type CompletionRequest = { model: string; messages: ChatMessage[] };
export type CompletionResult = { content: string };

export interface CompletionProvider {
  complete(request: CompletionRequest): Promise<CompletionResult>;
}
