---
description: Use when user needs capabilities Claude lacks (image generation, real-time X/Twitter data) or explicitly requests external models ('blockrun', 'use grok', 'use gpt', 'dall-e', 'deepseek')
---

1. El usuario invoca el comando `/blockrun`.
2. El agente activa la habilidad ubicada en `.agent/skills/awesome_skills/blockrun`.
3. El agente lee el archivo `SKILL.md` de dicha habilidad para entender sus capacidades y modo de uso.
4. El agente procede a asistir al usuario siguiendo las instrucciones de la habilidad.
