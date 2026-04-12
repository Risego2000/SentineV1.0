---
description: Voice agents represent the frontier of AI interaction - humans speaking naturally with AI systems. The challenge isn't just speech recognition and synthesis, it's achieving natural conversation flow with sub-800ms latency while handling interruptions, background noise, and emotional nuance.  This skill covers two architectures: speech-to-speech (OpenAI Realtime API, lowest latency, most natural) and pipeline (STT→LLM→TTS, more control, easier to debug). Key insight: latency is the constraint. Hu
---

1. El usuario invoca el comando `/voice-agents`.
2. El agente activa la habilidad ubicada en `.agent/skills/awesome_skills/voice-agents`.
3. El agente lee el archivo `SKILL.md` de dicha habilidad para entender sus capacidades y modo de uso.
4. El agente procede a asistir al usuario siguiendo las instrucciones de la habilidad.
