const state = {
  session: null,
  profile: null,
  currentView: 'dashboard',
  menu: [],
  lookups: {
    stores: [],
    checkouts: [],
    types: [],
    users: []
  },
  allTickets: [],
  tickets: [],
  charts: {},
  isSigningOut: false,
  adminUi: {
    tickets: {
      tab: 'active',
      filters: {
        store: '',
        checkout: '',
        type: '',
        status: '',
        priority: ''
      }
    },
    stores: { search: '', status: '', sort: 'name_asc', editingId: null },
    types: { search: '', status: '', sort: 'name_asc', editingId: null }
  }
};

const MENU_ADMIN = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'tickets', label: 'Chamados' },
  { id: 'stores', label: 'Lojas' },
  { id: 'checkouts', label: 'Equipamentos/Setor' },
  { id: 'types', label: 'Tipos de chamado' },
  { id: 'users', label: 'Usuários' },
  { id: 'reports', label: 'Relatórios' },
  { id: 'settings', label: 'Configurações' }
];

const MENU_FUNC = [
  { id: 'dashboard', label: 'Meu painel' },
  { id: 'tickets', label: 'Meus chamados' },
  { id: 'settings', label: 'Configurações' }
];

const el = {
  authView: document.getElementById('auth-view'),
  appView: document.getElementById('app-view'),
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  userInfo: document.getElementById('user-info'),
  viewTitle: document.getElementById('view-title'),
  menuNav: document.getElementById('menu-nav'),
  content: document.getElementById('content'),
  btnLogout: document.getElementById('btn-logout'),
  btnOpenTicket: document.getElementById('btn-open-ticket'),
  ticketModal: document.getElementById('ticket-modal'),
  detailsModal: document.getElementById('details-modal'),
  detailsContent: document.getElementById('details-content'),
  ticketForm: document.getElementById('ticket-form'),
  globalSearch: document.getElementById('global-search'),
  btnAdminQuick: document.getElementById('btn-admin-quick'),
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  btnNavToggle: document.getElementById('btn-nav-toggle'),
  btnNavClose: document.getElementById('btn-nav-close'),
  navOverlay: document.getElementById('nav-overlay')
};

function showAuthScreen() {
  document.body.classList.remove('nav-open', 'nav-desktop');
  state.isSigningOut = false;
  state.currentView = 'dashboard';
  state.menu = [];
  state.allTickets = [];
  state.tickets = [];
  if (el.btnLogout) {
    el.btnLogout.disabled = false;
  }
  el.appView.classList.add('hidden');
  el.authView.classList.remove('hidden');
  el.loginForm.classList.remove('hidden');
  el.registerForm.classList.add('hidden');
}

function showAppScreen() {
  syncMenuState();
  state.isSigningOut = false;
  if (el.btnLogout) {
    el.btnLogout.disabled = false;
  }
  el.authView.classList.add('hidden');
  el.appView.classList.remove('hidden');
}

function clearClientSessionState() {
  state.session = null;
  state.profile = null;
  state.currentView = 'dashboard';
  state.menu = [];
  state.allTickets = [];
  state.tickets = [];
  state.adminUi.tickets.filters = {
    store: '',
    checkout: '',
    type: '',
    status: '',
    priority: ''
  };
  state.adminUi.tickets.tab = 'active';

  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch (error) {
    console.warn('Nao foi possivel limpar o storage local.', error);
  }
}

async function performLogout() {
  if (state.isSigningOut) return;
  state.isSigningOut = true;

  if (el.btnLogout) {
    el.btnLogout.disabled = true;
  }

  setNavOpen(false);

  try {
    if (window.sb?.auth) {
      const { error } = await sb.auth.signOut({ scope: 'local' });
      if (error) {
        console.error(error);
      }
    }
  } finally {
    state.isSigningOut = false;
    clearClientSessionState();
    showAuthScreen();
    window.location.href = 'login.html';
  }
}

function initLogoutButton() {
  if (!el.btnLogout) return;
  el.btnLogout.type = 'button';
  el.btnLogout.style.pointerEvents = 'auto';
  el.btnLogout.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await performLogout();
  });
}

function showToast(msg, type = 'ok') {
  const container = document.getElementById('toast-container');
  const node = document.createElement('div');
  node.className = `toast ${type === 'error' ? 'error' : ''}`;
  node.textContent = msg;
  container.appendChild(node);
  setTimeout(() => node.remove(), 3500);
}

function fmtDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function badgeStatus(s) {
  const map = {
    aberto: 'Aberto',
    em_andamento: 'Em andamento',
    aguardando_retorno: 'Aguardando retorno',
    resolvido: 'Resolvido',
    fechado: 'Fechado',
    cancelado: 'Cancelado'
  };
  return `<span class="badge b-status-${s}">${map[s] || s}</span>`;
}

function badgePriority(p) {
  const map = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
  return `<span class="badge b-prioridade-${p}">${map[p] || p}</span>`;
}

function badgeActive(active) {
  return `<span class="badge ${active ? 'b-ativo' : 'b-inativo'}">${active ? 'Ativo' : 'Inativo'}</span>`;
}

