# 📘 REQUISITOS — Documento de requisitos del producto (PRD)

> [!NOTE]
> Define **qué** construimos y **por qué**. El **cómo** está en [02_ARQUITECTURA.md](02_ARQUITECTURA.md).

## 🧭 Producto

**ImgPDF Toolbox** — aplicación de escritorio para Windows que reúne en un solo lugar las tareas más comunes con **PDFs e imágenes**: convertir, unir, separar, comprimir, rotar, marcar, foliar, testar, firmar y más. Todo se procesa **en el equipo del usuario** con [Ghostscript](https://www.ghostscript.com) e [ImageMagick](https://imagemagick.org).

- **Versión actual:** 1.8.0
- **Autor:** Juan Carlos De La Cruz Eligio (@enfcarloseligio)
- **Licencia:** MIT

## 😣 Problema

Quien trabaja con documentos necesita, a diario, tareas pequeñas pero frecuentes: reducir el peso de un PDF, convertir páginas a imagen, ocultar datos sensibles, estampar un folio, firmar, redimensionar fotos. Las opciones habituales tienen inconvenientes:

- Los sitios web **suben los archivos a servidores ajenos**, algo inaceptable con documentos oficiales, médicos o con datos personales.
- Las suites comerciales son **pesadas, de pago y complejas** para tareas simples.
- Las herramientas de línea de comandos son potentes pero **inaccesibles** para la mayoría.

## 👥 Usuarios objetivo

| Perfil | Necesidad principal |
|---|---|
| Personal administrativo y de oficina | Unir, separar, foliar, firmar y testar documentos con rapidez y sin enviarlos a internet |
| Profesionales de la salud, legal y educación | Ocultar datos personales (testado), proteger la privacidad y comprimir expedientes |
| Diseñadores, analistas y creadores de contenido | Convertir, redimensionar, comprimir y limpiar imágenes por lote |
| Cualquier persona con archivos sensibles | Una herramienta que **nunca saque sus archivos del equipo** |

## 🎯 Objetivo

Ofrecer una caja de herramientas **ligera, privada, uniforme y fácil de usar**, en español, donde cada tarea siga el mismo flujo (archivos → carpeta de salida → configuración → vista previa) y muestre progreso real.

## 🧰 Funciones principales (estado actual)

### 📄 Herramientas PDF
PDF → IMG · Unir · Separar · Comprimir · Foliar · Marca texto · Marca imagen · Rotar · Desbloquear · Estándares (PDF/A, PDF/X, PDF/UA, PDF/E) · Testar · Flujo de firma · Firmar

### 🖼️ Herramientas de imagen
IMG → PDF · Convertir · Recortar · Redimensionar · Comprimir · Quitar fondo (varios colores y pincel de retoque) · Rotar · Testar · Marca texto · Marca imagen

### ⚙️ Transversales
- Progreso real con cancelación en todas las operaciones.
- Vista previa real del resultado donde aplica, con zoom.
- Listas de imágenes en miniaturas con tamaño, peso y tamaño final.
- Resolución (72–600 DPI, 300 por defecto) y calidad (100/75/50/25 %, 100 por defecto) unificadas.
- Modo de ancho **Contenedor** o **Canvas**.
- Detección e instalación asistida de Ghostscript e ImageMagick.
- Avance guardado en Testar y Firmar; firmas protegidas con contraseña.
- Configuración recordada por herramienta.

## 🧱 Principios de producto

1. **Privacidad primero:** ningún archivo sale del equipo. Sin cuentas, sin telemetría.
2. **Calidad sin sorpresas:** los valores por defecto no degradan los archivos (300 DPI, 100 %). Si una operación no necesita recomprimir, no recomprime (p. ej. Rotar).
3. **Uniformidad:** misma estructura, mismos textos, mismos controles en todas las herramientas.
4. **Transparencia:** el usuario ve lo que va a obtener (vista previa real) y lo que ocurre (progreso real).
5. **Español claro:** interfaz, mensajes y documentación en español profesional.
6. **Solo Ghostscript e ImageMagick:** toda función nueva se construye con estos dos motores, sin dependencias adicionales (ver [05_DECISIONES](05_DECISIONES.md) ADR-019).

## 🚫 Fuera de alcance

- Edición del contenido de un PDF (cambiar texto existente, maquetar).
- Versiones para macOS o Linux (el producto es Windows-first).
- Sincronización en la nube, cuentas de usuario o colaboración.
- Segmentación de imágenes con IA (Quitar fondo solo trabaja con colores).
- Aplicación móvil.

## 🗺️ Hoja de ruta

Resumida aquí y detallada en [08_TAREAS](08_TAREAS.md).

| Versión | Tema | Estado |
|---|---|---|
| 1.8.0 | 🚀 Quitar fondo avanzado, miniaturas, vistas previas, Canvas | ✅ Publicada |
| 1.8.1 | 🩹 Estabilización y pruebas reales | 🔜 |
| 1.9.0 | 📄 PDF esencial: organizar páginas, proteger, escala de grises | 🔜 |
| 1.10.0 | 🔎 OCR: texto buscable con el Tesseract integrado en Ghostscript | 🔜 |
| 1.11.0 | 🎨 Ajustes de imagen: color, voltear, enfocar y reducir ruido | 🔜 |
| 1.12.0 | 🔒 Privacidad y metadatos | 🔜 |
| 1.13.0 | 📐 Maquetación de PDF: varias páginas por hoja, márgenes y tamaño de página | 🔜 |
| 1.14.0 | 🧩 Composición de imágenes: collage, mosaicos, GIF, marcos | 🔜 |
| 1.15.0 | 🧰 Extracción y utilidades | 🔜 |
| 2.0.0 | 🏁 Consolidación: seguridad, pruebas automáticas, accesibilidad y rendimiento | 🔜 |

## 🏆 Criterios de éxito

Una persona sin conocimientos técnicos debe poder, sin ayuda:

1. Instalar la aplicación y que detecte (o instale) Ghostscript e ImageMagick.
2. Elegir un archivo, una carpeta de salida y una opción, y obtener el resultado esperado.
3. Ver una vista previa fiel antes de procesar, donde aplique.
4. Cancelar una operación en curso sin dejar archivos a medias.
5. Reanudar un testado o una firma tras un cierre inesperado.
6. Confiar en que ningún archivo salió de su equipo.

## 📊 Métricas de calidad

- Cero pérdida de calidad innecesaria en las operaciones que no lo requieren.
- Cada herramienta nueva sigue la estructura de pasos y reutiliza los componentes comunes.
- Las pruebas manuales de [07_PLAN_DE_PRUEBAS.md](07_PLAN_DE_PRUEBAS.md) pasan antes de publicar cada versión.
