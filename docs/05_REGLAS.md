# 📜 REGLAS — Reglas de desarrollo

> [!NOTE]
> Reglas para quien programe en este proyecto (personas o asistentes de IA). Complementan [03_ARQUITECTURA.md](03_ARQUITECTURA.md) y [04_DISEÑO.md](04_DISEÑO.md).

## 🧠 Antes de programar

1. Leer la documentación relevante (`docs/`) y el archivo que se va a tocar.
2. Inspeccionar lo que ya existe: **reutilizar antes de crear** (cajas de archivos, lotes, vistas previas, selector de color, perfiles de DPI y calidad, miniaturas).
3. Si el cambio es grande o toca varias capas, **planificar primero** y acordar el alcance.
4. Confirmar con el autor las decisiones que cambian el comportamiento visible o la arquitectura.

## 💻 Código

- **Sin `!important`** en CSS. Resolver conflictos con orden de cascada o especificidad.
- **Cabecera de archivo** en todos los archivos: línea `Archivo:` (ruta) y `Descripción:`. Copiar el formato de uno existente.
- **Secciones** con `// ── Título ───` (`/* ── Título ── */` en CSS) que describan cada bloque.
- **Comentarios** en español profesional, que documenten **qué hace** el código para otros desarrolladores. Sin historial de cambios ni lenguaje conversacional («fix de…», «NUEVO:», «ahora…», «v1.3.0»).
- **Funciones pequeñas** y con una sola responsabilidad. No duplicar lógica.
- **No modificar archivos ajenos a la tarea.**
- Nombres de variables y funciones claros; la interfaz y los comentarios, en español.

## 🖥️ Interfaz

- Seguir [04_DISEÑO.md](04_DISEÑO.md). Los colores y espacios salen de las variables CSS, no de valores sueltos.
- Cada herramienta usa la estructura de pasos (`organizeModule`) y **no oculta pasos de forma condicional**.
- **No escribir cajas de archivos a mano:** usar `fileZoneHtml`, `pickFiles`, `fileCountText` y `FILE_KINDS`.
- Las herramientas de imagen por lotes se construyen con `batchFilesHtml`, `batchActionsHtml` y `setupBatchTool`.
- La selección de fuentes usa `buildFontPicker`; no reimplementarla.
- Los iconos son SVG (`icon()`); **nada de emojis** en la interfaz.
- Incluir siempre estados de carga, vacío y error.
- Toda herramienta que cambia un archivo y lo amerita tiene **vista previa fiel**, con zoom, que usa los **mismos argumentos** que el proceso real.

## 💎 Calidad de los archivos

- **Valores por defecto sin pérdida:** 300 DPI y calidad 100 % en todo lo que los ofrezca.
- **No recomprimir si no hace falta** (p. ej. Rotar solo cambia la rotación o la orientación).
- Las pérdidas de calidad deben ser **elegidas** por el usuario y explicadas en la interfaz.

## ⚙️ Procesos y datos

- Procesos externos con **listas de argumentos**, no con cadenas de shell.
- Las operaciones largas informan **progreso real** y se pueden **cancelar** sin dejar archivos a medias.
- Cada canal IPC nuevo lleva su función en `preload.js`.
- Validar toda entrada que llegue desde el renderer (rutas, números, colores, listas).
- `package.json` → `build.files` debe incluir cada carpeta de ejecución nueva.

## 🔐 Seguridad

- No exponer claves ni rutas internas al renderer.
- No añadir conexiones de red sin documentarlas en [07_SEGURIDAD.md](07_SEGURIDAD.md) y en el README.
- Los datos sensibles (firmas, avances de testado) se tratan según [07_SEGURIDAD.md](07_SEGURIDAD.md).

## 🧪 Pruebas

- Antes de dar una función por terminada: revisar la sintaxis de los archivos tocados, probar con archivos reales y recorrer el apartado correspondiente de [08_PLAN_DE_PRUEBAS.md](08_PLAN_DE_PRUEBAS.md).
- La lógica que no depende de Electron se prueba de forma aislada con Node.
- Cuando algo falla, corregir antes de seguir con la siguiente tarea.

## 🌿 Git y versiones

- Los cambios de cada versión van **directo a `main`**, con commits descriptivos en español y prefijo (`feat:`, `fix:`, `docs:`).
- **Excepción:** una reestructuración grande (como partir el código en `src/` y `core/`) se hace en una rama, para poder revertirla.
- Cada versión: subir el número en `ImgPDF-Toolbox/package.json`, confirmar, **etiquetar `vX.Y.Z`**, subir `main` y la etiqueta, y generar el instalador.
- Publicar el Release de GitHub requiere decisión del autor.
- Los archivos de contexto de trabajo no se suben al repositorio (ver `.gitignore`).

## 📚 Documentación

- Cada versión actualiza el README y, si cambia algo estructural, los documentos de `docs/`.
- [10_MEMORIA.md](10_MEMORIA.md) se actualiza al cerrar cada sesión de trabajo importante.
- Las decisiones técnicas duraderas se registran en [06_DECISIONES.md](06_DECISIONES.md).
- Los documentos de `docs/` **sí** pueden usar emojis, tablas, avisos y diagramas para facilitar la lectura; la interfaz de la aplicación, no.
- Toda función nueva se construye con Ghostscript e ImageMagick (excepción: `pdf-lib` para ediciones estructurales; ver ADR-019 en [06_DECISIONES](06_DECISIONES.md)).
