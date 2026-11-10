// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/redact.js
// Descripción: Módulo «Testar»: oculta datos de un PDF o de una imagen dibujando cuadros
//              negros sobre un visor. El avance se guarda solo en disco para retomarlo tras
//              un cierre accidental o un corte de luz. Al exportar, cada página se convierte
//              en imagen (PNG o JPG), suelta o dentro de un PDF, de modo que el contenido
//              bajo los cuadros se elimina de verdad y no puede recuperarse. La mecánica del
//              visor, el autoguardado y la exportación viven en core/page-tool.js.
// ═════════════════════════════════════════════════════════════════════════════

async function renderRedact(ctx = {}) {
  return renderPageTool(ctx, {
    // ── Identidad ──────────────────────────────────────────────────────────────
    id: 'redact', api: 'redact', progress: 'redact',
    title: 'Testar', titleIcon: 'redact', previewTitle: 'Testado',

    // ── Textos ─────────────────────────────────────────────────────────────────
    description: isPdf => `Oculta datos sensibles dibujando cuadros negros sobre ${isPdf ? 'las páginas del PDF' : 'la imagen'}. Tu avance se guarda solo: si se cierra la aplicación o se va la luz, puedes retomarlo.`,
    itemNoun: 'cuadro(s)',
    runLabel: 'Exportar testado', doneTitle: 'Archivo testado',
    pdfHint: 'Cada página se guarda como imagen dentro de un PDF: bajo los cuadros no queda texto ni imagen que recuperar.',
    infoIdle: 'Abre un archivo y arrastra sobre la página para dibujar un cuadro.',
    removeLabel: 'Quitar cuadro', removeTitle: 'Quita el cuadro seleccionado',

    // ── Editor: cuadros negros que se dibujan arrastrando ──────────────────────
    editorMode: 'box', editorEmptyText: 'Selecciona un archivo para empezar a testar',

    // ── Atajo al Testar del otro tipo de archivo ───────────────────────────────
    // Lleva el archivo recién exportado si es del tipo que abre el destino (p. ej. el PDF
    // testado, para revisarlo o testarlo más); si no, abre el módulo vacío.
    shortcut: isPdf => ({
      label: isPdf ? 'Ir a Testar imagen' : 'Ir a Testar PDF',
      go: outputs => {
        const target = isPdf ? 'imageAny' : 'pdf';
        const files = outputs.filter(f => FILE_KINDS[target].extensions.includes(f.split('.').pop().toLowerCase()));
        goToModule(isPdf ? 'image-tools' : 'pdf-tools', 'redact', { files });
      },
    }),
  });
}