function isCompletedStatus(status) {
  return ['resolvido', 'fechado', 'cancelado'].includes(status);
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function compareNameAsc(a, b) {
  return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
}

function sortRows(rows, sortMode) {
  const sorted = [...rows];
  if (sortMode === 'name_desc') return sorted.sort((a, b) => compareNameAsc(b, a));
  if (sortMode === 'recent') return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (sortMode === 'oldest') return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return sorted.sort(compareNameAsc);
}

function filterAdminRows(rows, ui) {
  let filtered = [...rows];
  const search = normalizeText(ui.search);
  if (search) filtered = filtered.filter(r => normalizeText(r.nome).includes(search));
  if (ui.status === 'ativo') filtered = filtered.filter(r => r.ativo);
  if (ui.status === 'inativo') filtered = filtered.filter(r => !r.ativo);
  return sortRows(filtered, ui.sort);
}

function checkoutKey(nome, setor) {
  return `${normalizeText(nome)}|${normalizeText(setor)}`;
}

function getCheckoutTemplates() {
  const grouped = new Map();
  state.lookups.checkouts.forEach(row => {
    const key = checkoutKey(row.nome, row.setor);
    if (!grouped.has(key)) {
      grouped.set(key, {
        id: row.id,
        nome: row.nome,
        setor: row.setor || null,
        activeRows: 0,
        totalRows: 0
      });
    }
    const item = grouped.get(key);
    item.totalRows += 1;
    if (row.ativo) item.activeRows += 1;
  });

  return [...grouped.values()]
    .map(item => ({
      ...item,
      ativo: item.activeRows > 0
    }))
    .sort((a, b) => compareNameAsc(a, b));
}

async function syncGlobalCheckoutsAcrossStores() {
  if (!isAdmin()) return;
  if (!state.lookups.stores.length || !state.lookups.checkouts.length) return;

  const templates = getCheckoutTemplates();
  const inserts = [];

  state.lookups.stores.forEach(store => {
    templates.forEach(template => {
      const exists = state.lookups.checkouts.some(c =>
        c.loja_id === store.id &&
        checkoutKey(c.nome, c.setor) === checkoutKey(template.nome, template.setor)
      );
      if (!exists) {
        inserts.push({
          loja_id: store.id,
          nome: template.nome,
          setor: template.setor || null,
          ativo: template.ativo
        });
      }
    });
  });

  if (!inserts.length) return;
  const inserted = await safeQuery(sb.from('caixas').insert(inserts).select());
  if (!inserted) return;
  await loadLookups();
}

async function safeQuery(promise) {
  const { data, error } = await promise;
  if (error) {
    showToast(error.message, 'error');
    return null;
  }
  return data;
}

async function loadLookups() {
  const [stores, checkouts, types, users] = await Promise.all([
    safeQuery(sb.from('lojas').select('*').order('nome')),
    safeQuery(sb.from('caixas').select('*').order('nome')),
    safeQuery(sb.from('tipos_chamado').select('*').order('nome')),
    safeQuery(sb.from('usuarios').select('*').order('nome'))
  ]);

  state.lookups.stores = stores || [];
  state.lookups.checkouts = checkouts || [];
  state.lookups.types = types || [];
  state.lookups.users = users || [];

  hydrateStoreSelects();
}

function hydrateStoreSelects() {
  const storeOptions = ['<option value="">Selecione</option>']
    .concat(state.lookups.stores.map(s => `<option value="${s.id}">${s.nome}</option>`))
    .join('');

  document.getElementById('ticket-store').innerHTML = storeOptions;
  document.getElementById('register-store').innerHTML = `<option value="">Sem vínculo</option>${state.lookups.stores.map(s => `<option value="${s.id}">${s.nome}</option>`).join('')}`;

  document.getElementById('ticket-type').innerHTML = state.lookups.types
    .filter(t => t.ativo)
    .map(t => `<option value="${t.id}">${t.nome}</option>`)
    .join('');
}

async function ensureProfile(sessionUser) {
  const row = await safeQuery(sb.from('usuarios').select('*').eq('id', sessionUser.id).maybeSingle());
  if (row) {
    state.profile = row;
    return;
  }

  const payload = {
    id: sessionUser.id,
    nome: sessionUser.user_metadata?.nome || sessionUser.email.split('@')[0],
    email: sessionUser.email,
    perfil: sessionUser.user_metadata?.perfil || 'funcionario',
    loja_id: sessionUser.user_metadata?.loja_id || null,
    ativo: true
  };

  const inserted = await safeQuery(sb.from('usuarios').insert(payload).select().single());
  state.profile = inserted;
}

function isAdmin() {
  return state.profile?.perfil === 'admin';
}

function isDesktopNav() {
  return window.innerWidth > 980;
}

function setNavOpen(open) {
  if (isDesktopNav()) {
    document.body.classList.add('nav-open');
    return;
  }
  document.body.classList.toggle('nav-open', !!open);
}

function syncMenuState() {
  document.body.classList.toggle('nav-desktop', isDesktopNav());
  if (isDesktopNav()) {
    document.body.classList.add('nav-open');
  } else {
    document.body.classList.remove('nav-open');
  }
}

function mountMenu() {
  state.menu = isAdmin() ? MENU_ADMIN : MENU_FUNC;
  el.menuNav.innerHTML = state.menu
    .map(item => `<button class="nav-btn ${item.id === state.currentView ? 'active' : ''}" data-view="${item.id}">${item.label}</button>`)
    .join('');
}

async function openCurrentView(viewId) {
  state.currentView = viewId;
  if (!isDesktopNav()) setNavOpen(false);
  mountMenu();
  try {
    await renderView();
  } catch (error) {
    console.error(error);
    showToast('Nao foi possivel abrir esta tela.', 'error');
  }
}

async function fetchTickets(filters = {}) {
  let query = sb.from('chamados').select(`
    *,
    loja:lojas(id,nome,codigo),
    caixa:caixas(id,nome,setor),
    tipo:tipos_chamado(id,nome),
    usuario:usuarios(id,nome,email)
  `).order('created_at', { ascending: false });

  const data = await safeQuery(query);
  const rows = data || [];
  state.allTickets = rows;
  state.tickets = rows;
  return state.tickets;
}

function getTicketRowsForView() {
  const source = state.allTickets.length ? state.allTickets : state.tickets;
  const ticketUi = state.adminUi.tickets;
  const isHistoryTab = ticketUi.tab === 'history';

  return source.filter(ticket => {
    if (isHistoryTab && !isCompletedStatus(ticket.status)) return false;
    if (!isHistoryTab && isCompletedStatus(ticket.status)) return false;
    if (ticketUi.filters.store && String(ticket.loja?.id || '') !== String(ticketUi.filters.store)) return false;
    if (ticketUi.filters.checkout && normalizeText(ticket.caixa?.nome) !== normalizeText(ticketUi.filters.checkout)) return false;
    if (ticketUi.filters.type && String(ticket.tipo?.id || '') !== String(ticketUi.filters.type)) return false;
    if (ticketUi.filters.status && ticket.status !== ticketUi.filters.status) return false;
    if (ticketUi.filters.priority && ticket.prioridade !== ticketUi.filters.priority) return false;
    return true;
  });
}

function renderDashboard() {
  const all = state.allTickets.length ? state.allTickets : state.tickets;
  const activeTickets = all.filter(x => !isCompletedStatus(x.status));
  const kpi = {
    aberto: all.filter(x => x.status === 'aberto').length,
    andamento: all.filter(x => x.status === 'em_andamento').length,
    resolvido: all.filter(x => x.status === 'resolvido').length,
    fechado: all.filter(x => x.status === 'fechado').length
  };

  const stores = state.lookups.stores
    .filter(s => s.ativo)
    .map(s => `<option value="${s.id}">${s.nome}</option>`)
    .join('');
  const types = state.lookups.types
    .filter(t => t.ativo)
    .map(t => `<option value="${t.id}">${t.nome}</option>`)
    .join('');
  const recent = activeTickets.slice(0, 8);

  el.content.innerHTML = `
    <article class="cards-grid dashboard-kpis">
      <section class="kpi kpi-open"><span class="kpi-dot"></span><strong>${kpi.aberto}</strong><span>Abertos</span><small>Pendentes de atendimento</small></section>
      <section class="kpi kpi-progress"><span class="kpi-dot"></span><strong>${kpi.andamento}</strong><span>Em andamento</span><small>Chamados em execução</small></section>
      <section class="kpi kpi-done"><span class="kpi-dot"></span><strong>${kpi.resolvido}</strong><span>Resolvidos</span><small>Finalizados com sucesso</small></section>
      <section class="kpi kpi-total"><span class="kpi-dot"></span><strong>${all.length}</strong><span>Total</span><small>Base geral de chamados</small></section>
    </article>

    <section class="dashboard-main">
      <article class="card ticket-form-card">
        <div class="card-title-row">
          <h3>Abrir chamado</h3>
          <button id="btn-ticket-examples" class="btn btn-ghost btn-sm" type="button">Gerar exemplos</button>
        </div>
        <form id="quick-ticket-form" class="form-grid">
          <div class="grid-2">
            <label>Título*
              <input id="quick-ticket-title" required maxlength="120" placeholder="Ex: Impressora térmica não imprime" />
            </label>
            <label>Solicitante
              <input value="${state.profile?.nome || '-'}" disabled />
            </label>
          </div>
          <label>Descrição detalhada*
            <textarea id="quick-ticket-description" rows="4" required placeholder="Descreva o problema, impacto e desde quando ocorre..."></textarea>
          </label>
          <div class="grid-2">
            <label>Filial*
              <select id="quick-ticket-store" required>${stores}</select>
            </label>
            <label>Equipamentos/Setor*
              <select id="quick-ticket-checkout" required></select>
            </label>
          </div>
          <div class="grid-3">
            <label>Tipo de chamado*
              <select id="quick-ticket-type" required>${types}</select>
            </label>
            <label>Prioridade*
              <select id="quick-ticket-priority" required>
                <option value="baixa">Baixa</option>
                <option value="media" selected>Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </label>
            <label>Status
              <select id="quick-ticket-status" disabled>
                <option value="aberto" selected>Aberto</option>
              </select>
            </label>
          </div>
          <footer class="admin-form-actions">
            <button type="submit" class="btn btn-primary btn-sm">Salvar chamado</button>
            <button type="button" id="btn-open-ticket-modal" class="btn btn-ghost btn-sm">Modo completo</button>
          </footer>
        </form>
      </article>

      <aside class="recent-column">
        <article class="card">
          <div class="card-title-row">
            <div>
              <h3>Chamados recentes</h3>
              <p>Exibe apenas chamados ainda em andamento no sistema.</p>
            </div>
          </div>
          <div class="recent-list">
            ${recent.length ? recent.map(r => `
              <button type="button" class="recent-ticket" data-action="open" data-id="${r.id}">
                <div class="recent-head">
                  <strong>${r.titulo}</strong>
                  <div class="recent-badges">
                    ${badgeStatus(r.status)}
                    ${badgePriority(r.prioridade)}
                  </div>
                </div>
                <p>${r.loja?.nome || '-'} | ${r.caixa?.nome || '-'} | ${r.tipo?.nome || '-'}</p>
                <small>${r.usuario?.nome || '-'} • ${fmtDate(r.created_at)}</small>
              </button>
            `).join('') : '<p>Nenhum chamado recente.</p>'}
          </div>
        </article>
      </aside>
    </section>
  `;

  const storeSelect = document.getElementById('quick-ticket-store');
  const checkoutSelect = document.getElementById('quick-ticket-checkout');
  const syncCheckouts = () => {
    const storeId = Number(storeSelect.value);
    const options = state.lookups.checkouts
      .filter(c => c.ativo && c.loja_id === storeId)
      .map(c => `<option value="${c.id}">${c.nome}${c.setor ? ` - ${c.setor}` : ''}</option>`)
      .join('');
    checkoutSelect.innerHTML = options || '<option value="">Sem equipamentos/setor ativos</option>';
  };

  if (!isAdmin() && state.profile?.loja_id) {
    storeSelect.value = String(state.profile.loja_id);
    storeSelect.setAttribute('disabled', 'disabled');
  }
  syncCheckouts();
  storeSelect.addEventListener('change', syncCheckouts);

  document.getElementById('btn-ticket-examples').addEventListener('click', () => {
    document.getElementById('quick-ticket-title').value = 'PDV sem conexão com a rede';
    document.getElementById('quick-ticket-description').value = 'O PDV 03 está sem acesso ao sistema desde 09:20. Reinício já realizado sem sucesso.';
  });

  document.getElementById('quick-ticket-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      loja_id: Number(storeSelect.value),
      caixa_id: Number(checkoutSelect.value),
      tipo_chamado_id: Number(document.getElementById('quick-ticket-type').value),
      usuario_id: state.profile.id,
      titulo: document.getElementById('quick-ticket-title').value.trim(),
      descricao: document.getElementById('quick-ticket-description').value.trim(),
      prioridade: document.getElementById('quick-ticket-priority').value,
      anexo_url: null,
      telefone_retorno: null,
      responsavel_local: null,
      status: 'aberto'
    };
    if (!payload.loja_id || !payload.caixa_id || !payload.tipo_chamado_id || !payload.titulo || !payload.descricao) {
      return showToast('Preencha os campos obrigatórios', 'error');
    }
    const inserted = await safeQuery(sb.from('chamados').insert(payload).select().single());
    if (!inserted) return;
    showToast(`Chamado ${inserted.numero_chamado || inserted.id} criado com sucesso`);
    await reloadAll();
    renderDashboard();
  });

  document.getElementById('btn-open-ticket-modal').addEventListener('click', () => {
    el.btnOpenTicket.click();
  });

  bindTicketRowActions();
}

