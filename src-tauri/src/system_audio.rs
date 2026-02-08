//! Passive background system audio daemon: records last N seconds of system audio
//! and returns them as WAV base64 when requested (e.g. on shortcut).
//!
//! On macOS 14.2+: uses Core Audio Process Tap API (no BlackHole required).
//! On other platforms: returns "unsupported".

use base64::Engine;
use hound::{WavSpec, WavWriter};
use serde::Serialize;
use std::io::Cursor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

pub(crate) const SAMPLE_RATE: u32 = 48000;
pub(crate) const CHANNELS: u16 = 2;

/// Max buffer we allocate (seconds). Actual used length is set on start.
const MAX_BUFFER_SECONDS: u32 = 300;

/// Shared state for the system audio ring buffer and daemon control.
pub struct SystemAudioState {
    /// Ring buffer: physical capacity = MAX_BUFFER_SECONDS * SAMPLE_RATE * CHANNELS.
    /// Logical length (samples to return) = buffer_seconds * SAMPLE_RATE * CHANNELS, set on start.
    buffer: Mutex<Vec<f32>>,
    write_index: Mutex<usize>,
    capacity: usize,
    /// Number of samples to return in get_recent (logical_seconds * rate * ch).
    logical_len: Mutex<usize>,
    /// Whether the daemon is currently recording.
    recording: AtomicBool,
    /// Join handle for the capture thread (macOS only).
    #[allow(dead_code)]
    capture_handle: Mutex<Option<thread::JoinHandle<()>>>,
}

impl SystemAudioState {
    pub fn new() -> Self {
        let capacity = (MAX_BUFFER_SECONDS as usize)
            .saturating_mul(SAMPLE_RATE as usize)
            .saturating_mul(CHANNELS as usize);
        let capacity = capacity.max(1);
        let default_seconds = 30u32;
        let logical_len = (default_seconds as usize)
            .saturating_mul(SAMPLE_RATE as usize)
            .saturating_mul(CHANNELS as usize)
            .min(capacity);
        Self {
            buffer: Mutex::new(vec![0.0; capacity]),
            write_index: Mutex::new(0),
            capacity,
            logical_len: Mutex::new(logical_len),
            recording: AtomicBool::new(false),
            capture_handle: Mutex::new(None),
        }
    }

    /// Set logical buffer length (samples to keep/return) for next start. Call before start.
    pub fn set_buffer_seconds(&self, buffer_seconds: u32) {
        let len = (buffer_seconds as usize)
            .saturating_mul(SAMPLE_RATE as usize)
            .saturating_mul(CHANNELS as usize)
            .min(self.capacity)
            .max(1);
        if let Ok(mut l) = self.logical_len.lock() {
            *l = len;
        }
    }

    pub fn is_recording(&self) -> bool {
        self.recording.load(Ordering::SeqCst)
    }

    /// Store the capture thread handle so it can be joined on stop (macOS fallback).
    pub fn store_capture_handle(&self, handle: thread::JoinHandle<()>) {
        if let Ok(mut h) = self.capture_handle.lock() {
            *h = Some(handle);
        }
    }

    /// Push a single f32 sample (interleaved L/R). Called from capture thread.
    pub fn push_sample(&self, sample: f32) {
        if !self.recording.load(Ordering::SeqCst) {
            return;
        }
        if let Ok(mut buf) = self.buffer.lock() {
            if let Ok(mut idx) = self.write_index.lock() {
                buf[*idx] = sample;
                *idx = (*idx + 1) % self.capacity;
            }
        }
    }

    /// Push a chunk of interleaved f32 samples.
    pub fn push_samples(&self, samples: &[f32]) {
        for &s in samples {
            self.push_sample(s);
        }
    }

    /// Push samples from a real-time audio thread. Uses try_lock to avoid
    /// blocking the audio IO thread. Drops samples if the mutex is held
    /// (e.g. during get_recent_base64), which is acceptable for a background
    /// audio capture ring buffer.
    pub fn push_samples_realtime(&self, samples: &[f32]) {
        if !self.recording.load(Ordering::Relaxed) {
            return;
        }
        if let Ok(mut buf) = self.buffer.try_lock() {
            if let Ok(mut idx) = self.write_index.try_lock() {
                for &s in samples {
                    buf[*idx] = s;
                    *idx = (*idx + 1) % self.capacity;
                }
            }
        }
    }

