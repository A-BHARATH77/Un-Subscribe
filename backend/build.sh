#!/usr/bin/env bash
# build.sh — Render build script
# Installs Python dependencies + Playwright's Chromium browser

set -e

pip install -r requirements.txt
playwright install chromium
playwright install-deps chromium
