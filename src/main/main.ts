import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { llmEngine } from './llm-engine.js';
import { modelManager } from './model-manager.js';
import {
  getConversations,
  getConversation,
  saveConversation,
  deleteConversation,
  getSettings,
  updateSettings,
  getCurrentConversationId,
  setCurrentConversationId,
} from './store.js';
import { Conversation, Message, ModelId } from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff',
  });

  llmEngine.setMainWindow(mainWindow);
  modelManager.setMainWindow(mainWindow);

  const isDev = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else if (isTest || !app.isPackaged) {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers

// Model operations
ipcMain.handle('model:get-all', () => {
  return modelManager.getAllModels();
});

ipcMain.handle('model:get-info', (_event, modelId: ModelId) => {
  const info = modelManager.getModelInfo(modelId);
  console.log('[GET-INFO] Model:', modelId, 'Downloaded:', info.downloaded, 'Path:', info.path);
  return info;
});

ipcMain.handle('model:download', async (_event, modelId: ModelId) => {
  console.log('[DOWNLOAD] Starting download for:', modelId);
  try {
    const path = await modelManager.downloadModel(modelId);
    console.log('[DOWNLOAD] Success, path:', path);
    return { success: true, path };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log('[DOWNLOAD] Error:', message);
    return { success: false, error: message };
  }
});

ipcMain.handle('model:cancel-download', () => {
  modelManager.cancelDownload();
  return { success: true };
});

// LLM operations
ipcMain.handle('llm:initialize', async () => {
  try {
    const settings = getSettings();
    console.log('[INIT] Selected model:', settings.selectedModel);
    const modelPath = modelManager.getModelPath(settings.selectedModel);
    console.log('[INIT] Model path:', modelPath);
    const modelInfo = modelManager.getModelInfo(settings.selectedModel);
    console.log('[INIT] Model info:', modelInfo);
    console.log('[INIT] Supports thinking:', modelInfo.supportsThinking);
    await llmEngine.initialize(modelPath, modelInfo.supportsThinking);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
});

ipcMain.handle('llm:is-ready', () => {
  return llmEngine.isReady();
});

ipcMain.handle('llm:reset-session', async () => {
  await llmEngine.resetSession();
  return { success: true };
});

ipcMain.handle('llm:load-history', async (_event, messages: Message[]) => {
  try {
    await llmEngine.loadConversationHistory(messages);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
});

ipcMain.handle('llm:generate', async (_event, prompt: string) => {
  try {
    const response = await llmEngine.generate(prompt, (chunk, type) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('llm:chunk', {
          chunk,
          conversationId: llmEngine.getGeneratingConversationId(),
          type,
        });
      }
    });
    return { success: true, response };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'Aborted') {
      return { success: false, aborted: true };
    }
    return { success: false, error: message };
  }
});

ipcMain.handle('llm:stop', () => {
  llmEngine.stopGeneration();
  return { success: true };
});

ipcMain.handle('llm:set-generating-conversation', (_event, id: string | null) => {
  llmEngine.setGeneratingConversationId(id);
  return { success: true };
});

ipcMain.handle('llm:get-generating-conversation', () => {
  return llmEngine.getGeneratingConversationId();
});

ipcMain.handle('llm:is-generating', () => {
  return llmEngine.isCurrentlyGenerating();
});

// Conversation management
ipcMain.handle('conversations:get-all', () => {
  return getConversations();
});

ipcMain.handle('conversations:get', (_event, id: string) => {
  return getConversation(id);
});

ipcMain.handle('conversations:create', () => {
  const conversation: Conversation = {
    id: uuidv4(),
    title: 'New Chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  saveConversation(conversation);
  setCurrentConversationId(conversation.id);
  return conversation;
});

ipcMain.handle('conversations:save', (_event, conversation: Conversation) => {
  saveConversation(conversation);
  return { success: true };
});

ipcMain.handle('conversations:delete', (_event, id: string) => {
  deleteConversation(id);
  return { success: true };
});

ipcMain.handle('conversations:get-current-id', () => {
  return getCurrentConversationId();
});

ipcMain.handle('conversations:set-current-id', (_event, id: string | null) => {
  setCurrentConversationId(id);
  return { success: true };
});

// Settings
ipcMain.handle('settings:get', () => {
  return getSettings();
});

ipcMain.handle('settings:update', (_event, settings) => {
  const updated = updateSettings(settings);

  // Apply theme
  if (settings.theme) {
    nativeTheme.themeSource = settings.theme;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors);
    }
  }

  return updated;
});

ipcMain.handle('theme:get-system', () => {
  return nativeTheme.shouldUseDarkColors;
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await llmEngine.dispose();
});

// Handle theme changes
nativeTheme.on('updated', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors);
  }
});
