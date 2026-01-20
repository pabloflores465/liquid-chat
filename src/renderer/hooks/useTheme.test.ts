import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTheme } from './useTheme';
import { mockElectronAPI } from '../../test/setup';

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
  });

  it('loads initial theme from settings', async () => {
    mockElectronAPI.settings.get.mockResolvedValue({ theme: 'dark', modelPath: null });
    mockElectronAPI.theme.getSystem.mockResolvedValue(false);

    const { result } = renderHook(() => useTheme());

    await waitFor(() => {
      expect(result.current.theme).toBe('dark');
    });
  });

  it('sets isDark correctly for dark theme', async () => {
    mockElectronAPI.settings.get.mockResolvedValue({ theme: 'dark', modelPath: null });
    mockElectronAPI.theme.getSystem.mockResolvedValue(false);

    const { result } = renderHook(() => useTheme());

    await waitFor(() => {
      expect(result.current.isDark).toBe(true);
    });
  });

  it('sets isDark correctly for light theme', async () => {
    mockElectronAPI.settings.get.mockResolvedValue({ theme: 'light', modelPath: null });
    mockElectronAPI.theme.getSystem.mockResolvedValue(false);

    const { result } = renderHook(() => useTheme());

    await waitFor(() => {
      expect(result.current.isDark).toBe(false);
    });
  });

  it('uses system preference when theme is system', async () => {
    mockElectronAPI.settings.get.mockResolvedValue({ theme: 'system', modelPath: null });
    mockElectronAPI.theme.getSystem.mockResolvedValue(true); // System is dark

    const { result } = renderHook(() => useTheme());

    await waitFor(() => {
      expect(result.current.theme).toBe('system');
      expect(result.current.isDark).toBe(true);
    });
  });

  it('updates document data-theme attribute', async () => {
    mockElectronAPI.settings.get.mockResolvedValue({ theme: 'dark', modelPath: null });
    mockElectronAPI.theme.getSystem.mockResolvedValue(false);

    renderHook(() => useTheme());

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  it('setTheme updates theme and saves to settings', async () => {
    mockElectronAPI.settings.get.mockResolvedValue({ theme: 'light', modelPath: null });
    mockElectronAPI.settings.update.mockResolvedValue({ theme: 'dark', modelPath: null });
    mockElectronAPI.theme.getSystem.mockResolvedValue(false);

    const { result } = renderHook(() => useTheme());

    await waitFor(() => {
      expect(result.current.theme).toBe('light');
    });

    await act(async () => {
      await result.current.setTheme('dark');
    });

    expect(mockElectronAPI.settings.update).toHaveBeenCalledWith({ theme: 'dark' });
    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
  });

  it('cycleTheme cycles through light -> dark -> system', async () => {
    mockElectronAPI.settings.get.mockResolvedValue({ theme: 'light', modelPath: null });
    mockElectronAPI.theme.getSystem.mockResolvedValue(false);

    const { result } = renderHook(() => useTheme());

    await waitFor(() => {
      expect(result.current.theme).toBe('light');
    });

    await act(async () => {
      await result.current.cycleTheme();
    });

    expect(result.current.theme).toBe('dark');

    await act(async () => {
      await result.current.cycleTheme();
    });

    expect(result.current.theme).toBe('system');

    await act(async () => {
      await result.current.cycleTheme();
    });

    expect(result.current.theme).toBe('light');
  });

  it('subscribes to theme changes', async () => {
    mockElectronAPI.settings.get.mockResolvedValue({ theme: 'system', modelPath: null });
    mockElectronAPI.theme.getSystem.mockResolvedValue(false);

    renderHook(() => useTheme());

    await waitFor(() => {
      expect(mockElectronAPI.theme.onChanged).toHaveBeenCalled();
    });
  });

  it('cleanup unsubscribes from theme changes', async () => {
    const unsubscribe = vi.fn();
    mockElectronAPI.theme.onChanged.mockReturnValue(unsubscribe);
    mockElectronAPI.settings.get.mockResolvedValue({ theme: 'system', modelPath: null });
    mockElectronAPI.theme.getSystem.mockResolvedValue(false);

    const { unmount } = renderHook(() => useTheme());

    await waitFor(() => {
      expect(mockElectronAPI.theme.onChanged).toHaveBeenCalled();
    });

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
