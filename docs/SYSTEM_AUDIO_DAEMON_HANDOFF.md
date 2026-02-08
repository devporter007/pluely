# System Audio Daemon – Handoff Document

## Problem statement

We want a **passive background system audio daemon** with the following behavior:

1. **Toggle**  
   The user can turn the daemon on/off from the main chat UI (completion bar) and optionally from settings. When on, the app should continuously record **system audio** (what’s playing out of the speakers) in the background.

2. **Ring buffer**  
   Only the **last X seconds** of system audio are kept in memory (X configurable in settings, e.g. 5–300 seconds). Older audio is discarded. No need to store hours of audio.

3. **Attach on keystroke**  
   When the user presses a **global shortcut** (e.g. Cmd+Shift+A), the app should take the current ring-buffer contents (last X seconds), encode them as audio (e.g. WAV), and **attach that audio to the current chat message** in the same way as the existing “attach audio file” flow. The user can then send the message with that audio included.

4. **No browser / screen-share capture**  
   We **cannot** use React/browser APIs (e.g. `getDisplayMedia` / screen share) for system audio. On macOS, the browser does not get system audio that way. The implementation must use a **Rust/Tauri backend** (native code).

5. **No mandatory virtual driver**  
   Ideally we do **not** require the user to install something like BlackHole. We prefer using OS APIs that can capture system output when the right permissions are granted (e.g. macOS “Screen & System Audio Recording” or the **Core Audio Process Tap API** on macOS 14.2+). A reference project used dependencies that suggest system audio capture is possible without BlackHole (see “Reference dependencies” below).

6. **Existing behavior to keep**  
   The app already supports attaching normal audio files to chat (e.g. from file picker or from screenshot flow). The new behavior is **additive**: the daemon is an extra way to get “last N seconds of system audio” attached on a keystroke. The entry point for audio in the completion/chat flow is `useCompletion.ts` (and the existing `audioBase64` / attached-files handling).

---

## Reference dependencies (from another project)

A project that achieves system audio recording used a `Cargo.toml` snippet like this (for inspiration only; we may not need all of these):

```toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
cpal = "0.15.3"
hound = "3.5.1"
ringbuf = "0.4.8"
# ...
[target.'cfg(target_os = "macos")'.dependencies]
tauri-plugin-macos-permissions = "2"
cidre = "0.11.3"
# ...
```

Relevant points:

- **cpal** – cross‑platform audio; typically used for mics/default input; on macOS it does **not** by default capture “system output” without something like BlackHole or a loopback device.
- **Core Audio Process Tap API** (macOS 14.2+) – Apple’s API to tap system/process audio without a virtual driver. This is the desired direction for real system audio on macOS (see “Known gaps / what’s not done” below).
- **ringbuf** – used to keep a fixed-size buffer of the last N seconds of PCM.
- **hound** – used to encode PCM to WAV (and optionally decode).

---

## Detailed list of changes made

Below is a file-by-file summary of what was added or modified so an engineer can locate and fix issues.

---

### 1. Frontend – types and config

**`src/types/settings.ts`**

- Added interface:
  - `SystemAudioDaemonConfig`: `{ enabled: boolean; bufferSeconds: number }` (bufferSeconds typically 5–300).

**`src/config/constants.ts`**

- Added storage key: `SYSTEM_AUDIO_DAEMON_CONFIG: "system_audio_daemon_config"`.

**`src/types/context.type.ts`**

- Import of `SystemAudioDaemonConfig`.
- Added to context type:
  - `systemAudioDaemonConfig: SystemAudioDaemonConfig`
  - `setSystemAudioDaemonConfig: React.Dispatch<React.SetStateAction<SystemAudioDaemonConfig>>`

**`src/types/settings.hook.ts`**

- Added to `UseSettingsReturn`:
  - `systemAudioDaemonConfig`, `setSystemAudioDaemonConfig`
  - `handleSystemAudioDaemonEnabledChange(enabled: boolean)`
  - `handleSystemAudioDaemonBufferSecondsChange(bufferSeconds: number)`

---

### 2. Frontend – app context and persistence

**`src/contexts/app.context.tsx`**

- Import: `SystemAudioDaemonConfig`.
- New state:
  - `systemAudioDaemonConfig` with default `{ enabled: false, bufferSeconds: 30 }`.
