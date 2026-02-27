//! Audio waveform extraction and data structures

use serde::{Deserialize, Serialize};

/// Waveform data for audio visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WaveformData {
    /// Number of samples
    pub sample_count: usize,
    /// Duration of the audio in seconds
    pub duration: f64,
    /// Peak values for each sample (0.0 to 1.0)
    pub peaks: Vec<f32>,
    /// RMS values for each sample (0.0 to 1.0)
    pub rms: Vec<f32>,
}

impl WaveformData {
    /// Create empty waveform data
    pub fn empty() -> Self {
        Self {
            sample_count: 0,
            duration: 0.0,
            peaks: Vec::new(),
            rms: Vec::new(),
        }
    }

    /// Create waveform data from raw samples
    pub fn from_samples(samples: &[f32], duration: f64, num_buckets: usize) -> Self {
        if samples.is_empty() || num_buckets == 0 {
            return Self::empty();
        }

        let samples_per_bucket = samples.len() / num_buckets;
        if samples_per_bucket == 0 {
            return Self::empty();
        }

        let mut peaks = Vec::with_capacity(num_buckets);
        let mut rms = Vec::with_capacity(num_buckets);

        for i in 0..num_buckets {
            let start = i * samples_per_bucket;
            let end = ((i + 1) * samples_per_bucket).min(samples.len());
            let bucket = &samples[start..end];

            // Calculate peak (max absolute value)
            let peak = bucket
                .iter()
                .map(|s| s.abs())
                .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
                .unwrap_or(0.0);

            // Calculate RMS
            let sum_squares: f32 = bucket.iter().map(|s| s * s).sum();
            let rms_value = (sum_squares / bucket.len() as f32).sqrt();

            peaks.push(peak);
            rms.push(rms_value);
        }

        Self {
            sample_count: num_buckets,
            duration,
            peaks,
            rms,
        }
    }
}
