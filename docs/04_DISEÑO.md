# DISEÑO — Sistema de diseño

> Cómo debe **verse y sentirse** la aplicación. La fuente original de la identidad es `identidad enfcarloseligio.md` (raíz del repositorio); los valores aplicados están en `renderer/styles/global.css` como variables CSS.

## Estilo

Moderno, sobrio y profesional. Fondos claros, mucho aire, tarjetas con bordes suaves y un único color de acción. Nada de emojis en la interfaz: los iconos son SVG propios.

## Colores

| Uso | Variable | Valor |
|---|---|---|
| Azul profundo (títulos, identidad) | `--deep` | `#0F172A` |
| Primario (acción principal, enlaces) | `--primary` | `#0A66C2` |
| Primario oscuro / más oscuro | `--primary-dark` / `--primary-darker` | `#084C94` / `#063A73` |
| Primario suave (hover, selección) | `--primary-soft` | `#E6F0FA` |
| Acento (datos, destacados) | `--accent` | `#06B6D4` |
| Acento oscuro / profundo | `--accent-dark` / `--accent-deeper` | `#0891B2` / `#0E7490` |
| Texto | `--text` | `#475569` |
| Texto secundario | `--text-muted` | `#64748B` |
| Fondo | `--bg` | `#F8FAFC` |
| Superficie (tarjetas) | `--surface` | `#FFFFFF` |
| Borde | `--border` | `#E2E8F0` |
| Deshabilitado | `--disabled` | `#A5B4C3` |
| Éxito | `--success` | `#16A34A` |
| Advertencia | `--warning` | `#F59E0B` |
| Error | `--error` | `#DC2626` |
| Información | `--info-text` | `#1E40AF` |

Reglas:
- `--text-muted` para texto secundario; `--disabled` **solo** para estados deshabilitados.
- Los colores de estado (éxito, advertencia, error, información) tienen su fondo y borde suaves (`--*-bg`, `--*-border`).

## Tipografía

| Rol | Fuente | Variable |
|---|---|---|
| Títulos principales | Plus Jakarta Sans (800–900) | `--font-display` |
| Encabezados y subtítulos | Open Sans (500–700) | `--font-heading` |
| Texto y notas | Roboto (300–500) | `--font-body` |
| Código y valores técnicos | Roboto Mono / Consolas | `--font-mono` |

Los tamaños son fluidos (`--text-h1` a `--text-xs`, con `clamp`) y se adaptan a escritorio, tableta y móvil.

## Botones

| Tipo | Uso | Clase |
|---|---|---|
| Primario | Acción principal de la pantalla (una por vista) | `.btn-primary` |
| Secundario | Acciones alternativas (borde azul, fondo transparente) | `.btn-secondary` |
| Acento | Datos y destacados (cian) | `.btn-accent` |
| Ghost | Navegación y acciones discretas | `.btn-ghost` |
| Peligro | Cancelar o descartar | `.btn-danger` |
| Interruptor | Opciones de barra de herramientas | `.btn-toggle` |
| Opción | Selección entre alternativas | `.opt-btn` |

Cada botón define los estados **normal, hover, active y deshabilitado** según la identidad (colores en `identidad enfcarloseligio.md`).

## Tarjetas y estructura de herramienta

Cada herramienta es una lista de **pasos numerados** en tarjetas con radio de 10 px (`--radius`):

1. **Archivos**
2. **Carpeta de salida**
3. **Configuración** (los grupos de opciones se acomodan en filas y se reacomodan al achicar)
4. **Vista previa** (junto a la configuración en pantallas anchas)

Después, el resultado y la **barra de acción fija** al pie (botón primario + progreso).

## Vistas previas y áreas de trabajo

Se distinguen dos tipos, con la misma apariencia base:

| Tipo | Qué es | Título del paso | Ejemplos |
|---|---|---|---|
| **De salida** | Muestra cómo quedará el resultado | «Vista previa del resultado» | Marca texto, Marca imagen, Foliar, Convertir, Redimensionar, Comprimir imágenes, Rotar, Quitar fondo |
| **De trabajo** | Se edita directamente sobre ella | «Área de trabajo» | Testar, Firmar, Recortar |

Valores comunes (variables en `global.css`):
- Alto mínimo `--stage-min` (320 px) y máximo de imagen `--stage-max` (70 vh).
- Fondo de cuadros para ver transparencias, borde y radio como las tarjetas.
- Columna de vista previa del 42 % del ancho (mínimo 340 px) cuando hay espacio.
- **Zoom** con `−`, porcentaje, `+` y `Restablecer`; navegación de páginas en documentos.
- Pie con descripción de lo que se muestra (formato, tamaño, peso).

## Iconos

- SVG propios en `renderer/assets/svg/`, cuadrícula de 24 px, **trazo** (no relleno), `currentColor`.
- Grosor de trazo **2.2**, definido una sola vez en `.ic` (CSS).
- Uso: `icon(nombre, tamaño)` o `iconLabel(nombre, texto)`; en HTML estático, `<span data-icon="nombre" data-size="N">`.
- Un icono nuevo se añade a `ICON_LIST`. Guía de reemplazo en `ICONOS.txt`.

## Ancho de la aplicación

Selector en la cabecera:
- **Contenedor** (por defecto): ancho máximo cómodo de lectura (1140 px; 1280 px desde 1500 px de ventana).
- **Canvas**: todo el ancho con un margen lateral de 2.5 % (`--canvas-margin`).

## Resolución y calidad estándar

Todas las herramientas que las ofrecen usan los mismos perfiles, con nombre, icono y una línea explicativa debajo:

- **Resolución:** Pantalla 72 · Digital 150 · Estándar 200 · Impresión 300 (por defecto) · Alta definición 400 · Máxima 600 DPI.
- **Calidad:** Máxima 100 % (por defecto) · Alta 75 % · Media 50 % · Baja 25 %.

## Requisitos de experiencia

- **Responsive:** funciona desde la ventana mínima (820 × 620) hasta pantallas grandes y modo Canvas.
- **Estados de carga:** vistas previas con aviso «Actualizando…»; operaciones con progreso real.
- **Estados vacíos:** cada zona de archivos y visor explica qué hacer («Selecciona una imagen para ver el resultado»).
- **Estados de error:** mensajes claros, en español, sin jerga; indican qué hacer.
- **Cancelación:** toda operación larga se puede cancelar.
- **Teclado y foco:** controles alcanzables con teclado y anillo de foco visible (`--focus-ring`).
- **Arrastrar y soltar:** nunca detener la propagación de `dragenter` / `dragover` (rompe la carga de varios archivos).

## Tono y textos

- Español profesional, claro y breve; tuteo cercano.
- Botones y zonas homogéneos: «Seleccionar PDF / PDFs / imagen / imágenes» y «Seleccionar carpeta».
- Los títulos de resultado no empiezan con ✓, ✗ ni ⚠: el cuadro añade su propio icono.
- Las sugerencias explican el efecto de la opción («Mínimo peso. Ideal para correo»).