function buildChart(id, label, labels, values) {
  if (state.charts[id]) state.charts[id].destroy();
  const ctx = document.getElementById(id);
  if (!ctx) return;
  state.charts[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data: values,
        backgroundColor: ['#0f6abf', '#f8a300', '#7a4be0', '#1f9d59', '#475a78', '#d13a30']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function ticketTable(rows) {
  return renderCollectionCards({
    rows,
    emptyTitle: 'Nenhum chamado encontrado.',
    emptyText: 'Ajuste os filtros ou cadastre um novo chamado para visualizar itens aqui.',
    render: r => `
      <article class="entity-card entity-card-ticket">
        <header class="entity-card-head">
          <div>
            <small class="entity-card-kicker">Chamado #${r.numero_chamado || r.id}</small>
            <h4>${r.titulo}</h4>
            <p>${r.loja?.nome || '-'} • ${r.caixa?.nome || '-'} • ${r.tipo?.nome || '-'}</p>
          </div>
          <div class="entity-card-badges">
            ${badgePriority(r.prioridade)}
            ${badgeStatus(r.status)}
          </div>
        </header>
        <div class="entity-card-content">
          ${renderInfoGrid([
            ['Solicitante', r.usuario?.nome || '-'],
            ['Abertura', fmtDate(r.created_at)]
          ])}
        </div>
        <footer class="entity-card-actions">
          <button class="btn btn-sm btn-ghost" data-action="open" data-id="${r.id}">Detalhes</button>
        </footer>
      </article>
    `
  });
}

function renderInfoGrid(items) {
  return `
    <div class="info-grid">
      ${items.map(([label, value]) => `
        <div class="info-item">
          <span>${label}</span>
          <strong>${value ?? '-'}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCollectionCards({ rows, emptyTitle, emptyText, render, className = '' }) {
  if (!rows.length) {
    return `
      <div class="entity-empty">
        <h4>${emptyTitle}</h4>
        <p>${emptyText}</p>
      </div>
    `;
  }

  return `<div class="entity-grid ${className}">${rows.map(render).join('')}</div>`;
}

function renderEntityCard({
  kicker,
  title,
  description,
  badges = '',
  details = [],
  actions = '',
  className = ''
}) {
  return `
    <article class="entity-card ${className}">
      <header class="entity-card-head">
        <div>
          ${kicker ? `<small class="entity-card-kicker">${kicker}</small>` : ''}
          <h4>${title}</h4>
          ${description ? `<p>${description}</p>` : ''}
        </div>
        ${badges ? `<div class="entity-card-badges">${badges}</div>` : ''}
      </header>
      <div class="entity-card-content">
        ${details.length ? renderInfoGrid(details) : ''}
      </div>
      ${actions ? `<footer class="entity-card-actions">${actions}</footer>` : ''}
    </article>
  `;
}

function renderTicketView() {
  const ticketUi = state.adminUi.tickets;
  const isHistoryTab = ticketUi.tab === 'history';
  const stores = ['<option value="">Todas as lojas</option>'].concat(state.lookups.stores.map(s => `<option value="${s.id}">${s.nome}</option>`)).join('');
  const checkoutNames = [...new Set(state.lookups.checkouts.map(c => c.nome).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const checkouts = ['<option value="">Todos os equipamentos/setor</option>'].concat(checkoutNames.map(name => `<option value="${name}">${name}</option>`)).join('');
  const types = ['<option value="">Todos os tipos</option>'].concat(state.lookups.types.map(t => `<option value="${t.id}">${t.nome}</option>`)).join('');
  const statusOptions = isHistoryTab
    ? `
      <option value="">Todos os status do histórico</option>
      <option value="resolvido" ${ticketUi.filters.status === 'resolvido' ? 'selected' : ''}>Resolvido</option>
      <option value="fechado" ${ticketUi.filters.status === 'fechado' ? 'selected' : ''}>Fechado</option>
      <option value="cancelado" ${ticketUi.filters.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
    `
    : `
      <option value="">Todos os status ativos</option>
      <option value="aberto" ${ticketUi.filters.status === 'aberto' ? 'selected' : ''}>Aberto</option>
      <option value="em_andamento" ${ticketUi.filters.status === 'em_andamento' ? 'selected' : ''}>Em andamento</option>
      <option value="aguardando_retorno" ${ticketUi.filters.status === 'aguardando_retorno' ? 'selected' : ''}>Aguardando retorno</option>
    `;
  const visibleRows = getTicketRowsForView();

  el.content.innerHTML = `
    <article class="card">
      <div class="card-title-row">
        <div>
          <h3>Chamados</h3>
          <p>${isHistoryTab ? 'Registro de chamados concluídos.' : 'Acompanhe apenas chamados ativos e em progresso.'}</p>
        </div>
      </div>
      <div class="ticket-tabs">
        <button class="ticket-tab ${!isHistoryTab ? 'active' : ''}" id="btn-tab-active" type="button">Chamados em aberto</button>
        <button class="ticket-tab ${isHistoryTab ? 'active' : ''}" id="btn-tab-history" type="button">Histórico</button>
      </div>
      <div class="filters">
        <select id="f-store">${stores}</select>
        <select id="f-checkout">${checkouts}</select>
        <select id="f-type">${types}</select>
        <select id="f-status">
          ${statusOptions}
        </select>
        <select id="f-priority">
          <option value="">Todas prioridades</option>
          <option value="baixa" ${ticketUi.filters.priority === 'baixa' ? 'selected' : ''}>Baixa</option>
          <option value="media" ${ticketUi.filters.priority === 'media' ? 'selected' : ''}>Média</option>
          <option value="alta" ${ticketUi.filters.priority === 'alta' ? 'selected' : ''}>Alta</option>
          <option value="critica" ${ticketUi.filters.priority === 'critica' ? 'selected' : ''}>Crítica</option>
        </select>
        <button id="btn-apply-filters" class="btn btn-primary btn-sm">Aplicar</button>
        <button id="btn-clear-filters" class="btn btn-ghost btn-sm">Limpar</button>
      </div>
    </article>
    <article class="card table-wrap">
      ${ticketTable(visibleRows)}
    </article>
  `;

  document.getElementById('f-store').value = ticketUi.filters.store;
  document.getElementById('f-checkout').value = ticketUi.filters.checkout;
  document.getElementById('f-type').value = ticketUi.filters.type;

  document.getElementById('btn-tab-active').addEventListener('click', () => {
    state.adminUi.tickets.tab = 'active';
    state.adminUi.tickets.filters = {
      store: '',
      checkout: '',
      type: '',
      status: '',
      priority: ''
    };
    renderTicketView();
  });

  document.getElementById('btn-tab-history').addEventListener('click', () => {
    state.adminUi.tickets.tab = 'history';
    state.adminUi.tickets.filters = {
      store: '',
      checkout: '',
      type: '',
      status: '',
      priority: ''
    };
    renderTicketView();
  });

  document.getElementById('btn-apply-filters').addEventListener('click', () => {
    state.adminUi.tickets.filters = {
      store: document.getElementById('f-store').value,
      checkout: document.getElementById('f-checkout').value,
      type: document.getElementById('f-type').value,
      status: document.getElementById('f-status').value,
      priority: document.getElementById('f-priority').value
    };
    renderTicketView();
  });

  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    state.adminUi.tickets.filters = {
      store: '',
      checkout: '',
      type: '',
      status: '',
      priority: ''
    };
    renderTicketView();
  });

  bindTicketRowActions();
}

function adminEntityView(title, id, rows, columns, actions) {
  el.content.innerHTML = `
    <article class="card">
      <div class="card-title-row">
        <div>
          <h3>${title}</h3>
          <p>Gerencie os registros em cards verticais com ações rápidas no final de cada item.</p>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-create-${id}">Novo</button>
      </div>
    </article>
    <article class="card">
      ${renderCollectionCards({
        rows,
        emptyTitle: `Nenhum registro em ${title.toLowerCase()}.`,
        emptyText: 'Use o botão Novo para criar o primeiro item.',
        render: row => renderEntityCard({
          kicker: `ID ${row.id}`,
          title: row.nome || row.email || row.id,
          description: columns.find(c => c.key !== 'nome' && c.key !== 'email' && c.key !== 'id')
            ? columns.find(c => c.key !== 'nome' && c.key !== 'email' && c.key !== 'id').render
              ? columns.find(c => c.key !== 'nome' && c.key !== 'email' && c.key !== 'id').render(row)
              : (row[columns.find(c => c.key !== 'nome' && c.key !== 'email' && c.key !== 'id').key] ?? '-')
            : '',
          details: columns
            .filter(c => !['nome', 'email'].includes(c.key))
            .map(c => [c.label, typeof c.render === 'function' ? c.render(row) : (row[c.key] ?? '-')]),
          actions: `
            <button class="btn btn-sm btn-ghost" data-entity="${id}" data-action="edit" data-id="${row.id}">Editar</button>
            <button class="btn btn-sm btn-danger" data-entity="${id}" data-action="delete" data-id="${row.id}">Excluir/Inativar</button>
          `
        }),
        className: 'entity-grid-admin'
      })}
    </article>
  `;

  document.getElementById(`btn-create-${id}`).addEventListener('click', actions.create);
  el.content.querySelectorAll(`button[data-entity="${id}"]`).forEach(btn => {
    btn.addEventListener('click', () => {
      const row = rows.find(r => String(r.id) === String(btn.dataset.id));
      if (btn.dataset.action === 'edit') actions.edit(row);
      if (btn.dataset.action === 'delete') actions.remove(row);
    });
  });
}

function renderStores() {
  const ui = state.adminUi.stores;
  const rows = filterAdminRows(state.lookups.stores, ui);
  const editing = state.lookups.stores.find(s => s.id === ui.editingId) || null;

  el.content.innerHTML = `
    <article class="card admin-card">
      <div class="admin-header">
        <div>
          <h3>Lojas</h3>
          <p>Cadastro de lojas para organização de chamados, usuários e equipamentos/setor.</p>
        </div>
        <button id="btn-store-new" class="btn btn-primary btn-sm">Novo</button>
      </div>
      <form id="store-form" class="admin-form">
        <div class="grid-2">
          <label>Nome da loja*
            <input id="store-name" maxlength="120" required value="${editing?.nome || ''}" />
          </label>
          <label>Código*
            <input id="store-code" maxlength="30" required value="${editing?.codigo || ''}" />
          </label>
        </div>
        <label>Observação (opcional)
          <textarea id="store-observation" rows="2" maxlength="300">${editing?.observacao || ''}</textarea>
        </label>
        <footer class="admin-form-actions">
          <button type="submit" class="btn btn-primary btn-sm">${editing ? 'Salvar edição' : 'Salvar loja'}</button>
          ${editing ? '<button type="button" class="btn btn-ghost btn-sm" id="btn-store-cancel-edit">Cancelar edição</button>' : ''}
        </footer>
      </form>
    </article>

    <article class="card admin-card">
      <div class="card-title-row">
        <div>
          <h3>Lojas cadastradas</h3>
          <p>Visualização em cards com status, metadados e ações agrupadas.</p>
        </div>
      </div>
      <div class="filters filters-admin">
        <input id="stores-search" placeholder="Buscar por nome" value="${ui.search}" />
        <select id="stores-status">
          <option value="">Todos os status</option>
          <option value="ativo" ${ui.status === 'ativo' ? 'selected' : ''}>Ativo</option>
          <option value="inativo" ${ui.status === 'inativo' ? 'selected' : ''}>Inativo</option>
        </select>
        <select id="stores-sort">
          <option value="name_asc" ${ui.sort === 'name_asc' ? 'selected' : ''}>Nome (A-Z)</option>
          <option value="name_desc" ${ui.sort === 'name_desc' ? 'selected' : ''}>Nome (Z-A)</option>
          <option value="recent" ${ui.sort === 'recent' ? 'selected' : ''}>Mais recente</option>
          <option value="oldest" ${ui.sort === 'oldest' ? 'selected' : ''}>Mais antigo</option>
        </select>
        <button id="btn-stores-clear" class="btn btn-ghost btn-sm">Limpar filtros</button>
      </div>
      ${renderCollectionCards({
        rows,
        emptyTitle: 'Nenhuma loja encontrada.',
        emptyText: 'Ajuste os filtros ou cadastre uma nova loja.',
        render: row => renderEntityCard({
          kicker: `Loja #${row.id}`,
          title: row.nome,
          description: `Código ${row.codigo}`,
          badges: badgeActive(row.ativo),
          details: [
            ['Código', row.codigo],
            ['Cadastro', fmtDate(row.created_at)],
            ['Observação', row.observacao || '-']
          ],
          actions: `
            <button class="btn btn-sm btn-ghost" data-store-action="edit" data-id="${row.id}">Editar</button>
            <button class="btn btn-sm ${row.ativo ? 'btn-warning' : 'btn-primary'}" data-store-action="toggle" data-id="${row.id}">${row.ativo ? 'Inativar' : 'Ativar'}</button>
            <button class="btn btn-sm btn-danger" data-store-action="delete" data-id="${row.id}">Excluir</button>
          `,
          className: 'entity-card-admin'
        }),
        className: 'entity-grid-admin'
      })}
    </article>
  `;

  const form = document.getElementById('store-form');
  const searchInput = document.getElementById('stores-search');
  const statusSelect = document.getElementById('stores-status');
  const sortSelect = document.getElementById('stores-sort');

  searchInput.addEventListener('input', () => {
    state.adminUi.stores.search = searchInput.value;
    renderStores();
  });

  statusSelect.addEventListener('change', () => {
    state.adminUi.stores.status = statusSelect.value;
    renderStores();
  });

  sortSelect.addEventListener('change', () => {
    state.adminUi.stores.sort = sortSelect.value;
    renderStores();
  });

  document.getElementById('btn-stores-clear').addEventListener('click', (e) => {
    e.preventDefault();
    state.adminUi.stores = { search: '', status: '', sort: 'name_asc', editingId: null };
    renderStores();
  });

  document.getElementById('btn-store-new').addEventListener('click', (e) => {
    e.preventDefault();
    state.adminUi.stores.editingId = null;
    renderStores();
  });

  if (editing) {
    document.getElementById('btn-store-cancel-edit').addEventListener('click', () => {
      state.adminUi.stores.editingId = null;
      renderStores();
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('store-name').value.trim();
    const codigo = document.getElementById('store-code').value.trim().toUpperCase();
    const observacao = document.getElementById('store-observation').value.trim() || null;

    if (!nome || !codigo) {
      showToast('Preencha nome e código da loja.', 'error');
      return;
    }

    const duplicateCode = state.lookups.stores.find(s =>
      normalizeText(s.codigo) === normalizeText(codigo) &&
      s.id !== state.adminUi.stores.editingId
    );
    if (duplicateCode) {
      showToast('Já existe uma loja com esse código.', 'error');
      return;
    }

    if (editing) {
      const updated = await safeQuery(
        sb.from('lojas').update({ nome, codigo, observacao }).eq('id', editing.id).select().single()
      );
      if (!updated) return;
      showToast('Loja atualizada com sucesso.');
    } else {
      const created = await safeQuery(
        sb.from('lojas').insert({ nome, codigo, observacao }).select().single()
      );
      if (!created) return;
      showToast('Loja cadastrada com sucesso.');
    }

    state.adminUi.stores.editingId = null;
    await reloadAll();
    renderStores();
  });

  el.content.querySelectorAll('button[data-store-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = state.lookups.stores.find(s => String(s.id) === String(btn.dataset.id));
      if (!row) return;

      if (btn.dataset.storeAction === 'edit') {
        state.adminUi.stores.editingId = row.id;
        renderStores();
        return;
      }

      if (btn.dataset.storeAction === 'toggle') {
        if (!confirm(`Deseja ${row.ativo ? 'inativar' : 'ativar'} a loja ${row.nome}?`)) return;
        const updated = await safeQuery(
          sb.from('lojas').update({ ativo: !row.ativo }).eq('id', row.id).select().single()
        );
        if (!updated) return;
        showToast(`Loja ${updated.ativo ? 'ativada' : 'inativada'} com sucesso.`);
        await reloadAll();
        renderStores();
        return;
      }

      if (!confirm(`Excluir a loja ${row.nome}? Essa ação pode falhar se houver vínculos.`)) return;
      const deleted = await safeQuery(sb.from('lojas').delete().eq('id', row.id).select().single());
      if (!deleted) return;
      showToast('Loja excluída com sucesso.');
      state.adminUi.stores.editingId = null;
      await reloadAll();
      renderStores();
    });
  });
}

function renderCheckouts() {
  const templates = getCheckoutTemplates();
  adminEntityView('Equipamentos/Setor (global para todas as lojas)', 'checkouts', templates, [
    { key: 'id', label: 'ID' },
    { key: 'nome', label: 'Equipamentos/Setor' },
    { key: 'setor', label: 'Setor' },
    { key: 'totalRows', label: 'Lojas com esse item' },
    { key: 'ativo', label: 'Status', render: row => row.ativo ? 'Ativo' : 'Inativo' }
  ], {
    create: async () => {
      const nome = prompt('Nome do equipamento/setor:');
      if (!nome) return;
      const setor = prompt('Setor (opcional):') || null;
      const key = checkoutKey(nome, setor);
      const inserts = state.lookups.stores
        .filter(store => !state.lookups.checkouts.some(c => c.loja_id === store.id && checkoutKey(c.nome, c.setor) === key))
        .map(store => ({ nome: nome.trim(), setor, loja_id: store.id }));

      if (!inserts.length) {
        showToast('Esse equipamento/setor já existe em todas as lojas.', 'error');
        return;
      }

      const created = await safeQuery(sb.from('caixas').insert(inserts).select());
      if (!created) return;
      showToast(`Equipamento/setor cadastrado para ${created.length} loja(s).`);
      await reloadAll();
      renderCheckouts();
    },
    edit: async (row) => {
      const nome = prompt('Nome:', row.nome);
      if (!nome) return;
      const setor = prompt('Setor:', row.setor || '') || null;
      const oldKey = checkoutKey(row.nome, row.setor);
      const relatedIds = state.lookups.checkouts
        .filter(c => checkoutKey(c.nome, c.setor) === oldKey)
        .map(c => c.id);
      const updated = await safeQuery(sb.from('caixas').update({ nome, setor }).in('id', relatedIds).select());
      if (!updated) return;
      showToast(`Equipamento/setor atualizado em ${updated.length} loja(s).`);
      await reloadAll();
      renderCheckouts();
    },
    remove: async (row) => {
      if (!confirm(`Deseja ${row.ativo ? 'inativar' : 'ativar'} ${row.nome}?`)) return;
      const key = checkoutKey(row.nome, row.setor);
      const relatedIds = state.lookups.checkouts
        .filter(c => checkoutKey(c.nome, c.setor) === key)
        .map(c => c.id);
      const updated = await safeQuery(sb.from('caixas').update({ ativo: !row.ativo }).in('id', relatedIds).select());
      if (!updated) return;
      showToast(`Status aplicado ao equipamento/setor em ${updated.length} loja(s).`);
      await reloadAll();
      renderCheckouts();
    }
  });
}

function renderTypes() {
  const ui = state.adminUi.types;
  const rows = filterAdminRows(state.lookups.types, ui);
  const editing = state.lookups.types.find(t => t.id === ui.editingId) || null;

  el.content.innerHTML = `
    <article class="card admin-card">
      <div class="admin-header">
        <div>
          <h3>Tipos de chamado (Globais)</h3>
          <p>Os tipos cadastrados aqui ficam disponíveis automaticamente para todas as lojas.</p>
        </div>
        <button id="btn-type-new" class="btn btn-primary btn-sm">Novo</button>
      </div>
      <form id="type-form" class="admin-form">
        <div class="grid-2">
          <label>Nome do tipo*
            <input id="type-name" maxlength="120" required value="${editing?.nome || ''}" />
          </label>
          <label>Status atual
            <input value="${editing ? (editing.ativo ? 'Ativo' : 'Inativo') : 'Ativo'}" disabled />
          </label>
        </div>
        <label>Descrição
          <textarea id="type-description" rows="2" maxlength="300">${editing?.descricao || ''}</textarea>
        </label>
        <footer class="admin-form-actions">
          <button type="submit" class="btn btn-primary btn-sm">${editing ? 'Salvar edição' : 'Salvar tipo'}</button>
          ${editing ? '<button type="button" class="btn btn-ghost btn-sm" id="btn-type-cancel-edit">Cancelar edição</button>' : ''}
        </footer>
      </form>
    </article>

    <article class="card admin-card">
      <div class="card-title-row">
        <div>
          <h3>Tipos cadastrados</h3>
          <p>Todos os tipos ficam organizados em cards com status e descrição.</p>
        </div>
      </div>
      <div class="filters filters-admin">
        <input id="types-search" placeholder="Buscar por nome" value="${ui.search}" />
        <select id="types-status">
          <option value="">Todos os status</option>
          <option value="ativo" ${ui.status === 'ativo' ? 'selected' : ''}>Ativo</option>
          <option value="inativo" ${ui.status === 'inativo' ? 'selected' : ''}>Inativo</option>
        </select>
        <select id="types-sort">
          <option value="name_asc" ${ui.sort === 'name_asc' ? 'selected' : ''}>Nome (A-Z)</option>
          <option value="name_desc" ${ui.sort === 'name_desc' ? 'selected' : ''}>Nome (Z-A)</option>
          <option value="recent" ${ui.sort === 'recent' ? 'selected' : ''}>Mais recente</option>
          <option value="oldest" ${ui.sort === 'oldest' ? 'selected' : ''}>Mais antigo</option>
        </select>
        <button id="btn-types-clear" class="btn btn-ghost btn-sm">Limpar filtros</button>
      </div>
      ${renderCollectionCards({
        rows,
        emptyTitle: 'Nenhum tipo encontrado.',
        emptyText: 'Ajuste os filtros ou crie um novo tipo de chamado.',
        render: row => renderEntityCard({
          kicker: `Tipo #${row.id}`,
          title: row.nome,
          description: row.descricao || 'Sem descrição adicional.',
          badges: badgeActive(row.ativo),
          details: [
            ['Descrição', row.descricao || '-'],
            ['Cadastro', fmtDate(row.created_at)]
          ],
          actions: `
            <button class="btn btn-sm btn-ghost" data-type-action="edit" data-id="${row.id}">Editar</button>
            <button class="btn btn-sm ${row.ativo ? 'btn-warning' : 'btn-primary'}" data-type-action="toggle" data-id="${row.id}">${row.ativo ? 'Inativar' : 'Ativar'}</button>
            <button class="btn btn-sm btn-danger" data-type-action="delete" data-id="${row.id}">Excluir</button>
          `,
          className: 'entity-card-admin'
        }),
        className: 'entity-grid-admin'
      })}
    </article>
  `;

  const form = document.getElementById('type-form');
  const searchInput = document.getElementById('types-search');
  const statusSelect = document.getElementById('types-status');
  const sortSelect = document.getElementById('types-sort');

  searchInput.addEventListener('input', () => {
    state.adminUi.types.search = searchInput.value;
    renderTypes();
  });

  statusSelect.addEventListener('change', () => {
    state.adminUi.types.status = statusSelect.value;
    renderTypes();
  });

  sortSelect.addEventListener('change', () => {
    state.adminUi.types.sort = sortSelect.value;
    renderTypes();
  });

  document.getElementById('btn-types-clear').addEventListener('click', (e) => {
    e.preventDefault();
    state.adminUi.types = { search: '', status: '', sort: 'name_asc', editingId: null };
    renderTypes();
  });

  document.getElementById('btn-type-new').addEventListener('click', (e) => {
    e.preventDefault();
    state.adminUi.types.editingId = null;
    renderTypes();
  });

  if (editing) {
    document.getElementById('btn-type-cancel-edit').addEventListener('click', () => {
      state.adminUi.types.editingId = null;
      renderTypes();
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('type-name').value.trim();
    const descricao = document.getElementById('type-description').value.trim() || null;

    if (!nome) {
      showToast('Informe o nome do tipo de chamado.', 'error');
      return;
    }

    const duplicateType = state.lookups.types.find(t =>
      normalizeText(t.nome) === normalizeText(nome) &&
      t.id !== state.adminUi.types.editingId
    );
    if (duplicateType) {
      showToast('Já existe um tipo com esse nome.', 'error');
      return;
    }

    if (editing) {
      const updated = await safeQuery(
        sb.from('tipos_chamado').update({ nome, descricao }).eq('id', editing.id).select().single()
      );
      if (!updated) return;
      showToast('Tipo de chamado atualizado com sucesso.');
    } else {
      const created = await safeQuery(
        sb.from('tipos_chamado').insert({ nome, descricao }).select().single()
      );
      if (!created) return;
      showToast('Tipo de chamado cadastrado com sucesso.');
    }

    state.adminUi.types.editingId = null;
    await reloadAll();
    renderTypes();
  });

  el.content.querySelectorAll('button[data-type-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = state.lookups.types.find(t => String(t.id) === String(btn.dataset.id));
      if (!row) return;

      if (btn.dataset.typeAction === 'edit') {
        state.adminUi.types.editingId = row.id;
        renderTypes();
        return;
      }

      if (btn.dataset.typeAction === 'toggle') {
        if (!confirm(`Deseja ${row.ativo ? 'inativar' : 'ativar'} o tipo ${row.nome}?`)) return;
        const updated = await safeQuery(
          sb.from('tipos_chamado').update({ ativo: !row.ativo }).eq('id', row.id).select().single()
        );
        if (!updated) return;
        showToast(`Tipo ${updated.ativo ? 'ativado' : 'inativado'} com sucesso.`);
        await reloadAll();
        renderTypes();
        return;
      }

      if (!confirm(`Excluir o tipo ${row.nome}? Essa ação pode falhar se houver chamados vinculados.`)) return;
      const deleted = await safeQuery(sb.from('tipos_chamado').delete().eq('id', row.id).select().single());
      if (!deleted) return;
      showToast('Tipo excluído com sucesso.');
      state.adminUi.types.editingId = null;
      await reloadAll();
      renderTypes();
    });
  });
}

function renderUsers() {
  adminEntityView('Usuários', 'users', state.lookups.users, [
    { key: 'nome', label: 'Nome' },
    { key: 'email', label: 'Email' },
    { key: 'perfil', label: 'Perfil' },
    { key: 'loja_id', label: 'Loja', render: row => state.lookups.stores.find(s => s.id === row.loja_id)?.nome || '-' },
    { key: 'ativo', label: 'Status', render: row => row.ativo ? 'Ativo' : 'Inativo' }
  ], {
    create: async () => {
      const nome = prompt('Nome:');
      if (!nome) return;
      const email = prompt('Email:');
      if (!email) return;
      const senha = prompt('Senha inicial (mín. 6):');
      if (!senha || senha.length < 6) return;
      const perfil = prompt('Perfil (admin/funcionario):', 'funcionario');
      const loja = prompt('ID da loja (vazio opcional):');

      const createClient = supabase.createClient(window.APP_CONFIG.supabaseUrl, window.APP_CONFIG.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });

      const { error } = await createClient.auth.signUp({
        email,
        password: senha,
        options: {
          data: {
            nome,
            perfil: perfil === 'admin' ? 'admin' : 'funcionario',
            loja_id: loja ? Number(loja) : null
          }
        }
      });

      if (error) return showToast(error.message, 'error');
      showToast('Usuário criado. Se confirmação de email estiver ativa, ele precisa confirmar acesso.');
      await reloadAll();
      renderUsers();
    },
    edit: async (row) => {
      const nome = prompt('Nome:', row.nome);
      if (!nome) return;
      const perfil = prompt('Perfil (admin/funcionario):', row.perfil) || row.perfil;
      const loja = prompt('ID loja (vazio remove):', row.loja_id || '');
      const ativo = confirm('Usuário ativo? (OK=ativo / Cancel=inativo)');
      await safeQuery(
        sb.from('usuarios').update({
          nome,
          perfil: perfil === 'admin' ? 'admin' : 'funcionario',
          loja_id: loja ? Number(loja) : null,
          ativo
        }).eq('id', row.id)
      );
      await reloadAll();
      renderUsers();
    },
    remove: async (row) => {
      if (!confirm(`Deseja ${row.ativo ? 'inativar' : 'ativar'} ${row.nome}?`)) return;
      await safeQuery(sb.from('usuarios').update({ ativo: !row.ativo }).eq('id', row.id));
      await reloadAll();
      renderUsers();
    }
  });
}

function renderReports() {
  const source = state.allTickets.length ? state.allTickets : state.tickets;
  const totalPorLoja = state.lookups.stores.map(s => ({
    loja: s.nome,
    total: source.filter(t => t.loja_id === s.id).length
  }));

  el.content.innerHTML = `
    <article class="card">
      <div class="card-title-row">
        <div>
          <h3>Relatórios</h3>
          <p>Resumo por loja e exportação CSV em cards verticais.</p>
        </div>
        <button id="btn-export-csv" class="btn btn-primary btn-sm">Exportar chamados (CSV)</button>
      </div>
      ${renderCollectionCards({
        rows: totalPorLoja,
        emptyTitle: 'Sem dados para relatório.',
        emptyText: 'Cadastre chamados para visualizar o resumo por loja.',
        render: x => renderEntityCard({
          kicker: 'Resumo por loja',
          title: x.loja,
          description: `${x.total} chamado(s) registrados`,
          details: [['Total de chamados', String(x.total)]],
          className: 'entity-card-report'
        }),
        className: 'entity-grid-report'
      })}
    </article>
  `;

  document.getElementById('btn-export-csv').addEventListener('click', exportCsv);
}

function renderSettings() {
  const user = state.profile;
  el.content.innerHTML = `
    <article class="card admin-card">
      <div class="card-title-row">
        <div>
          <h3>Configurações</h3>
          <p>Atualize os dados principais do seu perfil em um card único e responsivo.</p>
        </div>
      </div>
      <div class="settings-shell">
        <div class="settings-summary entity-card">
          <header class="entity-card-head">
            <div>
              <small class="entity-card-kicker">Perfil atual</small>
              <h4>${user?.nome || '-'}</h4>
              <p>${user?.perfil || '-'} • ${user?.email || '-'}</p>
            </div>
            <div class="entity-card-badges">${badgeActive(user?.ativo)}</div>
          </header>
        </div>
        <form class="admin-form" id="settings-form">
          <div class="grid-2">
            <label>Nome
              <input id="settings-name" value="${user?.nome || ''}" />
            </label>
            <label>Email
              <input value="${user?.email || ''}" disabled />
            </label>
          </div>
          <footer class="admin-form-actions">
            <button id="btn-save-settings" type="submit" class="btn btn-primary btn-sm">Salvar</button>
          </footer>
        </form>
      </div>
    </article>
  `;

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('settings-name').value.trim();
    if (!nome) return showToast('Informe o nome', 'error');
    await safeQuery(sb.from('usuarios').update({ nome }).eq('id', state.profile.id));
    state.profile.nome = nome;
    el.userInfo.textContent = `${state.profile.nome} (${state.profile.perfil})`;
    showToast('Perfil atualizado');
  });
}

async function renderView() {
  el.viewTitle.textContent = state.menu.find(m => m.id === state.currentView)?.label || 'Painel';

  if (state.currentView === 'dashboard') return renderDashboard();
  if (state.currentView === 'tickets') return renderTicketView();
  if (state.currentView === 'stores') return renderStores();
  if (state.currentView === 'checkouts') return renderCheckouts();
  if (state.currentView === 'types') return renderTypes();
  if (state.currentView === 'users') return renderUsers();
  if (state.currentView === 'reports') return renderReports();
  if (state.currentView === 'settings') return renderSettings();
}

function bindTicketRowActions() {
  if (document.body.dataset.ticketActionsBound === 'true') return;

  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action="open"]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    const ticketId = Number(btn.dataset.id);
    if (!ticketId) return;
    await openTicketDetails(ticketId);
  });

  document.body.dataset.ticketActionsBound = 'true';
}

async function openTicketDetails(ticketId) {
  const source = state.allTickets.length ? state.allTickets : state.tickets;
  let ticket = source.find(t => String(t.id) === String(ticketId));

  if (!ticket) {
    ticket = await safeQuery(
      sb.from('chamados').select(`
        *,
        loja:lojas(id,nome,codigo),
        caixa:caixas(id,nome,setor),
        tipo:tipos_chamado(id,nome),
        usuario:usuarios(id,nome,email)
      `).eq('id', ticketId).maybeSingle()
    );
  }

  if (!ticket) {
    showToast('Nao foi possivel carregar os detalhes do chamado', 'error');
    return;
  }

  const history = await safeQuery(
    sb.from('historico_chamados')
      .select('*, usuario:usuarios(nome)')
      .eq('chamado_id', ticketId)
      .order('created_at', { ascending: false })
  ) || [];

  const statusActions = isAdmin()
    ? `<div class="ticket-progress-panel">
        <h3>Progresso do chamado</h3>
        <p>Apenas administradores podem atualizar o andamento. Quando o chamado for concluído, ele aparecerá na aba Histórico.</p>
        <div class="toolbar">
        <select id="ticket-status-update">
          <option value="aberto">Aberto</option>
          <option value="em_andamento">Em andamento</option>
          <option value="aguardando_retorno">Aguardando retorno</option>
          <option value="resolvido">Resolvido</option>
          <option value="fechado">Fechado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <button class="btn btn-primary btn-sm" id="btn-change-status" data-id="${ticket.id}">Alterar status</button>
        </div>
        <div class="admin-form-actions">
          <button type="button" class="btn btn-danger btn-sm" id="btn-delete-ticket" data-id="${ticket.id}">Excluir chamado</button>
        </div>
      </div>`
    : '';

  el.detailsContent.innerHTML = `
    <div class="details-header">
      <div>
        <h2>Chamado ${ticket.numero_chamado || ticket.id}</h2>
        <p>${ticket.titulo}</p>
      </div>
      <div class="entity-card-badges">
        ${badgePriority(ticket.prioridade)}
        ${badgeStatus(ticket.status)}
      </div>
    </div>

    <div class="details-tabs">
      <button class="details-tab active" type="button" data-details-tab="info">Informações</button>
      <button class="details-tab" type="button" data-details-tab="status">Alterar status</button>
      <button class="details-tab" type="button" data-details-tab="history">Histórico</button>
    </div>

    <section class="details-panel active" data-details-panel="info">
      <div class="card">
        <h3>Informações principais</h3>
        <div class="info-grid">
          <div class="info-item"><span>Loja</span><strong>${ticket.loja?.nome || '-'}</strong></div>
          <div class="info-item"><span>Equipamentos/Setor</span><strong>${ticket.caixa?.nome || '-'}</strong></div>
          <div class="info-item"><span>Tipo</span><strong>${ticket.tipo?.nome || '-'}</strong></div>
          <div class="info-item"><span>Solicitante</span><strong>${ticket.usuario?.nome || '-'}</strong></div>
          <div class="info-item"><span>Abertura</span><strong>${fmtDate(ticket.created_at)}</strong></div>
          <div class="info-item"><span>Anexo</span><strong>${ticket.anexo_url ? `<a href="${ticket.anexo_url}" target="_blank">Ver anexo</a>` : '-'}</strong></div>
        </div>
      </div>
      <div class="card">
        <h3>Descrição</h3>
        <p>${ticket.descricao}</p>
      </div>
    </section>

    <section class="details-panel" data-details-panel="status">
      ${statusActions || '<div class="card"><p>Somente administradores podem alterar o status deste chamado.</p></div>'}
      <div class="card">
        <h3>Adicionar observação</h3>
        <textarea id="obs-text" rows="3" placeholder="Digite uma observação"></textarea>
        <button id="btn-add-observation" class="btn btn-primary btn-sm" data-id="${ticket.id}">Registrar observação</button>
      </div>
    </section>

    <section class="details-panel" data-details-panel="history">
      <div class="card">
        <h3>Histórico</h3>
        ${history.length ? history.map(h => `
          <div class="history-item">
            <strong>${h.acao}</strong> - ${fmtDate(h.created_at)}
            <div>${h.descricao || ''}</div>
            <small>Por: ${h.usuario?.nome || 'Sistema'}</small>
          </div>
        `).join('') : '<p>Sem histórico.</p>'}
      </div>
    </section>
    <footer class="modal-footer">
      <button type="button" class="btn btn-ghost" id="btn-close-details">Fechar</button>
    </footer>
  `;

  el.detailsContent.querySelectorAll('[data-details-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const nextTab = tab.dataset.detailsTab;
      el.detailsContent.querySelectorAll('[data-details-tab]').forEach(node => {
        node.classList.toggle('active', node.dataset.detailsTab === nextTab);
      });
      el.detailsContent.querySelectorAll('[data-details-panel]').forEach(node => {
        node.classList.toggle('active', node.dataset.detailsPanel === nextTab);
      });
    });
  });

  if (isAdmin()) {
    const select = document.getElementById('ticket-status-update');
    select.value = ticket.status;
    document.getElementById('btn-change-status').addEventListener('click', async () => {
      const nextStatus = select.value;
      const updated = await safeQuery(sb.from('chamados').update({ status: nextStatus }).eq('id', ticket.id).select().single());
      if (!updated) return;
      showToast('Status atualizado');
      if (el.detailsModal.open) {
        el.detailsModal.close();
      }
      await reloadAll();
      await renderView();
    });

    document.getElementById('btn-delete-ticket').addEventListener('click', async () => {
      if (!confirm(`Excluir o chamado ${ticket.numero_chamado || ticket.id}? Essa ação não poderá ser desfeita.`)) return;
      const { error, count } = await sb
        .from('chamados')
        .delete({ count: 'exact' })
        .eq('id', ticket.id);
      if (error) {
        showToast(error.message, 'error');
        return;
      }
      if (!count) {
        showToast('Nenhum chamado foi excluído. Verifique a permissão de exclusão no banco.', 'error');
        return;
      }
      showToast('Chamado excluído com sucesso');
      if (el.detailsModal.open) {
        el.detailsModal.close();
      }
      await reloadAll();
      await renderView();
    });
  }

  document.getElementById('btn-add-observation').addEventListener('click', async () => {
    const text = document.getElementById('obs-text').value.trim();
    if (!text) return showToast('Digite a observação', 'error');
    await safeQuery(sb.rpc('add_ticket_observation', { p_chamado_id: ticket.id, p_texto: text }));
    showToast('Observação registrada');
    await openTicketDetails(ticket.id);
  });

  document.getElementById('btn-close-details').addEventListener('click', () => {
    if (el.detailsModal.open) {
      el.detailsModal.close();
    }
  });

  if (el.detailsModal.open) {
    el.detailsModal.close();
  }

  requestAnimationFrame(() => {
    if (!el.detailsModal.open) {
      el.detailsModal.showModal();
    }
  });
}

async function reloadAll() {
  await loadLookups();
  await fetchTickets();
}

function setupTicketModal() {
  document.getElementById('ticket-store').addEventListener('change', (e) => {
    const storeId = Number(e.target.value);
    const options = state.lookups.checkouts
      .filter(c => c.ativo && c.loja_id === storeId)
      .map(c => `<option value="${c.id}">${c.nome}${c.setor ? ` - ${c.setor}` : ''}</option>`)
      .join('');

    document.getElementById('ticket-checkout').innerHTML = options || '<option value="">Sem equipamentos/setor ativos</option>';
  });

  el.btnOpenTicket.addEventListener('click', async () => {
    await syncGlobalCheckoutsAcrossStores();
    const storeSelect = document.getElementById('ticket-store');

    if (!isAdmin() && state.profile.loja_id) {
      storeSelect.value = String(state.profile.loja_id);
      storeSelect.dispatchEvent(new Event('change'));
      storeSelect.setAttribute('disabled', 'disabled');
    } else {
      storeSelect.removeAttribute('disabled');
      const firstStore = state.lookups.stores.find(s => s.ativo);
      if (firstStore && !storeSelect.value) {
        storeSelect.value = String(firstStore.id);
      }
      storeSelect.dispatchEvent(new Event('change'));
    }

    el.ticketModal.showModal();
  });

  document.getElementById('btn-close-ticket').addEventListener('click', () => el.ticketModal.close());

  el.ticketForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      loja_id: Number(document.getElementById('ticket-store').value),
      caixa_id: Number(document.getElementById('ticket-checkout').value),
      tipo_chamado_id: Number(document.getElementById('ticket-type').value),
      usuario_id: state.profile.id,
      titulo: document.getElementById('ticket-title').value.trim(),
      descricao: document.getElementById('ticket-description').value.trim(),
      prioridade: document.getElementById('ticket-priority').value,
      anexo_url: document.getElementById('ticket-attachment').value.trim() || null,
      telefone_retorno: null,
      responsavel_local: null,
      status: 'aberto'
    };

    if (!payload.loja_id || !payload.caixa_id || !payload.tipo_chamado_id || !payload.titulo || !payload.descricao) {
      return showToast('Preencha os campos obrigatórios', 'error');
    }

    const inserted = await safeQuery(sb.from('chamados').insert(payload).select().single());
    if (!inserted) return;

    showToast(`Chamado ${inserted.numero_chamado || inserted.id} criado com sucesso`);
    el.ticketForm.reset();
    el.ticketModal.close();
    await reloadAll();
    renderView();
  });
}

function exportCsv() {
  const header = [
    'numero_chamado', 'loja', 'caixa', 'tipo', 'titulo', 'prioridade', 'status', 'abertura', 'solicitante'
  ];

  const lines = state.tickets.map(t => [
    t.numero_chamado || t.id,
    t.loja?.nome || '',
    t.caixa?.nome || '',
    t.tipo?.nome || '',
    t.titulo,
    t.prioridade,
    t.status,
    fmtDate(t.created_at),
    t.usuario?.nome || ''
  ].map(v => `"${String(v).replaceAll('"', '""')}"`).join(','));

  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `chamados_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function bootApp(session) {
  state.session = session;
  await ensureProfile(session.user);
  state.currentView = 'dashboard';
  syncMenuState();
  state.isSigningOut = false;
  if (el.btnLogout) {
    el.btnLogout.disabled = false;
  }

  if (!state.profile.ativo) {
    showToast('Usuário inativo. Contate o administrador.', 'error');
    await sb.auth.signOut();
    return;
  }

  showAppScreen();
  el.userInfo.textContent = `${state.profile.nome} (${state.profile.perfil})`;
  if (el.btnAdminQuick) {
    el.btnAdminQuick.classList.toggle('hidden', !isAdmin());
  }

  await reloadAll();
  mountMenu();
  await renderView();
}

function bootAuth() {
  document.getElementById('btn-go-register').addEventListener('click', () => {
    el.loginForm.classList.add('hidden');
    el.registerForm.classList.remove('hidden');
  });

  document.getElementById('btn-go-login').addEventListener('click', () => {
    el.registerForm.classList.add('hidden');
    el.loginForm.classList.remove('hidden');
  });

  el.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return showToast(error.message, 'error');
  });

  el.registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const perfil = document.getElementById('register-role').value;
    const loja_id = document.getElementById('register-store').value || null;

    const { error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome,
          perfil,
          loja_id: loja_id ? Number(loja_id) : null
        }
      }
    });

    if (error) return showToast(error.message, 'error');
    showToast('Cadastro criado. Faça login para continuar.');
    el.registerForm.reset();
    el.registerForm.classList.add('hidden');
    el.loginForm.classList.remove('hidden');
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = '';
    document.getElementById('login-email').focus();
  });
}

function bindTopActions() {
  if (el.menuNav) {
    el.menuNav.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-view]');
      if (!btn) return;
      await openCurrentView(btn.dataset.view);
    });
  }

  if (el.btnNavToggle) {
    el.btnNavToggle.addEventListener('click', () => {
      if (isDesktopNav()) return;
      const isOpen = document.body.classList.contains('nav-open');
      setNavOpen(!isOpen);
    });
  }

  if (el.btnNavClose) {
    el.btnNavClose.addEventListener('click', () => {
      if (isDesktopNav()) return;
      setNavOpen(false);
    });
  }

  if (el.navOverlay) {
    el.navOverlay.addEventListener('click', () => {
      if (isDesktopNav()) return;
      setNavOpen(false);
    });
  }

  if (el.btnAdminQuick) {
    el.btnAdminQuick.addEventListener('click', async () => {
      if (!isAdmin()) return showToast('Acesso restrito para administradores.', 'error');
      await openCurrentView('stores');
    });
  }

  if (el.btnThemeToggle) {
    el.btnThemeToggle.addEventListener('click', () => {
      document.body.classList.toggle('theme-light');
    });
  }

  window.addEventListener('resize', syncMenuState);

  el.globalSearch.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const number = el.globalSearch.value.trim();
    if (!number) return;

    const data = await safeQuery(
      sb.from('chamados').select(`
        *,
        loja:lojas(id,nome,codigo),
        caixa:caixas(id,nome,setor),
        tipo:tipos_chamado(id,nome),
        usuario:usuarios(id,nome,email)
      `).ilike('numero_chamado', `%${number}%`).limit(1)
    );

    if (!data || !data.length) return showToast('Chamado não encontrado', 'error');
    await fetchTickets();
    await openTicketDetails(data[0].id);
  });

  if (el.detailsModal) {
    el.detailsModal.addEventListener('close', () => {
      el.detailsContent.innerHTML = '';
    });
    el.detailsModal.addEventListener('cancel', () => {
      el.detailsContent.innerHTML = '';
    });
  }
}

async function init() {
  if (!window.sb) return;

  bootAuth();
  bindTopActions();
  initLogoutButton();
  setupTicketModal();

  syncMenuState();
  el.authView.classList.add('hidden');
  el.appView.classList.add('hidden');
  await loadLookups();

  const { data } = await sb.auth.getSession();
  if (data.session) {
    await bootApp(data.session);
  } else {
    showAuthScreen();
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') return;

    if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
      await bootApp(session);
    } else {
      state.isSigningOut = false;
      if (el.btnLogout) {
        el.btnLogout.disabled = false;
      }
      clearClientSessionState();
      showAuthScreen();
    }
  });
}

init();
