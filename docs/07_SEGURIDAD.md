# SEGURIDAD — Requisitos y estado de seguridad

> La seguridad se define desde el inicio, no minutos antes de publicar. Este documento recoge lo que la aplicación **ya hace**, los **riesgos conocidos** y lo que se debe respetar en todo cambio. Para reportar un problema de seguridad, ver el final.

## Principio

Todo el procesamiento ocurre **en el equipo del usuario**. La aplicación no usa servidores propios, no recopila datos, no tiene cuentas ni telemetría.

## Modelo de amenazas

| Activo | Amenaza principal |
|---|---|
| Documentos e imágenes del usuario | Fuga fuera del equipo; restos en carpetas temporales |
| Firmas | Robo de la carpeta de datos |
| Contenido tapado con Testar | Recuperación del contenido bajo los cuadros |
| El propio equipo | Ejecución de comandos mediante nombres de archivo manipulados; carga de contenido remoto |

## Controles actuales

### Aislamiento del renderer
- `contextIsolation: true` y `nodeIntegration: false`.
- El renderer solo accede al sistema mediante `window.api` (preload), una función por canal IPC.

### Datos y privacidad
- **Sin telemetría ni cuentas.** Las únicas conexiones de red son opcionales y puntuales: consulta de versiones de ImageMagick y Ghostscript (API de GitHub) y descarga de una tipografía de Google Fonts elegida por el usuario.
- **Testar** rasteriza las páginas y funde los cuadros con los píxeles: el contenido tapado **no se puede recuperar** del archivo exportado.
- **Imágenes:** Testar descarta los metadatos (EXIF, GPS) del resultado.
- **Rotar** no altera el contenido, solo la rotación o la orientación.

### Firmas
- Bóveda cifrada con **AES-256-GCM**; la clave se deriva de la contraseña con **scrypt** y solo vive en memoria mientras la bóveda está desbloqueada.
- Contraseña mínima de 8 caracteres.
- **5 contraseñas erróneas en 10 minutos eliminan todas las firmas.**
- Bloqueo por inactividad y bloqueo manual; las miniaturas de firmas no se muestran hasta colocarlas.

### Procesamiento de archivos
- ImageMagick se invoca con **listas de argumentos** en las herramientas de imagen (sin shell).
- Las rutas de salida son únicas (`getUniqueFilePath`): no se sobrescriben archivos existentes.
- Una exportación interrumpida o cancelada no deja archivos a medias.

## Riesgos conocidos (pendientes)

| # | Riesgo | Mitigación prevista |
|---|---|---|
| 1 | **Comandos con cadenas de shell:** parte del código antiguo (`ipc-annotations`, `ipc-conversions`, `ipc-flow`, `ipc-pdf-ops`, `ipc-system`) arma comandos interpolando rutas dentro de comillas. Un nombre de archivo con caracteres especiales podría alterar el comando. | Migrar a `runSpawn` con listas de argumentos. Todo código nuevo debe usarlas. |
| 2 | **`open-url`** abre cualquier dirección que reciba del renderer. | Restringir a una lista de dominios permitidos y a `https`. |
| 3 | **Sin política de contenido (CSP)** en `index.html`. | Añadir una CSP estricta (`default-src 'self'`, solo `file:` y los orígenes necesarios). |
| 4 | **`sandbox` del renderer** no está activado. | Evaluar activarlo y revisar el preload. |
| 5 | **`store-get` / `store-set`** aceptan claves arbitrarias. | Limitar a claves conocidas o a un prefijo. |
| 6 | **Sesiones de Testar y Firmar** guardan en `userData` las páginas **originales** rasterizadas (sin tapar) hasta que se descartan. | Mantener activa por defecto la opción «Eliminar el avance guardado después de exportar»; considerar una limpieza por antigüedad y avisarlo al usuario. |
| 7 | **Archivos temporales** (vistas previas, miniaturas, páginas base) con contenido de los documentos quedan en la carpeta temporal. | Limpieza al cerrar la aplicación y por antigüedad. |
| 8 | **Instalador sin firma digital:** Windows muestra un aviso de SmartScreen. | Firmar el instalador con un certificado de firma de código. |
| 9 | **Instaladores de Ghostscript e ImageMagick incluidos** se ejecutan con permisos de administrador. | Verificar su huella (hash) antes de ejecutarlos y documentar su origen y versión. |

## Requisitos para todo cambio

- **Entradas:** validar en el proceso principal todo dato del renderer (rutas existentes, números en rango, colores `#rrggbb`, listas con límite de tamaño). Ejemplos: `cleanColors`, `cleanStrokes`, `cleanRect`.
- **Procesos:** argumentos en lista; nunca concatenar texto del usuario en una cadena de shell.
- **Archivos de entrada:** tratarlos como no confiables (pueden estar corruptos o ser maliciosos); capturar errores y no bloquear la aplicación.
- **Secretos:** no guardar contraseñas ni claves en disco en claro; no escribirlas en registros ni mensajes.
- **Red:** cualquier conexión nueva se documenta aquí y en el README, y es opcional.
- **Rutas:** no escribir fuera de la carpeta de salida elegida, `userData` o la carpeta temporal.
- **Dependencias:** mantenerlas al mínimo; revisar la licencia y las vulnerabilidades conocidas antes de añadir una (`npm audit`).

## Carga de archivos

Al abrir un archivo se valida:
- **Tipo:** por extensión permitida (`FILE_KINDS`) y, en las herramientas de imagen, porque ImageMagick pueda leerlo.
- **Tamaño:** sin límite fijo; las operaciones largas son cancelables y las miniaturas y vistas previas se reducen.
- **Nombre:** los nombres de salida se derivan del archivo de origen con sufijo; se evita colisión con archivos existentes.

## Informar de un problema

Abre un *issue* privado o escribe al autor (**@enfcarloseligio**, https://enfcarloseligio.com/). No publiques detalles de una vulnerabilidad antes de que esté corregida.
