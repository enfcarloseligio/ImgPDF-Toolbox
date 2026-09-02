const workspace = document.getElementById('workspace');

document.getElementById('btn-unir').addEventListener('click', async () => {
  const files = await window.api.selectFiles([
    { name: 'Documentos PDF', extensions: ['pdf'] }
  ]);

  if (files.length > 0) {
    workspace.innerHTML = `
      <div style="width: 100%;">
        <h3 style="margin-bottom: 0.75rem;">Archivos seleccionados (${files.length}):</h3>
        <ul style="list-style: none; padding: 0;">
          ${files.map(f => `<li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem;">📄 ${f}</li>`).join('')}
        </ul>
      </div>
    `;
  }
});