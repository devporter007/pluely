# Pluely — fork (no bullshit)

This is a fork of Pluely with no bullshit attached.

Side note: Tested only for mac

The system audio attachment feature right now is broken, will have a look later on it.
**Extra features:**
- Completely stripped off license logic
- Auto screenshot upload with automatic prompt on key press

---

**Undetectable Everywhere:**

The overlay window is designed to be invisible in video calls, screen shares, recordings, and screenshots. When you share your screen in Zoom, Google Meet, Microsoft Teams, or any other meeting platform, Pluely remains completely hidden from your audience. The translucent design makes it extremely difficult to capture in screenshots, and it won't appear on projectors or shared screens.

**Perfect Stealth Design:**

The window transparency can be adjusted to your preference, allowing you to see through it while keeping it functional. You can instantly show or hide the window using keyboard shortcuts, and move it anywhere on your screen with arrow keys. The always-on-top mode ensures it's accessible when you need it, while the hide feature makes it disappear completely when you don't.

**Critical Use Cases:**

Use Pluely confidently during job interviews to get real-time information without detection. Access product details instantly during sales calls while maintaining professionalism. Reference documentation during technical meetings without breaking your flow. Get learning assistance during educational presentations that's completely invisible to your audience. Analyze screenshots and get suggestions during design reviews without anyone knowing. Debug code and get syntax help during live coding sessions in complete stealth.

## Privacy-First Architecture

Your data stays yours. Pluely is engineered with privacy as the foundation, not an afterthought.

**Local Storage:**

All your conversations are stored locally in a SQLite database on your device. Chat history, messages, and attachments never leave your computer. The database is stored in your application data directory with full transaction safety and data integrity checks. Your conversations can be exported as markdown files and deleted anytime you want.

**Settings and Configuration:**

All application settings, AI provider configurations, custom system prompts, keyboard shortcuts, and preferences are stored in your browser's localStorage. This data remains on your device and is never transmitted anywhere. You have complete control over your configuration data.

**Secure Credentials:**

License keys and sensitive credentials are stored in encrypted secure storage in your application data directory, separate from other application data. API keys for AI providers are stored in localStorage and never sent to any server except directly to your chosen AI provider.

**Zero Server Dependency:**

Pluely makes API calls directly from your device to your chosen AI provider. There are no proxy servers, no middleware, and no data collection. Your conversations go straight from your device to OpenAI, Anthropic, Google, or whichever provider you choose. You can inspect every network request in your browser's developer tools to verify this claim.

**No Telemetry:**

Pluely has no analytics, no usage tracking, no data collection, and no telemetry of any kind. Your usage patterns, conversations, and behavior remain completely private. The application doesn't phone home, doesn't report statistics, and doesn't collect any information about how you use it.

**Offline Capability:**

The application works without an internet connection for all local features. You only need internet when making API calls to AI providers for responses. Everything else, including the interface, settings, chat history, and system prompts, works completely offline.

## Blazing Fast Performance

Built with Tauri and Rust, Pluely delivers native desktop performance that puts web-based alternatives to shame.

**Lightweight Binary:**

The entire application is approximately 10MB in size, making it 27 times smaller than the original Cluely and significantly smaller than Electron-based alternatives. Despite its tiny footprint, it includes a full React frontend, Rust backend, SQLite database, and all features.

**Instant Startup:**

Pluely launches in under 100 milliseconds. There's no splash screen, no loading spinner, and no waiting. Click the icon and it's ready to use immediately. This instant startup makes it perfect for quick queries and impromptu assistance.

**Native Performance:**

Built on Tauri, Pluely runs as a native application using your system's webview. There's no embedded Chromium, no browser overhead, and no unnecessary resource consumption. It uses 50% less RAM compared to Electron apps and has minimal CPU impact even during active use.

**Efficient Resource Usage:**

The application typically uses less than 50MB of RAM during normal operation. System audio capture, voice recording, and screenshot processing are optimized for performance. Multiple conversations, attached files, and chat history don't slow down the application.

**Cross-Platform:**

Pluely runs natively on macOS, Windows, and Linux with platform-specific optimizations. The same codebase delivers optimal performance on all three platforms, using native system APIs and respecting platform conventions.

