/**
 * Canvas draw functions for each mood visualizer.
 * Pure functions — no React, no state, no side-effects.
 * Ported from WIderia Player (kideria/web/player.js).
 */
import { MOOD_CHAR_COLORS } from "../types/mood";

// ── Helpers ────────────────────────────────────────────────────────────────

function bassEnergy(freqData: Uint8Array): number {
    const count = Math.max(1, Math.floor(freqData.length * 0.07));
    let sum = 0;
    for (let i = 0; i < count; i++) sum += freqData[i];
    return sum / count / 255;
}

// ── Journey — 4-quadrant radial character bars ─────────────────────────────

export function drawJourney(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    ts: number,
    freqData: Uint8Array,
): void {
    const t = ts / 1000;
    const beat = bassEnergy(freqData);
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    bg.addColorStop(0, `rgba(20,12,4,${0.6 + beat * 0.15})`);
    bg.addColorStop(1, "rgba(5,3,1,1)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2,
        cy = H / 2;
    const baseR = Math.min(W, H) * 0.22;
    const BARS = 180;
    const quadColors = [
        MOOD_CHAR_COLORS.lute,
        MOOD_CHAR_COLORS.violin,
        MOOD_CHAR_COLORS.shaman,
        MOOD_CHAR_COLORS.band,
    ];

    for (let i = 0; i < BARS; i++) {
        const angle = (i / BARS) * Math.PI * 2 - Math.PI / 2 + t * 0.05;
        const amp = freqData[Math.floor((i / BARS) * freqData.length * 0.75)] / 255;
        const barLen = baseR * 0.15 + amp * baseR * 0.9 * (1 + beat * 0.25);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * baseR, cy + Math.sin(angle) * baseR);
        ctx.lineTo(cx + Math.cos(angle) * (baseR + barLen), cy + Math.sin(angle) * (baseR + barLen));
        ctx.strokeStyle = quadColors[Math.floor(i / (BARS / 4))];
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4 + amp * 0.6;
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const pulseR = baseR * (0.82 + beat * 0.18);
    const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR);
    radGrad.addColorStop(0, `rgba(200,148,26,${0.25 + beat * 0.4})`);
    radGrad.addColorStop(0.5, `rgba(155,79,203,${0.08 + beat * 0.1})`);
    radGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
    ctx.fillStyle = radGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,148,26,${0.4 + beat * 0.5})`;
    ctx.fill();

    if (W > 400) {
        const labels = [
            { lbl: "LUTE", x: cx - baseR * 1.6, y: cy - baseR * 0.5, color: MOOD_CHAR_COLORS.lute },
            { lbl: "VIOLIN", x: cx + baseR * 1.2, y: cy - baseR * 0.5, color: MOOD_CHAR_COLORS.violin },
            { lbl: "SHAMAN", x: cx - baseR * 1.6, y: cy + baseR * 0.8, color: MOOD_CHAR_COLORS.shaman },
            { lbl: "BAND", x: cx + baseR * 1.3, y: cy + baseR * 0.8, color: MOOD_CHAR_COLORS.band },
        ];
        ctx.font = `700 ${Math.max(9, W * 0.012)}px Cinzel, serif`;
        ctx.letterSpacing = "0.1em";
        labels.forEach(({ lbl, x, y, color }) => {
            ctx.textAlign = "center";
            ctx.fillStyle = color + "99";
            ctx.fillText(lbl, x, y);
        });
        ctx.letterSpacing = "";
    }
}

// ── Dock — spinning vinyl + frequency ring ─────────────────────────────────

export function drawDock(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    _ts: number,
    freqData: Uint8Array,
    vinylAngle: number,
): void {
    const beat = bassEnergy(freqData);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0b0905";
    ctx.fillRect(0, 0, W, H);

    const plankY = H * 0.78;
    ctx.strokeStyle = "rgba(80,50,20,0.35)";
    ctx.lineWidth = 1;
    for (let y = plankY; y < H + 2; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }
    for (let x = 0; x < W; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, plankY);
        ctx.lineTo(x, H);
        ctx.stroke();
    }

    const cx = W / 2,
        cy = H * 0.44;
    const vR = Math.min(W * 0.38, H * 0.72, 200);

    const aura = ctx.createRadialGradient(cx, cy, vR * 0.2, cx, cy, vR * 1.6);
    aura.addColorStop(0, `rgba(212,160,74,${0.08 + beat * 0.12})`);
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, vR * 1.6, 0, Math.PI * 2);
    ctx.fillStyle = aura;
    ctx.fill();

    const ringR = vR * 1.12;
    for (let i = 0; i < 128; i++) {
        const angle = (i / 128) * Math.PI * 2 - Math.PI / 2;
        const amp = freqData[Math.floor((i / 128) * freqData.length * 0.5)] / 255;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * ringR, cy + Math.sin(angle) * ringR);
        ctx.lineTo(
            cx + Math.cos(angle) * (ringR + amp * vR * 0.28),
            cy + Math.sin(angle) * (ringR + amp * vR * 0.28),
        );
        ctx.strokeStyle = `rgba(212,160,74,${0.35 + amp * 0.65})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(vinylAngle);
    ctx.beginPath();
    ctx.arc(0, 0, vR, 0, Math.PI * 2);
    ctx.fillStyle = "#110a06";
    ctx.fill();
    ctx.strokeStyle = "rgba(60,40,20,0.5)";
    ctx.lineWidth = 1;
    for (let r = vR * 0.28; r < vR * 0.96; r += vR * 0.04) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
    }
    const shine = ctx.createLinearGradient(-vR, -vR * 0.1, vR, vR * 0.1);
    shine.addColorStop(0, "rgba(255,255,255,0)");
    shine.addColorStop(0.5, "rgba(255,255,255,0.07)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(0, 0, vR, 0, Math.PI * 2);
    ctx.fillStyle = shine;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, vR * 0.29, 0, Math.PI * 2);
    const labelGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, vR * 0.29);
    labelGrad.addColorStop(0, "#9C5A1A");
    labelGrad.addColorStop(0.6, "#C8941A");
    labelGrad.addColorStop(1, "#7A4010");
    ctx.fillStyle = labelGrad;
    ctx.fill();
    ctx.save();
    ctx.rotate(-vinylAngle);
    ctx.fillStyle = "#0a0502";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${vR * 0.095}px Cinzel, serif`;
    ctx.fillText("WALDIEZ", 0, -vR * 0.06);
    ctx.font = `400 ${vR * 0.054}px Cinzel, serif`;
    ctx.fillText("Player", 0, vR * 0.095);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, vR * 0.032, 0, Math.PI * 2);
    ctx.fillStyle = "#0b0906";
    ctx.fill();
    ctx.restore();

    const needleX = cx + vR * 0.72,
        needleY = cy - vR * 0.85;
    ctx.save();
    ctx.translate(needleX, needleY);
    ctx.rotate(-0.28 + beat * 0.03);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-vR * 0.65, vR * 0.62);
    ctx.strokeStyle = "#C8941A";
    ctx.lineWidth = 2.5;
    if (beat > 0.5) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#C8941A";
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(-vR * 0.65, vR * 0.62, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#E8D080";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#C8941A";
    ctx.fill();
    ctx.restore();
}

// ── Storm — lightning frequency bars ──────────────────────────────────────

export function drawStorm(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    ts: number,
    freqData: Uint8Array,
    isPlaying: boolean,
): void {
    const t = ts / 1000;
    const beat = bassEnergy(freqData);
    ctx.fillStyle = "rgba(5,9,18,0.18)";
    ctx.fillRect(0, 0, W, H);

    if (isPlaying) {
        ctx.strokeStyle = "rgba(100,160,200,0.18)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 18; i++) {
            const x = ((i * 137.508 + t * 120) % 1) * W;
            const y1 = ((i * 0.618 + t * 0.7) % 1) * H;
            const len = 8 + (i % 4) * 4;
            ctx.beginPath();
            ctx.moveTo(x, y1);
            ctx.lineTo(x - 2, y1 + len);
            ctx.stroke();
        }
    }

    const BAR_W = Math.max(2, W / 80);
    const BARS = Math.floor(W / BAR_W);
    for (let i = 0; i < BARS; i++) {
        const amp = freqData[Math.floor((i / BARS) * freqData.length * 0.82)] / 255;
        const barH = amp * H * 0.88;
        const x = i * BAR_W;
        const blue = Math.floor(170 + amp * 85);
        const green = Math.floor(amp * 195);
        const barGrad = ctx.createLinearGradient(0, H, 0, H - barH);
        barGrad.addColorStop(0, `rgba(0,${green},${blue},0.85)`);
        barGrad.addColorStop(1, `rgba(180,240,255,${amp * 0.9})`);
        ctx.fillStyle = barGrad;
        ctx.fillRect(x, H - barH, BAR_W - 1, barH);
        ctx.fillStyle = `rgba(0,${green},${blue},0.1)`;
        ctx.fillRect(x, H, BAR_W - 1, barH * 0.25);
    }

    if (beat > 0.72 && isPlaying) {
        _drawLightning(ctx, W, H, beat);
        ctx.fillStyle = `rgba(200,230,255,${(beat - 0.72) * 0.18})`;
        ctx.fillRect(0, 0, W, H);
    }
}

function _drawLightning(ctx: CanvasRenderingContext2D, W: number, H: number, intensity: number): void {
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#00BFFF";
    ctx.strokeStyle = `rgba(200,240,255,${intensity * 0.9})`;
    ctx.lineWidth = 1 + intensity * 2.5;
    ctx.beginPath();
    let x = W * (0.15 + Math.random() * 0.7),
        y = 0;
    while (y < H * 0.65) {
        const nx = x + (Math.random() - 0.5) * 70;
        const ny = y + 15 + Math.random() * 35;
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        x = nx;
        y = ny;
    }
    ctx.stroke();
    ctx.restore();
}

// ── Fest — concert stage + circular spectrum ───────────────────────────────

export function drawFest(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    ts: number,
    freqData: Uint8Array,
    isPlaying: boolean,
): void {
    const t = ts / 1000;
    const beat = bassEnergy(freqData);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#08040f";
    ctx.fillRect(0, 0, W, H);

    const spots = [
        { x: W * 0.18, hue: 52, sweep: 0.22 },
        { x: W * 0.5, hue: 275, sweep: 0.18 },
        { x: W * 0.82, hue: 190, sweep: 0.28 },
    ];
    spots.forEach(({ x, hue, sweep }, si) => {
        const sway = Math.sin(t * (0.28 + si * 0.07) + si) * W * sweep;
        const tipX = x + sway,
            tipY = H * 0.78;
        const halfW = H * 0.26;
        const lg = ctx.createLinearGradient(x, 0, tipX, tipY);
        lg.addColorStop(0, `hsla(${hue},90%,65%,${0.3 + beat * 0.12})`);
        lg.addColorStop(0.7, `hsla(${hue},80%,55%,${0.06 + beat * 0.04})`);
        lg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(tipX - halfW, tipY);
        ctx.lineTo(tipX + halfW, tipY);
        ctx.closePath();
        ctx.fillStyle = lg;
        ctx.fill();
    });

    const cx = W / 2,
        cy = H * 0.44;
    const baseR = Math.min(W, H) * 0.12;
    for (let i = 0; i < 160; i++) {
        const angle = (i / 160) * Math.PI * 2 - Math.PI / 2;
        const amp = freqData[Math.floor((i / 160) * freqData.length * 0.72)] / 255;
        const barLen = baseR * 0.25 + amp * baseR * (1.4 + beat * 0.5);
        const hue = ((i / 160) * 300 + t * 22 + 260) % 360;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * baseR, cy + Math.sin(angle) * baseR);
        ctx.lineTo(cx + Math.cos(angle) * (baseR + barLen), cy + Math.sin(angle) * (baseR + barLen));
        ctx.strokeStyle = `hsla(${hue},88%,68%,${0.55 + amp * 0.45})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    if (beat > 0.45) {
        ctx.beginPath();
        ctx.arc(cx, cy, baseR * (1.05 + beat * 0.35), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${(beat - 0.45) * 0.55})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    const cGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR);
    cGlow.addColorStop(0, `rgba(160,96,216,${0.4 + beat * 0.4})`);
    cGlow.addColorStop(0.6, `rgba(100,30,180,${0.1 + beat * 0.1})`);
    cGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.fillStyle = cGlow;
    ctx.fill();

    _drawCrowd(ctx, W, H, beat, isPlaying);
}

