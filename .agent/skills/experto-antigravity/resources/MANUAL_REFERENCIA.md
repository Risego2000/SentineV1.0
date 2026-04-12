# Manual de Referencia Google Antigravity

Este documento compila las prácticas oficiales para el desarrollo de agentes con el framework Antigravity.

## Arquitectura del Agente

### 1. El Ciclo de Vida (Loop)

El agente opera en un bucle continuo de **Pensamiento -> Acción -> Observación**.

- **Pensamiento**: El agente analiza el contexto y decide la siguiente herramienta.
- **Acción**: Ejecución de herramienta (`tool_call`).
- **Observación**: Lectura del resultado (`tool_response`).

**Mejor Práctica**: Mantener el contexto limpio. No satures la memoria con lecturas de archivos gigantes innecesarios.

### 2. Modos de Operación

- **PLANNING**: Fase de investigación y diseño. No tocar código. Crear `implementation_plan.md`.
- **EXECUTION**: Fase de escritura. Tocar código. Actualizar `task.md`.
- **VERIFICATION**: Fase de pruebas. No tocar código principal, solo tests. Crear `walkthrough.md`.

## Herramientas Core

| Herramienta        | Uso Correcto                                             | Anti-Patrón                                           |
| :----------------- | :------------------------------------------------------- | :---------------------------------------------------- |
| `task_boundary`    | Al inicio de CADA bloque lógico.                         | Usarlo cada vez que respiras o nunca usarlo.          |
| `notify_user`      | Solo cuando es necesario input humano o en fin de tarea. | Usarlo para decir "hola" o actualizaciones triviales. |
| `run_command`      | Comandos específicos y seguros.                          | `git push` sin commit previo, o scripts bloqueantes.  |
| `browser_subagent` | Navegación compleja, SPAs.                               | Usarlo para leer un simple JSON o TXT online.         |

## Desarrollo de Habilidades (Skill Development)

### Estructura Canónica

```
mi-habilidad/
├── SKILL.md            # Instrucciones maestras
├── README.md           # Guía para humanos
├── scripts/            # Scripts Python/Bash de apoyo
└── resources/          # Plantillas, diccionarios, datos
```

### Filosofía "Tool-First"

Si una habilidad requiere lógica compleja, no le pidas al LLM que la "piense" cada vez.
**Escribe un script.**

- Mal: "Analiza este texto y dime la frecuencia de palabras."
- Bien: `run_command(python scripts/analyzer.py input.txt)`

## Troubleshooting

- **Error 429/403**: Usa `browser_subagent` con esperas humanas.
- **Alucinaciones**: Fuerza al agente a leer `SKILL.md` antes de actuar.
- **Bucles Infinitos**: Revisa los criterios de parada en tus scripts.
