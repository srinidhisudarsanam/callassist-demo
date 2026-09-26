#!/bin/bash
# Copy the working prototype here, stamp asset links with a fresh version (so browsers never mix
# a new page with a cached old stylesheet), commit and push. GitHub Pages rebuilds in about a minute.
set -e
SRC="$HOME/.codex/.chatgpt-projects/g-p-6a99a12e90ec8191ad9d1857bdec1929/callassist-prototype"
cd "$(dirname "$0")"
rsync -a --exclude 'previous-version-*' --exclude '.DS_Store' --exclude README.md --exclude publish.sh "$SRC"/ ./
V=$(date +%Y%m%d%H%M%S)
for f in index.html call.html; do
  sed -E -i '' "s#(href|src)=\"(landing\.css|landing\.js|call\.css|call\.js|engine\.js|trains\.js)(\?v=[0-9]+)?\"#\1=\"\2?v=$V\"#g" "$f"
done
git add -A
git commit -q -m "${1:-Update prototype}

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin main
echo "Published version $V"
