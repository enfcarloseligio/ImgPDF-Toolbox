// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     scripts/after-pack.js
// Descripción: Hook de electron-builder que se ejecuta tras empaquetar la aplicación en
//              Windows. Graba en el .exe el icono propio y los metadatos del producto
//              (nombre, descripción, autor, versión) para que el menú Inicio, los accesos
//              directos, la barra de tareas y «Aplicaciones» muestren la identidad de la
//              app en lugar de la de Electron. Usa rcedit, que no necesita enlaces simbólicos
//              (a diferencia de la edición integrada de electron-builder, desactivada).
// ═════════════════════════════════════════════════════════════════════════════

const path = require('path');

// ── Hook principal ───────────────────────────────────────────────────────────

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  // rcedit es un módulo ESM: se carga con import() dinámico desde este script CommonJS
  const rceditModule = await import('rcedit');
  const rcedit = rceditModule.rcedit || rceditModule.default;

  const { appInfo, projectDir } = context.packager;
  const exePath  = path.join(context.appOutDir, `${appInfo.productFilename}.exe`);
  const iconPath = path.join(projectDir, 'renderer', 'assets', 'icon.ico');
  const author   = appInfo.companyName || 'enfcarloseligio';

  await rcedit(exePath, {
    icon: iconPath,
    'file-version': appInfo.version,
    'product-version': appInfo.version,
    'version-string': {
      ProductName: appInfo.productName,
      FileDescription: appInfo.productName,
      CompanyName: author,
      LegalCopyright: `© 2026 ${author}`,
      OriginalFilename: `${appInfo.productFilename}.exe`,
      InternalName: appInfo.productFilename,
    },
  });
};
