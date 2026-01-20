import React, { useState, useEffect, useCallback } from 'react';
import { DownloadProgress } from '../types/electron';

interface ModelDownloadProps {
  onDownloadComplete: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ModelDownload({ onDownloadComplete }: ModelDownloadProps): React.ReactElement {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = window.electron.model.onDownloadProgress((prog) => {
      setProgress(prog);
    });

    return unsubscribe;
  }, []);

  const handleDownload = useCallback(async (): Promise<void> => {
    setIsDownloading(true);
    setError(null);

    const result = await window.electron.model.download();

    if (result.success) {
      onDownloadComplete();
    } else {
      setError(result.error || 'Download failed');
      setIsDownloading(false);
    }
  }, [onDownloadComplete]);

  const handleCancel = useCallback(async (): Promise<void> => {
    await window.electron.model.cancelDownload();
    setIsDownloading(false);
    setProgress(null);
  }, []);

  return (
    <div className="download-screen">
      <h2>Welcome to Liquid Chat</h2>
      <p>
        To get started, we need to download the LiquidAI LFM2-2.6B model.
        This is a one-time download of approximately 1.5 GB.
      </p>

      {error && (
        <p style={{ color: 'var(--accent-danger)', marginBottom: '16px' }}>
          Error: {error}
        </p>
      )}

      {isDownloading && progress ? (
        <>
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="progress-text">
              {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
              {' '}({progress.percent.toFixed(1)}%)
            </div>
          </div>
          <button
            className="download-btn"
            onClick={handleCancel}
            style={{ marginTop: '16px', background: 'var(--accent-danger)' }}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          className="download-btn"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          Download Model
        </button>
      )}
    </div>
  );
}
