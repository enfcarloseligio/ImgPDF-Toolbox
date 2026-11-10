# DECISIONES — Decisiones de arquitectura

> Decisiones **permanentes** y su razón. Antes de cambiar una de ellas, revisar el motivo. Para el estado actual del proyecto, ver [10_MEMORIA.md](10_MEMORIA.md).

Formato: **Decisión** · **Razón** · **Consecuencias**. Las decisiones sustituidas no se borran: se marcan como *Reemplazada*.

---

## ADR-001 — Aplicación de escritorio con Electron
**Decisión:** construir una aplicación de escritorio Windows con Electron.
**Razón:** el producto promete privacidad total; todo debe ejecutarse en el equipo del usuario, con acceso a archivos y a programas externos.
**Consecuencias:** instalador grande (~175 MB); distribución mediante instalador NSIS; sin versión web.

## ADR-002 — Ghostscript e ImageMagick como programas externos
**Decisión:** delegar el procesamiento en Ghostscript (PDF) e ImageMagick (imágenes), invocados como procesos, en lugar de reimplementar o enlazar librerías.
**Razón:** son maduras y cubren cientos de formatos; su licencia (Ghostscript AGPL) se respeta al invocarlas como programas independientes.
**Consecuencias:** hay que detectarlas o instalarlas al arrancar; el instalador puede incluir sus instaladores; las diferencias de versión se tratan en `src/process-runner.js`.

## ADR-003 — Interfaz sin framework ni empaquetador
**Decisión:** HTML, CSS y JavaScript plano con scripts globales cargados en orden desde `index.html`.
**Razón:** simplicidad, cero configuración de build, arranque rápido y fácil mantenimiento por una sola persona.
**Consecuencias:** todo es global; los nombres deben ser únicos; el orden de los `<script>` importa; la reutilización se logra con componentes en `core/`.

## ADR-004 — Separación en `src/` y `renderer/core` + `renderer/modules`
**Decisión:** dividir el código monolítico original en un proceso principal por áreas (`src/ipc-*.js`) y un renderer con núcleo (`core/`) y una herramienta por archivo (`modules/`).
**Razón:** el archivo único era inmanejable y propenso a errores.
**Consecuencias:** cada función nueva exige handler + envoltorio en `preload.js`; se hizo en una rama por el tamaño del cambio.

## ADR-005 — Aislamiento de contexto y API plana
**Decisión:** `contextIsolation: true`, `nodeIntegration: false` y un objeto `window.api` con una función por canal IPC.
**Razón:** el renderer no debe tener acceso a Node ni al sistema.
**Consecuencias:** toda capacidad nueva se declara explícitamente en el preload.

## ADR-006 — Estructura de pasos uniforme
**Decisión:** toda herramienta se presenta como pasos numerados (Archivos → Carpeta de salida → Configuración → Vista previa) generados por `organizeModule`.
**Razón:** que el usuario aprenda una vez y use todas; y que las herramientas nuevas sean baratas de construir.
**Consecuencias:** los pasos no se ocultan de forma condicional; las plantillas son listas planas de bloques.

## ADR-007 — Progreso real y cancelación
**Decisión:** todas las operaciones cuentan sus unidades de antemano (páginas o imágenes) e informan avance real; todas son cancelables.
**Razón:** un porcentaje inventado no es confiable y las tareas pueden ser largas.
**Consecuencias:** los handlers rechazan con el mensaje de cancelación; los trabajos de Ghostscript de una llamada leen las líneas `Page N` (nunca usar `-q` ahí).

## ADR-008 — Testar rasteriza a propósito
**Decisión:** Testar convierte cada página en imagen y pinta los cuadros sobre los píxeles.
**Razón:** que el contenido tapado **no se pueda recuperar** del archivo exportado (un cuadro negro sobre texto vectorial no oculta nada).
**Consecuencias:** el PDF resultante no tiene texto seleccionable; la calidad depende del DPI elegido (por eso se ofrecen hasta 600 DPI y PNG sin pérdida).

