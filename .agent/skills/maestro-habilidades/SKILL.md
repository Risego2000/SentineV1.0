---
description: 'Habilidad para crear y estructurar nuevas habilidades en el espacio de trabajo siguiendo los estándares oficiales de Antigravity.'
---

# Maestro Creador de Habilidades

Esta habilidad te guía en la creación de nuevas capacidades para el agente (skills) de manera estructurada y efectiva, asegurando que sigan el formato oficial de `SKILL.md` y la organización de archivos recomendada.

## Cuándo usar esta habilidad

- Cuando necesites crear una nueva funcionalidad o conjunto de instrucciones especializadas para el agente.
- Cuando quieras organizar mejor las capacidades actuales dividiéndolas en habilidades granulares.
- Cuando necesites documentar procesos específicos para que el agente los siga en el futuro.

## Cómo usarla (Paso a Paso)

### 1. Definir el propósito y nombre

Elige un nombre descriptivo para la habilidad (en minúsculas, usando guiones si es necesario). Por ejemplo: `analisis-datos-avanzado`.

### 2. Estructura de archivos

Crea una carpeta dentro de `.agent/skills/` con el nombre de tu habilidad.

```text
.agent/skills/
└── nombre-de-tu-habilidad/
    ├── SKILL.md (Obligatorio)
    ├── scripts/ (Opcional: para herramientas ejecutables)
    ├── examples/ (Opcional: ejemplos de uso)
    └── resources/ (Opcional: plantillas o materiales de apoyo)
```

### 3. Configurar SKILL.md

El archivo `SKILL.md` debe comenzar con un bloque YAML de frontmatter:

```yaml
---
description: 'Una descripción clara y concisa que el agente leerá para descubrir esta habilidad.'
---
```

### 4. Contenido del documento

Sigue esta estructura básica en el cuerpo del Markdown:

- `# Nombre de la Habilidad` (H1).
- `## Cuándo usar esta habilidad`: Define los escenarios o disparadores (triggers).
- `## Cómo usarla`: Instrucciones detalladas paso a paso para el agente.

### 5. Herramienta Maestro (Automatización)

Puedes usar el script incluido para generar esta estructura instantáneamente:

```bash
python .agent/skills/maestro-habilidades/scripts/crear_habilidad.py "Nombre Habilidad" "Descripción para el agente"
```

### 6. Mejores Prácticas

- **Granularidad**: Es mejor tener varias habilidades pequeñas que hagan una sola cosa bien, que una habilidad gigante y confusa.
- **Descubrimiento**: La `description` en el YAML es vital. Piensa en qué palabras clave buscaría el agente para activar esta habilidad.
- **Scripts**: Si la lógica es compleja, prefiere usar un script en la carpeta `scripts/` y documentar cómo invocarlo en `SKILL.md`.
