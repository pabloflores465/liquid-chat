import { getLlama, LlamaChatSession, Llama, LlamaModel, LlamaContext, LlamaContextSequence } from 'node-llama-cpp';
import { BrowserWindow } from 'electron';
import { Message } from './types.js';

export class LLMEngine {
  private llama: Llama | null = null;
  private model: LlamaModel | null = null;
  private context: LlamaContext | null = null;
  private sequence: LlamaContextSequence | null = null;
  private session: LlamaChatSession | null = null;
  private mainWindow: BrowserWindow | null = null;
  private isGenerating = false;
  private abortController: AbortController | null = null;
  private generationPromise: Promise<string> | null = null;
  private generatingForConversationId: string | null = null;
  private supportsThinking = false;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  async initialize(modelPath: string, supportsThinking = false): Promise<void> {
    if (this.model) {
      return;
    }

    this.supportsThinking = supportsThinking;
    this.sendStatus('Initializing LLM engine...');

    this.llama = await getLlama();

    this.sendStatus('Loading model...');

    this.model = await this.llama.loadModel({
      modelPath,
    });

    this.sendStatus('Creating context...');

    this.context = await this.model.createContext({
      contextSize: 4096,
    });

    // Create a single sequence that we'll reuse
    this.sequence = this.context.getSequence();

    // Create initial session
    this.session = new LlamaChatSession({
      contextSequence: this.sequence,
    });

    this.sendStatus('Ready');
  }

  async resetSession(): Promise<void> {
    if (!this.context || !this.sequence) {
      throw new Error('LLM not initialized');
    }

    // Stop any ongoing generation and wait for it to finish
    if (this.isGenerating) {
      this.stopGeneration();
      if (this.generationPromise) {
        try {
          await this.generationPromise;
        } catch {
          // Ignore errors from aborted generation
        }
      }
    }

    // Dispose old session if exists
    if (this.session) {
      this.session = null;
    }

    // Erase the sequence state to start fresh
    this.sequence.eraseContextTokenRanges([
      { start: 0, end: this.sequence.nextTokenIndex }
    ]);

    // Create a new session with the same sequence
    this.session = new LlamaChatSession({
      contextSequence: this.sequence,
    });
  }

  async loadConversationHistory(messages: Message[]): Promise<void> {
    if (!this.session) {
      throw new Error('Session not created');
    }

    // Build chat history in the format node-llama-cpp expects
    const chatHistory: Array<{ type: 'user'; text: string } | { type: 'model'; response: string[] }> = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        chatHistory.push({
          type: 'user',
          text: msg.content,
        });
      } else if (msg.role === 'assistant') {
        chatHistory.push({
          type: 'model',
          response: [msg.content],
        });
      }
    }

    this.session.setChatHistory(chatHistory);
  }

  async generate(
    prompt: string,
    onChunk: (chunk: string, type: 'thinking' | 'content') => void
  ): Promise<string> {
    if (!this.context || !this.session) {
      throw new Error('LLM not initialized');
    }

    if (this.isGenerating) {
      throw new Error('Already generating');
    }

    this.isGenerating = true;
    this.abortController = new AbortController();

    let fullResponse = '';

    const doGenerate = async (): Promise<string> => {
      try {
        fullResponse = await this.session!.prompt(prompt, {
          maxTokens: 2000000,
          temperature: 0.7,
          topP: 0.9,
          signal: this.abortController!.signal,
          repeatPenalty: {
            penalty: 1.2,
            frequencyPenalty: 0.1,
            presencePenalty: 0.1,
            penalizeNewLine: false,
            lastTokens: 64,
          },
          onResponseChunk: (chunk) => {
            // Check if this is a thought segment
            const isThought = chunk.type === 'segment' && chunk.segmentType === 'thought';
            const chunkType = isThought ? 'thinking' : 'content';

            if (chunk.text) {
              onChunk(chunk.text, chunkType);
            }
          },
        });

        return fullResponse;
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          return fullResponse;
        }
        throw error;
      } finally {
        this.isGenerating = false;
        this.abortController = null;
        this.generationPromise = null;
        this.generatingForConversationId = null;
      }
    };

    this.generationPromise = doGenerate();
    return this.generationPromise;
  }

  stopGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  isReady(): boolean {
    return this.model !== null && this.context !== null && this.session !== null;
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
    this.session = null;
    this.sequence = null;

    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }

    if (this.model) {
      await this.model.dispose();
      this.model = null;
    }

    this.llama = null;
  }
}

export const llmEngine = new LLMEngine();
