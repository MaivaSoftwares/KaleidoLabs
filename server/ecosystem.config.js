module.exports = {
  apps: [{
    name: 'kaleido-server',
    script: './dist/index.js',
    instances: 'max',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 4500
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 4500
    }
  }]
}; 