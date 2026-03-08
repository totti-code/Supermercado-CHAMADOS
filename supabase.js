(function initSupabase() {
  if (!window.APP_CONFIG?.supabaseUrl || !window.APP_CONFIG?.supabaseAnonKey || window.APP_CONFIG.supabaseUrl.includes('COLE_AQUI')) {
    alert('Configure o arquivo config.js com URL e ANON KEY do Supabase.');
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
