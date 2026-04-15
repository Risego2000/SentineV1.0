/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_GENAI_KEY: string;
  readonly VITE_GEMINI_MODEL: string;
  readonly VITE_MAPBOX_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
