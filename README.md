# Liquid Chat

Local AI chatbot for macOS powered by Qwen3. Runs entirely on your machine -- no API keys, no cloud, no data leaves your computer.

## Features

- **Local LLM inference** -- Uses node-llama-cpp to run Qwen3-4B directly on your Mac
- **Thinking/reasoning display** -- See the model's reasoning process in real time
- **Streaming responses** -- Chunks streamed as they're generated
- **Conversation management** -- Create, search, rename, and delete conversations
- **Markdown rendering** -- Full GFM support with syntax highlighting and LaTeX math
- **Light/dark/system themes** -- Follows your system preference or set manually
- **Persistent storage** -- Conversations saved locally via electron-store

## Tech Stack

- **Electron** -- Desktop application framework
- **React + TypeScript** -- UI with strict typing
- **Vite** -- Build tooling for the renderer process
- **node-llama-cpp** -- Local LLM inference engine
- **Vitest + Playwright** -- Unit and end-to-end testing

## Requirements

- macOS (Apple Silicon recommended)
- Node.js 18+

## Getting Started

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev
```

On first launch, the app will prompt you to download the Qwen3-4B model.

## Scripts

| Command              | Description                          |
|----------------------|--------------------------------------|
| `npm run dev`        | Start app in development mode        |
| `npm run build`      | Build renderer, main, and preload    |
| `npm run package`    | Package as macOS .dmg installer      |
| `npm run test`       | Run unit tests                       |
| `npm run test:watch` | Run unit tests in watch mode         |
| `npm run test:e2e`   | Run end-to-end tests with Playwright |
| `npm run test:all`   | Run all tests (unit + e2e)           |

## Project Structure

```
src/
  main/           # Electron main process
    main.ts         # Window setup and IPC handlers
    llm-engine.ts   # LLM inference with node-llama-cpp
    model-manager.ts# Model download and management
    store.ts        # Persistent storage
    preload.ts      # Context bridge for renderer
  renderer/       # React frontend
    components/     # UI components
    hooks/          # Custom React hooks
    styles/         # CSS
e2e/              # Playwright end-to-end tests
build/            # Build resources and entitlements
```

## License

Private -- All rights reserved.
