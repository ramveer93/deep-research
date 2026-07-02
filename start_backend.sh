#!/bin/bash
echo "Starting FastAPI backend..."

# Set the python path to the current directory (project root) so 'backend' module is found
export PYTHONPATH=$(pwd)

# Run uvicorn from the root
backend/venv312/bin/python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload
