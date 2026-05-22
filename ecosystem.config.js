module.exports = {
  apps: [
    {
      name: "joker-dashboard",
      script: "node_modules/next/dist/bin/next",
      args: "dev --webpack",
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
    },
  ],
};
