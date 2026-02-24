#!/bin/bash

# Install dependencies
npm install

# Build the application
npm run build

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# Start/Restart the application with PM2
pm2 startOrRestart ecosystem.config.js --env production

# Save PM2 process list and environment
pm2 save

# Setup PM2 startup script
pm2 startup 