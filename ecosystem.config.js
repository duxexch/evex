// PM2 Ecosystem Configuration
// تكوين PM2 للتشغيل

module.exports = {
  apps: [
    {
      name: "vex",
      script: "dist/server/index.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "development",
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      max_memory_restart: "1G",
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 4000,
    },
  ],
};
