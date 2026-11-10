# 🧪 PLAN DE PRUEBAS

> [!NOTE]
> Define qué significa que algo **funciona**. Hoy el proyecto no tiene pruebas automáticas: este plan es la lista de comprobación manual que se recorre **antes de publicar cada versión**. Al terminar una tarea, recorrer al menos su apartado y el de regresión.

## ℹ️ Cómo usarlo

1. Preparar una carpeta de pruebas con: PDFs de 1, 3 y 10 páginas (uno con texto, uno escaneado, uno protegido), imágenes PNG, JPG (con y sin EXIF), WebP, HEIC y SVG, y una imagen vertical entre varias horizontales.
2. Probar siempre con una carpeta de salida nueva para detectar archivos a medias.
3. Marcar cada punto; lo que falle se registra en [10_MEMORIA.md](10_MEMORIA.md) y se corrige antes de publicar.

---

## 🚀 1. Arranque e instalación

- [ ] La pantalla de inicio detecta Ghostscript e ImageMagick instalados y permite entrar.
- [ ] Sin alguna de las dos: ofrece instalar; el instalador se abre con permisos de administrador.
- [ ] Tras instalar ambas, la validación las marca como instaladas (**regresión 1.7.3**).
- [ ] Si la validación falla tras instalar, aparece el aviso con el botón «Reiniciar aplicación», que reinicia y las detecta.
- [ ] «Continuar sin instalar» permite entrar sin las herramientas y las funciones afectadas avisan.
- [ ] La barra de estado de herramientas de la cabecera refleja el estado real.

## 🧱 2. Estructura general (todas las herramientas)

- [ ] Los pasos aparecen en orden: Archivos → Carpeta de salida → Configuración → Vista previa.
- [ ] Textos homogéneos: «Seleccionar PDF/PDFs/imagen/imágenes» y «Seleccionar carpeta».
- [ ] Seleccionar y arrastrar y soltar (varios archivos a la vez; desde el Explorador).
- [ ] El botón de acción se habilita solo con archivos y carpeta de salida válidos.
- [ ] Progreso real (archivo en curso y páginas) y botón **Cancelar** que detiene sin dejar archivos a medias.
- [ ] El resultado muestra éxito y errores por archivo, con «Abrir carpeta de salida».
- [ ] La configuración de cada herramienta se recuerda al volver a abrirla.
- [ ] Los atajos «Ir a … PDF/imagen» abren la herramienta homóloga de la otra categoría (Rotar, Marca texto, Marca imagen, Comprimir, PDF ↔ IMG, Testar).

## 💎 3. Resolución y calidad

- [ ] Todas las herramientas con DPI ofrecen 72, 150, 200, 300, 400 y 600, con 300 seleccionado en una instalación nueva.
- [ ] Todas las de calidad ofrecen 100, 75, 50 y 25 %, con 100 % seleccionado en una instalación nueva.
- [ ] Cada perfil muestra su explicación debajo.
- [ ] Una configuración guardada con valores antiguos (p. ej. 95 o 85) se ajusta al valor más cercano sin romper.
- [ ] PNG a 100 % no pierde calidad; JPG a 100 % usa la máxima calidad.

## 📄 4. Herramientas PDF

| Herramienta | Comprobar |
|---|---|
| **PDF → IMG** | PNG y JPG; DPI y fondo; un PDF de varias páginas genera una imagen por página |
| **Unir** | Orden exacto, reordenar con flechas y arrastre |
| **Separar** | Una página por archivo, bloques de N y rangos (`1-5, 8, 10-12`) |
| **Comprimir** | Los 6 perfiles; el resultado pesa menos y se abre; un PDF con imágenes de baja resolución no se amplía |
| **Foliar** | Vista previa fiel; prefijo, consecutivo y sello de recibido con fecha; fuente y peso |
| **Marca texto / imagen** | Vista previa fiel; mosaico, ángulo, opacidad, posición; navegar entre páginas |
| **Rotar** | Todas / pares / impares; el PDF conserva texto seleccionable y peso; vista previa coincide con el resultado |
| **Desbloquear** | Quita restricciones; abre con contraseña conocida |
| **Estándares** | Convierte a PDF/A, PDF/X, PDF/UA, PDF/E y el resultado abre |
| **Testar** | Dibujar, mover, redimensionar, deshacer, copiar a todas las páginas; **el texto bajo el cuadro no es recuperable**; color de cuadro (negro por defecto y botón «Negro (predeterminado)»); avance guardado y recuperación tras cerrar |
| **Flujo de firma** | Un solo PDF, uno por página, por rangos; nombres `pp-001`, `pp-003`… |
| **Firmar** | Dibujar y cargar PNG con transparencia; guardar con nombre; contraseña; 5 intentos fallidos eliminan las firmas; colocar, mover, redimensionar |

## 🖼️ 5. Herramientas de imagen

