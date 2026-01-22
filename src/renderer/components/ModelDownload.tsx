import React, { useState, useEffect, useCallback } from 'react';
import { DownloadProgress, ModelInfo, ModelId } from '../types/electron';

interface ModelDownloadProps {
  onDownloadComplete: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function ModelDownload({ onDownloadComplete }: ModelDownloadProps): React.ReactElement {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelId>('qwen3-4b-thinking');
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadModels = async (): Promise<void> => {
      const allModels = await window.electron.model.getAll();
      setModels(allModels);
    };
    loadModels();
  }, []);

  useEffect(() => {
    const unsubscribe = window.electron.model.onDownloadProgress((p) => {
      setProgress(p);
    });
    return unsubscribe;
  }, []);

  const handleDownload = useCallback(async (): Promise<void> => {
    setIsDownloading(true);
    setError(null);
    setProgress(null);

    try {
      // Save selected model to settings
      await window.electron.settings.update({ selectedModel });

      const result = await window.electron.model.download(selectedModel);
      if (result.success) {
        onDownloadComplete();
      } else {
        setError(result.error || 'Download failed');
        setIsDownloading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
      setIsDownloading(false);
    }
  }, [onDownloadComplete, selectedModel]);

  const handleCancel = useCallback(async (): Promise<void> => {
    await window.electron.model.cancelDownload();
    setIsDownloading(false);
    setProgress(null);
  }, []);

  const selectedModelInfo = models.find((m) => m.id === selectedModel);

  return (
    <div className="download-screen">
      <h2>Welcome to Liquid Chat</h2>
      <p>Select a model to download and get started.</p>

      {!isDownloading && (
        <div className="model-selector">
          {models.map((model) => (
            <label
              key={model.id}
              className={`model-option ${selectedModel === model.id ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="model"
                value={model.id}
                checked={selectedModel === model.id}
                onChange={() => setSelectedModel(model.id)}
              />
              <div className="model-option-content">
                <div className="model-option-header">
                  <span className="model-option-name">{model.name}</span>
                  {model.supportsThinking && (
                    <span className="model-badge thinking">Thinking</span>
                  )}
                  {model.downloaded && (
                    <span className="model-badge downloaded">Downloaded</span>
                  )}
                </div>
                <span className="model-option-description">{model.description}</span>
              </div>
            </label>
          ))}
        </div>
      )}

      {error && <p className="download-error">{error}</p>}

      {!isDownloading ? (
        <button className="download-btn" onClick={handleDownload}>
          {selectedModelInfo?.downloaded ? 'Use Selected Model' : 'Download Model'}
        </button>
      ) : (
        <>
          {progress && (
            <div className="progress-container">
              <div className="progress-info">
                <span>Downloading {selectedModelInfo?.name}...</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="progress-text">
                {progress.percent.toFixed(1)}% - {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
              </div>
            </div>
          )}
          <button className="download-btn cancel" onClick={handleCancel}>
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