## ADR-009 — Sesiones con avance guardado (Testar y Firmar)
**Decisión:** un motor común (`src/page-tool.js`) guarda cada sesión en `userData` de forma atómica y la autoguarda.
**Razón:** recuperar el trabajo tras un cierre accidental o un corte de luz.
**Consecuencias:** quedan páginas rasterizadas del documento original en `userData` hasta que la sesión se descarta (ver [07_SEGURIDAD.md](07_SEGURIDAD.md)).

## ADR-010 — Firmas cifradas con contraseña
**Decisión:** las firmas se guardan en una bóveda cifrada con AES-256-GCM, clave derivada con scrypt, y se eliminan tras 5 contraseñas erróneas en 10 minutos.
**Razón:** la firma es un dato sensible; debe protegerse aunque alguien acceda a la carpeta de datos.
**Consecuencias:** si se olvida la contraseña hay que empezar de nuevo; la bóveda se bloquea por inactividad.

## ADR-011 — Valores por defecto sin pérdida de calidad
**Decisión:** 300 DPI y calidad 100 % por defecto en todas las herramientas que los ofrecen, con perfiles homogéneos (72/150/200/300/400/600 DPI; 100/75/50/25 %).
**Razón:** el usuario no debe degradar sus archivos por no cambiar una opción.
**Consecuencias:** los archivos pesan más por defecto; la reducción de peso es una elección explícita (Comprimir).

## ADR-012 — Vista previa real con los mismos argumentos
**Decisión:** las vistas previas ejecutan el mismo proceso que el resultado final, mediante funciones constructoras de argumentos compartidas.
**Razón:** que lo que se ve sea lo que se obtiene (compresión incluida).
**Consecuencias:** hay un pequeño costo de procesamiento al ajustar opciones; las peticiones se serializan y se aplica una espera.

## ADR-013 — Rotar no recomprime
**Decisión:** el PDF se gira con `pdf-lib` (solo cambia `/Rotate`); el JPG, cambiando únicamente su orientación EXIF; el PNG, en píxeles (sin pérdida).
**Razón:** girar no debe tocar la calidad ni el contenido. La versión anterior rasterizaba el PDF a 200 DPI.
**Consecuencias:** `pdf-lib` es la primera dependencia de ejecución; los PDF protegidos deben desbloquearse antes; un visor que ignore EXIF mostraría el JPG sin girar.

## ADR-014 — Miniaturas generadas por el proceso principal
**Decisión:** las miniaturas de las listas de imágenes se generan con ImageMagick (PNG reducido en carpeta temporal, con caché por archivo y fecha).
**Razón:** abrir decenas de fotos grandes directamente en la interfaz sería lento y consumiría mucha memoria; además HEIC o TIFF no se muestran en el navegador.
**Consecuencias:** hay archivos temporales; las miniaturas se piden de una en una.

## ADR-015 — Quitar fondo solo por color
**Decisión:** Quitar fondo trabaja con colores de fondo (varios, con tolerancia) y un pincel de retoque; no usa IA.
**Razón:** mantener el producto ligero y sin dependencias; los fondos uniformes cubren la mayoría de los casos.
**Consecuencias:** no recorta siluetas sobre fondos complejos; el retoque a mano se aplica solo a la primera imagen de un lote.

## ADR-016 — Dos modos de ancho: Contenedor y Canvas
**Decisión:** un selector en la cabecera alterna entre un ancho cómodo de lectura y todo el ancho con 2.5 % de margen; se recuerda la elección.
**Razón:** quien necesita ver mejor los visores puede ampliar el espacio sin perder la lectura cómoda para el resto.
**Consecuencias:** los visores y la columna de vista previa deben escalar con el ancho disponible.

## ADR-017 — Flujo de Git
**Decisión:** commits directos a `main` y etiqueta por versión; rama solo para reestructuraciones grandes. Los archivos de contexto de trabajo no se suben.
**Razón:** historial simple y lineal para un proyecto mantenido por una persona.
**Consecuencias:** cada versión se etiqueta `vX.Y.Z`; el Release de GitHub es una decisión aparte.

## ADR-018 — Sin OCR por ahora
**Decisión:** no incluir OCR en la línea 1.x.
**Razón:** requeriría Tesseract como tercera dependencia, con su instalación y validación.
**Consecuencias:** se evalúa para una posible 2.0.0 si hay demanda.
