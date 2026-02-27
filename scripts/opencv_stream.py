#!/usr/bin/env python3
"""
Minimal MJPEG HTTP server using OpenCV for Waldiez Player (Tauri desktop).

Usage:
    python3 scripts/opencv_stream.py --device 0 --port 8888 --fps 15

The server exposes a single endpoint:
    GET http://127.0.0.1:<port>/video  →  multipart/x-mixed-replace MJPEG stream
"""
import argparse
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import cv2

_frame_lock = threading.Lock()
_latest_frame: bytes | None = None
_running = True


def capture_thread(device: int, fps: float) -> None:
    global _latest_frame, _running
    cap = cv2.VideoCapture(device)
    if not cap.isOpened():
        print(f"ERROR: Cannot open camera device {device}", flush=True)
        return
    interval = 1.0 / max(fps, 1.0)
    while _running:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.1)
            continue
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        with _frame_lock:
            _latest_frame = buf.tobytes()
        time.sleep(interval)
    cap.release()


class MJPEGHandler(BaseHTTPRequestHandler):
    def log_message(self, *_):  # silence per-request access logs
        pass

    def do_GET(self):
        if self.path != "/video":
            self.send_response(404)
            self.end_headers()
            return

        self.send_response(200)
        self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store")
        self.end_headers()
        try:
            while True:
                with _frame_lock:
                    frame = _latest_frame
                if frame:
                    self.wfile.write(b"--frame\r\n")
                    self.wfile.write(b"Content-Type: image/jpeg\r\n\r\n")
                    self.wfile.write(frame)
                    self.wfile.write(b"\r\n")
                time.sleep(0.05)
        except (BrokenPipeError, ConnectionResetError):
            pass


def main() -> None:
    global _running
    parser = argparse.ArgumentParser(description="MJPEG stream server for Waldiez Player")
    parser.add_argument("--device", type=int, default=0, help="Camera device index")
    parser.add_argument("--port", type=int, default=8888, help="HTTP port")
    parser.add_argument("--fps", type=float, default=15.0, help="Target capture FPS")
    args = parser.parse_args()

    t = threading.Thread(target=capture_thread, args=(args.device, args.fps), daemon=True)
    t.start()

    server = HTTPServer(("127.0.0.1", args.port), MJPEGHandler)
    print(f"MJPEG stream: http://127.0.0.1:{args.port}/video", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        _running = False


if __name__ == "__main__":
    main()
