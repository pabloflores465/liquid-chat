import { app, BrowserWindow } from 'electron';
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync, renameSync } from 'fs';
import { join } from 'path';
import https from 'https';
import http from 'http';
import { ModelInfo, DownloadProgress, ModelDefinition, ModelId } from './types.js';

const AVAILABLE_MODELS: ModelDefinition[] = [
  {
    id: 'qwen3-4b',
    name: 'Qwen3 4B',
    filename: 'Qwen3-4B-Q4_K_M.gguf',
    url: 'https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf',
    supportsThinking: false,
    description: 'Fast general-purpose model',
  },
  {
    id: 'qwen3-4b-thinking',
    name: 'Qwen3 4B Thinking',
    filename: 'Qwen3-4B-Thinking-2507-Q4_K_M.gguf',
    url: 'https://huggingface.co/unsloth/Qwen3-4B-Thinking-2507-GGUF/resolve/main/Qwen3-4B-Thinking-2507-Q4_K_M.gguf',
    supportsThinking: true,
    description: 'Reasoning model with visible thinking',
  },
];

export class ModelManager {
  private modelsDir: string;
  private mainWindow: BrowserWindow | null = null;
  private currentDownloadAbort: (() => void) | null = null;

  constructor() {
    if (app.isPackaged) {
      this.modelsDir = join(app.getPath('userData'), 'models');
    } else {
      this.modelsDir = join(process.cwd(), 'models');
    }

    if (!existsSync(this.modelsDir)) {
      mkdirSync(this.modelsDir, { recursive: true });
    }
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private getModelDefinition(modelId: ModelId): ModelDefinition {
    const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
    if (!model) {
      throw new Error(`Unknown model: ${modelId}`);
    }
    return model;
  }

  getModelPath(modelId: ModelId): string {
    const model = this.getModelDefinition(modelId);
    return join(this.modelsDir, model.filename);
  }

  getAllModels(): ModelInfo[] {
    return AVAILABLE_MODELS.map((model) => {
      const modelPath = join(this.modelsDir, model.filename);
      const downloaded = existsSync(modelPath);
      let size = 0;

      if (downloaded) {
        try {
          const stats = statSync(modelPath);
          size = stats.size;
        } catch {
          // File might not exist or be readable
        }
      }

      return {
        id: model.id,
        name: model.name,
        path: modelPath,
        size,
        downloaded,
        supportsThinking: model.supportsThinking,
        description: model.description,
      };
    });
  }

  getModelInfo(modelId: ModelId): ModelInfo {
    const model = this.getModelDefinition(modelId);
    const modelPath = join(this.modelsDir, model.filename);
    const downloaded = existsSync(modelPath);
    let size = 0;

    if (downloaded) {
      try {
        const stats = statSync(modelPath);
        size = stats.size;
      } catch {
        // File might not exist or be readable
      }
    }

    return {
      id: model.id,
      name: model.name,
      path: modelPath,
      size,
      downloaded,
      supportsThinking: model.supportsThinking,
      description: model.description,
    };
  }

  isModelDownloaded(modelId: ModelId): boolean {
    return existsSync(this.getModelPath(modelId));
  }

  private sendProgress(progress: DownloadProgress): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('model:download-progress', progress);
    }
  }

  async downloadModel(modelId: ModelId): Promise<string> {
    const model = this.getModelDefinition(modelId);
    const modelPath = join(this.modelsDir, model.filename);
    const tempPath = modelPath + '.tmp';

    if (existsSync(modelPath)) {
      return modelPath;
    }

    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }

    return new Promise((resolve, reject) => {
      let aborted = false;
      let currentRequest: http.ClientRequest | null = null;

      this.currentDownloadAbort = () => {
        aborted = true;
        if (currentRequest) {
          currentRequest.destroy();
        }
      };

      const makeRequest = (url: string): void => {
        if (aborted) {
          reject(new Error('Download cancelled'));
          return;
        }

        const protocol = url.startsWith('https') ? https : http;

        currentRequest = protocol.get(url, { headers: { 'User-Agent': 'LiquidChat/1.0' } }, (response) => {
          if (aborted) {
            response.destroy();
            reject(new Error('Download cancelled'));
            return;
          }

          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              makeRequest(redirectUrl);
              return;
            }
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed with status ${response.statusCode}`));
            return;
          }

          const totalBytes = parseInt(response.headers['content-length'] ?? '0', 10);
          let downloadedBytes = 0;

          const file = createWriteStream(tempPath);

          response.on('data', (chunk: Buffer) => {
            if (aborted) {
              response.destroy();
              file.close();
              return;
            }
            downloadedBytes += chunk.length;
            const percent = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
            this.sendProgress({ percent, downloadedBytes, totalBytes });
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close(() => {
              if (aborted) {
                if (existsSync(tempPath)) {
                  unlinkSync(tempPath);
                }
                reject(new Error('Download cancelled'));
                return;
              }
              try {
                renameSync(tempPath, modelPath);
                this.currentDownloadAbort = null;
                resolve(modelPath);
              } catch (err) {
                reject(err);
              }
            });
          });

          file.on('error', (err) => {
            if (existsSync(tempPath)) {
              unlinkSync(tempPath);
            }
            reject(err);
          });

          response.on('error', (err) => {
            file.close();
            if (existsSync(tempPath)) {
              unlinkSync(tempPath);
            }
            reject(err);
          });
        }).on('error', reject);
      };

      makeRequest(model.url);
    });
  }

  cancelDownload(): void {
    if (this.currentDownloadAbort) {
      this.currentDownloadAbort();
      this.currentDownloadAbort = null;
    }

    // Clean up any temp files
    for (const model of AVAILABLE_MODELS) {
      const tempPath = join(this.modelsDir, model.filename + '.tmp');
      if (existsSync(tempPath)) {
        try {
          unlinkSync(tempPath);
        } catch {
          // Ignore errors when deleting temp file
        }
      }
    }
  }
}

export const modelManager = new ModelManager();
