#!/bin/sh
set -eu
ollama serve &
server_pid=$!
until ollama list >/dev/null 2>&1; do sleep 1; done
ollama pull "${OLLAMA_MODEL:-qwen3:4b}"
wait "$server_pid"
