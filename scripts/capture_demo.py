#!/usr/bin/env python3
"""
Capture mixer demo screenshots + animated GIF for the README.
Usage: python scripts/capture_demo.py
Dev server must be running on http://localhost:5173
"""
import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path("docs/demo")
OUT.mkdir(parents=True, exist_ok=True)

# Music-friendly names we inject into the DOM after the page loads
DEMO_NAMES = [
    "Midnight Drive.mp3",
    "Summer Vibes — Extended Mix",
    "Deep House Sessions",
    "Chill Beats Vol. 3.flac",
    "Techno Mix 2024.mp3",
    "Neon Lights (Radio Edit)",
    "Lost in the Groove.wav",
]


def grab(page, name: str) -> Path:
    path = OUT / name
    page.screenshot(path=str(path))
    print(f"  saved {path}")
    return path


def switch_to_mixer(page):
    """Click the mode selector button and choose Mixer from the dropdown."""
    buttons = page.locator("header button, [role='banner'] button")
    count = buttons.count()
    for i in range(count):
        buttons.nth(i).click()
        page.wait_for_timeout(300)
        mixer_btn = page.locator("button", has_text="Mixer").first
        if mixer_btn.is_visible():
            mixer_btn.click()
            page.wait_for_timeout(600)
            return
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
    raise RuntimeError("Could not find mode selector button")


def rename_tracks(page):
    """Overwrite visible track name text nodes with music-friendly labels."""
    page.evaluate(f"""(names) => {{
        const spans = [...document.querySelectorAll('ul li span')].filter(
            el => el.classList.contains('truncate') || el.textContent.trim().length > 3
        );
        names.forEach((name, i) => {{
            if (spans[i]) spans[i].textContent = name;
        }});
    }}""", DEMO_NAMES)


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1400, "height": 800},
            device_scale_factor=2,
        )
        page = ctx.new_page()

        print("→ Loading app …")
        page.goto("http://localhost:5173")
        page.wait_for_load_state("networkidle", timeout=12_000)
        page.wait_for_timeout(800)

        print("→ Switching to Mixer mode via UI …")
        switch_to_mixer(page)
        page.wait_for_selector("text=MIXER", timeout=8_000)
        print("  ✓ Mixer view active")

        print("→ Renaming tracks to music-friendly labels …")
        rename_tracks(page)
        page.wait_for_timeout(200)

        frames: list[Path] = []

        # Frame 1 — overview
        print("→ Frame 1: overview")
        frames.append(grab(page, "frame_01.png"))

        # Frames 2–4 — hover tracks to show A/B buttons
        tracks = page.locator("ul li")
        count = tracks.count()
        print(f"  {count} tracks in library")
        for i in range(min(3, count)):
            print(f"→ Frame {i + 2}: hover track {i + 1}")
            tracks.nth(i).hover()
            page.wait_for_timeout(150)
            frames.append(grab(page, f"frame_0{i + 2}.png"))

        # Frame 5 — idle
        print("→ Frame 5: idle")
        page.mouse.move(900, 400)
        page.wait_for_timeout(150)
        frames.append(grab(page, "frame_05.png"))

        browser.close()

    # Build GIF (resize to 1200px wide for README)
    print("→ Building GIF …")
    delays = [200, 140, 110, 140, 170]
    gif = OUT / "mixer_demo.gif"
    cmd = ["convert", "-loop", "0"]
    for d, f in zip(delays, frames):
        cmd += ["-delay", str(d), "-resize", "1200x", str(f)]
    cmd.append(str(gif))
    subprocess.run(cmd, check=True)

    try:
        subprocess.run(
            ["gifsicle", "--optimize=3", "--colors", "128", "-o", str(gif), str(gif)],
            check=True, capture_output=True,
        )
        print("  ✓ gifsicle optimised")
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass

    # Static screenshot at full resolution
    shot = OUT / "mixer_screenshot.png"
    subprocess.run(["cp", str(frames[0]), str(shot)], check=True)

    print(f"\nDone!  GIF {gif.stat().st_size // 1024} KB  |  PNG {shot.stat().st_size // 1024} KB")
    print("\nAdd to README:\n  ![Mixer](docs/demo/mixer_demo.gif)")


if __name__ == "__main__":
    main()
