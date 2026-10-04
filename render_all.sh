#!/usr/bin/env bash
# Render film 2 (edu) then film 1 (astra), each as AV1 then H.264, with logs and live status.
#   ./render_all.sh              run in the foreground (Ctrl+C to stop; run again to resume)
#   ./render_all.sh --bg         run detached; then check with ./status.sh   (add --watch to follow)
#   ./render_all.sh --codec av1 --workers 6 --gpu --av1enc amf     (any render.mjs option works)
cd "$(dirname "$0")" || exit 1
mkdir -p logs
if [ "$1" = "--bg" ]; then
  shift; nohup node render_all.mjs "$@" > logs/render_all.out 2>&1 &
  echo "started in background (pid $!). Check:  ./status.sh   or   ./status.sh --watch"; exit 0
fi
node render_all.mjs "$@"
