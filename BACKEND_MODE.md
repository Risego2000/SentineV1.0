# Modo Backend (Decisión Temporal)

El modo backend primario temporal actual es:

- **Opción A (primaria): backend legacy `server.js`**

Motivo:

- Actualmente contiene toda la superficie de rutas usada por frontend/Electron.
- El backend modular sigue en migración.

Reglas operativas:

- Usar `npm run start` / `npm run dev:api` para desarrollo y ejecución normal.
- `server/index.ts` queda solo para migración (`npm run start:modular` / `npm run dev:api:modular`).
- Los módulos TODO del modular (`transcoding`, `cameras`, `evidence`, `reports`) ahora hacen proxy a endpoints legacy para mantener compatibilidad durante la migración.

Nota de migración:

- Para cambiar a la Opción B más adelante, las rutas modulares deben implementarse de forma nativa y eliminar el proxy.
