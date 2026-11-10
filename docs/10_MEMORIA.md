# MEMORIA — Estado actual del proyecto

> Foto del momento: qué está hecho, qué falta y qué sigue. Se **actualiza al cerrar cada sesión de trabajo importante**. Las decisiones permanentes están en [06_DECISIONES.md](06_DECISIONES.md) y las tareas en [09_TAREAS.md](09_TAREAS.md).

**Última actualización:** 10 de noviembre de 2026

## Estado actual

- **Versión publicada:** 1.8.0 (etiqueta `v1.8.0` en `main`).
- **Instalador generado:** `ImgPDF-Toolbox/dist/ImgPDF Toolbox Setup 1.8.0.exe` (sin firmar).
- **Release de GitHub:** aún no publicado.
- **Rama de trabajo:** solo `main`.
- **Siguiente versión:** 1.8.1 (estabilización) y después 1.9.0 (PDF esencial).

## Completado en 1.8.0

- Quitar fondo: varios colores, selector HEX/RGB/HSL, gotero con muestras y pincel para restaurar o borrar.
- Testar: color de los cuadros (negro puro por defecto).
- Perfiles de resolución (72–600 DPI, 300 por defecto) y calidad (100/75/50/25 %, 100 por defecto) en todas las herramientas.
- Comprimir imágenes y Recortar con cuatro niveles; Comprimir PDF con perfiles de 200, 400 y 600 DPI.
- Miniaturas en las listas de imágenes, con tamaño, peso, tamaño final y resalte de la orientación minoritaria.
- Vista previa del resultado en Convertir, Redimensionar, Comprimir imágenes y Rotar; zoom en todas las vistas previas.
- Selector Contenedor / Canvas; vistas previas y áreas de trabajo homologadas.
- Atajos entre herramientas homólogas de PDF e imagen.
- Rotar sin recomprimir (PDF con `pdf-lib`, JPG por orientación EXIF).
- Corrección de la validación de Ghostscript tras instalar y aviso de reinicio.

## Hoja de ruta

El plan de versiones y sus tareas está en [09_TAREAS.md](09_TAREAS.md). Resumen: 1.8.1 estabilización · 1.9.0 PDF esencial · 1.10.0 ajustes de imagen · 1.11.0 privacidad y metadatos · 1.12.0 maquetación de PDF · 1.13.0 composición de imágenes · 1.14.0 extracción y utilidades · 2.0.0 OCR (opcional).

## Tarea actual

Ninguna en curso. Pendiente de iniciar **T-181-1** (pruebas reales de 1.8.0), la primera de [09_TAREAS.md](09_TAREAS.md).

## Problemas y límites conocidos

- Quitar fondo solo maneja fondos de color (sin IA); el retoque con pincel se aplica solo a la primera imagen de un lote.
- Los GIF animados conservan sus fotogramas solo al convertir a GIF o WebP; HEIC es de solo lectura.
- Un JPG girado cambia solo su etiqueta de orientación: un visor muy antiguo que la ignore lo mostraría sin girar.
- Un JPG con EXIF sin orientación pierde ese EXIF al girarse (se sustituye por uno mínimo).
- Los PDF protegidos deben desbloquearse antes de girarlos.
- Sin probar con mouse real ni con archivos del Explorador: arrastre del pincel, reordenar miniaturas y soltar archivos.
- Riesgos de seguridad abiertos: ver [07_SEGURIDAD.md](07_SEGURIDAD.md).
- El instalador no está firmado (aviso de SmartScreen).

## Archivos de apoyo

- `identidad enfcarloseligio.md`: identidad visual (colores, tipografías, botones).
- `ICONOS.txt`: dónde se usa cada icono y cómo reemplazarlo.
- `extraResources/`: instaladores de Ghostscript e ImageMagick (no versionados); deben existir con los nombres definidos en `src/ipc-system.js`.

## Siguiente paso

Probar 1.8.0 con uso real, corregir lo que salga y publicar el Release. Luego iniciar 1.9.0 con la reorganización del menú PDF.

## Cómo mantener este archivo

Al cerrar una sesión importante: actualizar la fecha, mover lo terminado a «Completado», dejar claro cuál es la tarea actual y el siguiente paso, y anotar los problemas nuevos.
