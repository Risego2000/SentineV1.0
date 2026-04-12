---
description: Create and manage Claude Code skills following Anthropic best practices. Use when creating new skills, modifying skill-rules.json, understanding trigger patterns, working with hooks, debugging skill activation, or implementing progressive disclosure. Covers skill structure, YAML frontmatter, trigger types (keywords, intent patterns, file paths, content patterns), enforcement levels (block, suggest, warn), hook mechanisms (UserPromptSubmit, PreToolUse), session tracking, and the 500-line rule.
---

1. El usuario invoca el comando `/skill-developer`.
2. El agente activa la habilidad ubicada en `.agent/skills/awesome_skills/skill-developer`.
3. El agente lee el archivo `SKILL.md` de dicha habilidad para entender sus capacidades y modo de uso.
4. El agente procede a asistir al usuario siguiendo las instrucciones de la habilidad.