- In **loadData()** (initial load from localStorage):
  - Read `STORAGE_KEYS.SYSTEM_AUDIO_DAEMON_CONFIG`, parse JSON, and call `setSystemAudioDaemonConfig` with validation (e.g. `bufferSeconds` clamped 5–300, default 30).
- In **storage sync** (the `storage` event listener):
  - Added `STORAGE_KEYS.SYSTEM_AUDIO_DAEMON_CONFIG` so that when this key changes (e.g. another tab), `loadData()` runs.
- New **useEffect** – persist:
  - When `systemAudioDaemonConfig` changes, write it to localStorage under `SYSTEM_AUDIO_DAEMON_CONFIG`.
- New **useEffect** – sync to backend:
  - When `systemAudioDaemonConfig.enabled` or `systemAudioDaemonConfig.bufferSeconds` changes:
    - If `enabled`: `invoke("system_audio_start", { bufferSeconds: systemAudioDaemonConfig.bufferSeconds })`.
    - If not enabled: `invoke("system_audio_stop")`.
- In the context **value** object passed to the provider:
  - Exposed `systemAudioDaemonConfig` and `setSystemAudioDaemonConfig`.

---

### 3. Frontend – shortcuts

**`src/config/shortcuts.ts`**

- Added a new shortcut action to `DEFAULT_SHORTCUT_ACTIONS`:
  - `id: "attach_system_audio"`
  - `name: "Attach system audio"`
  - `description: "Attach last N seconds of system audio to chat (requires system audio daemon on)"`
  - Default keys: Mac `cmd+shift+a`, Windows/Linux `ctrl+shift+a`.

**`src-tauri/src/shortcuts.rs`**

- In **handle_shortcut_action**:
  - New branch for `"attach_system_audio"`: call `handle_attach_system_audio_shortcut(app)`.
- New function **handle_attach_system_audio_shortcut**:
  - Gets the main webview window and emits the event `"trigger-attach-system-audio"` with payload `{}`. The frontend listens for this and then requests the last N seconds from the backend and adds them as an attachment.

---

### 4. Frontend – settings UI

**`src/hooks/useSettings.ts`**

- From `useApp()`: destructure `systemAudioDaemonConfig`, `setSystemAudioDaemonConfig`.
- New handlers:
  - **handleSystemAudioDaemonEnabledChange(enabled)**: update config with `enabled`, persist to localStorage under `SYSTEM_AUDIO_DAEMON_CONFIG`.
  - **handleSystemAudioDaemonBufferSecondsChange(bufferSeconds)**: clamp to 5–300, update config, persist same key.
- Return object extended with:
  - `systemAudioDaemonConfig`, `setSystemAudioDaemonConfig`, `handleSystemAudioDaemonEnabledChange`, `handleSystemAudioDaemonBufferSecondsChange`.

**`src/pages/screenshot/components/ScreenshotConfigs.tsx`**

- Props extended with:
  - `systemAudioDaemonConfig`, `handleSystemAudioDaemonEnabledChange`, `handleSystemAudioDaemonBufferSecondsChange`.
- New section (e.g. after screenshot compression, before Tips):
  - **Header**: “System audio daemon” with short description (record last N seconds, use shortcut to attach; macOS 14.2+ note).
  - **Switch**: “Enable system audio daemon” bound to `handleSystemAudioDaemonEnabledChange`.
  - When enabled: **number input** “Buffer (seconds)” (min 5, max 300) bound to `handleSystemAudioDaemonBufferSecondsChange`.

---

### 5. Frontend – completion bar toggle and attach flow

**`src/pages/app/components/completion/SystemAudioDaemonToggle.tsx`** (new file)

- Small component that uses `useApp()` to read `systemAudioDaemonConfig` and `setSystemAudioDaemonConfig`.
- Renders a **Button** (icon size) that toggles `enabled` on click (e.g. Volume2Icon when on, VolumeXIcon when off).
- Tooltip explains that when on, the last N seconds are recorded and the shortcut attaches them.

**`src/pages/app/components/completion/index.tsx`**

- Import and render **SystemAudioDaemonToggle** in the completion bar (e.g. after Screenshot, before Files).

**`src/hooks/useCompletion.ts`**

- **addFileFromBase64(base64, name, type)** (new):
  - Builds an `AttachedFile` with the given base64, name, type, and a generated id.
  - Uses `setState` with a guard: if `prev.attachedFiles.length >= MAX_FILES`, return `prev` unchanged; otherwise append the new file. This is used when the backend returns WAV base64 for the last N seconds.