| Herramienta | Comprobar |
|---|---|
| **IMG → PDF** | Original (sin pérdida) y niveles; un PDF por imagen, uno solo o por rangos; miniaturas reordenables con flechas y arrastre |
| **Convertir** | Todos los formatos; calidad, modo sin pérdida, fondo de la transparencia, metadatos, tamaños de ICO; vista previa con peso antes/después |
| **Recortar** | 8 asas, dibujar, valores numéricos, proporciones y orientación; zoom; salida original o comprimida |
| **Redimensionar** | Píxeles, porcentaje, lado mayor; con y sin proporción; «no ampliar»; la miniatura muestra el tamaño final correcto |
| **Comprimir** | Los 4 niveles; PNG reduce colores según nivel; omite lo que no se puede reducir |
| **Quitar fondo** | Esquina automática; varios colores (gotero y selector HEX/RGB/HSL); «Desde los bordes» y «Todo el color»; tolerancia; suavizado; pincel restaurar y borrar con deshacer; el retoque solo afecta a la primera imagen |
| **Rotar** | PNG sin pérdida; JPG sin recomprimir (los datos de imagen no cambian; se ve girado en visor y navegador); la miniatura intercambia ancho y alto con 90° y 270° |
| **Testar / Marcas** | Igual que sus equivalentes de PDF |

## 🧩 6. Listas de imágenes en miniatura

- [ ] Aparecen miniatura, nombre, tamaño en píxeles y peso de cada imagen (también HEIC, TIFF y SVG).
- [ ] Una imagen vertical entre horizontales (o al revés) queda resaltada con su etiqueta.
- [ ] La × quita una imagen; con muchas imágenes la lista se desplaza.
- [ ] Con 30 imágenes grandes la ventana no se bloquea.
- [ ] En Redimensionar y Rotar, el tamaño final se actualiza al cambiar las opciones.

## 🔍 7. Vistas previas y zoom

- [ ] Las de salida (marcas, foliado, Convertir, Redimensionar, Comprimir, Rotar, Quitar fondo) se actualizan solas al cambiar opciones y muestran aviso mientras se genera.
- [ ] Mismo alto mínimo y máximo en marcas, Quitar fondo, Recortar, Testar y Firmar; títulos «Vista previa del resultado» y «Área de trabajo».
- [ ] Zoom `−` `+` `Restablecer` funciona en todas; el gotero y las asas siguen siendo exactos con zoom.
- [ ] Sin archivo, la vista previa lo indica (o usa una hoja de muestra donde corresponde).

## ↔️ 8. Ancho de la aplicación y responsive

- [ ] El selector Contenedor / Canvas cambia el ancho y se recuerda al reiniciar.
- [ ] Canvas deja un margen lateral de 2.5 % y los visores aprovechan el ancho.
- [ ] Probar en: **820 px** (mínimo), **1140 px**, **1440 px**, **1920 px** y Canvas en pantalla grande.
- [ ] Los grupos de opciones se reacomodan sin desbordarse; la columna de vista previa pasa debajo cuando falta espacio.

## 📦 9. Empaquetado

- [ ] `npm run build` termina sin errores.
- [ ] El instalador instala, abre y la aplicación funciona sin Node ni el repositorio (incluye `src/` y `pdf-lib`).
- [ ] Los instaladores de Ghostscript e ImageMagick incluidos se ejecutan desde la aplicación instalada.
- [ ] El icono aparece correcto en el menú Inicio, en Aplicaciones y en la barra de tareas.
- [ ] Desinstalar elimina la aplicación.

## 🔁 10. Regresión (corregido anteriormente)

- [ ] La validación de Ghostscript tras instalar ya no falla (ruta de Program Files).
- [ ] Rotar un PDF **no** rasteriza ni pierde texto.
- [ ] Las herramientas con zonas de imágenes soltando varios archivos a la vez cargan todos.

---

## 🚢 11. Lista de publicación

Se recorre **una vez por versión**, después de las pruebas anteriores y antes de anunciar la versión.

**Funcionalidad**
- [ ] Las tareas de la versión están completas y probadas.
- [ ] Los apartados 1 a 10 de este plan pasan (incluida la regresión).
- [ ] Estados de carga, vacío y error revisados en lo nuevo.

**Interfaz**
- [ ] Probada en 820 px, 1140 px, 1440 px, 1920 px y en modo Canvas.
- [ ] Teclado y foco visibles en los controles nuevos.

**Seguridad**
- [ ] Sin archivos privados ni de contexto del asistente en lo que se sube (`git diff --cached --name-only`).
- [ ] Entradas nuevas validadas en el proceso principal.
- [ ] Riesgos nuevos anotados en [07_SEGURIDAD](07_SEGURIDAD.md).

**Código**
- [ ] La sintaxis de todos los archivos pasa la revisión.
- [ ] `npm run build` termina sin errores.

**Entrega**
- [ ] Número de versión subido en `package.json`; README y `docs/` actualizados ([10_MEMORIA](10_MEMORIA.md) incluida).
- [ ] Commit directo a `main`, etiqueta `vX.Y.Z` creada y subida.
- [ ] Instalador generado e **instalado desde cero** en un equipo limpio, y probado.
- [ ] Notas de la versión escritas y Release publicado (decisión del autor).

---

## 🤖 Pruebas automáticas (futuro)

La lógica que no depende de Electron se puede probar con `node --test`:

- `src/background-removal.js` — construcción de argumentos, varios colores, trazos.
- `src/lossless-rotate.js` — orientación EXIF, JPG con y sin EXIF, comparación con ImageMagick.
- Conversiones de color de `core/color-picker.js` (HEX ↔ RGB ↔ HSL).
