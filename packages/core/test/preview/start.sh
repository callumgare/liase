#!/usr/bin/env bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

tsx watch --include "$SCRIPT_DIR/**" --include "$SCRIPT_DIR/../../.secrets.mjs" test/preview/server.ts
