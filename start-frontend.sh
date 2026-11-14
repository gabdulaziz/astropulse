#!/usr/bin/env bash
# Starts the React dev server. First run installs npm packages.
set -e
cd "$(dirname "$0")/frontend"
[ -d node_modules ] || npm install
[ -f .env ] || cp .env.example .env
npm run dev
