---
description: 'Habilidad para analizar ideas, investigar y crear PRDs detallados para aplicaciones de produccion altamente visuales y funcionales.'
---

# Arquitecto de Aplicaciones 🏗️

Esta habilidad permite al agente Antigravity analizar ideas de negocio o herramientas técnicas, investigar profundamente y transformarlas en aplicaciones de producción visualmente sorprendentes y totalmente funcionales.

## Cuándo usar esta habilidad

- Cuando el usuario solicite crear una nueva aplicación desde cero.
- Cuando se necesite profesionalizar una idea vaga mediante un PRD detallado.
- Cuando se requiera una aplicación con estándares de producción (seguridad, escalabilidad, estética premium).

## Cómo usarla

### Paso 1: Análisis e Investigación Profunda

1. **Analizar la Idea:** Escucha la solicitud del usuario e identifica el núcleo del producto.
2. **Investigar:** Utiliza `search_web` y `read_url_content` para investigar:
   - Competidores y soluciones similares.
   - Mejores prácticas de UX/UI para ese nicho.
   - Tecnologías óptimas para la implementación solicitada.
3. **Clarificación:** Haz preguntas específicas si hay ambigüedades en el flujo de negocio.

### Paso 2: Creación del PRD Operativo

Genera un documento siguiendo la plantilla en `resources/PRD_TEMPLATE.md`.

- Define **Principios No Negociables** (ej: Privacidad absoluta, Cero dependencias externas).
- Detalla los **Roles de Usuario** y el **MVP funcional**.
- Establece los **Criterios de Aceptación** claros.

### Paso 3: Diseño Aesthetics y Arquitectura

- Propón un sistema de diseño visualmente impactante (Gradients, Glassmorphism, animaciones micro).
- Define la stack técnica (Next.js, Tailwind, etc. siguiendo los estándares del sistema).

### Paso 4: Implementación por Fases

Una vez aprobado el PRD:

1. **Scaffold Automático:** Usa el script para crear la base:
   ```bash
   python .agent/skills/arquitecto-de-aplicaciones/scripts/scaffold_app.py "nombre_proyecto" --stack "nextjs|vite|html"
   ```
2. Implementa componentes clave con el diseño propuesto.
3. Integra lógica de datos y funcionalidad completa.

## Mejores Prácticas

- **Fase de PRD primero:** Nunca empieces a codear sin un PRD aprobado por el usuario.
- **Visuales WOW:** Los datos deben presentarse de forma visualmente atractiva (gráficos, dashboards dinámicos).
- **Funcionalidad Real:** No uses placeholders. Todo debe funcionar o tener un mock de datos realista.
