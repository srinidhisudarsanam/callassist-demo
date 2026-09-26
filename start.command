#!/bin/bash
# Double-click to start the CallAssist demo on this Mac.
# Voice input needs a real web address (not a file), so this serves the folder locally.
cd "$(dirname "$0")"
PORT=8765
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
URL="http://localhost:$PORT/index.html"
# Brave blocks the speech recognition the demo uses, so prefer Chrome, then Safari.
open -a "Google Chrome" "$URL" 2>/dev/null || open -a Safari "$URL"
echo "CallAssist demo running at $URL. Close this window to stop it."
wait $SERVER
