module.exports = {
  apps: [
    {
      name: "krows-api",
      script: "dist/main.js",
      instances: 4,
      exec_mode: "cluster",
      // Per-worker safety net — restart a worker if it leaks past this, rather than
      // taking down the whole container. Tune against MEM_LIMIT_API/4 with headroom.
      max_memory_restart: "300M",
      // Give enableShutdownHooks() time to close Prisma/Redis connections before
      // pm2-runtime escalates to SIGKILL.
      kill_timeout: 8000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