    /// Snapshot the last N seconds (logical_len) from the ring buffer and encode as WAV base64.
    pub fn get_recent_base64(&self) -> Result<String, String> {
        let (buffer, write_index, logical_len) = {
            let buf = self.buffer.lock().map_err(|e| e.to_string())?;
            let idx = self.write_index.lock().map_err(|e| e.to_string())?;
            let len = self.logical_len.lock().map_err(|e| e.to_string())?;
            (buf.clone(), *idx, *len)
        };
        if buffer.is_empty() || logical_len == 0 {
            return Err("No audio recorded yet".to_string());
        }
        let cap = self.capacity;
        // Last logical_len samples: from (write_index + cap - logical_len) % cap to (write_index + cap - 1) % cap.
        let start = (write_index + cap - logical_len) % cap;
        let mut ordered: Vec<f32> = Vec::with_capacity(logical_len);
        for i in 0..logical_len {
            let j = (start + i) % cap;
            ordered.push(buffer[j]);
        }
        // Convert f32 [-1,1] to i16 and write WAV.
        let mut cursor = Cursor::new(Vec::new());
        let spec = WavSpec {
            channels: CHANNELS,
            sample_rate: SAMPLE_RATE,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = WavWriter::new(&mut cursor, spec).map_err(|e| e.to_string())?;
        for &s in &ordered {
            let clamped = s.clamp(-1.0, 1.0);
            let sample_i16 = (clamped * 32767.0) as i16;
            writer.write_sample(sample_i16).map_err(|e| e.to_string())?;
        }
        writer.finalize().map_err(|e| e.to_string())?;
        let bytes = cursor.into_inner();
        Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
    }
}

#[derive(Clone, Serialize)]
pub struct SystemAudioStatus {
    pub recording: bool,
    pub buffer_seconds: u32,
    pub supported: bool,
}

/// Start the system audio daemon. On non-macOS or if tap fails, returns error.
#[tauri::command]
pub async fn system_audio_start(
    buffer_seconds: u32,
    state: tauri::State<'_, Arc<SystemAudioState>>,
) -> Result<(), String> {
    if state.recording.load(Ordering::SeqCst) {
        return Ok(());
    }
    state.set_buffer_seconds(buffer_seconds);
    // Set recording true before spawning capture so the thread sees it
    state.recording.store(true, Ordering::SeqCst);
    #[cfg(target_os = "macos")]
    {
        if let Err(e) = crate::system_audio_macos::start_capture(state.inner().clone()).await {
            state.recording.store(false, Ordering::SeqCst);
            return Err(e);
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = buffer_seconds;
        state.recording.store(false, Ordering::SeqCst);
        return Err("System audio capture is only supported on macOS 14.2+".to_string());
    }
    Ok(())
}

/// Stop the system audio daemon.
#[tauri::command]
pub async fn system_audio_stop(state: tauri::State<'_, Arc<SystemAudioState>>) -> Result<(), String> {
    state.recording.store(false, Ordering::SeqCst);
    #[cfg(target_os = "macos")]
    {
        crate::system_audio_macos::stop_capture().await;
    }
    if let Ok(mut h) = state.capture_handle.lock() {
        if let Some(handle) = h.take() {
            let _ = handle.join();
        }
    }
    Ok(())
}

/// Get the last N seconds of system audio as base64 WAV.
#[tauri::command]
pub async fn system_audio_get_recent_base64(
    state: tauri::State<'_, Arc<SystemAudioState>>,
) -> Result<String, String> {
    state.get_recent_base64()
}

/// Return whether the daemon is currently recording.
#[tauri::command]
pub async fn system_audio_is_recording(
    state: tauri::State<'_, Arc<SystemAudioState>>,
) -> Result<bool, String> {
    Ok(state.is_recording())
}

/// Return status (recording, buffer_seconds, supported).
#[tauri::command]
pub async fn system_audio_status(
    state: tauri::State<'_, Arc<SystemAudioState>>,
) -> Result<SystemAudioStatus, String> {
    let logical_len: usize = *state.logical_len.lock().map_err(|e| e.to_string())?;
    let buffer_seconds = (logical_len as u32) / (SAMPLE_RATE * CHANNELS as u32);
    Ok(SystemAudioStatus {
        recording: state.is_recording(),
        buffer_seconds,
        supported: cfg!(target_os = "macos"),
    })
}
