// PM2 Ecosystem Configuration for VEX Platform
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: "vex-platform",
      script: "dist/index.cjs",
      cwd: "/var/www/vex",
      
      // Environment
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      
      // Clustering - adjust based on VPS CPU cores
      instances: "max", // Use all available CPU cores
      exec_mode: "cluster",
      
      // Memory & Performance
      max_memory_restart: "500M", // Restart if memory exceeds 500MB
      node_args: "--max-old-space-size=512",
      
      // Logging
      log_file: "/var/log/vex/combined.log",
      out_file: "/var/log/vex/out.log",
      error_file: "/var/log/vex/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 4000,
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Health monitoring
      exp_backoff_restart_delay: 100,
    },
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: "vex",
      host: ["your-vps-ip"],
      ref: "origin/main",
      repo: "git@github.com:yourusername/vex-platform.git",
      path: "/var/www/vex",
      "pre-deploy-local": "",
      "post-deploy": "npm install && npm run build && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "",
      env: {
        NODE_ENV: "production",
      },
    },
  },
};
