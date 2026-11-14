#!/usr/bin/env bash
# Starts the FastAPI backend. First run creates the virtual env and installs packages.
set -e
cd "$(dirname "$0")/backend"
if [ ! -d .venv ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi
[ -f .env ] || cp .env.example .env
source .venv/bin/activate
if [ "$1" == "--seed" ]; then python seed.py --reset; fi
echo "API running at http://localhost:8000  (docs: http://localhost:8000/docs)"
uvicorn app.main:app --reload --port 8000
