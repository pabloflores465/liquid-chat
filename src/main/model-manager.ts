import { app, BrowserWindow } from 'electron';
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync, renameSync } from 'fs';
import { join } from 'path';
import https from 'https';
import http from 'http';
import { ModelInfo, DownloadProgress } from './types.js';

const MODEL_FILENAME = 'LFM2-2.6B-Exp-Q4_K_M.gguf';
const MODEL_URL = 'https://huggingface.co/LiquidAI/LFM2-2.6B-Exp-GGUF/resolve/main/LFM2-2.6B-Exp-Q4_K_M.gguf';

export class ModelManager {
  private modelsDir: string;
  private mainWindow: BrowserWindow | null = null;

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

  getModelPath(): string {
    return join(this.modelsDir, MODEL_FILENAME);
  }

  getModelInfo(): ModelInfo {
    const modelPath = this.getModelPath();
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
      name: 'LiquidAI LFM2-2.6B',
      path: modelPath,
      size,
      downloaded,
    };
  }

  isModelDownloaded(): boolean {
    return existsSync(this.getModelPath());
  }

  private sendProgress(progress: DownloadProgress): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('model:download-progress', progress);
    }
  }

  async downloadModel(): Promise<string> {
    const modelPath = this.getModelPath();
    const tempPath = modelPath + '.tmp';

    if (existsSync(modelPath)) {
      return modelPath;
    }

    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }

    return new Promise((resolve, reject) => {
      const makeRequest = (url: string): void => {
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, { headers: { 'User-Agent': 'LiquidChat/1.0' } }, (response) => {
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
            downloadedBytes += chunk.length;
            const percent = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
            this.sendProgress({ percent, downloadedBytes, totalBytes });
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close(() => {
              try {
                renameSync(tempPath, modelPath);
                resolve(modelPath);
              } catch (err) {
                reject(err);
              }
            });
          });

          file.on('error', (err) => {
            unlinkSync(tempPath);
            reject(err);
          });

          response.on('error', (err) => {
            file.close();
            unlinkSync(tempPath);
            reject(err);
          });
        }).on('error', reject);
      };

      makeRequest(MODEL_URL);
    });
  }

  cancelDownload(): void {
    const tempPath = this.getModelPath() + '.tmp';
    if (existsSync(tempPath)) {
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore errors when deleting temp file
      }
    }
  }
}

export const modelManager = new ModelManager();
