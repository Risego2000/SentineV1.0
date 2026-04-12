---
description: 'Crea presentaciones visuales y profesionales en Google Slides a partir de blogs, enlaces o documentos.'
---

# Diseñador de Presentaciones 🎨

Esta habilidad permite al agente Antigravity transformar cualquier entrada (blog, enlace, documento) en una presentación de Google Slides profesional, visual y estructurada.

## Cuándo usar esta habilidad

- Cuando el usuario proporcione un enlace o archivo y pida una presentación.
- Cuando necesites visualizar conceptos complejos de forma clara y ejecutiva.
- Cuando se requiera preparar material para una reunión o exposición basado en investigación reciente.

## Cómo usarla

### 1. Extracción y Análisis

- Usa `read_url_content` o `view_file` para obtener la información fuente.
- Extrae los puntos clave: Título impactante, 3-5 secciones principales, y conclusiones.
- Define una "línea visual": Decide qué tipo de imágenes o estilos complementarían mejor el mensaje (ej: minimalista, tecnológico, vibrante).

### 2. Estructuración del Deck

Crea un esquema mental (o un JSON interno) con:

- **Slide 1: Portada**: Título descriptivo y subtítulo gancho.
- **Slide 2: Agenda/Contexto**: Qué aprenderá la audiencia.
- **Slides 3-N: Cuerpo**: Una idea principal por slide, máximo 3 bullet points, sugerencia de imagen profesional.
- **Slide Final: Cierre y Contacto/Q&A**.

### 3. Automatización en Google Slides

Utiliza el `browser_subagent` para:

1. Navegar a `https://slides.new`.
2. Escribir el título de la presentación en el campo correspondiente.
3. Crear las diapositivas necesarias.
4. Insertar el texto en los cuadros de texto de título y cuerpo.
5. (Opcional) Abrir el panel de "Explorar" para aplicar un diseño sugerido automáticamente por Google.

### 4. Pulido Visual

- Si el usuario lo pide, utiliza `generate_image` para crear fondos o ilustraciones únicas y súbelas a la presentación (o descárgalas para que el usuario las use).

## Mejores Prácticas

- **Menos es Más**: No satures las diapositivas de texto. Resume.
- **Jerarquía Visual**: Usa títulos grandes y legibles.
- **Storytelling**: Sigue un flujo lógico: Gancho → Problema → Solución → Conclusión.
- **Navegación**: Verifica siempre que estás en el campo de texto correcto antes de escribir en el navegador.
