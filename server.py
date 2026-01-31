#!/usr/bin/env python3
import argparse
import json
import mimetypes
import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse
import time

DEFAULT_THEME_PATH = "/home/atlas/.config/DankMaterialShell/themes/KAV THEME/theme.json"


def load_theme(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_theme(path: Path, data: dict):
    # Create a timestamped backup once per save.
    ts = time.strftime("%Y%m%d-%H%M%S")
    backup_path = path.with_suffix(path.suffix + f".bak.{ts}")
    if path.exists():
        backup_path.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


class ThemeHandler(BaseHTTPRequestHandler):
    server_version = "ThemeTweaker/1.0"

    def _send(self, status, body=b"", content_type="text/plain; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def _serve_file(self, file_path: Path):
        if not file_path.exists():
            self._send(HTTPStatus.NOT_FOUND, b"Not found")
            return
        mime, _ = mimetypes.guess_type(str(file_path))
        content_type = mime or "application/octet-stream"
        data = file_path.read_bytes()
        self._send(HTTPStatus.OK, data, content_type)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/theme":
            try:
                data = load_theme(self.server.theme_path)
            except Exception as e:
                self._send(HTTPStatus.INTERNAL_SERVER_ERROR, str(e).encode("utf-8"))
                return
            body = json.dumps(data).encode("utf-8")
            self._send(HTTPStatus.OK, body, "application/json; charset=utf-8")
            return

        if parsed.path == "/api/path":
            body = json.dumps({"path": str(self.server.theme_path)}).encode("utf-8")
            self._send(HTTPStatus.OK, body, "application/json; charset=utf-8")
            return

        # Serve static files from the script directory
        if parsed.path in ("/", ""):
            file_path = self.server.web_root / "index.html"
        else:
            safe_path = parsed.path.lstrip("/")
            file_path = self.server.web_root / safe_path
        self._serve_file(file_path)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/theme":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
                if not isinstance(data, dict):
                    raise ValueError("JSON root must be an object")
                if "dark" not in data or "light" not in data:
                    raise ValueError("Theme must contain 'dark' and 'light' objects")
                write_theme(self.server.theme_path, data)
            except Exception as e:
                self._send(HTTPStatus.BAD_REQUEST, str(e).encode("utf-8"))
                return

            self._send(HTTPStatus.OK, b"OK")
            return

        if parsed.path == "/api/path":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                payload = json.loads(body.decode("utf-8"))
                if not isinstance(payload, dict) or "path" not in payload:
                    raise ValueError("Request must include 'path'")
                new_path = Path(str(payload["path"])).expanduser()
                if not new_path.exists() or not new_path.is_file():
                    raise ValueError("Path must be an existing file")
                if new_path.suffix.lower() != ".json":
                    raise ValueError("File must be a .json")
                # Validate it can be read
                load_theme(new_path)
                self.server.theme_path = new_path
            except Exception as e:
                self._send(HTTPStatus.BAD_REQUEST, str(e).encode("utf-8"))
                return

            body = json.dumps({"path": str(self.server.theme_path)}).encode("utf-8")
            self._send(HTTPStatus.OK, body, "application/json; charset=utf-8")
            return

        self._send(HTTPStatus.NOT_FOUND, b"Not found")


class ThemeServer(HTTPServer):
    def __init__(self, server_address, RequestHandlerClass, theme_path: Path, web_root: Path):
        super().__init__(server_address, RequestHandlerClass)
        self.theme_path = theme_path
        self.web_root = web_root


def main():
    parser = argparse.ArgumentParser(description="Local theme color tweaker server")
    parser.add_argument("--path", default=DEFAULT_THEME_PATH, help="Path to theme.json")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind")
    args = parser.parse_args()

    theme_path = Path(args.path).expanduser()
    web_root = Path(__file__).resolve().parent

    server = ThemeServer((args.host, args.port), ThemeHandler, theme_path, web_root)
    print(f"Theme tweaker running at http://{args.host}:{args.port}")
    print(f"Editing: {theme_path}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
