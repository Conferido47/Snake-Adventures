import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const tunnelHost = env.VITE_DEV_TUNNEL_HOST?.trim();

  return {
    base: './',
    server: {
      host: '0.0.0.0',
      allowedHosts: tunnelHost ? [tunnelHost] : [],
      hmr: mode === 'discord' ? { clientPort: 443 } : undefined,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
    },
  };
});