- **useEffect** listening for **`trigger-attach-system-audio`**:
  - On event: `invoke("system_audio_get_recent_base64")`.
  - On success: call `addFileFromBase64(base64, "system_audio_<timestamp>.wav", "audio/wav")`.
  - On error: set `state.error` to a user-friendly message (e.g. “Could not attach system audio. Is the daemon on?”).

Existing completion logic already sends the first audio attachment in `attachedFiles` as `audioBase64` in the AI request; no change needed there for the new attachment type.

---

### 6. Backend – Tauri/Rust

**`src-tauri/Cargo.toml`**

- New dependencies (all platforms):
  - `ringbuf = "0.4"`
  - `hound = "3.5"`
- New macOS-only dependencies:
  - `objc2-core-audio = "0.3"`
  - `objc2-foundation = "0.3"`

**`src-tauri/src/lib.rs`**

- New modules: `mod system_audio;` and `#[cfg(target_os = "macos")] mod system_audio_macos;`
- New managed state: `.manage(Arc::new(SystemAudioState::new()))`
- New invoke handlers:
  - `system_audio::system_audio_start`
  - `system_audio::system_audio_stop`
  - `system_audio::system_audio_get_recent_base64`
  - `system_audio::system_audio_is_recording`
  - `system_audio::system_audio_status`

**`src-tauri/src/system_audio.rs`** (new file)

- **Constants**: `SAMPLE_RATE` (48000), `CHANNELS` (2), `MAX_BUFFER_SECONDS` (300). These were made `pub(crate)` so the macOS module can use them (fix for “private constant” errors).
- **SystemAudioState**:
  - **buffer**: `Mutex<Vec<f32>>` – ring buffer of PCM samples (stereo, interleaved). Capacity = `MAX_BUFFER_SECONDS * SAMPLE_RATE * CHANNELS`.
  - **write_index**: `Mutex<usize>` – next write position in the ring.
  - **capacity**: physical capacity in samples.
  - **logical_len**: `Mutex<usize>` – number of samples that “count” as the last N seconds (set from `buffer_seconds` when start is called).
  - **recording**: `AtomicBool` – whether the daemon is running. The macOS capture thread checks this via a **public** method `is_recording()` so the macOS module does not need to touch a private field.
  - **capture_handle**: `Mutex<Option<thread::JoinHandle<()>>>` – join handle for the capture thread (used on stop). A **public** method `store_capture_handle(handle)` was added so the macOS module can set it without accessing the private field.
- **Methods**:
  - `new()` – allocates buffer and sets default `logical_len` (e.g. 30 seconds).
  - `set_buffer_seconds(seconds)` – sets `logical_len` from seconds (capped by capacity).
  - `is_recording()`, `push_sample(sample)`, `push_samples(samples)` – used by the capture path.
  - `get_recent_base64()` – locks buffer and write_index, computes the last `logical_len` samples in order, encodes them as 16‑bit PCM WAV (via `hound`), returns base64 string. **Fix applied**: when reading `logical_len` for `system_audio_status`, we use `*state.logical_len.lock()...` to get a `usize`, not cast the MutexGuard (fix for “non-primitive cast” error).
  - `store_capture_handle(handle)` – store join handle from macOS module.
- **Commands**:
  - **system_audio_start(buffer_seconds)** – if already recording, return Ok. Else set buffer seconds, set `recording = true`, then on macOS call `system_audio_macos::start_capture(state)`. On failure, set `recording = false` and return Err. On non‑macOS return an error string.
  - **system_audio_stop()** – set `recording = false`, call macOS `stop_capture()`, join the thread from `capture_handle` if present.
  - **system_audio_get_recent_base64()** – delegate to `state.get_recent_base64()`.
  - **system_audio_is_recording()** – return `state.is_recording()`.
  - **system_audio_status()** – return `{ recording, buffer_seconds (derived from logical_len), supported: cfg!(target_os = "macos") }`.

**`src-tauri/src/system_audio_macos.rs`** (new file, `#[cfg(target_os = "macos")]`)

- **start_capture(state: Arc<SystemAudioState>)**:
  - First tries **try_start_process_tap(state)** (real system audio). Currently that function always returns `Err(...)` (stub).
  - **Fallback**: spawn a thread that, while `state.is_recording()` is true, pushes **silence** (0.0f32) in chunks (e.g. 9600 samples every 100 ms) via `state.push_sample(0.0)`. This fills the ring buffer so that `get_recent_base64` returns valid WAV and the frontend/attach flow can be tested. The thread’s join handle is stored via `state.store_capture_handle(handle)`.
