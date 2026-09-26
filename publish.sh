#!/bin/bash
# Publish this repo as it is: stamp asset links with a fresh version (so browsers never mix
# a new page with a cached old stylesheet), commit and push. GitHub Pages rebuilds in about a minute.
# Edit the files here; nothing is copied in from anywhere else.
set -e
cd "$(dirname "$0")"
if [ "$(git branch --show-current)" != "main" ]; then
  echo "Publish from main (currently on $(git branch --show-current))." >&2
  exit 1
fi
V=$(date +%Y%m%d%H%M%S)
for f in index.html call.html; do
  sed -E -i '' "s#(href|src)=\"(landing\.css|landing\.js|call\.css|call\.js|engine\.js|trains\.js)(\?v=[0-9]+)?\"#\1=\"\2?v=$V\"#g" "$f"
done
git add -A
git commit -q -m "${1:-Update prototype}

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin main
echo "Published version $V"
