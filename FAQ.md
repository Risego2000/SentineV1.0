# ❓ Preguntas Frecuentes - Sentinel AI v1.0.0

## 🎥 Sobre Videos y Detección

### ¿Funciona con cualquier video?
✅ **Sí**, la aplicación soporta:
- **Formatos**: MP4, MOV, AVI, MKV (H264, H265)
- **Resolución**: 480p a 4K (recomendado 1080p)
- **Frame rate**: 24fps a 60fps
- **Tamaño**: Hasta 2GB por video

### ¿Qué tipo de infracciones detecta?
La aplicación detecta automáticamente:
1. **Rebase de línea** - Cruzar una línea sin detenerse
2. **Giro prohibido** - Girar en dirección prohibida
3. **Exceso de velocidad** - Sobrepasar velocidad máxima
4. **Invasión de carril** - Entrar en carril opuesto
5. **Doble fila** - Estacionar en lugar prohibido

### ¿Necesito calibrar nada antes?
✅ **Sí, para velocidad**:
- Necesitas 2+ puntos de referencia (distancia conocida)
- El sistema calcula automáticamente km/h
- Otras detecciones funcionan sin calibración

### ¿Cómo funciona el OCR de placas?
- Sistema: PaddleOCR de código abierto
- Precisión: 95%+ en placas españolas
- Soporta: Placas antiguas y nuevas
- Resultado: Placa legible + confianza

---

## 🔒 Sobre Conexión e Internet

### ¿Necesito conexión a internet?
✅ **Sí, para estas funciones**:
- Análisis IA con Gemini API
- Sincronización con Supabase
- Actualización de base de datos

❌ **No necesita internet para**:
- Detección de vehículos (MediaPipe)
- OCR de placas (PaddleOCR)
- Procesamiento local de video

### ¿Funciona offline?
✅ **Parcialmente**:
- Puedes detectar sin internet
- Los datos se guardan localmente
- Sincronización automática cuando internet vuelve
- No puedes ver datos cloud mientras offline

### ¿Es segura la conexión?
✅ **Sí**:
- Conexión HTTPS encriptada
- Datos encriptados en tránsito y en reposo
- Autenticación con JWT
- Row Level Security en Supabase

---

## 💾 Sobre Datos y Almacenamiento

### ¿Dónde se guardan los datos?
**Base de datos**:
- Supabase Cloud (PostgreSQL)
- Encriptación automática
- Backups diarios

**Videos**:
- Almacenamiento local (opcional)
- O subido a cloud (automático)

### ¿Cuánto espacio necesito?
- **Instalación**: 2 GB
- **Caché local**: 500 MB (automático)
- **Videos**: Según archivos cargados

### ¿Puedo cambiar de contraseña?
✅ **Sí**:
1. Click en "Perfil" → "Configuración"
2. Opción "Cambiar contraseña"
3. Necesitas contraseña actual + nueva

### ¿Cómo recupero mi cuenta?
✅ **Si olvidaste contraseña**:
1. Click "¿Olvidaste contraseña?" en login
2. Ingresa tu email
3. Recibe enlace en tu email
4. Restablece desde el enlace

---

## 📊 Sobre Expedientes

### ¿Cuáles son los estados de un expediente?
```
DETECTED → UNDER_REVIEW → VALIDATED → SIGNED → EXPORTED
         ↓
      REJECTED
```

1. **DETECTED**: IA detectó infracción
2. **UNDER_REVIEW**: Operador revisando
3. **VALIDATED**: Operador confirmó
4. **REJECTED**: Operador rechazó (falso positivo)
5. **SIGNED**: Firmado digitalmente
6. **EXPORTED**: Exportado (PDF/Excel)

### ¿Puedo editar expedientes después de crear?
✅ **Sí, si no están EXPORTED**:
- Cambiar estado
- Agregar notas
- Corregir datos
- Cambios se registran en audit trail

### ¿Cómo valido un expediente?
1. Abre Expedientes (Ctrl+E)
2. Click en expediente de la lista
3. Revisa detalles (placa, tipo, video)
4. Click "✅ Validar"
5. Se cambia a estado VALIDATED

