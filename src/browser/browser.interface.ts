export type BrowserSessionOptions = { headless?: boolean; timeoutMs?: number };
export interface BrowserSession { goto(url: string): Promise<void>; getContent(): Promise<string>; close(): Promise<void>; }
export interface BrowserService { createSession(options?: BrowserSessionOptions): Promise<BrowserSession>; }
