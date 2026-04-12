---
description: Tools are how AI agents interact with the world. A well-designed tool is the difference between an agent that works and one that hallucinates, fails silently, or costs 10x more tokens than necessary.  This skill covers tool design from schema to error handling. JSON Schema best practices, description writing that actually helps the LLM, validation, and the emerging MCP standard that's becoming the lingua franca for AI tools.  Key insight: Tool descriptions are more important than tool implementa
---

1. El usuario invoca el comando `/agent-tool-builder`.
2. El agente activa la habilidad ubicada en `.agent/skills/awesome_skills/agent-tool-builder`.
3. El agente lee el archivo `SKILL.md` de dicha habilidad para entender sus capacidades y modo de uso.
4. El agente procede a asistir al usuario siguiendo las instrucciones de la habilidad.
