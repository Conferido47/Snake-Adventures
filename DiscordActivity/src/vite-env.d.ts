/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISCORD_CLIENT_ID?: string;
  readonly VITE_DEV_TUNNEL_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
