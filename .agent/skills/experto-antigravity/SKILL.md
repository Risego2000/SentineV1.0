---
description: 'Habilidad maestra que contiene todo el conocimiento, filosofias y mejores practicas de Google Antigravity.'
---

# Experto Google Antigravity 🧠

Esta es la habilidad **maestra** que define la inteligencia, filosofía y estándares operativos del agente. Sirve como fuente de verdad sobre "cómo hacer las cosas bien" en el ecosistema Antigravity.

## Cuándo usar esta habilidad

- **Siempre**: Esta habilidad actúa como el "sistema operativo" de tu razonamiento.
- Cuando necesites auditar el desempeño de otras habilidades.
- Cuando crees nuevas habilidades o flujos de trabajo (para asegurar que cumplan el estándar).
- Cuando tengas dudas sobre qué herramienta usar para una tarea específica.

## Principios Rectores (The Antigravity Way)

### 1. Gobernanza de Tareas (`task_boundary`)

- **Regla**: Nunca inicies una tarea compleja sin definir un `task_boundary`.
- **Estado**: El `TaskStatus` debe describir siempre el _siguiente paso_, no el pasado.
- **Granularidad**: Si una tarea tiene más de 3 pasos, merece su propio sub-task o checklist.

### 2. Gestión de Artefactos (Memoria Externa)

- El agente tiene memoria limitada. Los artefactos (`task.md`, `implementation_plan.md`) son tu memoria a largo plazo.
- **Regla**: Si no está escrito en un artefacto, no existe. Documenta todo.
- **Walkthroughs**: Son la prueba de trabajo. Incluyen capturas y logs reales, no solo texto.

### 3. Uso de Herramientas

- **Navegador**: Usa `browser_subagent` para tareas complejas de web (SPA, Auth). Usa `read_url_content` para velocidad en sitios estáticos.
- **Terminal**: Usa `run_command` con `powershell` (Windows) y asegura el manejo de errores.
- **Edición**: Prefiere `replace_file_content` para bloques contiguos. `multi_replace` solo para ediciones dispersas.

## Protocolo de Interacción de Habilidades

Cuando invoques otra habilidad (ej: `arquitecto-de-aplicaciones`), consulta este protocolo:

1.  **Planificación**: Antes de ejecutar la habilidad, crea un plan en `task.md`.
2.  **Ejecución**: Sigue las instrucciones del `SKILL.md` específico de esa habilidad.
3.  **Auditoría**: Usa los principios de _Experto Antigravity_ para verificar el resultado. ¿Es seguro? ¿Es eficiente? ¿Cumple los estándares estéticos y funcionales?

## Recursos

- `resources/MANUAL_REFERENCIA.md`: Compendio detallado de la documentación oficial.
