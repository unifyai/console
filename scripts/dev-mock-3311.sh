#!/usr/bin/env bash
# Mock-simulation dev server on a fixed port for browser-pane verification.
cd /Users/djl11/console
export NEXT_PUBLIC_MOCK_SIM=true
exec npx next dev -p 3311