## Complete Control

Own your AI experience. Pluely gives you unprecedented control over every aspect of the application.

**Any AI Provider:**

Connect to any LLM provider using simple curl commands. OpenAI, Anthropic, Google, xAI, Mistral, Cohere, Perplexity, Groq, Ollama, or your own custom endpoint. Switch providers anytime without losing your chat history or configuration. Use multiple providers for different use cases.

**Any STT Provider:**

Integrate any speech-to-text service using curl commands. OpenAI Whisper, ElevenLabs, Groq, Deepgram, Azure, Google, or custom providers. Full control over audio format, sample rate, and processing parameters. Test providers instantly to find the best accuracy for your voice and language.

**Custom System Prompts:**

Create unlimited system prompts to control AI behavior. Define personas, writing styles, response formats, and specialized knowledge domains. Switch between prompts instantly to adapt the AI to different scenarios. Use AI-powered generation to create effective prompts automatically.

**Flexible Configuration:**

Customize keyboard shortcuts for all actions. Adjust window transparency and always-on-top behavior. Configure screenshot capture modes and processing options. Set response length, language, and auto-scroll preferences. Choose audio input devices and capture settings. Everything is configurable to match your workflow.

**Open Source:**

The entire codebase is open source under GPL v3. You can inspect every line of code, verify privacy claims, audit security measures, and modify the application to suit your needs. Build it yourself, contribute improvements, or fork it for custom requirements.

## Always Ready

Pluely sits quietly on your desktop, consuming minimal resources while remaining instantly accessible.

**One-Click Access:**

Use keyboard shortcuts to instantly show or hide the window, open the dashboard, start voice recording, capture screenshots, or toggle system audio. The overlay window is always available when you need it and out of sight when you don't.

**Persistent History:**

All conversations are saved locally in SQLite with full context. Return to previous conversations anytime, continue where you left off, and search through your history. Export conversations as markdown for documentation or reference.

**Background Operation:**

Pluely can run silently in the background with the overlay hidden. Enable autostart to launch it automatically when your system boots. Hide the dock icon for maximum stealth while keeping the application running and accessible via keyboard shortcuts.

**Zero Maintenance:**

No subscriptions to manage, no accounts to maintain, and no services to configure beyond your AI provider. Once set up, Pluely just works. Updates are delivered automatically when available, and you control when to install them.

---

## 📋 Prerequisites & Dependencies

**Important**: Before installing the app, ensure all required system dependencies are installed for your platform:

👉 **[Tauri Prerequisites & Dependencies](https://v2.tauri.app/start/prerequisites/)**

This includes essential packages like WebKitGTK (Linux), system libraries, and other dependencies required for Tauri applications to run properly on your operating system.

---

## Installation & Setup

### Prerequisites

- **Node.js** (v18 or higher)
- **Rust** (latest stable)
- **npm** or **yarn**

### Quick Start

```bash
# Clone the repository
git clone https://github.com/iamsrikanthnani/pluely.git
cd pluely

# Install dependencies
npm install

# Start development server
npm run tauri dev
```

### Build for Production

```bash
# Build the application
npm run tauri build
```

This creates platform-specific installers in `src-tauri/target/release/bundle/`:

- **macOS**: `.dmg`
- **Windows**: `.msi`, `.exe`
- **Linux**: `.deb`, `.rpm`, `.AppImage`


---

## 📄 License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments
- Pluely
- **[Cluely](https://cluely.com/)** - Inspiration for this open source alternative
- **[Tauri](https://tauri.app/)** - Amazing desktop framework
- **[tauri-nspanel](https://github.com/ahkohd/tauri-nspanel)** - macOS native panel integration for Tauri
- **[shadcn/ui](https://ui.shadcn.com/)** - Beautiful UI components
- **[@ricky0123/vad-react](https://github.com/ricky0123/vad)** - Voice Activity Detection
- **[OpenAI](https://openai.com/)** - GPT models and Whisper API
- **[Anthropic](https://anthropic.com/)** - Claude AI models
- **[xAI](https://x.ai/)** - Grok AI models
- **[Google](https://gemini.google.com/)** - Gemini AI models


