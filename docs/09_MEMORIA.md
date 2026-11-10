# 🧠 MEMORIA — Estado actual del proyecto

> [!NOTE]
> Foto del momento: qué está hecho, qué falta y qué sigue. Se **actualiza al cerrar cada sesión de trabajo importante**. El plan completo está en [08_TAREAS](08_TAREAS.md) y las decisiones permanentes en [05_DECISIONES](05_DECISIONES.md).

**📅 Última actualización:** 10 de noviembre de 2026

## 📍 Estado actual

| | |
|---|---|
| 🏷️ **Versión publicada** | **1.8.0** (etiqueta `v1.8.0` en `main`) |
| 📦 **Instalador** | `ImgPDF-Toolbox/dist/ImgPDF Toolbox Setup 1.8.0.exe` (sin firmar) |
| 🚢 **Release de GitHub** | ⏳ aún no publicado |
| 🌿 **Ramas** | solo `main` |
| ➡️ **Siguiente versión** | 🩹 1.8.1 (estabilización) → 📄 1.9.0 (PDF esencial) |

## 🗺️ Hoja de ruta

El detalle por tarea está en [08_TAREAS](08_TAREAS.md). Resumen:

`1.8.1` 🩹 estabilización → `1.9.0` 📄 PDF esencial → `1.10.0` 🔎 OCR → `1.11.0` 🎨 ajustes de imagen → `1.12.0` 🔒 privacidad y metadatos → `1.13.0` 📐 maquetación de PDF → `1.14.0` 🧩 composición de imágenes → `1.15.0` 🧰 extracción y utilidades → `2.0.0` 🏁 consolidación.

> [!IMPORTANT]
> Toda la ruta se hace con **Ghostscript** e **ImageMagick**. El OCR usa el Tesseract que ya trae Ghostscript (probado con 10.08, en español).

## ✅ Completado en 1.8.0

- 🎨 **Quitar fondo:** varios colores, selector HEX/RGB/HSL, gotero con muestras y pincel para restaurar o borrar.
- ⬛ **Testar:** color de los cuadros (negro puro por defecto).
- 📐 **Resolución y calidad** unificadas: 72–600 DPI (300 por defecto) y 100/75/50/25 % (100 por defecto).
- 🗜️ **Comprimir:** imágenes y Recortar con cuatro niveles; PDF con perfiles de 200, 400 y 600 DPI.
- 🖼️ **Miniaturas** en las listas de imágenes con tamaño, peso, tamaño final y resalte de la orientación minoritaria.
- 🔍 **Vista previa del resultado** en Convertir, Redimensionar, Comprimir imágenes y Rotar; zoom en todas.
- ↔️ **Contenedor / Canvas** y vistas previas homologadas.
- 🔗 **Atajos** entre herramientas homólogas de PDF e imagen.
- 🔁 **Rotar sin recomprimir:** PDF con `pdf-lib`, JPG por orientación EXIF.
- 🩺 **Instalación:** corrección de la validación de Ghostscript y aviso de reinicio.

## 🎯 Tarea actual

Ninguna en curso. Pendiente de iniciar **T-181-1** (pruebas reales de 1.8.0), la primera de [08_TAREAS](08_TAREAS.md).

## ⚠️ Problemas y límites conocidos

- 🎨 Quitar fondo solo maneja fondos de color (sin IA); el retoque con pincel se aplica solo a la primera imagen de un lote.
- 🎞️ Los GIF animados conservan sus fotogramas solo al convertir a GIF o WebP; HEIC es de solo lectura.
- 🔁 Un JPG girado cambia solo su etiqueta de orientación: un visor muy antiguo que la ignore lo mostraría sin girar.
- 🔁 Un JPG con EXIF sin orientación pierde ese EXIF al girarse (se sustituye por uno mínimo).
- 🔐 Los PDF protegidos deben desbloquearse antes de girarlos.
- 🖱️ Sin probar con mouse real ni con archivos del Explorador: arrastre del pincel, reordenar miniaturas y soltar archivos.
- 🛡️ Riesgos de seguridad abiertos: ver [06_SEGURIDAD](06_SEGURIDAD.md) (se cierran en la 2.0.0).
- ✍️ El instalador no está firmado (aviso de SmartScreen).

## 📎 Archivos de apoyo

- 🎨 `identidad enfcarloseligio.md`: identidad visual (colores, tipografías, botones).
- 🔣 `ICONOS.txt`: dónde se usa cada icono y cómo reemplazarlo.
- 📦 `extraResources/`: instaladores de Ghostscript e ImageMagick (no versionados); deben existir con los nombres definidos en `src/ipc-system.js`. Desde la 1.10.0 incluirá también `tessdata/` con los idiomas del OCR.

## ➡️ Siguiente paso

Probar 1.8.0 con uso real, corregir lo que salga y publicar el Release. Luego iniciar 1.9.0 con la reorganización del menú PDF.

## 🔄 Cómo mantener este archivo

Al cerrar una sesión importante: actualizar la fecha, mover lo terminado a «Completado», dejar claro cuál es la tarea actual y el siguiente paso, y anotar los problemas nuevos.