### ¿Puedo rechazar expedientes?
✅ **Sí**:
1. Abre expediente
2. Click "❌ Rechazar"
3. Ingresa motivo (falso positivo, falla IA, etc.)
4. Se cambia a REJECTED
5. No se genera PDF

---

## 📄 Sobre PDF y Exportación

### ¿Qué formatos de exportación hay?
1. **PDF Preinforme**: Antes de firmar (sin validez legal)
2. **PDF Oficial**: Después de firmar (con firma digital)
3. **Excel**: Múltiples expedientes en tabla

### ¿Puedo generar PDF sin firmar?
✅ **Sí, pero**:
- PDF Preinforme: Válido para revisión interna
- PDF Oficial: Requiere firma digital
- Excel: Siempre disponible

### ¿Cómo funciona la firma digital?
1. Expediente en estado VALIDATED
2. Click "🔐 Firmar"
3. Opciones de firma:
   - PIN numérico
   - Biometría (huella/cara)
   - Certificado digital
4. Se añade firma al PDF

### ¿El PDF incluye toda la información?
✅ **Sí**:
- Datos del vehículo (placa, tipo)
- Infracción (tipo, descripción)
- Evidencia (fotos, video)
- Firma digital
- Audit trail (quién, cuándo, cambios)

---

## ⚡ Sobre Rendimiento

### La aplicación va lenta, ¿qué hago?
1. **Cierra otras aplicaciones** (libera RAM)
2. **Reduce tamaño de video** (<500 MB)
3. **Reduce resolución** (720p en lugar de 4K)
4. **Aumenta RAM** (4 GB mínimo, 8 GB recomendado)

### ¿Cuánto tarda detectar una infracción?
- **Detección**: 100-200 ms por frame
- **OCR**: 500-800 ms por placa
- **IA analysis**: 1-2 segundos
- **Total**: 5-10 segundos por video típico

### ¿Por qué usa mucha RAM?
- Modelos IA cargados en memoria (MediaPipe, YOLOv5)
- Buffer de video (múltiples frames)
- Caché de resultados
- Histórico de sesión

---

## 🔧 Sobre Técnica

### ¿Qué tecnologías usa?
**Frontend**:
- React 19 + TypeScript
- Vite (bundler)
- Tailwind CSS

**Backend**:
- Express 5 (Node.js)
- PostgreSQL (Supabase)
- Gemini API (IA)

**Detección**:
- MediaPipe (detección de personas)
- YOLOv5m (detección de vehículos)
- PaddleOCR (extracción de placas)

### ¿Puedo instalar localmente?
✅ **Sí**, necesitas:
```bash
git clone <repo>
npm install
npm run dev
```

### ¿Cuál es el sistema requerido para desarrollo?
- Node.js 18+
- Python 3.10+
- FFmpeg
- 8 GB RAM mínimo

---

## 📞 Soporte

### ¿Dónde reporto bugs?
- Abre GitHub issue en el repositorio
- Describe el problema y pasos para reproducir
- Incluye versión y sistema operativo

### ¿Cómo solicito nuevas features?
- GitHub Discussions
- O crea un GitHub issue con tag "enhancement"
- Describe qué necesitas y por qué

### ¿Hay documentación técnica?
✅ **Sí**:
- `README.md` - Visión general
- `INSTALL_GUIDE.md` - Instalación
- `QUICK_START.md` - Uso rápido
- Código fuente comentado en `/src`

---

## 🎓 Capacitación

### ¿Hay videos tutoriales?
Próximamente en el sitio web oficial.

### ¿Se ofrece capacitación?
Contacta a support@sentinel.ai para:
- Cursos en línea
- Sesiones de entrenamiento
- Soporte premium

---

## 📋 Versión y Actualizaciones

### ¿Cuál es la versión actual?
**Versión**: 1.0.0 (Lanzamiento MVP)
**Fecha**: 2026-04-28

### ¿Hay actualizaciones automáticas?
Próximamente en v1.1.0

### ¿Cómo me mantengo actualizado?
- Suscríbete a newsletter en sitio web
- Sigue el repositorio GitHub
- Verifica "Cambios" en la app

---

## ✉️ Contacto

- **Email**: support@sentinel.ai
- **GitHub**: https://github.com/sentinel-ai
- **Web**: https://sentinel.ai

---

**Última actualización**: 2026-04-28  
**Versión**: 1.0.0
