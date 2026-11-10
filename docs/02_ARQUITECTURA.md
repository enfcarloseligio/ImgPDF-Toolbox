# 🏗️ ARQUITECTURA

> [!NOTE]
> Define **cómo** funciona la aplicación. El **qué y por qué** está en [01_REQUISITOS.md](01_REQUISITOS.md).

## 🔭 Resumen

Aplicación de escritorio **Electron** (Windows) con interfaz en **HTML, CSS y JavaScript sin framework ni empaquetador**. El procesamiento pesado lo hacen programas externos que se invocan como procesos: **Ghostscript** (PDF) e **ImageMagick** (imágenes). Una librería JavaScript pura, **pdf-lib**, se usa solo para ediciones de PDF que no deben reprocesar el contenido (giro de páginas y, más adelante, metadatos). Las funciones nuevas se construyen únicamente con Ghostscript e ImageMagick (ver ADR-019).

## 🛠️ Tecnologías

| Capa | Tecnología |
|---|---|
| Contenedor | Electron 33 |
| Interfaz | HTML + CSS + JS plano (scripts globales, sin módulos ni bundler) |
| Procesos externos | Ghostscript, ImageMagick (se detectan o se instalan al arrancar) |
| PDF sin reprocesar | pdf-lib (giro de páginas) |
| Persistencia | JSON en `userData` (`settings.json`) y archivos de sesión |
| Empaquetado | electron-builder (instalador NSIS) |
| Iconos | SVG propios con `currentColor` |
| Tipografías | Plus Jakarta Sans, Open Sans, Roboto (empaquetadas) |

## 🗺️ Diagrama

```
 Usuario
   │
   ▼
 Renderer (renderer/)          ← interfaz sin acceso a Node
   │  window.api.*  (preload.js, contextIsolation)
   ▼
 Proceso principal (src/)      ← handlers IPC por área
   │
   ├── Ghostscript   (PDF: comprimir, unir, rasterizar, estándares…)
   ├── ImageMagick   (imágenes: convertir, recortar, marcas…)
   ├── pdf-lib       (giro de páginas sin reprocesar)
   └── Sistema de archivos (userData, carpeta temporal, carpeta de salida)
```

## 📁 Estructura de carpetas

```
ImgPDF-Toolbox/                 ← repositorio
├── README.md, LICENSE, docs/    ← documentación
└── ImgPDF-Toolbox/              ← proyecto Electron (aquí se ejecuta npm)
    ├── main.js                  ← arranque (~20 líneas)
    ├── preload.js               ← puente: window.api (1 canal IPC = 1 función)
    ├── src/                     ← proceso principal
    │   ├── process-runner.js    ←   ejecución, cancelación, rutas únicas
    │   ├── progress.js          ←   progreso real por herramienta
    │   ├── store.js             ←   preferencias en JSON
    │   ├── page-tool.js         ←   motor común de Testar y Firmar
    │   ├── background-removal.js←   argumentos de Quitar fondo (sin Electron)
    │   ├── lossless-rotate.js   ←   giro de JPG por orientación EXIF (sin Electron)
    │   ├── signature-vault.js   ←   bóveda cifrada de firmas
    │   └── ipc-*.js             ←   handlers por área (sistema, conversiones,
    │                                 PDF, anotaciones, imágenes, testado, firma,
    │                                 flujo, vista previa)
    ├── renderer/
    │   ├── index.html           ←   carga todos los scripts en orden
    │   ├── app.js               ←   arranque, detección de herramientas, enrutador
    │   ├── core/                ←   estado, iconos, layout, utilidades, componentes
    │   ├── modules/             ←   una herramienta por archivo (renderXxx)
    │   ├── styles/              ←   global.css, modules.css, views.css
    │   └── assets/              ←   iconos SVG, tipografías, icono de la app
    ├── extraResources/          ←   instaladores de Ghostscript e ImageMagick (no versionados)
    └── scripts/                 ←   utilidades de empaquetado
```

## ⚙️ Proceso principal (`src/`)

- `main.js` solo registra los handlers de `src/` y crea la ventana.
- Cada archivo `ipc-*.js` agrupa los handlers de un área. Añadir una función = **handler en `src/` + envoltorio en `preload.js`**.
- **Cancelación:** `process-runner.js` registra el proceso en curso y lo mata con `taskkill /T /F`. Los handlers deben rechazar con el mensaje de cancelación.
- **Progreso real:** cada handler cuenta las unidades por adelantado (páginas PDF o imágenes), crea un seguimiento con `createProgress` y llama a `start()`, `tick()` y `done()`. Los trabajos de Ghostscript de una sola llamada usan `runGsWithProgress`, que lee las líneas `Page N` de su salida.
- **ImageMagick** se invoca con **listas de argumentos** (`runSpawn`), sin pasar por el shell.
- **Lógica sin Electron:** lo que se puede probar de forma aislada vive en módulos que no importan Electron (`background-removal.js`, `lossless-rotate.js`).

## 🌉 Preload (`preload.js`)

`contextIsolation: true` y `nodeIntegration: false`. Expone un objeto `window.api` plano, uno a uno con los canales IPC. El renderer no tiene acceso a Node ni al sistema de archivos salvo mediante esas funciones.

## 🖥️ Renderer (`renderer/`)

