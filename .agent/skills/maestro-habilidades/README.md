# Maestro Creador de Habilidades 🛠️

Esta habilidad automatiza la creación de nuevas capacidades para el agente Antigravity, asegurando que sigan el estándar oficial.

## ¿Cómo funciona?

1.  **Automatización**: Crea la estructura de carpetas (`scripts`, `examples`, `resources`) y archivos base (`SKILL.md`, `README.md`).
2.  **Estándar**: Asegura que el `SKILL.md` tenga el frontmatter YAML necesario para que el agente lo descubra.
3.  **Facilidad**: Proporciona un workflow para ejecutarlo directamente desde la barra de comandos.

## Uso para Humanos

Aunque el agente puede usar esta habilidad por sí mismo, tú también puedes invocarla:

### Mediante Workflow (Recomendado)

Escribe `/crear-habilidad` en el chat y sigue las instrucciones.

### Mediante Terminal

```bash
python .agent/skills/maestro-habilidades/scripts/crear_habilidad.py "Nombre de la Habilidad" "Descripción para el agente"
```

## Estándar de Habilidades

Cada habilidad creada contiene:

- **SKILL.md**: El "cerebro" de la habilidad. Define cuándo y cómo el agente debe usarla.
- **README.md**: Documentación para ti (el usuario).
- **Carpetas**: Espacios organizados para scripts de lógica, ejemplos y recursos.

---

_Gestión de Capacidades Antigravity_
