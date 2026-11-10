<div align="center">

# 🗃️ ImgPDF Toolbox

**Convierte, organiza y protege tus PDFs e imágenes — todo en tu equipo, sin subir nada a internet.**

[![Versión](https://img.shields.io/github/v/tag/enfcarloseligio/ImgPDF-Toolbox?label=versi%C3%B3n&color=0A66C2)](https://github.com/enfcarloseligio/ImgPDF-Toolbox/tags)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-06B6D4)](LICENSE)
![Plataforma: Windows](https://img.shields.io/badge/plataforma-Windows-0F172A)
![Electron](https://img.shields.io/badge/Electron-33-475569)
![Privacidad](https://img.shields.io/badge/privacidad-100%25%20local-16A34A)
![Motores](https://img.shields.io/badge/motores-Ghostscript%20%2B%20ImageMagick-06B6D4)
![Documentación](https://img.shields.io/badge/documentaci%C3%B3n-en%20espa%C3%B1ol-F59E0B)

[✨ Características](#-características) · [🧰 Herramientas](#-herramientas) · [📸 Capturas](#-capturas) · [📥 Instalación](#-instalación) · [🔧 Desarrollo](#-desarrollo) · [🧭 Hoja de ruta](#-hoja-de-ruta) · [📚 Documentación](#-documentación)

![Pantalla de inicio de ImgPDF Toolbox](docs/img/inicio.png)

</div>

> [!IMPORTANT]
> 🔒 **Tus archivos nunca salen de tu computadora.** Suite de escritorio ligera y de código abierto para convertir, manipular y optimizar **PDFs e imágenes**. Todo el procesamiento ocurre en tu equipo con [Ghostscript](https://www.ghostscript.com) e [ImageMagick](https://imagemagick.org). Sin cuentas, sin servidores y sin telemetría.

## 🧠 Cómo funciona

```mermaid
flowchart LR
  A["📂 Tus archivos<br/>PDF e imágenes"] --> B["🗃️ ImgPDF Toolbox"]
  B --> C["📄 Ghostscript<br/>(PDF)"]
  B --> D["🖼️ ImageMagick<br/>(imágenes)"]
  C --> E["📁 Tu carpeta<br/>de salida"]
  D --> E
```

---

## ✨ Características

### 🧭 Flujo de trabajo

- 📊 **Progreso real:** cada operación muestra el archivo en curso y cuántas páginas lleva procesadas del total, con opción de cancelar.
- 🪜 **Flujo uniforme:** todas las herramientas siguen el mismo orden (archivos → carpeta de salida → configuración → vista previa) y una barra de acción siempre visible.
- 🖱️ **Arrastrar y soltar con posición:** suelta archivos donde quieras insertarlos en la lista; también puedes reordenarla con el asa o las flechas.
- 🧩 **Opciones que aprovechan el ancho:** los grupos de opciones se acomodan en la misma fila y se reacomodan al achicar la ventana.
- ↔️ **Contenedor o Canvas:** un selector en la cabecera alterna entre un ancho cómodo de lectura y todo el ancho de la ventana (con un pequeño margen lateral) para ver mejor los visores; se recuerda entre sesiones.
- 💾 **Configuración recordada** por herramienta y última carpeta de salida.

### 💎 Calidad y vistas previas

- 🎚️ **Calidad sin pérdida cuando la necesitas:** todas las herramientas con resolución ofrecen 72, 150, 200, 300, 400 y 600 DPI, y las de calidad 100, 75, 50 y 25 %, con 300 DPI y 100 % por defecto. IMG → PDF puede conservar los píxeles exactos de la imagen, PDF → IMG permite elegir la calidad del JPG y el recorte puede guardarse con la calidad original.
- 🔍 **Vista previa real** de marcas de agua y foliado: la página de tu archivo con la marca aplicada con el mismo proceso que el resultado final, con navegación entre páginas.
- 👁️ **Vista previa del resultado** también en Convertir, Redimensionar, Comprimir imágenes y Rotar: se aplica el mismo proceso a la primera imagen y se ve el formato, el tamaño y el peso antes y después.
- 🖼️ **Imágenes en miniatura:** las listas de imágenes muestran miniaturas con su tamaño y peso, y el tamaño final al redimensionar o rotar; si mezclas horizontales y verticales, las minoritarias se resaltan. Se reordenan con flechas o arrastrando.
- 🔄 **Rotar sin recomprimir:** el PDF conserva su contenido y el JPG sus datos intactos (cambia solo su orientación).

### 🛠️ Herramientas destacadas

- 🪄 **Quitar fondo avanzado:** varios colores de fondo (gotero o selector HEX, RGB y HSL), tolerancia y un pincel para restaurar o borrar a mano.
- ✂️ **Edición de imágenes:** convierte entre formatos, recorta con un editor visual y proporciones estándar, redimensiona y comprime.
- 🔁 **Flujo de firma en un paso:** convierte un PDF a imágenes y lo vuelve a armar en PDF —junto, por página o por rangos— con el formato y la resolución que elijas.
- ✍️ **Firmar con firmas protegidas:** dibuja o carga tu firma, guárdala cifrada con contraseña y colócala con un clic sobre el PDF, con visor y avance guardado.
- ⬛ **Testar con avance guardado:** oculta datos con cuadros (negro puro por defecto, con color a elegir) sobre un visor; el trabajo se guarda solo para retomarlo tras un cierre inesperado.
- 🔤 **Tipografías propias:** fuentes del sistema o del catálogo de Google Fonts para marcas de texto y folios.
- 🩺 **Dependencias asistidas:** detecta ImageMagick y Ghostscript, ofrece instalarlos y comprueba si hay versiones nuevas.

---

## 🧰 Herramientas

### 📄 Herramientas PDF

| Herramienta | Qué hace |
|---|---|
| 🖼️ **PDF → IMG** | Exporta cada página como PNG o JPG con resolución (DPI), calidad JPG y fondo configurables. |
| 🔗 **Unir PDFs** | Fusiona varios documentos en el orden exacto que definas. |
| ✂️ **Separar PDF** | Una página por archivo, bloques de N páginas o rangos personalizados (`1-5, 8, 10-12`). |
| 🗜️ **Comprimir** | Reduce el peso con seis perfiles de resolución (72, 150, 200, 300, 400 y 600 DPI: pantalla, digital, estándar, impresión, alta definición y máxima). Nunca amplía las imágenes. |
| 🔢 **Foliar** | Numeración de páginas, folios consecutivos o con prefijo, sellos de recibido con fecha; tipografía, peso y cursiva a elegir. |
| 💧 **Marca texto** | Marca de agua de texto: tipografía y peso, orientación, color, opacidad, mosaico y posición. |
| 🏷️ **Marca imagen** | Marca de agua con logo o firma: tamaño, opacidad, ángulo, mosaico y márgenes. |
| 🔄 **Rotar** | Gira todas las páginas, solo pares o solo impares, sin recomprimir: el PDF conserva su contenido y el JPG sus datos intactos (cambia solo su orientación). |
| 🔓 **Desbloquear** | Quita restricciones de propietario o abre PDFs con contraseña conocida. |
| ⬛ **Testar** | Oculta datos con cuadros sobre un visor de páginas (negro puro por defecto, con color a elegir y resoluciones de hasta 600 DPI), con deshacer, zoom y copia de un cuadro a todas las páginas. El avance se guarda solo y se puede retomar. Exporta cada página como imagen (PNG o JPG), suelta o dentro de un PDF, por lo que el contenido tapado no se puede recuperar. |
| 🔁 **Flujo de firma** | Convierte el PDF a imágenes (PNG o JPG, DPI y fondo a elegir) y lo vuelve a armar en PDF en un solo paso: un solo PDF, uno por página o uno por cada N páginas. Cada PDF lleva el número de su primera página (`pp-001`, `pp-003`…), de modo que una hoja fuera de orden se nota al instante. |
| ✍️ **Firmar** | Dibuja tu firma a mano (color y grosor) o carga un PNG con transparencia, guárdala con un nombre y colócala con un clic sobre las páginas: se mueve, se redimensiona manteniendo su proporción y se copia a todas las páginas. Las firmas se guardan cifradas con contraseña y solo se ven por su nombre hasta que las colocas; con 5 contraseñas erróneas en 10 minutos se eliminan. El avance del documento se guarda solo. Exporta como PDF o imágenes. |
| 📑 **Estándares** | Convierte a PDF/A-1b, 2b, 3b y 4, PDF/X-1a y X-3, PDF/UA-1 y PDF/E-1. |

### 🖼️ Herramientas de imágenes
| Herramienta | Qué hace |
|---|---|
| 📄 **IMG → PDF** | Convierte PNG y JPG a PDF. «Original» conserva los píxeles sin recomprimir; el resto aplica compresión proporcional. Un PDF por imagen, todas en un solo PDF o por rangos (un PDF cada N imágenes, nombrado con su primera imagen). |
| 🔀 **Convertir** | Cambia el formato entre PNG, JPG, WebP, AVIF, JPEG XL, TIFF, BMP, GIF e ICO (con tamaños de icono). Controla calidad, modo sin pérdida, fondo de la transparencia y metadatos. Lee además HEIC, SVG y otros. |
| 📐 **Recortar** | Editor visual: mueve y redimensiona el recuadro con 8 asas, dibuja uno nuevo o escribe X, Y, ancho y alto. Proporciones 1:1, 5:4, 4:3, 3:2 y 16:9 con su versión vertical (4:5, 3:4, 2:3, 9:16) y proporción personalizada. Guarda con la calidad original o comprimida. |
| 📏 **Redimensionar** | Por píxeles exactos, por porcentaje o limitando el lado mayor; manteniendo la proporción o libre (puede deformar), con opción de no ampliar. |
| 🗜️ **Comprimir** | Cuatro niveles de compresión (95, 75, 50 y 25), vista previa con peso antes y después, conversión opcional a WebP o JPG, límite de tamaño y limpieza de metadatos. Omite lo que no se puede reducir más. |
| 🪄 **Quitar fondo** | Vuelve transparente un fondo de color uniforme, desde los bordes o en toda la imagen. Admite varios colores de fondo (gotero o selector con HEX, RGB y HSL), tolerancia, vista previa en vivo con zoom y un pincel para restaurar o borrar a mano. Está pensado para fondos lisos; no recorta siluetas sobre fondos complejos. |
| 🔄 **Rotar** | Gira imágenes en lote sin recomprimir: el PNG se gira en píxeles y el JPG solo cambia su orientación, con vista previa. |
| ⬛ **Testar** | El mismo testado con cuadros negros, aplicado a una imagen; exporta como imagen o como PDF. |
| 💧 **Marca texto / Marca imagen** | Las mismas marcas de agua, aplicadas a imágenes. |

---

## 📸 Capturas

| PDF → Imágenes | Marca de agua de texto |
|---|---|
| ![PDF a imágenes](docs/img/pdf-a-imagenes.png) | ![Marca de agua de texto](docs/img/marca-de-agua.png) |

| Recortar imagen | Convertir imágenes |
|---|---|
| ![Recortar imagen](docs/img/recortar-imagen.jpg) | ![Convertir imágenes](docs/img/convertir-imagenes.png) |

---

## 📥 Instalación

> [!NOTE]
> **Requisitos:** Windows 10 u 11.

1. 📦 **Descarga** el instalador desde la sección [Releases](https://github.com/enfcarloseligio/ImgPDF-Toolbox/releases) y ejecútalo.
2. 🔎 **Primer arranque:** al abrir la aplicación se comprueba si **ImageMagick** y **Ghostscript** están instalados. Si falta alguno, la propia app te guía: abre el asistente de instalación (si el instalador viene incluido) o recurre a `winget`.
3. 🔁 **Si la validación sigue marcando error** aunque ya instalaste ambos programas, usa el botón **Reiniciar aplicación** que aparece en el panel (o ciérrala y ábrela de nuevo) para que detecte los cambios.

> [!TIP]
> Ghostscript no está en el repositorio de `winget`; si la instalación automática no es posible, descárgalo desde [su sitio oficial](https://www.ghostscript.com/releases/gsdnld.html).

---

## 🔧 Desarrollo

### 📋 Requisitos

- **[Node.js](https://nodejs.org/) 18 o superior** (se recomienda la versión LTS). Incluye `npm`.
- **[Git](https://git-scm.com/downloads)**.
- **[ImageMagick](https://imagemagick.org)** y **[Ghostscript](https://www.ghostscript.com)**. Si no los tienes, la aplicación lo detecta al arrancar y te guía para instalarlos.

Comprueba las versiones:

```powershell
node --version
```

```powershell
npm --version
```

```powershell
git --version
```

### 🚀 Primera vez en un equipo nuevo

> [!IMPORTANT]
> El proyecto Electron está en una carpeta **anidada**: el repositorio contiene una carpeta llamada igual (`ImgPDF-Toolbox/ImgPDF-Toolbox`). Los comandos de `npm` se ejecutan dentro de la segunda.

**Paso 1 — Clona el repositorio:**

```powershell
git clone https://github.com/enfcarloseligio/ImgPDF-Toolbox.git
```

**Paso 2 — Entra a la carpeta del repositorio:**

```powershell
cd ImgPDF-Toolbox
```

**Paso 3 — Entra a la carpeta del proyecto Electron:**

```powershell
cd ImgPDF-Toolbox
```

**Paso 4 — Instala las dependencias:**

```powershell
npm install
```

**Paso 5 — Inicia la aplicación:**

```powershell
npm start
```

Al abrirse, la aplicación comprueba si **ImageMagick** y **Ghostscript** están instalados y, si falta alguno, ofrece instalarlo.

### 🔁 Día a día

Desde la carpeta del proyecto Electron (`ImgPDF-Toolbox/ImgPDF-Toolbox`):

```powershell
git pull
```

```powershell
npm install
```

```powershell
npm start
```

> [!TIP]
> `npm install` solo hace falta si cambiaron las dependencias; es seguro ejecutarlo siempre.

### 📦 Generar el instalador de Windows

Desde la carpeta del proyecto Electron:

```powershell
npm run build
```

El instalador (`ImgPDF Toolbox Setup X.Y.Z.exe`) se crea en la carpeta `dist/`.

### 🧩 Instaladores incluidos (opcional)

Para que el instalador de la aplicación lleve consigo los de ImageMagick y Ghostscript, coloca los `.exe` en `ImgPDF-Toolbox/extraResources/` antes de compilar (la carpeta está excluida de Git por su tamaño). Los nombres deben coincidir con los definidos en `src/ipc-system.js`:

| Herramienta | Archivo esperado |
|---|---|
| ImageMagick | `ImageMagick-7.1.2-34-Q16-HDRI-x64-dll.exe` |
| Ghostscript | `gs10080w64.exe` |

---

## 📁 Estructura del proyecto

```
ImgPDF-Toolbox/
├── ImgPDF-Toolbox/            # Proyecto Electron
│   ├── main.js                # Arranque del proceso principal
│   ├── preload.js             # Puente seguro hacia el renderer (window.api)
│   ├── src/                   # Lógica del proceso principal
│   │   ├── process-runner.js  #   Ejecución y cancelación de Ghostscript / ImageMagick
│   │   ├── progress.js        #   Progreso real por página
│   │   ├── page-tool.js       #   Motor común de Testar y Firmar (sesiones, autoguardado, exportación)
│   │   ├── background-removal.js #   Argumentos de Quitar fondo (colores y retoque)
│   │   ├── lossless-rotate.js #   Giro de JPG sin recomprimir (orientación EXIF)
│   │   ├── font-resolver.js   #   Variante de una fuente según peso y cursiva (familia, peso, ancho)
│   │   └── ipc-*.js           #   Handlers por área (sistema, conversiones, PDF, anotaciones, imágenes, testado, firma, flujo, vista previa)
│   └── renderer/              # Interfaz (HTML, CSS y JS sin framework)
│       ├── core/              #   Estado, iconos, layout por pasos, lotes, miniaturas, vistas previas, zoom, selector de color, editor de recorte, visor de páginas, panel de firma, utilidades, vistas
│       ├── modules/           #   Una herramienta por archivo
│       ├── styles/            #   global.css, modules.css, views.css
│       └── assets/            #   Iconos SVG, tipografías e icono de la app
├── docs/                      # Documentación (00_LEEME … 09_MEMORIA) e imágenes del README
└── LICENSE
```

---

## 🧭 Hoja de ruta

| Versión | Tema | Estado |
|---|---|---|
| **1.8.0** | 🚀 Quitar fondo avanzado, miniaturas, vistas previas, Canvas, Rotar sin pérdida | ✅ Publicada |
| 1.8.1 | 🩹 Estabilización y pruebas reales | 🔜 |
| 1.9.0 | 📄 PDF esencial: organizar páginas, proteger con contraseña, escala de grises | 🔜 |
| 1.10.0 | 🔎 OCR: texto buscable con el Tesseract integrado en Ghostscript | 🔜 |
| 1.11.0 | 🎨 Ajustes de imagen: color, voltear, enfocar y reducir ruido | 🔜 |
| 1.12.0 | 🔒 Privacidad y metadatos | 🔜 |
| 1.13.0 | 📐 Maquetación de PDF: varias páginas por hoja, márgenes y tamaño de página | 🔜 |
| 1.14.0 | 🧩 Composición de imágenes: collage, mosaicos, GIF, marcos | 🔜 |
| 1.15.0 | 🧰 Extracción y utilidades | 🔜 |
| 2.0.0 | 🏁 Consolidación: seguridad, pruebas automáticas, accesibilidad y rendimiento | 🔜 |

El plan detallado, tarea por tarea, está en [`docs/08_TAREAS.md`](docs/08_TAREAS.md).

---

## 🔒 Privacidad

ImgPDF Toolbox no usa servidores propios, no recopila datos ni requiere cuenta. Las únicas conexiones de red son opcionales y puntuales: consultar la última versión publicada de ImageMagick y Ghostscript, y descargar una tipografía de Google Fonts cuando la eliges.

---

## 📜 Créditos y licencias

| Componente | Licencia y uso |
|---|---|
| 💻 **Código** | Licencia [MIT](LICENSE) |
| 📄 **[Ghostscript](https://www.ghostscript.com)** | © Artifex Software, licencia AGPL v3. La aplicación lo invoca como programa externo |
| 🖼️ **[ImageMagick](https://imagemagick.org)** | Licencia propia de ImageMagick, basada en Apache 2.0. La aplicación lo invoca como programa externo |
| 🔣 **Iconos de la interfaz** | Diseño propio, incluidos en `renderer/assets/svg/` |
| 🔤 **Tipografías** | Plus Jakarta Sans, Open Sans y Roboto, empaquetadas con la aplicación |

---

## 📚 Documentación

La documentación del proyecto está en la carpeta [`docs/`](docs/00_LEEME.md), en español y numerada en orden de lectura:

| | Documento | | Documento |
|---|---|---|---|
| 📘 | [Requisitos](docs/01_REQUISITOS.md) | 🔐 | [Seguridad](docs/06_SEGURIDAD.md) |
| 🏗️ | [Arquitectura](docs/02_ARQUITECTURA.md) | 🧪 | [Plan de pruebas](docs/07_PLAN_DE_PRUEBAS.md) |
| 🎨 | [Diseño](docs/03_DISEÑO.md) | 📋 | [Tareas](docs/08_TAREAS.md) |
| 📜 | [Reglas](docs/04_REGLAS.md) | 🧠 | [Memoria](docs/09_MEMORIA.md) |
| ⚖️ | [Decisiones](docs/05_DECISIONES.md) | 📚 | [Índice](docs/00_LEEME.md) |

---

## 👤 Autor

<div align="center">

**Juan Carlos De La Cruz Eligio** · [@enfcarloseligio](https://enfcarloseligio.com/)

*Hecho con cariño para que tus documentos se queden en tu equipo.* 🗃️

</div>