Scripts globales cargados por `<script>` en orden. Piezas principales:

| Archivo | Responsabilidad |
|---|---|
| `core/state.js` | Estado global; se modifica solo con `setOutputDir`, `setProcessing`, `setTools`, `setActiveModule` |
| `core/layout.js` | Convierte cada plantilla en tarjetas numeradas: Archivos → Carpeta de salida → Configuración → Vista previa |
| `core/ui-utils.js` | Cajas de archivos, botones de opción, perfiles de DPI y calidad, resultados |
| `core/batch.js` | Base de las herramientas de imagen por lotes |
| `core/image-gallery.js` | Listas de imágenes en miniaturas |
| `core/output-preview.js`, `annotation-preview.js`, `image-zoom.js` | Vistas previas del resultado y zoom |
| `core/page-tool.js`, `page-editor.js` | Visor de páginas de Testar y Firmar |
| `core/color-picker.js` | Selector de color (HEX, RGB, HSL) |
| `core/layout-mode.js` | Selector Contenedor / Canvas |
| `modules/*.js` | Una herramienta por archivo, con `renderXxx()` |
| `app.js` | Arranque y enrutador `moduleMap` |

### 🧩 Estructura de una herramienta

Cada plantilla es una lista plana de bloques dentro de `<div class="module">`, seguida de `organizeModule(ws)`. El ayudante clasifica los bloques (zona de archivos, carpeta de salida, configuración, vista previa, barra de acción, resultado) y los reordena en tarjetas numeradas. Un bloque de vista previa se marca con `data-step="preview"`.

### ➕ Añadir una herramienta

1. Crear `renderer/modules/<nombre>.js` con `renderXxx()`.
2. Añadir su `<script>` en `index.html` (antes de `app.js`).
3. Registrarla en `moduleMap` (`app.js`) y en `core/views.js`.
4. Añadir el handler en el `src/ipc-*.js` que corresponda y su envoltorio en `preload.js`.
5. Si usa un icono nuevo: crear el SVG y añadirlo a `ICON_LIST`.

## 💾 Datos y archivos

| Qué | Dónde |
|---|---|
| Preferencias y configuración por herramienta | `userData/settings.json` |
| Sesiones de Testar y Firmar (avance) | `userData/` (carpetas de sesión) |
| Bóveda de firmas (cifrada) | `userData/` |
| Fuentes de Google descargadas y su catálogo | `userData/` |
| Vistas previas y miniaturas | Carpeta temporal del sistema (`imgpdf_preview`, `imgpdf_thumbs`, `imgpdf_preview_annot`) |
| Resultados | La carpeta de salida elegida por el usuario |

## 🌐 Red

Solo conexiones opcionales y puntuales: consulta de la última versión de ImageMagick y Ghostscript (API de GitHub) y descarga de una tipografía de Google Fonts elegida por el usuario. Ver [06_SEGURIDAD.md](06_SEGURIDAD.md).

## 📦 Empaquetado

- `npm run build` genera el instalador NSIS en `dist/`.
- `package.json` → `build.files` debe listar **todas** las carpetas de ejecución (`src/**/*`, `renderer/**/*`…); si falta alguna, la app empaquetada falla.
- `extraResources/` se copia como `bin/` e incluye los instaladores de Ghostscript e ImageMagick con los nombres definidos en `src/ipc-system.js`.
- Las dependencias de ejecución (p. ej. `pdf-lib`) se incluyen automáticamente.

## 📏 Reglas de arquitectura

1. **Un canal IPC, una función en `window.api`.** No exponer objetos ni acceso general.
2. **El renderer nunca ejecuta procesos ni toca archivos directamente.**
3. **La lógica de procesamiento vive en `src/`;** la interfaz solo recoge opciones y muestra resultados.
4. **Reutilizar los componentes comunes** (cajas de archivos, lotes, vistas previas, selector de color, perfiles de DPI y calidad). No reescribir uno por herramienta.
5. **El proceso real y la vista previa comparten los mismos argumentos** (funciones constructoras), para que la vista previa sea fiel.
6. **Argumentos en lista, no cadenas de shell,** en todo código nuevo.
7. **Las operaciones largas informan progreso real y se pueden cancelar,** sin dejar archivos a medias.
8. **Los estados globales se modifican solo por sus funciones** (`setOutputDir`, `setProcessing`…).
9. **Nada de `!important` en CSS;** los conflictos se resuelven con orden de cascada o especificidad.

## 🔄 Flujos clave

### 🖼️ Procesamiento por lotes (imágenes)
`setupBatchTool` enlaza lista, carpeta de salida, ejecución y resultados → el handler usa `processFiles` (progreso y cancelación por archivo) → ImageMagick con argumentos en lista → resultados con peso antes y después.

### ✍️ Testar y Firmar
Abrir archivo → el motor común rasteriza las páginas a PNG en una sesión (`userData`) → el visor edita elementos como fracciones de página → el avance se guarda solo → exportar pinta los elementos sobre cada página y escribe imágenes o un PDF de imágenes (el contenido tapado no se puede recuperar).

### 🔁 Rotar sin pérdida
PDF: `pdf-lib` ajusta `/Rotate` de cada página sin tocar el contenido. JPG: se cambia solo la etiqueta de orientación EXIF (datos intactos). PNG: giro en píxeles sin pérdida.
