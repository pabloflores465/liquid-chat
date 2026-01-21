import { BrowserWindow } from 'electron';
import { Message } from './types.js';

const MODEL_ID = 'qwen/qwen3-4b-2507';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class LLMEngine {
  private mainWindow: BrowserWindow | null = null;
  private isGenerating = false;
  private shouldStop = false;
  private abortController: AbortController | null = null;
  private generatingForConversationId: string | null = null;
  private conversationHistory: OpenRouterMessage[] = [];
  private apiKey: string | null = null;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  async initialize(): Promise<void> {
    this.sendStatus('Ready');
  }

  async resetSession(): Promise<void> {
    if (this.isGenerating) {
      this.stopGeneration();
    }
    this.conversationHistory = [];
  }

  async loadConversationHistory(messages: Message[]): Promise<void> {
    this.conversationHistory = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  async generate(
    prompt: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    if (this.isGenerating) {
      throw new Error('Already generating');
    }

    this.isGenerating = true;
    this.shouldStop = false;
    this.abortController = new AbortController();

    let fullResponse = '';

    try {
      const messages: OpenRouterMessage[] = [
        ...this.conversationHistory,
        { role: 'user', content: prompt },
      ];

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://liquid-chat.app',
          'X-Title': 'Liquid Chat',
        },
        body: JSON.stringify({
          model: MODEL_ID,
          messages,
          stream: true,
          max_tokens: 2048,
          temperature: 0.7,
          top_p: 0.9,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();

      while (true) {
        if (this.shouldStop) {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                onChunk(content);
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }

      // Add to conversation history
      this.conversationHistory.push({ role: 'user', content: prompt });
      this.conversationHistory.push({ role: 'assistant', content: fullResponse });

      return fullResponse;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return fullResponse;
      }
      throw error;
    } finally {
      this.isGenerating = false;
      this.shouldStop = false;
      this.abortController = null;
      this.generatingForConversationId = null;
    }
  }

  stopGeneration(): void {
    this.shouldStop = true;
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  isReady(): boolean {
    return this.apiKey !== null;
  }

  isCurrentlyGenerating(): boolean {
    return this.isGenerating;
  }

  setGeneratingConversationId(id: string | null): void {
    this.generatingForConversationId = id;
  }

  getGeneratingConversationId(): string | null {
    return this.generatingForConversationId;
  }

  private sendStatus(status: string): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('llm:status', status);
    }
  }

  async dispose(): Promise<void> {
    this.stopGeneration();
    this.conversationHistory = [];
  }
}

export const llmEngine = new LLMEngine();
