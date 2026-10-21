#!/usr/bin/env bash
# Build and push Skill Builder audio satellite repos (run with a token that can create/push mrjkorea repos).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${TMPDIR:-/tmp}/sb-audio-repos-build"
ORG=mrjkorea

rm -rf "$BUILD"
mkdir -p "$BUILD"

publish_one() {
  local num=$1 level=$2
  local name="skill-builder-g1-audio-${num}"
  local dir="$BUILD/$name"
  mkdir -p "$dir/levels/$level"
  cp -a "$ROOT/levels/$level/audio" "$dir/levels/$level/"
  touch "$dir/.nojekyll"
  cat > "$dir/README.md" <<EOF
# ${name}

Static audio for Skill Builder **${level}** level (GitHub Pages).

Paths: \`levels/${level}/audio/intro/*.mp3\`, \`levels/${level}/audio/q/*.mp3\`

Published from \`main\` with \`.nojekyll\`.
EOF
  if ! gh repo view "${ORG}/${name}" &>/dev/null; then
    gh repo create "${ORG}/${name}" --public --description "Skill Builder ${level} audio (Pages)"
  fi
  (
    cd "$dir"
    git init -b main
    git add .
    git commit -m "Publish ${level} audio for GitHub Pages"
    git remote add origin "https://github.com/${ORG}/${name}.git"
    git push -u origin main --force-with-lease
  )
  echo "Pushed ${ORG}/${name}"
}

publish_one 2 seed
publish_one 3 roots
publish_one 4 sprout

echo "Enable GitHub Pages: Settings → Pages → Deploy from branch main / (root)."
echo "Then run: node scripts/verify-audio-pages.mjs"
