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
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function ModelDownload({ onDownloadComplete }: ModelDownloadProps): React.ReactElement {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const result = await window.electron.model.download();
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
        To get started, download the Qwen3-4B model.
        This is a one-time download of approximately 2.5 GB.
      </p>

      {error && <p className="download-error">{error}</p>}

      {!isDownloading ? (
        <button className="download-btn" onClick={handleDownload}>
          Download Model
        </button>
      ) : (
        <>
          {progress && (
            <div className="progress-container">
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