function _drawCrowd(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    beat: number,
    isPlaying: boolean,
): void {
    ctx.fillStyle = "rgba(0,0,0,0.88)";
    ctx.beginPath();
    ctx.moveTo(0, H);
    const HEADS = 32;
    for (let i = 0; i <= HEADS; i++) {
        const x = (i / HEADS) * W;
        const bob = isPlaying && beat > 0.55 ? Math.sin(i * 2.3 + Date.now() / 320) * 3 : 0;
        const hh = H * 0.115 + Math.sin(i * 4.1 + 0.7) * H * 0.035 + bob;
        const px = x - W / HEADS / 2;
        const py = H - hh;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.quadraticCurveTo(px, py, x, H - hh + H * 0.025);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
}

// ── Rock — distorted bars, embers, raw electric energy ────────────────────

export function drawRock(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    _ts: number,
    freqData: Uint8Array,
    isPlaying: boolean,
): void {
    const beat = bassEnergy(freqData);

    // Heavy persistent trail — slow fade gives gritty afterglow
    ctx.fillStyle = `rgba(15,2,3,${isPlaying ? 0.22 : 0.55})`;
    ctx.fillRect(0, 0, W, H);

    if (isPlaying) {
        // Wide distorted bars from bottom (broader than storm, more aggressive)
        const BAR_W = Math.max(3, W / 52);
        const BARS = Math.floor(W / BAR_W);

        for (let i = 0; i < BARS; i++) {
            const amp = (freqData[Math.floor((i / BARS) * freqData.length * 0.78)] ?? 0) / 255;
            // Distortion jitter — randomises amplitude slightly for a "clipped" look
            const dist = Math.min(1, amp + (Math.random() - 0.5) * amp * 0.12);
            const barH = dist * H * (0.85 + beat * 0.15);
            const x = i * BAR_W;

            const r1 = Math.floor(180 + amp * 55);
            const g1 = Math.floor(amp * 80);
            const r2 = Math.min(255, Math.floor(220 + amp * 35));
            const g2 = Math.floor(amp * 200);
            const b2 = Math.floor(amp * 30);

            const barGrad = ctx.createLinearGradient(0, H, 0, H - barH);
            barGrad.addColorStop(0, `rgba(${r1},${g1},0,0.92)`);
            barGrad.addColorStop(0.55, `rgba(${r2},${g2 >> 1},0,0.88)`);
            barGrad.addColorStop(1, `rgba(255,${g2},${b2},${0.45 + amp * 0.55})`);
            ctx.fillStyle = barGrad;
            ctx.fillRect(x, H - barH, BAR_W - 1, barH);
        }

        // Ember sparks scattered from bar tops on medium–heavy beats
        if (beat > 0.58) {
            const count = Math.floor((beat - 0.58) * 28);
            for (let i = 0; i < count; i++) {
                const sx = Math.random() * W;
                const sy = H * (0.04 + Math.random() * 0.38);
                const sr = 1.2 + Math.random() * 2.8;
                const g = Math.floor(40 + Math.random() * 160);
                ctx.beginPath();
                ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,${g},0,${(beat - 0.58) * 2.2 * Math.random()})`;
                ctx.fill();
            }
        }

        // Hard-hit flash
        if (beat > 0.82) {
            ctx.fillStyle = `rgba(255,70,10,${(beat - 0.82) * 0.18})`;
            ctx.fillRect(0, 0, W, H);
        }
    }
}

// ── Pop — neon bubbles, rainbow bars, sparkles ────────────────────────────

export function drawPop(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    ts: number,
    freqData: Uint8Array,
    _isPlaying: boolean,
): void {
    const t = ts / 1000;
    const beat = bassEnergy(freqData);

    // Light, lively persistent trail
    ctx.fillStyle = "rgba(8,1,21,0.17)";
    ctx.fillRect(0, 0, W, H);

    // Rainbow frequency bars from bottom — thin, bright, neon
    const BAR_W = Math.max(2, W / 90);
    const BARS = Math.floor(W / BAR_W);
    for (let i = 0; i < BARS; i++) {
        const amp = (freqData[Math.floor((i / BARS) * freqData.length * 0.7)] ?? 0) / 255;
        const barH = amp * H * (0.5 + beat * 0.15);
        const hue = ((i / BARS) * 320 + t * 55) % 360;
        ctx.fillStyle = `hsla(${hue},95%,68%,${0.45 + amp * 0.55})`;
        ctx.fillRect(i * BAR_W, H - barH, BAR_W - 1, barH);
    }

    // Floating translucent bubbles (position driven by sin — no Math.random)
    const BUBBLES = 6;
    for (let i = 0; i < BUBBLES; i++) {
        const bx = W * (0.12 + (i / BUBBLES) * 0.76 + Math.sin(t * 0.38 + i * 1.4) * 0.07);
        const by = H * (0.18 + 0.56 * ((Math.sin(t * 0.32 + i * 0.85) + 1) / 2));
        const br = (22 + i * 7 + beat * 22) * Math.min(1, W / 500);
        const hue = (i * 55 + t * 28) % 360;

        const grd = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        grd.addColorStop(0, `hsla(${hue},90%,72%,${0.16 + beat * 0.14})`);
        grd.addColorStop(0.65, `hsla(${hue},85%,62%,${0.06 + beat * 0.06})`);
        grd.addColorStop(1, `hsla(${hue},80%,55%,0)`);
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue},95%,82%,${0.22 + beat * 0.28})`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Sparkle dots on beat (sin-based positions — smooth, no Math.random)
    if (beat > 0.5) {
        for (let i = 0; i < 10; i++) {
            const sx = W * (0.08 + 0.84 * ((Math.sin(i * 137.5 + t * 0.09) + 1) / 2));
            const sy = H * 0.72 * ((Math.sin(i * 73.1 + t * 0.07) + 1) / 2);
            const hue = (i * 36 + t * 65) % 360;
            const alpha = (beat - 0.5) * 2.5 * ((Math.sin(t * 8 + i * 2.1) + 1) / 2);
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5 + (beat - 0.5) * 4.5, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${hue},100%,82%,${alpha})`;
            ctx.fill();
        }
    }

    // Central colour-shifting pulsing glow
    const cx = W / 2,
        cy = H / 2;
    const glR = Math.min(W, H) * 0.09 * (0.75 + beat * 0.45);
    const gh = (t * 48) % 360;
    const cGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glR);
    cGrd.addColorStop(0, `hsla(${gh},100%,78%,${0.28 + beat * 0.4})`);
    cGrd.addColorStop(1, `hsla(${gh},100%,68%,0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, glR, 0, Math.PI * 2);
    ctx.fillStyle = cGrd;
    ctx.fill();
}

// ── Disco — spinning ball, mirrored bars, light projections ───────────────

export function drawDisco(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    ts: number,
    freqData: Uint8Array,
    isPlaying: boolean,
    discoAngle: number,
): void {
    const t = ts / 1000;
    const beat = bassEnergy(freqData);

    // Deep navy fade
    ctx.fillStyle = "rgba(2,2,15,0.22)";
    ctx.fillRect(0, 0, W, H);

    // ── Disco ball ──────────────────────────────────────────────────────
    const ballX = W / 2,
        ballY = H * 0.17;
    const ballR = Math.min(W, H) * 0.068;

    // Facet rows — each row is a ring around the sphere
    const ROWS = 6;
    for (let row = 0; row < ROWS; row++) {
        const phi = Math.PI * 0.12 + (row / ROWS) * Math.PI * 0.76;
        const ringR = ballR * Math.sin(phi);
        const ringY = ballY + ballR * Math.cos(phi) * 0.52; // perspective squish
        const nFacets = Math.max(4, Math.round((ringR / ballR) * 12));

        for (let f = 0; f < nFacets; f++) {
            const theta = (f / nFacets) * Math.PI * 2 + discoAngle;
            const fx = ballX + ringR * Math.cos(theta);
            const brightness = Math.max(0, Math.cos(theta - Math.PI * 0.25) * 0.8 + 0.25);
            const hue = ((f / nFacets) * 300 + t * 55) % 360;

            if (brightness > 0.08) {
                ctx.fillStyle = `hsla(${hue},95%,${48 + brightness * 52}%,${brightness * 0.95})`;
                ctx.fillRect(fx - 3, ringY - 2, 6, 4);
            }
        }
    }

    // Ball glow + highlight
    const bGrd = ctx.createRadialGradient(
        ballX - ballR * 0.25,
        ballY - ballR * 0.25,
        0,
        ballX,
        ballY,
        ballR * 1.3,
    );
    bGrd.addColorStop(0, `rgba(255,255,255,${0.22 + beat * 0.15})`);
    bGrd.addColorStop(0.4, "rgba(200,220,255,0.08)");
    bGrd.addColorStop(1, "rgba(80,100,180,0)");
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballR * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = bGrd;
    ctx.fill();

    // ── Spinning light projections ──────────────────────────────────────
    if (isPlaying) {
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2 + discoAngle * 3.8;
            const dist = 0.22 + ((Math.sin(angle * 0.6 + t * 0.3) + 1) / 2) * 0.4;
            const projX = ballX + Math.cos(angle) * W * dist;
            const projY = ballY + (0.12 + Math.abs(Math.sin(angle * 1.2))) * H * dist * 0.75;
            const spotR = (10 + beat * 18) * Math.max(0.5, W / 600);
            const hue = (i * 36 + t * 35) % 360;

            if (projX > -spotR && projX < W + spotR && projY > -spotR && projY < H + spotR) {
                const sGrd = ctx.createRadialGradient(projX, projY, 0, projX, projY, spotR);
                sGrd.addColorStop(0, `hsla(${hue},100%,80%,${0.58 + beat * 0.32})`);
                sGrd.addColorStop(1, `hsla(${hue},90%,65%,0)`);
                ctx.beginPath();
                ctx.arc(projX, projY, spotR, 0, Math.PI * 2);
                ctx.fillStyle = sGrd;
                ctx.fill();
            }
        }
    }

    // ── Mirrored frequency bars from center ─────────────────────────────
    const cy = H * 0.56;
    const BAR_W = Math.max(2, W / 68);
    const BARS = Math.floor(W / BAR_W);
    for (let i = 0; i < BARS; i++) {
        const amp = (freqData[Math.floor((i / BARS) * freqData.length * 0.65)] ?? 0) / 255;
        const barH = amp * H * 0.3;
        const x = i * BAR_W;
        const hue = ((i / BARS) * 80 + t * 28 + 38) % 360; // warm gold/amber

        ctx.fillStyle = `hsla(${hue},88%,${52 + amp * 32}%,${0.55 + amp * 0.45})`;
        ctx.fillRect(x, cy - barH, BAR_W - 1, barH); // up

        ctx.fillStyle = `hsla(${hue},82%,${48 + amp * 28}%,${0.35 + amp * 0.35})`;
        ctx.fillRect(x, cy, BAR_W - 1, barH * 0.55); // down (shorter reflection)
    }

    // ── Dance floor perspective grid ────────────────────────────────────
    const floorY = H * 0.84;
    ctx.strokeStyle = "rgba(90,70,30,0.28)";
    ctx.lineWidth = 1;
    for (let fy = floorY; fy < H + 2; fy += (H - floorY) / 4) {
        ctx.beginPath();
        ctx.moveTo(0, fy);
        ctx.lineTo(W, fy);
        ctx.stroke();
    }
    const vp = W / 2;
    for (let xi = 0; xi <= 12; xi++) {
        const fx = (xi / 12) * W;
        ctx.beginPath();
        ctx.moveTo(fx, floorY);
        ctx.lineTo(vp + (fx - vp) * 0.1, H);
        ctx.stroke();
    }
}

// ── Idle — ambient breathing glow (shown when not playing / no audio) ──────

export function drawIdle(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    ts: number,
    moodAccent: string, // hex, e.g. "#C8941A"
): void {
    const t = ts / 1000;
    const beat = ((Math.sin(t * 0.9) + 1) / 2) * 0.4;
    const cx = W / 2,
        cy = H / 2;

    ctx.clearRect(0, 0, W, H);

    // Parse hex to rgb
    const r = parseInt(moodAccent.slice(1, 3), 16);
    const g = parseInt(moodAccent.slice(3, 5), 16);
    const b = parseInt(moodAccent.slice(5, 7), 16);

    const radius = Math.min(W, H) * 0.25 * (0.8 + beat);
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grd.addColorStop(0, `rgba(${r},${g},${b},${0.12 + beat * 0.1})`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2 + t * 0.15;
        const dist = Math.min(W, H) * 0.2 + Math.sin(t * 0.6 + i) * 8;
        const px = cx + Math.cos(ang) * dist;
        const py = cy + Math.sin(ang) * dist;
        const alpha = ((Math.sin(t * 0.8 + i * 0.4) + 1) / 2) * 0.4;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
    }
}
