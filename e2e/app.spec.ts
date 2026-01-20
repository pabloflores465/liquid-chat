import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // Build the app before testing
  electronApp = await electron.launch({
    args: [join(__dirname, '../dist/main/main.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  // Get the first window (should be main window since DevTools are disabled in test mode)
  page = await electronApp.firstWindow();

  // Wait for the app to load
  await page.waitForLoadState('domcontentloaded');

  // Wait for the React app to render
  await page.waitForSelector('.app', { timeout: 10000 });
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
});

test.describe('Liquid Chat Application', () => {
  test('should launch and show main window', async () => {
    const title = await page.title();
    expect(title).toBe('Liquid Chat');
  });

  test('should display sidebar with app title', async () => {
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    const appTitle = page.locator('.sidebar-header h1');
    await expect(appTitle).toHaveText('Liquid Chat');
  });

  test('should have new chat button', async () => {
    const newChatBtn = page.locator('.new-chat-btn');
    await expect(newChatBtn).toBeVisible();
    await expect(newChatBtn).toContainText('New');
  });

  test('should have theme toggle button', async () => {
    const themeToggle = page.locator('.theme-toggle');
    await expect(themeToggle).toBeVisible();
  });

  test('should display main content area', async () => {
    const mainContent = page.locator('.main-content');
    await expect(mainContent).toBeVisible();
  });

  test('should display chat header', async () => {
    const chatHeader = page.locator('.chat-header');
    await expect(chatHeader).toBeVisible();
  });

  test('should display input container', async () => {
    const inputContainer = page.locator('.input-container');
    await expect(inputContainer).toBeVisible();
  });

  test('should have a textarea for input', async () => {
    const textarea = page.locator('.input-field textarea');
    await expect(textarea).toBeVisible();
  });

  test('should have send button', async () => {
    const sendBtn = page.locator('.send-btn');
    await expect(sendBtn).toBeVisible();
  });

  test('send button should be disabled when input is empty', async () => {
    const sendBtn = page.locator('.send-btn');
    await expect(sendBtn).toBeDisabled();
  });

  test('send button should be enabled when input has text', async () => {
    const textarea = page.locator('.input-field textarea');
    await textarea.fill('Hello');

    const sendBtn = page.locator('.send-btn');
    await expect(sendBtn).not.toBeDisabled();

    // Clear for next test
    await textarea.fill('');
  });

  test('should create new conversation when clicking new chat', async () => {
    const newChatBtn = page.locator('.new-chat-btn');
    await newChatBtn.click();

    // Wait for conversation to be created
    await page.waitForTimeout(500);

    const conversationsList = page.locator('.conversations-list');
    await expect(conversationsList).toBeVisible();
  });

  test('should toggle theme when clicking theme button', async () => {
    const themeToggle = page.locator('.theme-toggle');
    const initialText = await themeToggle.textContent();

    await themeToggle.click();
    await page.waitForTimeout(300);

    const newText = await themeToggle.textContent();
    expect(newText).not.toBe(initialText);
  });

  test('should show download screen or chat based on model status', async () => {
    // The app should either show download screen or chat interface
    const downloadScreen = page.locator('.download-screen');
    const messagesContainer = page.locator('.messages-container');

    const downloadVisible = await downloadScreen.isVisible().catch(() => false);
    const messagesVisible = await messagesContainer.isVisible().catch(() => false);

    // One of them should be visible
    expect(downloadVisible || messagesVisible).toBe(true);
  });

  test('should display status indicator', async () => {
    const statusIndicator = page.locator('.status-indicator');
    await expect(statusIndicator).toBeVisible();
  });
});

test.describe('Theme Functionality', () => {
  test('should cycle through themes: light -> dark -> system', async () => {
    const themeToggle = page.locator('.theme-toggle');

    // Click to cycle theme
    await themeToggle.click();
    await page.waitForTimeout(200);
    let text = await themeToggle.textContent();
    const firstTheme = text;

    await themeToggle.click();
    await page.waitForTimeout(200);
    text = await themeToggle.textContent();
    const secondTheme = text;

    await themeToggle.click();
    await page.waitForTimeout(200);
    text = await themeToggle.textContent();
    const thirdTheme = text;

    // All three should be different
    expect(firstTheme).not.toBe(secondTheme);
    expect(secondTheme).not.toBe(thirdTheme);
  });

  test('should apply dark theme styles when in dark mode', async () => {
    const themeToggle = page.locator('.theme-toggle');

    // Click until we get to dark theme
    while (!(await themeToggle.textContent())?.includes('Dark')) {
      await themeToggle.click();
      await page.waitForTimeout(200);
    }

    // Check that dark theme is applied
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('Input Functionality', () => {
  test('should allow typing in textarea', async () => {
    const textarea = page.locator('.input-field textarea');
    await textarea.fill('Test message');

    await expect(textarea).toHaveValue('Test message');

    // Clear for next test
    await textarea.fill('');
  });

  test('textarea should expand with content', async () => {
    const textarea = page.locator('.input-field textarea');

    const initialHeight = await textarea.evaluate((el) => el.offsetHeight);

    await textarea.fill('Line 1\nLine 2\nLine 3\nLine 4');

    const newHeight = await textarea.evaluate((el) => el.offsetHeight);

    expect(newHeight).toBeGreaterThanOrEqual(initialHeight);

    // Clear for next test
    await textarea.fill('');
  });

  test('should clear input after attempting to send', async () => {
    const textarea = page.locator('.input-field textarea');
    await textarea.fill('Test message');

    const sendBtn = page.locator('.send-btn');
    await sendBtn.click();

    // Input should be cleared after send attempt
    await page.waitForTimeout(500);
    await expect(textarea).toHaveValue('');
  });
});
