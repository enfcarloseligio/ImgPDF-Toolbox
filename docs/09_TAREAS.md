# TAREAS — Plan de trabajo y hoja de ruta

> Trabajar **una tarea a la vez**: implementar → probar ([08_PLAN_DE_PRUEBAS.md](08_PLAN_DE_PRUEBAS.md)) → revisar → marcar → siguiente.
> Cada versión cierra con: README actualizado, número de versión, etiqueta `vX.Y.Z`, subida a `main` e instalador. Ver [05_REGLAS.md](05_REGLAS.md).

Leyenda: `[x]` hecho · `[ ]` pendiente · **Esfuerzo:** S pequeño · M medio · L grande.

---

## Historial publicado

- [x] **1.5.0** Herramientas de imagen (convertir, recortar, redimensionar, comprimir, quitar fondo)
- [x] **1.5.1** Mejoras de flujo y calidad
- [x] **1.6.0** Testar con avance guardado
- [x] **1.7.0** Firmar, Flujo de firma, rangos en IMG → PDF y opciones adaptables
- [x] **1.7.1** Firmas protegidas con contraseña y por nombre
- [x] **1.7.2** Vista previa real y peso de fuente funcional
- [x] **1.7.3** Corrección de la validación de Ghostscript tras instalar, aviso de reinicio, iconos más definidos
- [x] **1.8.0** Quitar fondo avanzado, miniaturas, vistas previas, modo Canvas, perfiles de DPI y calidad, Rotar sin pérdida

---

## Versión 1.8.1 — Estabilización (parche)

- [ ] T-181-1 Probar 1.8.0 con uso real y recorrer el plan de pruebas completo (S)
  - [ ] Pincel de Quitar fondo (restaurar y borrar) con el mouse
  - [ ] Arrastrar para reordenar miniaturas en IMG → PDF
  - [ ] Selector Contenedor / Canvas en distintos anchos
  - [ ] Soltar archivos desde el Explorador de Windows
  - [ ] Instalación limpia en un equipo sin Ghostscript ni ImageMagick
- [ ] T-181-2 Corregir lo que salga de las pruebas (M)
- [ ] T-181-3 Publicar el Release de GitHub `v1.8.0` con notas (S) — decisión del autor
- [ ] T-181-4 Verificar el icono de la aplicación en el menú Inicio tras una instalación real (S)

## Versión 1.9.0 — PDF esencial

Preparación:
- [ ] T-190-0 Reorganizar el menú PDF por temas (Organizar, Convertir, Anotar, Seguridad…) en `core/views.js` (M)
- [ ] T-190-1 Componente de miniaturas de páginas de PDF, reutilizable (M)

Funciones:
- [ ] T-190-2 **Organizar páginas:** reordenar, borrar y extraer con miniaturas (L)
- [ ] T-190-3 **Proteger PDF con contraseña:** cifrado y permisos (imprimir, copiar, editar) (M)
- [ ] T-190-4 **PDF en escala de grises o blanco y negro** (S)

## Versión 1.10.0 — Ajustes de imagen

- [ ] T-1100-1 **Ajustes de color:** brillo, contraste, saturación, gris, sepia, con vista previa (M)
- [ ] T-1100-2 **Voltear y espejar** (junto a Rotar) (S)
- [ ] T-1100-3 **Enfocar, suavizar y reducir ruido** con antes/después (M)

## Versión 1.11.0 — Privacidad y metadatos

- [ ] T-1110-1 **Editar metadatos del PDF** (título, autor, fecha) o borrarlos (M)
- [ ] T-1110-2 **Ver y limpiar EXIF y GPS** de imágenes, mostrando primero lo que se quita (M)
- [ ] T-1110-3 **Aplanar formularios y anotaciones** de PDF (M)

## Versión 1.12.0 — Maquetación de PDF

- [ ] T-1120-1 **Varias páginas por hoja (N-up) y cuadernillo** con vista previa (L)
- [ ] T-1120-2 **Recortar márgenes y cambiar el tamaño de página** (A4, Carta…) (M)

## Versión 1.13.0 — Composición de imágenes

- [ ] T-1130-1 **Collage y hoja de contactos** (L)
- [ ] T-1130-2 **Dividir una imagen en mosaicos** (M)
- [ ] T-1130-3 **Crear GIF animado** desde una lista ordenada (M)
- [ ] T-1130-4 **Marco, borde y esquinas redondeadas** (S)

## Versión 1.14.0 — Extracción y utilidades

- [ ] T-1140-1 **Extraer imágenes y texto de un PDF** (M)
- [ ] T-1140-2 **Comparar dos imágenes** marcando diferencias (M)
- [ ] T-1140-3 **Generar un juego de iconos** (favicon, apps, redes) (S)

## Versión 2.0.0 (opcional) — OCR

- [ ] T-200-1 Evaluar Tesseract como tercera dependencia (instalación, validación, idiomas) (M)
- [ ] T-200-2 Convertir escaneos en PDF con texto buscable (L)

---

## Mejoras técnicas pendientes (sin versión asignada)

- [ ] Migrar las llamadas a `run()` con cadenas de shell a listas de argumentos (`runSpawn`) — ver [07_SEGURIDAD.md](07_SEGURIDAD.md) (M)
- [ ] Restringir `open-url` a una lista de dominios permitidos (S)
- [ ] Añadir una política de contenido (CSP) a `index.html` (S)
- [ ] Limpieza automática de vistas previas y miniaturas temporales (S)
- [ ] Pruebas automáticas de la lógica sin Electron (`background-removal`, `lossless-rotate`, conversiones de color) con `node --test` (M)
- [ ] Firmar digitalmente el instalador para evitar el aviso de SmartScreen (M)

## Ideas descartadas o aplazadas

- Segmentación de fondo con IA (fuera de alcance; ver [06_DECISIONES.md](06_DECISIONES.md) ADR-015).
- Versiones para macOS y Linux.
