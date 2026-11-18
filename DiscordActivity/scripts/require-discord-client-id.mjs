import { loadEnv } from 'vite';

const environment = loadEnv('production', process.cwd(), 'VITE_');
if (!environment.VITE_DISCORD_CLIENT_ID?.trim()) {
  console.error('VITE_DISCORD_CLIENT_ID is required for a Discord production build.');
  process.exit(1);
}
