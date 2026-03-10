(function initSupabase() {
  function showConfigModal(message) {
    const dialog = document.getElementById('custom-dialog');
    const title = document.getElementById('custom-dialog-title');
    const text = document.getElementById('custom-dialog-message');
    const fields = document.getElementById('custom-dialog-fields');
    const cancel = document.getElementById('custom-dialog-cancel');
    const confirm = document.getElementById('custom-dialog-confirm');

    if (!dialog || !title || !text || !fields || !cancel || !confirm) return;

    title.textContent = 'Configuracao necessaria';
    text.textContent = message;
    text.classList.remove('hidden');
    fields.innerHTML = '';
    cancel.classList.add('hidden');
    confirm.textContent = 'Fechar';
    confirm.className = 'btn btn-primary';

    if (!dialog.open) {
      dialog.showModal();
    }
  }

  if (!window.APP_CONFIG?.supabaseUrl || !window.APP_CONFIG?.supabaseAnonKey || window.APP_CONFIG.supabaseUrl.includes('COLE_AQUI')) {
    showConfigModal('Configure o arquivo config.js com URL e ANON KEY do Supabase.');
    return;
  }

  window.sb = window.supabase.createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();