- **try_start_process_tap(_state)** – stub that returns an error. Intended future implementation: use `objc2-core-audio` / `objc2-foundation` to create a Core Audio Process Tap (e.g. `CATapDescription::initStereoGlobalTapButExcludeProcesses` with empty exclude list), create aggregate device, register IO proc callback, start device, and in the callback push `inInputData` (float) into `state.push_samples(...)`. This requires macOS 14.2+ and appropriate permissions.
- **stop_capture()** – currently no-op; joining the fallback thread is done in `system_audio_stop()` via `capture_handle`.

Rust fixes applied during handoff:

- **SAMPLE_RATE / CHANNELS private**: Made `pub(crate)` in `system_audio.rs`.
- **recording private**: macOS thread uses `state.is_recording()` instead of `state.recording.load(...)`.
- **logical_len cast**: In `system_audio_status`, use `*state.logical_len.lock()...` to get `usize` before converting to `u32` for `buffer_seconds`.
- **capture_handle**: macOS module uses `state.store_capture_handle(handle)` instead of accessing the private field.

---

## Known gaps / what’s not done

1. **Real system audio on macOS**  
   The daemon currently runs a **silence placeholder** on macOS (a thread that pushes zeros). Real system audio capture should use the **Core Audio Process Tap API** (macOS 14.2+), e.g.:
   - Create tap with `CATapDescription::initStereoGlobalTapButExcludeProcesses` (empty array = tap all processes).
   - Create aggregate device that includes the tap, then use `AudioDeviceCreateIOProcID` / `AudioDeviceStart` and in the IO proc copy `inInputData` into the ring buffer (real-time safe: e.g. lock-free queue from IO proc to a worker that pushes into `SystemAudioState`, or a lock-free ring buffer exposed to the IO proc).
   - Apple’s “Capturing system audio with Core Audio taps” and the gist referenced in the earlier implementation (Core Audio tap example) are useful references.

2. **Non‑macOS**  
   On Windows/Linux, `system_audio_start` returns an error. No implementation exists yet for capturing “system” output on those platforms (would require platform-specific research).

3. **Permissions**  
   On macOS, system audio capture may require “Screen & System Audio Recording” (or similar). The app already requests screen recording permission in some flows; ensure the same or correct permission is requested before starting the daemon and document it for the user.

4. **Build / runtime**  
   The user reported that “what you did didn’t work.” Possible areas to check:
   - **Build**: Ensure all Rust fixes above are present and that `objc2-core-audio` / `objc2-foundation` resolve and compile on the target macOS version.
   - **Shortcut registration**: Confirm the “attach_system_audio” action is registered (e.g. from the same shortcut config that includes “screenshot”) and that the backend receives the key and emits `trigger-attach-system-audio`.
   - **Frontend event**: Confirm the main window listens for `trigger-attach-system-audio` and that `invoke("system_audio_get_recent_base64")` is called and the result passed to `addFileFromBase64`.
   - **Daemon start/stop**: Confirm that when the toggle is turned on, `system_audio_start` is invoked with the right `bufferSeconds` and that the backend sets `recording = true` and starts the (placeholder or real) capture; when toggled off, `system_audio_stop` runs and the thread is joined.
   - **WAV format**: Verify the backend produces valid WAV (sample rate, channels, 16‑bit) and that the frontend and AI provider accept it (same path as existing audio attachments).

5. **Tauri capabilities**  
   If the app uses Tauri 2 capability-based permissions, ensure the default (or relevant) capability allows `invoke` for the new `system_audio_*` commands so the frontend can call them.

---

## Quick checklist for the engineer

- [ ] Reproduce the problem: what exactly fails (build, runtime, shortcut, attach, or wrong audio)?
- [ ] Confirm all files and changes above exist and match the described behavior.
- [ ] Fix any remaining Rust visibility/cast issues and get a clean `cargo build` (and `cargo build --target ...` for macOS if needed).
- [ ] Test: toggle daemon on → start; toggle off → stop; shortcut → attach last N seconds; send message with attached “system” audio.
- [ ] Optionally implement real macOS system audio via Process Tap API and document macOS version and permission requirements.
- [ ] Document for users: how to enable the daemon, set buffer length, use the shortcut, and any OS/permission requirements.
