#!/bin/sh
# WebUSB needs a secure context: serve over http://localhost (not file://).
cd "$(dirname "$0")" && exec python3 -m http.server "${1:-8000}" --bind 127.0.0.1
