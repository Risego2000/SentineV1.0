---
description: 'Rastrea los 10 temas mas importantes y con mayor debate en redes sociales y la web.'
---

# Rastreador de Tendencias Sociales 📈

Esta habilidad permite al agente Antigravity identificar los temas de mayor impacto, tráfico y debate en redes sociales y la web en tiempo real.

## Cuándo usar esta habilidad

- Cuando el usuario pregunte "¿De qué se está hablando hoy?" o "¿Cuáles son las noticias más importantes de ahora?".
- Cuando necesites contexto actual para generar contenido o presentaciones.
- Para realizar un análisis de sentimiento o pulso social sobre temas específicos.

## Cómo usarla

### 1. Extracción de Datos

- Ejecuta el script `scripts/obtener_tendencias.py` para obtener el Top 10 inicial de Google Trends.
- Utiliza `search_web` con términos como `"tendencias redes sociales hoy"` o `"trending topics España/México/etc"`.
- Consulta agregadores de noticias como Google News o portales de tendencias locales.

### 2. Análisis de Debate

Para cada uno de los 10 temas principales:

- Busca en la web el contexto del debate: ¿Por qué es tendencia? ¿Qué dicen los usuarios en X/Twitter, Reddit o Instagram?
- Identifica las "posturas" principales si el tema genera controversia.

### 3. Síntesis y Presentación

- Clasifica los temas por categoría (Política, Tecnología, Entretenimiento, Deportes, etc.).
- Presenta al usuario un informe estructurado con:
  - **Tema**: Nombre del trending topic.
  - **Impacto**: Volumen de tráfico o relevancia.
  - **Debate**: Breve resumen de por qué la gente está hablando de ello.

## Mejores Prácticas

- **Verificación**: No confíes en un solo feed. Cruza la información de Google Trends con búsquedas web recientes.
- **Contexto**: Un tema sin contexto es solo una palabra. Explica siempre el _porqué_.
- **Neutralidad**: Al reportar debates, mantén un tono objetivo describiendo las diferentes opiniones presentes.
