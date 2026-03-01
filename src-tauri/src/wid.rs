//! WID (Waldiez/SYNAPSE Identifier) generator for backend objects.
//!
//! Canonical format (sec mode, defaults): `YYYYMMDDTHHMMSS.0000Z-a3f91c`
//! This follows the same shape as `../wid` with W=4, Z=6.

use chrono::{TimeZone, Utc};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

const W: i64 = 4;
const Z: usize = 6;
const MAX_SEQ: i64 = 9999;

#[derive(Debug, Default)]
struct WidState {
    last_sec: i64,
    last_seq: i64,
}

static STATE: OnceLock<Mutex<WidState>> = OnceLock::new();
static NONCE: AtomicU64 = AtomicU64::new(0);

fn state() -> &'static Mutex<WidState> {
    STATE.get_or_init(|| {
        Mutex::new(WidState {
            last_sec: 0,
            last_seq: -1,
        })
    })
}

fn now_sec() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn fmt_ts(sec: i64) -> String {
    Utc.timestamp_opt(sec, 0)
        .single()
        .map(|dt| dt.format("%Y%m%dT%H%M%S").to_string())
        .unwrap_or_else(|| "19700101T000000".to_string())
}

fn random_hex(z: usize, sec: i64, seq: i64) -> String {
    let mut out = String::with_capacity(z);
    let mut seed = 0_u64;
    while out.len() < z {
        let mut h = DefaultHasher::new();
        sec.hash(&mut h);
        seq.hash(&mut h);
        NONCE.fetch_add(1, Ordering::Relaxed).hash(&mut h);
        seed.hash(&mut h);
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
            .hash(&mut h);
        let chunk = h.finish();
        let hex = format!("{chunk:016x}");
        let remaining = z - out.len();
        out.push_str(&hex[..remaining.min(hex.len())]);
        seed = chunk.rotate_left(13);
    }
    out
}

/// Generate a process-local, monotonic WID using canonical defaults (W=4, Z=6, sec).
pub fn next_wid() -> String {
    let mut st = state().lock().expect("wid state lock poisoned");

    let now = now_sec();
    let mut sec = if now > st.last_sec { now } else { st.last_sec };
    let mut seq = if sec == st.last_sec {
        st.last_seq + 1
    } else {
        0
    };

    if seq > MAX_SEQ {
        sec += 1;
        seq = 0;
    }

    st.last_sec = sec;
    st.last_seq = seq;

    let ts = fmt_ts(sec);
    let seq_str = format!("{seq:0width$}", width = W as usize);
    let pad = random_hex(Z, sec, seq);
    format!("{ts}.{seq_str}Z-{pad}")
}
