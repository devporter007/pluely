//! Passive background system audio daemon: records last N seconds of system audio
//! and returns them as Opus/OGG base64 when requested (e.g. on screenshot shortcut).
//!
//! On macOS 14.2+: uses Core Audio Process Tap API (no BlackHole required).
//! On other platforms: returns "unsupported".

use base64::Engine;
use serde::Serialize;
use std::io::Cursor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

pub(crate) const SAMPLE_RATE: u32 = 48000;
pub(crate) const CHANNELS: u16 = 2;

/// Output sample rate for Opus encoding (speech-optimized).
const OUTPUT_SAMPLE_RATE: u32 = 16000;
/// Output is mono.
const OUTPUT_CHANNELS: u16 = 1;

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

    /// Snapshot the last N seconds (logical_len) from the ring buffer,
    /// downsample to 16 kHz mono, encode as Opus inside an OGG container,
    /// and return the result as a base64 string.
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

        // --- 1. Read ring buffer in order ---
        let start = (write_index + cap - logical_len) % cap;
        let mut ordered: Vec<f32> = Vec::with_capacity(logical_len);
        for i in 0..logical_len {
            let j = (start + i) % cap;
            ordered.push(buffer[j]);
        }

        // --- 2. Downsample 48 kHz stereo → 16 kHz mono ---
        // Ratio = SAMPLE_RATE / OUTPUT_SAMPLE_RATE = 3
        // For every 3 stereo frames (6 interleaved samples) → 1 mono sample
        let ratio = (SAMPLE_RATE / OUTPUT_SAMPLE_RATE) as usize; // 3
        let stereo_frame_size = CHANNELS as usize;                // 2
        let group = ratio * stereo_frame_size;                    // 6
        let num_output_samples = ordered.len() / group;
        let mut mono16k: Vec<f32> = Vec::with_capacity(num_output_samples);
        for chunk in ordered.chunks_exact(group) {
            let sum: f32 = chunk.iter().sum();
            mono16k.push(sum / group as f32);
        }

        // --- 3. Encode as Opus inside OGG ---
        let mut encoder = opus::Encoder::new(
            OUTPUT_SAMPLE_RATE,
            opus::Channels::Mono,
            opus::Application::Voip,
        )
        .map_err(|e| format!("Opus encoder init: {}", e))?;

        let frame_size: usize = (OUTPUT_SAMPLE_RATE as usize) * 20 / 1000; // 320 samples (20 ms)
        let mut cursor = Cursor::new(Vec::<u8>::new());

        {
            let mut pw = ogg::writing::PacketWriter::new(&mut cursor);
            let serial: u32 = 0x504C5545; // "PLUE"

            // -- OpusHead --
            let pre_skip: u16 = 312;
            let mut head = Vec::with_capacity(19);
            head.extend_from_slice(b"OpusHead");
            head.push(1); // version
            head.push(OUTPUT_CHANNELS as u8);
            head.extend_from_slice(&pre_skip.to_le_bytes());
            head.extend_from_slice(&OUTPUT_SAMPLE_RATE.to_le_bytes());
            head.extend_from_slice(&0u16.to_le_bytes()); // output gain
            head.push(0); // channel mapping family
            pw.write_packet(
                head,
                serial,
                ogg::writing::PacketWriteEndInfo::EndPage,
                0,
            )
            .map_err(|e| format!("OGG write OpusHead: {}", e))?;

            // -- OpusTags --
            let vendor = b"pluely";
            let mut tags = Vec::new();
            tags.extend_from_slice(b"OpusTags");
            tags.extend_from_slice(&(vendor.len() as u32).to_le_bytes());
            tags.extend_from_slice(vendor);
            tags.extend_from_slice(&0u32.to_le_bytes()); // 0 comments
            pw.write_packet(
                tags,
                serial,
                ogg::writing::PacketWriteEndInfo::EndPage,
                0,
            )
            .map_err(|e| format!("OGG write OpusTags: {}", e))?;

            // -- Audio packets --
            // Granule position is always at 48 kHz for Opus
            let granule_increment: u64 = 960; // 20 ms at 48 kHz
            let mut granule_pos: u64 = 0;
            let total_frames = mono16k.len() / frame_size;
            let mut encode_buf = vec![0u8; 4000]; // max Opus packet

            for i in 0..total_frames {
                let frame = &mono16k[i * frame_size..(i + 1) * frame_size];
                let n = encoder
                    .encode_float(frame, &mut encode_buf)
                    .map_err(|e| format!("Opus encode: {}", e))?;
                granule_pos += granule_increment;

                let end_info = if i == total_frames - 1 {
                    ogg::writing::PacketWriteEndInfo::EndStream
                } else {
                    ogg::writing::PacketWriteEndInfo::NormalPacket
                };
                pw.write_packet(
                    encode_buf[..n].to_vec(),
                    serial,
                    end_info,
                    granule_pos,
                )
                .map_err(|e| format!("OGG write audio: {}", e))?;
            }

            // Handle remaining samples (pad with silence to fill a frame)
            let remainder = mono16k.len() % frame_size;
            if remainder > 0 {
                let mut last_frame = vec![0.0f32; frame_size];
                let offset = total_frames * frame_size;
                last_frame[..remainder].copy_from_slice(&mono16k[offset..offset + remainder]);
                let n = encoder
                    .encode_float(&last_frame, &mut encode_buf)
                    .map_err(|e| format!("Opus encode tail: {}", e))?;
                granule_pos += granule_increment;
                pw.write_packet(
                    encode_buf[..n].to_vec(),
                    serial,
                    ogg::writing::PacketWriteEndInfo::EndStream,
                    granule_pos,
                )
                .map_err(|e| format!("OGG write tail: {}", e))?;
            }
        }

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

/// Get the last N seconds of system audio as base64 OGG/Opus (16 kHz mono).
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
