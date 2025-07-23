#!/bin/bash

# Install dependencies if needed
cd backend && npm install &
cd ../frontend && npm install &
wait

# Start both servers
cd ./backend && npm run dev &
cd ./frontend && npm run dev &

echo "Backend running on http://localhost:3001"
echo "Frontend running on http://localhost:3000"
echo "Press Ctrl+C to stop both servers"

wait