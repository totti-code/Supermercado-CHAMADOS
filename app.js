const state = {
  session: null,
  profile: null,
  ticketWhatsAppTarget: null,
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
  queueMetrics: {
    globalOpenCount: 0,
    myPositions: {}
  },
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
  },
  mobileFilterPanels: {
    tickets: false,
    stores: false,
    types: false
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

const MENU_ADMIN_GROUPS = [
  {
    title: 'Principal',
    items: ['dashboard', 'tickets', 'reports']
  },
  {
    title: 'Administracao',
    items: ['stores', 'checkouts', 'types', 'users', 'settings']
  }
];

const UI_STORAGE_KEY = 'supermercado_chamados_ui_v1';
const TICKET_SELECT_QUERY = `
  *,
  loja:lojas(id,nome,codigo),
  caixa:caixas(id,nome,setor),
  tipo:tipos_chamado(id,nome),
  usuario:usuarios(id,nome,email,telefone)
`;
const TICKET_STATUS_LABELS = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando_retorno: 'Aguardando retorno',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
  cancelado: 'Cancelado'
};
const TICKET_PRIORITY_LABELS = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica'
};
const COMPLETED_TICKET_STATUSES = ['resolvido', 'fechado', 'cancelado'];
const ACTIVE_TICKET_FILTER_OPTIONS = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando_retorno', label: 'Aguardando retorno' }
];
const HISTORY_TICKET_FILTER_OPTIONS = [
  { value: 'resolvido', label: 'Resolvido' },
  { value: 'cancelado', label: 'Cancelado' }
];

const el = {
  authView: document.getElementById('auth-view'),
  appView: document.getElementById('app-view'),
  sidebar: document.getElementById('sidebar'),
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
  navOverlay: document.getElementById('nav-overlay'),
  toastDialog: document.getElementById('toast-dialog'),
  toastDialogBody: document.getElementById('toast-dialog-body'),
  customDialog: document.getElementById('custom-dialog'),
  customDialogForm: document.getElementById('custom-dialog-form'),
  customDialogTitle: document.getElementById('custom-dialog-title'),
  customDialogMessage: document.getElementById('custom-dialog-message'),
  customDialogFields: document.getElementById('custom-dialog-fields'),
  customDialogCancel: document.getElementById('custom-dialog-cancel'),
  customDialogConfirm: document.getElementById('custom-dialog-confirm')
};

const customDialogState = {
  resolver: null,
  fields: [],
  result: { confirmed: false, values: {} }
};

let toastTimer = null;

function normalizeDialogState(dialog) {
  if (!dialog) return;
  if (dialog.open) {
    try {
      dialog.close();
    } catch (error) {
      dialog.removeAttribute('open');
    }
  }
  dialog.returnValue = '';
}

function readUiPrefs() {
  try {
    return JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) || '{}');
  } catch (error) {
    console.warn('Nao foi possivel ler preferencias da interface.', error);
    return {};
  }
}

function writeUiPrefs(patch) {
  try {
    const current = readUiPrefs();
    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch (error) {
    console.warn('Nao foi possivel salvar preferencias da interface.', error);
  }
}

function restoreUiPrefs() {
  const prefs = readUiPrefs();
  if (prefs.theme === 'light') {
    document.body.classList.add('theme-light');
  }

  if (typeof prefs.lastView === 'string' && prefs.lastView) {
    state.currentView = prefs.lastView;
  }

  if (prefs.adminTickets && typeof prefs.adminTickets === 'object') {
    state.adminUi.tickets = {
      tab: prefs.adminTickets.tab === 'history' ? 'history' : 'active',
      filters: {
        store: prefs.adminTickets.filters?.store || '',
        checkout: prefs.adminTickets.filters?.checkout || '',
        type: prefs.adminTickets.filters?.type || '',
        status: prefs.adminTickets.filters?.status || '',
        priority: prefs.adminTickets.filters?.priority || ''
      }
    };
  }
}

function persistTicketUiState() {
  writeUiPrefs({
    adminTickets: {
      tab: state.adminUi.tickets.tab,
      filters: { ...state.adminUi.tickets.filters }
    }
  });
}

function persistCurrentView() {
  writeUiPrefs({ lastView: state.currentView });
}

async function copyText(text, successMessage = 'Copiado.') {
  const value = String(text || '').trim();
  if (!value) {
    showToast('Nada para copiar.', 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    showToast(successMessage);
  } catch (error) {
    showToast('Não foi possível copiar.', 'error');
  }
}

function getTopOpenDialog() {
  const openDialogs = [...document.querySelectorAll('dialog[open]')];
  return openDialogs.length ? openDialogs[openDialogs.length - 1] : null;
}

function removeToastOverlays() {
  document.querySelectorAll('.toast-modal-overlay').forEach(node => node.remove());
}

function closeBlockingDialogs() {
  removeToastOverlays();

  if (el.toastDialog?.open) {
    try {
      el.toastDialog.close();
    } catch (error) {
      el.toastDialog.removeAttribute('open');
    }
  }

  [el.customDialog, el.ticketModal, el.detailsModal].forEach(dialog => {
    if (!dialog?.open) return;
    try {
      dialog.close();
    } catch (error) {
      dialog.removeAttribute('open');
    }
  });

  if (el.customDialog) {
    resetCustomDialogUi();
  }
}

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
  state.ticketWhatsAppTarget = null;
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
  if (toastTimer) {
    window.clearTimeout(toastTimer);
    toastTimer = null;
  }

  removeToastOverlays();

  const topDialog = getTopOpenDialog();
  if (topDialog) {
    const overlay = document.createElement('div');
    overlay.className = 'toast-modal-overlay';

    const node = document.createElement('div');
    node.className = `toast ${type === 'error' ? 'error' : ''}`;
    node.textContent = msg;

    overlay.appendChild(node);
    topDialog.appendChild(overlay);

    toastTimer = window.setTimeout(() => {
      overlay.remove();
    }, 3500);
    return;
  }

  if (el.toastDialog && el.toastDialogBody) {
    el.toastDialogBody.className = `toast-dialog-body ${type === 'error' ? 'error' : 'ok'}`;
    el.toastDialogBody.textContent = msg;

    if (!el.toastDialog.open) {
      el.toastDialog.show();
    }

    toastTimer = window.setTimeout(() => {
      if (el.toastDialog.open) {
        el.toastDialog.close();
      }
    }, 3500);
    return;
  }

  const container = document.getElementById('toast-container');
  const node = document.createElement('div');
  node.className = `toast ${type === 'error' ? 'error' : ''}`;
  node.textContent = msg;
  container.appendChild(node);
  setTimeout(() => node.remove(), 3500);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDialogField(field) {
  const label = escapeHtml(field.label || '');
  const name = escapeHtml(field.name);
  const value = field.value ?? '';
  const required = field.required ? 'required' : '';
  const placeholder = field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : '';

  if (field.type === 'select') {
    const options = (field.options || [])
      .map(option => `
        <option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? 'selected' : ''}>
          ${escapeHtml(option.label)}
        </option>
      `)
      .join('');

    return `
      <label>
        ${label}
        <select name="${name}" ${required}>${options}</select>
      </label>
    `;
  }

  if (field.type === 'textarea') {
    return `
      <label>
        ${label}
        <textarea name="${name}" rows="${field.rows || 3}" ${required} ${placeholder}>${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  if (field.type === 'checkbox') {
    return `
      <label class="checkbox-field">
        <input type="checkbox" name="${name}" ${value ? 'checked' : ''} />
        <span>${label}</span>
      </label>
    `;
  }

  return `
    <label>
      ${label}
      <input
        type="${field.type || 'text'}"
        name="${name}"
        value="${escapeHtml(value)}"
        ${required}
        ${placeholder}
        ${field.minLength ? `minlength="${field.minLength}"` : ''}
      />
    </label>
  `;
}

function closeCustomDialog(result = { confirmed: false, values: {} }) {
  customDialogState.result = result;
  if (el.customDialog) {
    normalizeDialogState(el.customDialog);
  }
}

function resetCustomDialogUi() {
  customDialogState.fields = [];
  customDialogState.result = { confirmed: false, values: {} };
  if (el.customDialogForm) el.customDialogForm.reset();
  if (el.customDialogTitle) el.customDialogTitle.textContent = 'Confirmar ação';
  if (el.customDialogMessage) {
    el.customDialogMessage.textContent = '';
    el.customDialogMessage.classList.add('hidden');
  }
  if (el.customDialogFields) el.customDialogFields.innerHTML = '';
  if (el.customDialogCancel) {
    el.customDialogCancel.textContent = 'Cancelar';
    el.customDialogCancel.className = 'btn btn-ghost btn-sm';
    el.customDialogCancel.classList.remove('hidden');
  }
  if (el.customDialogConfirm) {
    el.customDialogConfirm.textContent = 'Confirmar';
    el.customDialogConfirm.className = 'btn btn-primary btn-sm';
  }
  if (el.customDialog) {
    el.customDialog.returnValue = '';
  }
}

function readCustomDialogValues() {
  const formData = new FormData(el.customDialogForm);
  const values = {};
  customDialogState.fields.forEach(field => {
    if (field.type === 'checkbox') {
      values[field.name] = el.customDialogForm.elements[field.name].checked;
      return;
    }
    values[field.name] = (formData.get(field.name) ?? '').toString().trim();
  });
  return values;
}

function openCustomDialog({
  title,
  message = '',
  fields = [],
  confirmText = 'Salvar',
  cancelText = 'Cancelar',
  confirmClass = 'btn btn-primary',
  showCancel = true
}) {
  customDialogState.fields = fields;
  customDialogState.result = { confirmed: false, values: {} };

  el.customDialogTitle.textContent = title;
  el.customDialogMessage.textContent = message;
  el.customDialogMessage.classList.toggle('hidden', !message);
  el.customDialogFields.innerHTML = fields.map(buildDialogField).join('');
  el.customDialogCancel.textContent = cancelText;
  el.customDialogCancel.classList.toggle('hidden', !showCancel);
  el.customDialogConfirm.textContent = confirmText;
  el.customDialogConfirm.className = confirmClass;

  return new Promise(resolve => {
    const showDialog = () => {
      customDialogState.resolver = resolve;
      requestAnimationFrame(() => {
        if (!el.customDialog.open) {
          el.customDialog.returnValue = '';
          el.customDialog.showModal();
        }
      });
    };

    if (el.customDialog.open) {
      const reopenAfterClose = () => {
        el.customDialog.removeEventListener('close', reopenAfterClose);
        showDialog();
      };
      el.customDialog.addEventListener('close', reopenAfterClose);
      normalizeDialogState(el.customDialog);
      return;
    }

    showDialog();
  });
}

async function refreshCurrentView() {
  closeBlockingDialogs();
  await reloadAll();
  await renderView();
}

function getTicketSource() {
  return state.allTickets.length ? state.allTickets : state.tickets;
}

function findTicketById(ticketId) {
  return getTicketSource().find(ticket => String(ticket.id) === String(ticketId)) || null;
}

async function fetchTicketById(ticketId) {
  return safeQuery(
    sb.from('chamados').select(TICKET_SELECT_QUERY).eq('id', ticketId).maybeSingle()
  );
}

async function showConfirmDialog({ title, message, confirmText = 'Confirmar', confirmClass = 'btn btn-primary' }) {
  const result = await openCustomDialog({
    title,
    message,
    confirmText,
    confirmClass,
    fields: []
  });
  return result.confirmed;
}

async function confirmAction({
  title,
  message,
  confirmText = 'Confirmar',
  confirmClass = 'btn btn-primary'
}) {
  return showConfirmDialog({
    title,
    message,
    confirmText,
    confirmClass
  });
}

function initCustomDialog() {
  if (!el.customDialog || !el.customDialogForm) return;

  el.customDialogForm.addEventListener('submit', event => {
    event.preventDefault();
    closeCustomDialog({
      confirmed: true,
      values: readCustomDialogValues()
    });
  });

  el.customDialogCancel.addEventListener('click', () => {
    closeCustomDialog({ confirmed: false, values: {} });
  });

  el.customDialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeCustomDialog({ confirmed: false, values: {} });
  });

  el.customDialog.addEventListener('close', () => {
    const resolver = customDialogState.resolver;
    if (resolver) {
      customDialogState.resolver = null;
      resolver(customDialogState.result);
    }
    resetCustomDialogUi();
  });
}

function fmtDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function badgeStatus(s) {
  return `<span class="badge b-status-${s}">${TICKET_STATUS_LABELS[s] || s}</span>`;
}

function badgePriority(p) {
  return `<span class="badge b-prioridade-${p}">${TICKET_PRIORITY_LABELS[p] || p}</span>`;
}

function badgeActive(active) {
  return `<span class="badge ${active ? 'b-ativo' : 'b-inativo'}">${active ? 'Ativo' : 'Inativo'}</span>`;
}

function isCompletedStatus(status) {
  return COMPLETED_TICKET_STATUSES.includes(status);
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function sanitizePhoneNumber(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeWhatsAppNumber(value) {
  let digits = sanitizePhoneNumber(value);
  if (!digits) return '';

  digits = digits.replace(/^00+/, '');
  digits = digits.replace(/^0+/, '');

  while (digits.startsWith('55') && digits.length > 13) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('550') && digits.length >= 13) {
    digits = `55${digits.slice(3)}`;
  }

  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  return digits;
}

function isValidBrazilWhatsAppNumber(value) {
  const digits = normalizeWhatsAppNumber(value);
  return /^55\d{10,11}$/.test(digits);
}

function formatWhatsAppInputValue(value) {
  const digits = normalizeWhatsAppNumber(value);
  if (!digits) return '';

  const country = digits.slice(0, 2);
  const ddd = digits.slice(2, 4);
  const number = digits.slice(4);

  if (!ddd) return `+${country}`;
  if (number.length <= 4) return `+${country} (${ddd}) ${number}`.trim();
  if (number.length <= 8) return `+${country} (${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`.trim();
  return `+${country} (${ddd}) ${number.slice(0, 5)}-${number.slice(5, 9)}`.trim();
}

function initPhoneInputFormatting() {
  const formatInput = input => {
    if (!input || input.type !== 'tel') return;
    input.value = formatWhatsAppInputValue(input.value);
  };

  document.addEventListener('input', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'tel') return;
    formatInput(input);
  });

  document.addEventListener('blur', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'tel') return;
    formatInput(input);
  }, true);

  document.querySelectorAll('input[type="tel"]').forEach(formatInput);
}

function formatPhoneDisplay(value) {
  const digits = normalizeWhatsAppNumber(value);
  return digits || '-';
}

function getTicketUserPhone(ticket) {
  const directPhone = normalizeWhatsAppNumber(ticket?.usuario?.telefone);
  if (directPhone) return directPhone;

  const lookupUser = state.lookups.users.find(user => String(user.id) === String(ticket?.usuario_id));
  const lookupPhone = normalizeWhatsAppNumber(lookupUser?.telefone);
  if (lookupPhone) return lookupPhone;

  if (String(ticket?.usuario_id) === String(state.profile?.id)) {
    const profilePhone = normalizeWhatsAppNumber(state.profile?.telefone);
    if (profilePhone) return profilePhone;
  }

  return '';
}

function getFixedTicketWhatsAppTarget() {
  const phone = normalizeWhatsAppNumber(state.ticketWhatsAppTarget?.whatsapp_chamados_destino);
  if (!phone) return null;
  return {
    id: state.ticketWhatsAppTarget.id || null,
    nome: state.ticketWhatsAppTarget.nome || 'Admin',
    whatsapp_chamados_destino: phone
  };
}

function syncTicketWhatsAppOption() {
  const button = el.ticketForm?.querySelector('button[type="submit"]');
  if (!button) return;

  const target = getFixedTicketWhatsAppTarget();
  button.disabled = !target;
  button.title = target ? '' : 'Cadastre o WhatsApp fixo do admin nas configurações.';
}

function buildStatusWhatsAppMessage(ticket, status) {
  const ticketNumber = ticket.numero_chamado || ticket.id;
  const requesterName = ticket.usuario?.nome || 'Solicitante';
  const storeName = ticket.loja?.nome || 'Loja não informada';
  const checkoutName = ticket.caixa?.nome || 'Equipamento/Setor não informado';
  const checkoutSector = ticket.caixa?.setor ? ` (${ticket.caixa.setor})` : '';
  const typeName = ticket.tipo?.nome || 'Tipo não informado';
  const title = ticket.titulo || 'Sem título';
  const description = ticket.descricao || 'Sem detalhes adicionais.';
  const intro = status === 'aguardando_retorno'
    ? 'Seu chamado está aguardando retorno.'
    : 'Seu chamado foi marcado como resolvido.';
  const closing = status === 'aguardando_retorno'
    ? 'Por favor, responda esta mensagem com o retorno solicitado para continuarmos o atendimento.'
    : '';

  return [
    `Olá, ${requesterName}!`,
    '',
    intro,
    '',
    `Número: ${ticketNumber}`,
    `Loja: ${storeName}`,
    `Equipamento/Setor: ${checkoutName}${checkoutSector}`,
    `Tipo: ${typeName}`,
    `Título: ${title}`,
    `Detalhes informados: ${description}`,
    ...(closing ? ['', closing] : [])
  ].join('\n');
}

function buildStartServiceWhatsAppMessage(ticket, customMessage) {
  const ticketNumber = ticket.numero_chamado || ticket.id;
  const requesterName = ticket.usuario?.nome || 'Solicitante';
  const storeName = ticket.loja?.nome || 'Loja não informada';
  const checkoutName = ticket.caixa?.nome || 'Equipamento/Setor não informado';
  const checkoutSector = ticket.caixa?.setor ? ` (${ticket.caixa.setor})` : '';
  const typeName = ticket.tipo?.nome || 'Tipo não informado';
  const title = ticket.titulo || 'Sem título';
  const description = ticket.descricao || 'Sem detalhes adicionais.';

  return [
    `Olá, ${requesterName}!`,
    '',
    'Seu chamado entrou em atendimento.',
    '',
    `Número: ${ticketNumber}`,
    `Loja: ${storeName}`,
    `Equipamento/Setor: ${checkoutName}${checkoutSector}`,
    `Tipo: ${typeName}`,
    `Título: ${title}`,
    `Detalhes informados: ${description}`,
    '',
    `Mensagem do atendimento: ${customMessage}`
  ].join('\n');
}

function buildNewTicketWhatsAppMessage(ticket) {
  const ticketNumber = ticket.numero_chamado || ticket.id;
  const requesterName = ticket.usuario?.nome || state.profile?.nome || 'Solicitante';
  const requesterPhone = getTicketUserPhone(ticket) || normalizeWhatsAppNumber(state.profile?.telefone);
  const storeName = ticket.loja?.nome || 'Loja não informada';
  const checkoutName = ticket.caixa?.nome || 'Equipamento/Setor não informado';
  const checkoutSector = ticket.caixa?.setor ? ` (${ticket.caixa.setor})` : '';
  const typeName = ticket.tipo?.nome || 'Tipo não informado';
  const title = ticket.titulo || 'Sem título';
  const description = ticket.descricao || 'Sem detalhes adicionais.';

  return [
    'Novo chamado aberto no sistema.',
    '',
    `Número: ${ticketNumber}`,
    `Solicitante: ${requesterName}`,
    `Telefone: ${requesterPhone || 'Não informado'}`,
    `Loja: ${storeName}`,
    `Equipamento/Setor: ${checkoutName}${checkoutSector}`,
    `Tipo: ${typeName}`,
    `Título: ${title}`,
    `Descrição: ${description}`
  ].join('\n');
}

function buildWhatsAppUrl(phone, message) {
  const digits = normalizeWhatsAppNumber(phone);
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

async function logWhatsAppNotification(ticket, phone, message, status, recipientUserId = null) {
  const { error } = await sb.from('notificacoes_whatsapp').insert({
    chamado_id: ticket.id,
    usuario_id: recipientUserId || ticket.usuario_id || null,
    enviado_por: state.profile?.id || null,
    telefone: normalizeWhatsAppNumber(phone),
    mensagem: message,
    status_chamado: status
  });

  if (error) {
    console.error(error);
    showToast(error.message, 'error');
    return null;
  }

  return { ok: true };
}

async function sendNewTicketWhatsApp({ inserted, payload }) {
  if (el.ticketModal?.open) {
    try {
      el.ticketModal.close();
    } catch (error) {
      el.ticketModal.removeAttribute('open');
    }
  }

  const targetAdmin = getFixedTicketWhatsAppTarget();
  if (!targetAdmin) {
    showToast(`Chamado ${inserted.numero_chamado || inserted.id} criado, mas nenhum WhatsApp fixo foi configurado por um admin.`, 'error');
    return false;
  }

  const ticketForWhatsApp = {
    ...inserted,
    loja: state.lookups.stores.find(store => String(store.id) === String(payload.loja_id)) || null,
    caixa: state.lookups.checkouts.find(checkout => String(checkout.id) === String(payload.caixa_id)) || null,
    tipo: state.lookups.types.find(type => String(type.id) === String(payload.tipo_chamado_id)) || null,
    usuario: state.lookups.users.find(user => String(user.id) === String(payload.usuario_id)) || state.profile || null
  };
  const whatsappMessage = buildNewTicketWhatsAppMessage(ticketForWhatsApp);
  const notificationLogged = await logWhatsAppNotification(
    ticketForWhatsApp,
    targetAdmin.whatsapp_chamados_destino,
    whatsappMessage,
    'aberto',
    targetAdmin.id
  );

  if (notificationLogged) {
    window.open(buildWhatsAppUrl(targetAdmin.whatsapp_chamados_destino, whatsappMessage), '_blank', 'noopener');
    showToast(`Chamado ${inserted.numero_chamado || inserted.id} criado e WhatsApp preparado.`);
    return true;
  } else {
    showToast(`Chamado ${inserted.numero_chamado || inserted.id} criado, mas o registro do WhatsApp falhou.`, 'error');
    return false;
  }
}

async function submitNewTicket(payload, { afterSuccess = null } = {}) {
  if (!payload.loja_id || !payload.caixa_id || !payload.tipo_chamado_id || !payload.titulo || !payload.descricao) {
    showToast('Preencha os campos obrigatórios', 'error');
    return false;
  }

  if (!getFixedTicketWhatsAppTarget()) {
    showToast('Cadastre o WhatsApp fixo do admin nas configurações antes de abrir o chamado.', 'error');
    return false;
  }

  const confirmed = await confirmAction({
    title: 'Enviar WhatsApp',
    message: `O chamado só será salvo após o envio do WhatsApp.\n\nConfirmar envio do chamado "${payload.titulo}"?`,
    confirmText: 'Enviar WhatsApp'
  });
  if (!confirmed) return false;

  const inserted = await safeQuery(sb.from('chamados').insert(payload).select().single());
  if (!inserted) return false;

  const whatsappSent = await sendNewTicketWhatsApp({ inserted, payload });
  if (!whatsappSent) return false;

  if (typeof afterSuccess === 'function') {
    await afterSuccess(inserted);
  }

  return true;
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
  const [stores, checkouts, types, users, ticketWhatsAppTarget] = await Promise.all([
    safeQuery(sb.from('lojas').select('*').order('nome')),
    safeQuery(sb.from('caixas').select('*').order('nome')),
    safeQuery(sb.from('tipos_chamado').select('*').order('nome')),
    safeQuery(sb.from('usuarios').select('*').order('nome')),
    safeQuery(sb.rpc('get_ticket_whatsapp_target').maybeSingle())
  ]);

  state.lookups.stores = stores || [];
  state.lookups.checkouts = checkouts || [];
  state.lookups.types = types || [];
  state.lookups.users = users || [];
  state.ticketWhatsAppTarget = ticketWhatsAppTarget || null;

  hydrateStoreSelects();
}

async function loadPublicRegisterStores() {
  const stores = await safeQuery(sb.from('lojas').select('id,nome').order('nome'));
  state.lookups.stores = stores || [];
  hydrateStoreSelects();
}

function hydrateStoreSelects() {
  const storeOptions = ['<option value="">Selecione</option>']
    .concat(state.lookups.stores.map(s => `<option value="${s.id}">${s.nome}</option>`))
    .join('');
  const registerStoreOptions = ['<option value="">Selecione uma loja</option>']
    .concat(state.lookups.stores.map(store => `<option value="${store.id}">${store.nome}</option>`))
    .join('');

  document.getElementById('ticket-store').innerHTML = storeOptions;
  document.getElementById('register-store').innerHTML = registerStoreOptions;
  document.getElementById('register-store').disabled = !state.lookups.stores.length;

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
    telefone: sanitizePhoneNumber(sessionUser.user_metadata?.telefone || ''),
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

function updateNavStateUi() {
  const desktop = isDesktopNav();
  const isOpen = desktop || document.body.classList.contains('nav-open');

  document.body.classList.toggle('nav-desktop', desktop);
  document.body.classList.toggle('nav-mobile-open', !desktop && isOpen);

  if (el.btnNavToggle) {
    el.btnNavToggle.setAttribute('aria-expanded', String(isOpen));
    el.btnNavToggle.setAttribute('aria-label', !desktop && isOpen ? 'Fechar menu de navegacao' : 'Abrir menu de navegacao');
  }

  if (el.navOverlay) {
    el.navOverlay.setAttribute('aria-hidden', String(!(!desktop && isOpen)));
  }

  if (el.sidebar) {
    el.sidebar.setAttribute('aria-hidden', String(!desktop && !isOpen));
  }
}

function setNavOpen(open) {
  if (isDesktopNav()) {
    document.body.classList.add('nav-open');
    updateNavStateUi();
    return;
  }
  document.body.classList.toggle('nav-open', !!open);
  updateNavStateUi();
}

function syncMenuState() {
  if (isDesktopNav()) {
    document.body.classList.add('nav-open');
  } else {
    document.body.classList.remove('nav-open');
  }
  updateNavStateUi();
}

function isMobileViewport() {
  return window.innerWidth <= 980;
}

function renderFilterAccordion(panelId, innerHtml, extraClass = '') {
  const expanded = !isMobileViewport() || !!state.mobileFilterPanels[panelId];
  const wrapperClass = ['filter-accordion', extraClass, expanded ? 'is-open' : '']
    .filter(Boolean)
    .join(' ');

  return `
    <section class="${wrapperClass}" data-filter-panel="${panelId}">
      <button
        type="button"
        class="filter-accordion-toggle"
        data-filter-toggle="${panelId}"
        aria-expanded="${expanded}"
        aria-controls="filter-panel-${panelId}"
      >
        <span>Filtro</span>
        <span class="filter-accordion-icon" aria-hidden="true"></span>
      </button>
      <div
        id="filter-panel-${panelId}"
        class="filter-accordion-content"
        ${expanded ? '' : 'hidden'}
      >
        <div class="filter-accordion-inner">
          ${innerHtml}
        </div>
      </div>
    </section>
  `;
}

function bindFilterAccordions(scope = document) {
  scope.querySelectorAll('[data-filter-toggle]').forEach(toggle => {
    if (toggle.dataset.filterBound === 'true') return;
    toggle.dataset.filterBound = 'true';

    toggle.addEventListener('click', () => {
      const panelId = toggle.dataset.filterToggle;
      const wrapper = scope.querySelector(`[data-filter-panel="${panelId}"]`);
      if (!wrapper || !isMobileViewport()) return;

      const content = wrapper.querySelector('.filter-accordion-content');
      const willOpen = !wrapper.classList.contains('is-open');
      wrapper.classList.toggle('is-open', willOpen);
      toggle.setAttribute('aria-expanded', String(willOpen));
      state.mobileFilterPanels[panelId] = willOpen;

      if (content) {
        if (willOpen) {
          content.hidden = false;
          requestAnimationFrame(() => {
            content.style.maxHeight = `${content.scrollHeight}px`;
          });
        } else {
          content.style.maxHeight = `${content.scrollHeight}px`;
          requestAnimationFrame(() => {
            content.style.maxHeight = '0px';
          });
          window.setTimeout(() => {
            if (!wrapper.classList.contains('is-open')) {
              content.hidden = true;
            }
          }, 260);
        }
      }
    });
  });

  scope.querySelectorAll('.filter-accordion').forEach(wrapper => {
    const panelId = wrapper.dataset.filterPanel;
    const content = wrapper.querySelector('.filter-accordion-content');
    const toggle = wrapper.querySelector('[data-filter-toggle]');
    if (!content || !toggle) return;

    const expanded = !isMobileViewport() || !!state.mobileFilterPanels[panelId];
    wrapper.classList.toggle('is-open', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    content.hidden = !expanded;
    content.style.maxHeight = expanded ? (isMobileViewport() ? `${content.scrollHeight}px` : 'none') : '0px';
  });
}

function mountMenu() {
  state.menu = isAdmin() ? MENU_ADMIN : MENU_FUNC;
  if (!el.menuNav) return;

  if (isAdmin()) {
    const byId = new Map(state.menu.map(item => [item.id, item]));
    el.menuNav.innerHTML = MENU_ADMIN_GROUPS.map(group => {
      const items = group.items
        .map(id => byId.get(id))
        .filter(Boolean)
        .map(item => `<button class="nav-btn ${item.id === state.currentView ? 'active' : ''}" data-view="${item.id}">${item.label}</button>`)
        .join('');

      if (!items) return '';

      return `
        <section class="nav-group" aria-label="${group.title}">
          <p class="nav-group-title">${group.title}</p>
          <div class="nav-group-items">
            ${items}
          </div>
        </section>
      `;
    }).join('');
    return;
  }

  el.menuNav.innerHTML = state.menu
    .map(item => `<button class="nav-btn ${item.id === state.currentView ? 'active' : ''}" data-view="${item.id}">${item.label}</button>`)
    .join('');
}

async function openCurrentView(viewId) {
  state.currentView = viewId;
  persistCurrentView();
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
  let query = sb.from('chamados').select(TICKET_SELECT_QUERY).order('created_at', { ascending: false });

  const data = await safeQuery(query);
  const rows = data || [];
  state.allTickets = rows;
  state.tickets = rows;
  return state.tickets;
}

async function loadQueueMetrics() {
  if (!state.profile) return;

  if (isAdmin()) {
    const queue = getOpenQueueTickets();
    state.queueMetrics.globalOpenCount = queue.length;
    state.queueMetrics.myPositions = Object.fromEntries(
      queue
        .filter(ticket => String(ticket.usuario_id) === String(state.profile?.id))
        .map((ticket, index) => [String(ticket.id), index + 1])
    );
    return;
  }

  const [globalCountResult, myPositionsResult] = await Promise.all([
    safeQuery(sb.rpc('get_global_open_ticket_count')),
    safeQuery(sb.rpc('get_my_open_ticket_queue_positions'))
  ]);

  state.queueMetrics.globalOpenCount = Number(globalCountResult || 0);
  state.queueMetrics.myPositions = Object.fromEntries(
    (myPositionsResult || []).map(row => [String(row.ticket_id), Number(row.queue_position)])
  );
}

function getTicketRowsForView() {
  const source = getTicketSource();
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

function getOpenQueueTickets() {
  const source = getTicketSource();
  return source
    .filter(ticket => ticket.status === 'aberto')
    .slice()
    .sort((a, b) => {
      const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (timeDiff !== 0) return timeDiff;
      return Number(a.id) - Number(b.id);
    });
}

function getTicketQueuePosition(ticketId) {
  if (!isAdmin() && state.queueMetrics.myPositions) {
    const mappedPosition = state.queueMetrics.myPositions[String(ticketId)];
    if (mappedPosition) return mappedPosition;
  }
  const queue = getOpenQueueTickets();
  const index = queue.findIndex(ticket => String(ticket.id) === String(ticketId));
  return index >= 0 ? index + 1 : null;
}

function renderQueueInfo(ticket) {
  const position = getTicketQueuePosition(ticket.id);
  if (!position) return ticket.status === 'aberto' ? 'Aguardando posição' : 'Fora da fila';
  return `${position}º na fila`;
}

async function deleteTicketById(ticketId, options = {}) {
  const { closeDetails = false } = options;
  const ticket = findTicketById(ticketId);
  if (!ticket) {
    showToast('Chamado não encontrado.', 'error');
    return;
  }

  const confirmed = await showConfirmDialog({
    title: 'Excluir chamado',
    message: `Excluir o chamado ${ticket.numero_chamado || ticket.id}? Essa ação não poderá ser desfeita.`,
    confirmText: 'Excluir',
    confirmClass: 'btn btn-danger'
  });
  if (!confirmed) return;

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

  if (closeDetails && el.detailsModal.open) {
    el.detailsModal.close();
  }

  await refreshCurrentView();
}

async function startTicketService(ticketId) {
  if (!isAdmin()) return;

  const ticket = findTicketById(ticketId);
  if (!ticket) {
    showToast('Chamado não encontrado.', 'error');
    return;
  }

  if (ticket.status !== 'aberto') {
    showToast('Só é possível iniciar atendimento de chamados abertos.', 'error');
    return;
  }

  const ticketUserPhone = getTicketUserPhone(ticket);
  if (!ticketUserPhone) {
    showToast('O usuário deste chamado não possui telefone cadastrado.', 'error');
    return;
  }

  const result = await openCustomDialog({
    title: 'Iniciar atendimento',
    message: `Informe a mensagem que será enviada no WhatsApp para o chamado ${ticket.numero_chamado || ticket.id}.`,
    confirmText: 'Iniciar atendimento',
    fields: [
      {
        name: 'mensagem',
        label: 'Mensagem para WhatsApp',
        type: 'textarea',
        rows: 4,
        required: true,
        placeholder: 'Ex: Olá, iniciei o atendimento do seu chamado e já estou verificando o equipamento.'
      }
    ]
  });
  if (!result.confirmed) return;

  const message = result.values.mensagem;
  if (!message) {
    showToast('Informe uma mensagem para enviar no WhatsApp.', 'error');
    return;
  }
  const whatsappMessage = buildStartServiceWhatsAppMessage(ticket, message);

  const updated = await safeQuery(
    sb.from('chamados').update({ status: 'em_andamento' }).eq('id', ticket.id).select().single()
  );
  if (!updated) return;

  await safeQuery(sb.rpc('add_ticket_observation', {
    p_chamado_id: ticket.id,
    p_texto: `Atendimento iniciado. Mensagem enviada no WhatsApp: ${message}`
  }));

  window.open(buildWhatsAppUrl(ticketUserPhone, whatsappMessage), '_blank', 'noopener');
  showToast('Atendimento iniciado e WhatsApp preparado.');
  await refreshCurrentView();
}

async function openTicketStatusDialog(ticketId) {
  if (!isAdmin()) return;

  const ticket = findTicketById(ticketId);
  if (!ticket) {
    showToast('Chamado não encontrado.', 'error');
    return;
  }

  const result = await openCustomDialog({
    title: `Alterar status do chamado ${ticket.numero_chamado || ticket.id}`,
    message: ticket.titulo || 'Atualize o andamento e a prioridade do chamado.',
    confirmText: 'Salvar alterações',
    fields: [
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        value: ticket.status === 'fechado' ? 'resolvido' : (ticket.status || 'aberto'),
        options: [
          { value: 'aberto', label: 'Aberto' },
          { value: 'em_andamento', label: 'Em andamento' },
          { value: 'aguardando_retorno', label: 'Aguardando retorno' },
          { value: 'resolvido', label: 'Resolvido' },
          { value: 'cancelado', label: 'Cancelado' }
        ]
      },
      {
        name: 'prioridade',
        label: 'Prioridade',
        type: 'select',
        value: ticket.prioridade || 'baixa',
        options: [
          { value: 'baixa', label: 'Baixa' },
          { value: 'media', label: 'Média' },
          { value: 'alta', label: 'Alta' },
          { value: 'critica', label: 'Crítica' }
        ]
      }
    ]
  });

  if (!result.confirmed) return;

  const nextStatus = result.values.status;
  const nextPriority = result.values.prioridade;
  if (nextStatus === ticket.status && nextPriority === (ticket.prioridade || 'baixa')) {
    showToast('Altere o status ou a prioridade antes de salvar.', 'error');
    return;
  }

  let whatsappDecision = null;
  let whatsappPhone = '';
  let whatsappMessage = '';
  const ticketUserPhone = getTicketUserPhone(ticket);

  if ((nextStatus === 'resolvido' || nextStatus === 'aguardando_retorno') && nextStatus !== ticket.status) {
    if (!ticketUserPhone) {
      return showToast('O usuário deste chamado não possui telefone cadastrado.', 'error');
    }

    const confirmTitle = nextStatus === 'aguardando_retorno'
      ? 'Enviar WhatsApp de retorno'
      : 'Enviar WhatsApp';
    const confirmMessage = nextStatus === 'aguardando_retorno'
      ? `Usar o telefone cadastrado ${ticketUserPhone} para abrir o WhatsApp após salvar o chamado como aguardando retorno?`
      : `Usar o telefone cadastrado ${ticketUserPhone} para abrir o WhatsApp após salvar o chamado como resolvido?`;

    const sendWhatsApp = await showConfirmDialog({
      title: confirmTitle,
      message: confirmMessage,
      confirmText: 'Sim, abrir WhatsApp',
      confirmClass: 'btn btn-primary'
    });

    whatsappDecision = { values: { enviar_whatsapp: sendWhatsApp } };
    if (sendWhatsApp) {
      whatsappPhone = ticketUserPhone;
      whatsappMessage = buildStatusWhatsAppMessage(ticket, nextStatus);
    }
  }

  const confirmed = await confirmAction({
    title: 'Atualizar chamado',
    message: `Confirmar atualização do chamado ${ticket.numero_chamado || ticket.id}?`,
    confirmText: 'Salvar alterações'
  });
  if (!confirmed) return;

  const updated = await safeQuery(
    sb.from('chamados').update({ status: nextStatus, prioridade: nextPriority }).eq('id', ticket.id).select().single()
  );
  if (!updated) return;

  if (whatsappDecision?.values?.enviar_whatsapp) {
    const notificationLogged = await logWhatsAppNotification(ticket, whatsappPhone, whatsappMessage, nextStatus);
    if (notificationLogged) {
      window.open(buildWhatsAppUrl(whatsappPhone, whatsappMessage), '_blank', 'noopener');
      showToast('Chamado atualizado e WhatsApp preparado.');
    } else {
      showToast('Chamado atualizado, mas o registro do WhatsApp falhou.', 'error');
    }
  } else {
    showToast('Chamado atualizado');
  }

  await refreshCurrentView();
}

function renderDashboard() {
  const all = state.allTickets.length ? state.allTickets : state.tickets;
  const activeTickets = all.filter(x => !isCompletedStatus(x.status));
  const canCreateTickets = !isAdmin();
  const openQueue = getOpenQueueTickets();
  const myQueuePositions = Object.values(state.queueMetrics.myPositions || {}).map(Number).filter(Boolean).sort((a, b) => a - b);
  const nextMyPosition = myQueuePositions[0] || null;
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
      <button type="button" class="kpi kpi-open" data-kpi-target="open"><span class="kpi-dot"></span><strong>${kpi.aberto}</strong><span>Abertos</span><small>Pendentes de atendimento</small></button>
      <button type="button" class="kpi kpi-progress" data-kpi-target="progress"><span class="kpi-dot"></span><strong>${kpi.andamento}</strong><span>Em andamento</span><small>Chamados em execução</small></button>
      <button type="button" class="kpi kpi-done" data-kpi-target="resolved"><span class="kpi-dot"></span><strong>${kpi.resolvido}</strong><span>Resolvidos</span><small>Finalizados com sucesso</small></button>
      <button type="button" class="kpi kpi-total" data-kpi-target="all"><span class="kpi-dot"></span><strong>${all.length}</strong><span>Total</span><small>Base geral de chamados</small></button>
    </article>

    <section class="dashboard-main">
      ${canCreateTickets ? `
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
              <label>Status
                <select id="quick-ticket-status" disabled>
                  <option value="aberto" selected>Aberto</option>
                </select>
              </label>
            </div>
            <footer class="admin-form-actions">
              <button type="submit" class="btn btn-primary btn-sm">Abrir Chamado</button>
              <button type="button" id="btn-open-ticket-modal" class="btn btn-ghost btn-sm">Modo completo</button>
            </footer>
          </form>
        </article>
        <article class="card">
          <div class="card-title-row">
            <div>
              <h3>Fila de atendimento</h3>
              <p>Veja quantos chamados abertos existem no sistema e a posição do seu próximo atendimento.</p>
            </div>
          </div>
          <div class="entity-card entity-card-ticket">
            <div class="entity-card-content">
              ${renderInfoGrid([
                ['CHAMADOS EM ABERTO(GERAL)', String(state.queueMetrics.globalOpenCount || openQueue.length)],
                ['Seus chamados abertos', String(myQueuePositions.length)],
                ['Próxima posição', nextMyPosition ? `${nextMyPosition}º na fila` : 'Sem chamados na fila']
              ])}
            </div>
          </div>
        </article>
      ` : ``}

      <aside class="recent-column">
        <article class="card">
          <div class="card-title-row">
            <div>
              <h3>Chamados recentes</h3>
              <p>Exibe apenas chamados ainda em andamento no sistema.</p>
            </div>
          </div>
          <div class="recent-list">
            ${recent.length ? recent.map(r => isAdmin() ? `
              <article class="entity-card entity-card-ticket">
                <header class="entity-card-head">
                  <div>
                    <small class="entity-card-kicker">Chamado #${r.numero_chamado || r.id}</small>
                    <h4>${r.titulo}</h4>
                    <p>${r.loja?.nome || '-'} • ${r.caixa?.nome || '-'} • ${r.tipo?.nome || '-'}</p>
                  </div>
                  <div class="entity-card-badges">
                    ${badgeStatus(r.status)}
                    ${badgePriority(r.prioridade)}
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
                  ${r.status === 'aberto' ? `<button class="btn btn-sm ticket-start-action" data-action="start-service" data-id="${r.id}">Iniciar atendimento</button>` : ''}
                  <button class="btn btn-sm btn-primary" data-action="status" data-id="${r.id}">Alterar status</button>
                  <button class="btn btn-sm btn-ghost ticket-delete-action" data-action="delete" data-id="${r.id}">Excluir</button>
                </footer>
              </article>
            ` : `
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

  el.content.querySelectorAll('[data-kpi-target]').forEach(card => {
    card.addEventListener('click', async () => {
      const target = card.dataset.kpiTarget;
      state.adminUi.tickets.filters = {
        store: '',
        checkout: '',
        type: '',
        status: '',
        priority: ''
      };

      if (target === 'open') {
        state.adminUi.tickets.tab = 'active';
        state.adminUi.tickets.filters.status = 'aberto';
      } else if (target === 'progress') {
        state.adminUi.tickets.tab = 'active';
        state.adminUi.tickets.filters.status = 'em_andamento';
      } else if (target === 'resolved') {
        state.adminUi.tickets.tab = 'history';
        state.adminUi.tickets.filters.status = 'resolvido';
      } else {
        state.adminUi.tickets.tab = 'active';
      }

      await openCurrentView('tickets');
    });
  });

  if (canCreateTickets) {
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

    if (state.profile?.loja_id) {
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
        prioridade: 'baixa',
        anexo_url: null,
        telefone_retorno: null,
        responsavel_local: null,
        status: 'aberto'
      };
      await submitNewTicket(payload, {
        afterSuccess: async () => {
          document.getElementById('quick-ticket-form').reset();
          if (state.profile?.loja_id) {
            storeSelect.value = String(state.profile.loja_id);
            storeSelect.setAttribute('disabled', 'disabled');
          }
          syncCheckouts();
          await reloadAll();
          renderDashboard();
        }
      });
    });

    document.getElementById('btn-open-ticket-modal').addEventListener('click', () => {
      el.btnOpenTicket.click();
    });
  }

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
            ['Abertura', fmtDate(r.created_at)],
            ['Fila', renderQueueInfo(r)]
          ])}
        </div>
        <footer class="entity-card-actions">
          <button class="btn btn-sm btn-ghost" data-action="open" data-id="${r.id}">Detalhes</button>
          ${isAdmin() && r.status === 'aberto' ? `<button class="btn btn-sm ticket-start-action" data-action="start-service" data-id="${r.id}">Iniciar atendimento</button>` : ''}
          ${isAdmin() ? `<button class="btn btn-sm btn-primary" data-action="status" data-id="${r.id}">Alterar status</button>` : ''}
          ${isAdmin() ? `<button class="btn btn-sm btn-ghost ticket-delete-action" data-action="delete" data-id="${r.id}">Excluir</button>` : ''}
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

function renderTicketSummaryCards(rows, isHistoryTab) {
  const summaryItems = isHistoryTab
    ? [
        ['Total no histórico', rows.length, 'kpi-total'],
        ['Resolvidos', rows.filter(row => row.status === 'resolvido').length, 'kpi-done'],
        ['Cancelados', rows.filter(row => row.status === 'cancelado').length, 'kpi-open']
      ]
    : [
        ['Total visível', rows.length, 'kpi-total'],
        ['Abertos', rows.filter(row => row.status === 'aberto').length, 'kpi-open'],
        ['Em andamento', rows.filter(row => row.status === 'em_andamento').length, 'kpi-progress'],
        ['Aguardando retorno', rows.filter(row => row.status === 'aguardando_retorno').length, 'kpi-done']
      ];

  return `
    <section class="cards-grid ticket-summary-grid">
      ${summaryItems.map(([label, value, css]) => `
        <article class="kpi ticket-summary-card ${css}">
          <span class="kpi-dot"></span>
          <strong>${value}</strong>
          <span>${label}</span>
        </article>
      `).join('')}
    </section>
  `;
}

function exportTicketRowsCsv(rows, fileLabel = 'chamados_filtrados') {
  const header = [
    'numero_chamado', 'loja', 'caixa', 'tipo', 'titulo', 'prioridade', 'status', 'abertura', 'solicitante'
  ];

  const lines = rows.map(t => [
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
  link.download = `${fileLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderTicketView() {
  const ticketUi = state.adminUi.tickets;
  const isHistoryTab = ticketUi.tab === 'history';
  const stores = ['<option value="">Todas as lojas</option>'].concat(state.lookups.stores.map(s => `<option value="${s.id}">${s.nome}</option>`)).join('');
  const checkoutNames = [...new Set(state.lookups.checkouts.map(c => c.nome).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const checkouts = ['<option value="">Todos os equipamentos/setor</option>'].concat(checkoutNames.map(name => `<option value="${name}">${name}</option>`)).join('');
  const types = ['<option value="">Todos os tipos</option>'].concat(state.lookups.types.map(t => `<option value="${t.id}">${t.nome}</option>`)).join('');
  const statusOptions = [
    `<option value="">${isHistoryTab ? 'Todos os status do histórico' : 'Todos os status ativos'}</option>`,
    ...(isHistoryTab ? HISTORY_TICKET_FILTER_OPTIONS : ACTIVE_TICKET_FILTER_OPTIONS)
      .map(option => `<option value="${option.value}" ${ticketUi.filters.status === option.value ? 'selected' : ''}>${option.label}</option>`)
  ].join('');
  const visibleRows = getTicketRowsForView();

  el.content.innerHTML = `
    <article class="card">
      <div class="card-title-row">
        <div>
          <h3>Chamados</h3>
          <p>${isHistoryTab ? 'Registro de chamados concluídos.' : 'Acompanhe apenas chamados ativos e em progresso.'}</p>
        </div>
        <button id="btn-export-visible-tickets" class="btn btn-primary btn-sm" type="button">Exportar filtrados</button>
      </div>
      <div class="ticket-tabs">
        <button class="ticket-tab ${!isHistoryTab ? 'active' : ''}" id="btn-tab-active" type="button">Chamados em aberto</button>
        <button class="ticket-tab ${isHistoryTab ? 'active' : ''}" id="btn-tab-history" type="button">Histórico</button>
      </div>
      ${renderFilterAccordion('tickets', `
        <div class="filters">
          <label class="filter-field">
            <span>Loja</span>
            <select id="f-store">${stores}</select>
          </label>
          <label class="filter-field">
            <span>Equipamento/Setor</span>
            <select id="f-checkout">${checkouts}</select>
          </label>
          <label class="filter-field">
            <span>Tipo</span>
            <select id="f-type">${types}</select>
          </label>
          <label class="filter-field">
            <span>Status</span>
            <select id="f-status">
              ${statusOptions}
            </select>
          </label>
          <label class="filter-field">
            <span>Prioridade</span>
            <select id="f-priority">
              <option value="">Todas prioridades</option>
              <option value="baixa" ${ticketUi.filters.priority === 'baixa' ? 'selected' : ''}>Baixa</option>
              <option value="media" ${ticketUi.filters.priority === 'media' ? 'selected' : ''}>Média</option>
              <option value="alta" ${ticketUi.filters.priority === 'alta' ? 'selected' : ''}>Alta</option>
              <option value="critica" ${ticketUi.filters.priority === 'critica' ? 'selected' : ''}>Crítica</option>
            </select>
          </label>
          <div class="filters-actions">
            <button id="btn-apply-filters" class="btn btn-primary btn-sm" type="button">Aplicar filtros</button>
            <button id="btn-clear-filters" class="btn btn-ghost btn-sm" type="button">Limpar</button>
          </div>
        </div>
      `)}
    </article>
    ${renderTicketSummaryCards(visibleRows, isHistoryTab)}
    <article class="card table-wrap">
      ${ticketTable(visibleRows)}
    </article>
  `;

  bindFilterAccordions(el.content);

  document.getElementById('f-store').value = ticketUi.filters.store;
  document.getElementById('f-checkout').value = ticketUi.filters.checkout;
  document.getElementById('f-type').value = ticketUi.filters.type;
  document.getElementById('btn-export-visible-tickets').addEventListener('click', () => {
    if (!visibleRows.length) {
      showToast('Nenhum chamado para exportar.', 'error');
      return;
    }
    exportTicketRowsCsv(visibleRows, isHistoryTab ? 'historico_filtrado' : 'chamados_filtrados');
  });

  document.getElementById('btn-tab-active').addEventListener('click', () => {
    state.adminUi.tickets.tab = 'active';
    state.adminUi.tickets.filters = {
      store: '',
      checkout: '',
      type: '',
      status: '',
      priority: ''
    };
    persistTicketUiState();
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
    persistTicketUiState();
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
    persistTicketUiState();
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
    persistTicketUiState();
    renderTicketView();
  });

  bindTicketRowActions();
}

function adminEntityView(title, id, rows, columns, actions) {
  el.content.innerHTML = `
    <article class="card entity-view entity-view-${id}">
      <div class="card-title-row">
        <div>
          <h3>${title}</h3>
          <p>Gerencie os registros em cards verticais com ações rápidas no final de cada item.</p>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-create-${id}">Novo</button>
      </div>
    </article>
    <article class="card entity-view entity-view-${id}">
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
            ${actions.remove ? `<button class="btn btn-sm ${row.ativo ? 'btn-warning' : 'btn-primary'}" data-entity="${id}" data-action="toggle" data-id="${row.id}">${row.ativo ? 'Inativar' : 'Ativar'}</button>` : ''}
            <button class="btn btn-sm btn-danger" data-entity="${id}" data-action="delete" data-id="${row.id}">${actions.delete ? 'Excluir' : 'Excluir/Inativar'}</button>
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
      if (btn.dataset.action === 'toggle' && actions.remove) actions.remove(row);
      if (btn.dataset.action === 'delete') (actions.delete || actions.remove)(row);
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
      ${renderFilterAccordion('stores', `
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
      `, 'filter-accordion-admin')}
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

  bindFilterAccordions(el.content);

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
      const confirmed = await confirmAction({
        title: 'Salvar edição da loja',
        message: `Confirmar atualização da loja ${nome}?`,
        confirmText: 'Salvar alterações'
      });
      if (!confirmed) return;
      const updated = await safeQuery(
        sb.from('lojas').update({ nome, codigo, observacao }).eq('id', editing.id).select().single()
      );
      if (!updated) return;
      showToast('Loja atualizada com sucesso.');
    } else {
      const confirmed = await confirmAction({
        title: 'Cadastrar loja',
        message: `Confirmar cadastro da loja ${nome}?`,
        confirmText: 'Cadastrar loja'
      });
      if (!confirmed) return;
      const created = await safeQuery(
        sb.from('lojas').insert({ nome, codigo, observacao }).select().single()
      );
      if (!created) return;
      showToast('Loja cadastrada com sucesso.');
    }

    state.adminUi.stores.editingId = null;
    await refreshCurrentView();
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
        const confirmed = await showConfirmDialog({
          title: `${row.ativo ? 'Inativar' : 'Ativar'} loja`,
          message: `Deseja ${row.ativo ? 'inativar' : 'ativar'} a loja ${row.nome}?`,
          confirmText: row.ativo ? 'Inativar' : 'Ativar',
          confirmClass: row.ativo ? 'btn btn-warning' : 'btn btn-primary'
        });
        if (!confirmed) return;
        const updated = await safeQuery(
          sb.from('lojas').update({ ativo: !row.ativo }).eq('id', row.id).select().single()
        );
        if (!updated) return;
        showToast(`Loja ${updated.ativo ? 'ativada' : 'inativada'} com sucesso.`);
        await refreshCurrentView();
        return;
      }

      const confirmed = await showConfirmDialog({
        title: 'Excluir loja',
        message: `Excluir a loja ${row.nome}? Essa ação pode falhar se houver vínculos.`,
        confirmText: 'Excluir',
        confirmClass: 'btn btn-danger'
      });
      if (!confirmed) return;
      const deleted = await safeQuery(sb.from('lojas').delete().eq('id', row.id).select().single());
      if (!deleted) return;
      showToast('Loja excluída com sucesso.');
      state.adminUi.stores.editingId = null;
      await refreshCurrentView();
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
      const result = await openCustomDialog({
        title: 'Novo equipamento/setor',
        message: 'Cadastre um modelo global para replicar nas lojas disponíveis.',
        confirmText: 'Salvar',
        fields: [
          { name: 'nome', label: 'Nome do equipamento/setor', required: true },
          { name: 'setor', label: 'Setor (opcional)' }
        ]
      });
      if (!result.confirmed || !result.values.nome) return;
      const nome = result.values.nome;
      const setor = result.values.setor || null;
      const key = checkoutKey(nome, setor);
      const inserts = state.lookups.stores
        .filter(store => !state.lookups.checkouts.some(c => c.loja_id === store.id && checkoutKey(c.nome, c.setor) === key))
        .map(store => ({ nome: nome.trim(), setor, loja_id: store.id }));

      if (!inserts.length) {
        showToast('Esse equipamento/setor já existe em todas as lojas.', 'error');
        return;
      }

      const confirmed = await confirmAction({
        title: 'Cadastrar equipamento/setor',
        message: `Confirmar cadastro de ${nome.trim()} para ${inserts.length} loja(s)?`,
        confirmText: 'Cadastrar'
      });
      if (!confirmed) return;

      const created = await safeQuery(sb.from('caixas').insert(inserts).select());
      if (!created) return;
      showToast(`Equipamento/setor cadastrado para ${created.length} loja(s).`);
      await reloadAll();
      renderCheckouts();
    },
    edit: async (row) => {
      const result = await openCustomDialog({
        title: 'Editar equipamento/setor',
        confirmText: 'Salvar alterações',
        fields: [
          { name: 'nome', label: 'Nome', required: true, value: row.nome },
          { name: 'setor', label: 'Setor', value: row.setor || '' }
        ]
      });
      if (!result.confirmed || !result.values.nome) return;
      const nome = result.values.nome;
      const setor = result.values.setor || null;
      const oldKey = checkoutKey(row.nome, row.setor);
      const relatedIds = state.lookups.checkouts
        .filter(c => checkoutKey(c.nome, c.setor) === oldKey)
        .map(c => c.id);
      const confirmed = await confirmAction({
        title: 'Salvar edição do equipamento/setor',
        message: `Confirmar atualização de ${row.nome} para ${nome.trim()}?`,
        confirmText: 'Salvar alterações'
      });
      if (!confirmed) return;
      const updated = await safeQuery(sb.from('caixas').update({ nome, setor }).in('id', relatedIds).select());
      if (!updated) return;
      showToast(`Equipamento/setor atualizado em ${updated.length} loja(s).`);
      await reloadAll();
      renderCheckouts();
    },
    remove: async (row) => {
      const confirmed = await showConfirmDialog({
        title: `${row.ativo ? 'Inativar' : 'Ativar'} equipamento/setor`,
        message: `Deseja ${row.ativo ? 'inativar' : 'ativar'} ${row.nome}?`,
        confirmText: row.ativo ? 'Inativar' : 'Ativar',
        confirmClass: row.ativo ? 'btn btn-warning' : 'btn btn-primary'
      });
      if (!confirmed) return;
      const key = checkoutKey(row.nome, row.setor);
      const relatedIds = state.lookups.checkouts
        .filter(c => checkoutKey(c.nome, c.setor) === key)
        .map(c => c.id);
      const updated = await safeQuery(sb.from('caixas').update({ ativo: !row.ativo }).in('id', relatedIds).select());
      if (!updated) return;
      showToast(`Status aplicado ao equipamento/setor em ${updated.length} loja(s).`);
      await refreshCurrentView();
    },
    delete: async (row) => {
      const confirmed = await showConfirmDialog({
        title: 'Excluir equipamento/setor',
        message: `Excluir ${row.nome} de todas as lojas? Essa ação pode falhar se houver chamados vinculados.`,
        confirmText: 'Excluir',
        confirmClass: 'btn btn-danger'
      });
      if (!confirmed) return;
      const key = checkoutKey(row.nome, row.setor);
      const relatedIds = state.lookups.checkouts
        .filter(c => checkoutKey(c.nome, c.setor) === key)
        .map(c => c.id);

      const { count: linkedTicketsCount, error: linkedTicketsError } = await sb
        .from('chamados')
        .select('id', { count: 'exact', head: true })
        .in('caixa_id', relatedIds);

      if (linkedTicketsError) {
        showToast(linkedTicketsError.message, 'error');
        return;
      }

      if ((linkedTicketsCount || 0) > 0) {
        showToast(`Não é possível excluir. Existem ${linkedTicketsCount} chamado(s) vinculado(s) a esse equipamento/setor. Use Inativar.`, 'error');
        return;
      }

      const deleted = await safeQuery(sb.from('caixas').delete().in('id', relatedIds).select());
      if (!deleted) return;
      showToast(`Equipamento/setor excluído em ${deleted.length} loja(s).`);
      await refreshCurrentView();
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
      ${renderFilterAccordion('types', `
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
      `, 'filter-accordion-admin')}
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

  bindFilterAccordions(el.content);

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
      const confirmed = await confirmAction({
        title: 'Salvar edição do tipo',
        message: `Confirmar atualização do tipo ${nome}?`,
        confirmText: 'Salvar alterações'
      });
      if (!confirmed) return;
      const updated = await safeQuery(
        sb.from('tipos_chamado').update({ nome, descricao }).eq('id', editing.id).select().single()
      );
      if (!updated) return;
      showToast('Tipo de chamado atualizado com sucesso.');
    } else {
      const confirmed = await confirmAction({
        title: 'Cadastrar tipo de chamado',
        message: `Confirmar cadastro do tipo ${nome}?`,
        confirmText: 'Cadastrar tipo'
      });
      if (!confirmed) return;
      const created = await safeQuery(
        sb.from('tipos_chamado').insert({ nome, descricao }).select().single()
      );
      if (!created) return;
      showToast('Tipo de chamado cadastrado com sucesso.');
    }

    state.adminUi.types.editingId = null;
    await refreshCurrentView();
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
        const confirmed = await showConfirmDialog({
          title: `${row.ativo ? 'Inativar' : 'Ativar'} tipo`,
          message: `Deseja ${row.ativo ? 'inativar' : 'ativar'} o tipo ${row.nome}?`,
          confirmText: row.ativo ? 'Inativar' : 'Ativar',
          confirmClass: row.ativo ? 'btn btn-warning' : 'btn btn-primary'
        });
        if (!confirmed) return;
        const updated = await safeQuery(
          sb.from('tipos_chamado').update({ ativo: !row.ativo }).eq('id', row.id).select().single()
        );
        if (!updated) return;
        showToast(`Tipo ${updated.ativo ? 'ativado' : 'inativado'} com sucesso.`);
        await refreshCurrentView();
        return;
      }

      const confirmed = await showConfirmDialog({
        title: 'Excluir tipo',
        message: `Excluir o tipo ${row.nome}? Essa ação pode falhar se houver chamados vinculados.`,
        confirmText: 'Excluir',
        confirmClass: 'btn btn-danger'
      });
      if (!confirmed) return;
      const deleted = await safeQuery(sb.from('tipos_chamado').delete().eq('id', row.id).select().single());
      if (!deleted) return;
      showToast('Tipo excluído com sucesso.');
      state.adminUi.types.editingId = null;
      await refreshCurrentView();
    });
  });
}

function renderUsers() {
  adminEntityView('Usuários', 'users', state.lookups.users, [
    { key: 'nome', label: 'Nome' },
    { key: 'email', label: 'Email' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'perfil', label: 'Perfil' },
    { key: 'loja_id', label: 'Loja', render: row => state.lookups.stores.find(s => s.id === row.loja_id)?.nome || '-' },
    { key: 'ativo', label: 'Status', render: row => row.ativo ? 'Ativo' : 'Inativo' }
  ], {
    create: async () => {
      const result = await openCustomDialog({
        title: 'Novo usuário',
        message: 'Cadastre um usuário e defina o perfil e a loja de vínculo.',
        confirmText: 'Criar usuário',
        fields: [
          { name: 'nome', label: 'Nome', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'telefone', label: 'Telefone / WhatsApp', type: 'tel', required: true, placeholder: '5599999999999' },
          { name: 'senha', label: 'Senha inicial', type: 'password', required: true, minLength: 6, placeholder: 'Mínimo de 6 caracteres' },
          {
            name: 'perfil',
            label: 'Perfil',
            type: 'select',
            value: 'funcionario',
            options: [
              { value: 'funcionario', label: 'Funcionário' },
              { value: 'admin', label: 'Admin' }
            ]
          },
          {
            name: 'loja',
            label: 'Loja',
            type: 'select',
            value: '',
            options: [{ value: '', label: 'Sem vínculo' }].concat(
              state.lookups.stores.map(store => ({ value: String(store.id), label: store.nome }))
            )
          }
        ]
      });
      if (!result.confirmed) return;

      const nome = result.values.nome;
      const email = result.values.email;
      const telefone = normalizeWhatsAppNumber(result.values.telefone);
      const senha = result.values.senha;
      const perfil = result.values.perfil;
      const loja = result.values.loja;
      if (!nome || !email || !telefone || !senha || senha.length < 6) {
        return showToast('Preencha nome, email, telefone e uma senha válida.', 'error');
      }
      if (!isValidBrazilWhatsAppNumber(telefone)) {
        return showToast('Informe um telefone válido no padrão brasileiro com DDI 55 e DDD.', 'error');
      }

      const confirmed = await confirmAction({
        title: 'Criar usuário',
        message: `Confirmar criação do usuário ${nome}?`,
        confirmText: 'Criar usuário'
      });
      if (!confirmed) return;

      const createClient = supabase.createClient(window.APP_CONFIG.supabaseUrl, window.APP_CONFIG.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });

      const { error } = await createClient.auth.signUp({
        email,
        password: senha,
        options: {
          data: {
            nome,
            telefone,
            perfil: perfil === 'admin' ? 'admin' : 'funcionario',
            loja_id: loja ? Number(loja) : null
          }
        }
      });

      if (error) return showToast(error.message, 'error');
      showToast('Usuário criado. Se confirmação de email estiver ativa, ele precisa confirmar acesso.');
      await refreshCurrentView();
    },
    edit: async (row) => {
      const result = await openCustomDialog({
        title: 'Editar usuário',
        confirmText: 'Salvar alterações',
        fields: [
          { name: 'nome', label: 'Nome', required: true, value: row.nome },
          { name: 'telefone', label: 'Telefone / WhatsApp', type: 'tel', required: true, value: row.telefone || '', placeholder: '5599999999999' },
          {
            name: 'perfil',
            label: 'Perfil',
            type: 'select',
            value: row.perfil,
            options: [
              { value: 'funcionario', label: 'Funcionário' },
              { value: 'admin', label: 'Admin' }
            ]
          },
          {
            name: 'loja',
            label: 'Loja',
            type: 'select',
            value: row.loja_id || '',
            options: [{ value: '', label: 'Sem vínculo' }].concat(
              state.lookups.stores.map(store => ({ value: String(store.id), label: store.nome }))
            )
          },
          {
            name: 'ativo',
            label: 'Status',
            type: 'select',
            value: row.ativo ? 'true' : 'false',
            options: [
              { value: 'true', label: 'Ativo' },
              { value: 'false', label: 'Inativo' }
            ]
          }
        ]
      });
      if (!result.confirmed || !result.values.nome) return;

      const nome = result.values.nome;
      const telefone = normalizeWhatsAppNumber(result.values.telefone);
      const perfil = result.values.perfil || row.perfil;
      const loja = result.values.loja;
      const ativo = result.values.ativo === 'true';
      if (!telefone) return showToast('Informe um telefone válido.', 'error');
      if (!isValidBrazilWhatsAppNumber(telefone)) {
        return showToast('Informe um telefone válido no padrão brasileiro com DDI 55 e DDD.', 'error');
      }
      const confirmed = await confirmAction({
        title: 'Salvar edição do usuário',
        message: `Confirmar atualização do usuário ${nome}?`,
        confirmText: 'Salvar alterações'
      });
      if (!confirmed) return;
      await safeQuery(
        sb.from('usuarios').update({
          nome,
          telefone,
          perfil: perfil === 'admin' ? 'admin' : 'funcionario',
          loja_id: loja ? Number(loja) : null,
          ativo
        }).eq('id', row.id)
      );
      await refreshCurrentView();
    },
    remove: async (row) => {
      const confirmed = await showConfirmDialog({
        title: `${row.ativo ? 'Inativar' : 'Ativar'} usuário`,
        message: `Deseja ${row.ativo ? 'inativar' : 'ativar'} ${row.nome}?`,
        confirmText: row.ativo ? 'Inativar' : 'Ativar',
        confirmClass: row.ativo ? 'btn btn-warning' : 'btn btn-primary'
      });
      if (!confirmed) return;
      await safeQuery(sb.from('usuarios').update({ ativo: !row.ativo }).eq('id', row.id));
      await refreshCurrentView();
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
          <div class="grid-2">
            <label>Telefone / WhatsApp
              <input id="settings-phone" type="tel" value="${user?.telefone || ''}" required placeholder="5599999999999" />
            </label>
            ${isAdmin() ? `
            <label>WhatsApp fixo para receber chamados
              <input id="settings-ticket-whatsapp" type="tel" value="${user?.whatsapp_chamados_destino || ''}" placeholder="5599999999999" />
            </label>
            ` : ''}
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
    const telefone = sanitizePhoneNumber(document.getElementById('settings-phone').value);
    const whatsappChamadosDestino = isAdmin()
      ? normalizeWhatsAppNumber(document.getElementById('settings-ticket-whatsapp')?.value)
      : null;
    if (!nome) return showToast('Informe o nome', 'error');
    if (!telefone) return showToast('Informe o telefone / WhatsApp.', 'error');
    if (isAdmin() && whatsappChamadosDestino && !isValidBrazilWhatsAppNumber(whatsappChamadosDestino)) {
      return showToast('Informe um WhatsApp válido no padrão brasileiro com DDI 55 e DDD.', 'error');
    }
    const confirmed = await confirmAction({
      title: 'Salvar perfil',
      message: `Confirmar atualização do seu nome para ${nome}?`,
      confirmText: 'Salvar perfil'
    });
    if (!confirmed) return;
    const updatePayload = { nome, telefone };
    if (isAdmin()) {
      updatePayload.whatsapp_chamados_destino = whatsappChamadosDestino || null;
    }
    await safeQuery(sb.from('usuarios').update(updatePayload).eq('id', state.profile.id));
    state.profile.nome = nome;
    state.profile.telefone = telefone;
    if (isAdmin()) {
      state.profile.whatsapp_chamados_destino = whatsappChamadosDestino || null;
    }
    el.userInfo.textContent = `${state.profile.nome} (${state.profile.perfil})`;
    showToast('Perfil atualizado');
    await refreshCurrentView();
  });
}

async function renderView() {
  el.viewTitle.textContent = state.menu.find(m => m.id === state.currentView)?.label || 'Painel';
  const viewRenderers = {
    dashboard: renderDashboard,
    tickets: renderTicketView,
    stores: renderStores,
    checkouts: renderCheckouts,
    types: renderTypes,
    users: renderUsers,
    reports: renderReports,
    settings: renderSettings
  };
  const renderCurrent = viewRenderers[state.currentView] || renderDashboard;
  return renderCurrent();
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

  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action="status"]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    if (!isAdmin()) return;
    const ticketId = Number(btn.dataset.id);
    if (!ticketId) return;
    await openTicketStatusDialog(ticketId);
  });

  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action="start-service"]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    if (!isAdmin()) return;
    const ticketId = Number(btn.dataset.id);
    if (!ticketId) return;
    await startTicketService(ticketId);
  });

  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action="delete"]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    if (!isAdmin()) return;
    const ticketId = Number(btn.dataset.id);
    if (!ticketId) return;
    await deleteTicketById(ticketId);
  });

  document.body.dataset.ticketActionsBound = 'true';
}

async function openTicketDetails(ticketId) {
  let ticket = findTicketById(ticketId);

  if (!ticket) {
    ticket = await fetchTicketById(ticketId);
  }

  if (!ticket) {
    showToast('Nao foi possivel carregar os detalhes do chamado', 'error');
    return;
  }

  const ticketUserPhone = getTicketUserPhone(ticket);

  const history = await safeQuery(
    sb.from('historico_chamados')
      .select('*, usuario:usuarios(nome)')
      .eq('chamado_id', ticketId)
      .order('created_at', { ascending: false })
  ) || [];

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
          <div class="info-item"><span>Telefone</span><strong>${formatPhoneDisplay(ticketUserPhone)}</strong></div>
          <div class="info-item"><span>Fila atual</span><strong>${renderQueueInfo(ticket)}</strong></div>
          <div class="info-item"><span>Abertura</span><strong>${fmtDate(ticket.created_at)}</strong></div>
          <div class="info-item"><span>Anexo</span><strong>${ticket.anexo_url ? `<a href="${ticket.anexo_url}" target="_blank">Ver anexo</a>` : '-'}</strong></div>
        </div>
      </div>
      <div class="card">
        <h3>Descrição</h3>
        <p>${ticket.descricao}</p>
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
      <button type="button" class="btn btn-ghost btn-sm" id="btn-close-details">Fechar</button>
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
  await loadQueueMetrics();
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

  const ticketWhatsappButton = document.getElementById('btn-save-ticket-whatsapp');
  if (ticketWhatsappButton) {
    ticketWhatsappButton.addEventListener('click', async () => {
      if (!getFixedTicketWhatsAppTarget()) {
        return showToast('Nenhum WhatsApp fixo foi configurado por um admin.', 'error');
      }
      if (!el.ticketForm.checkValidity()) {
        el.ticketForm.reportValidity();
        return;
      }

      const payload = {
        loja_id: Number(document.getElementById('ticket-store').value),
        caixa_id: Number(document.getElementById('ticket-checkout').value),
        tipo_chamado_id: Number(document.getElementById('ticket-type').value),
        usuario_id: state.profile.id,
        titulo: document.getElementById('ticket-title').value.trim(),
        descricao: document.getElementById('ticket-description').value.trim(),
        prioridade: 'baixa',
        anexo_url: document.getElementById('ticket-attachment').value.trim() || null,
        telefone_retorno: null,
        responsavel_local: null,
        status: 'aberto'
      };

      const saved = await submitNewTicket(payload, {
        afterSuccess: async () => {
          el.ticketForm.reset();
          syncTicketWhatsAppOption();
          if (el.ticketModal.open) {
            el.ticketModal.close();
          }
          await reloadAll();
          renderView();
        }
      });

      if (!saved) return;
    });
  }

  el.btnOpenTicket.addEventListener('click', async () => {
    if (isAdmin()) {
      showToast('Administradores apenas visualizam e alteram chamados.', 'error');
      return;
    }

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

    syncTicketWhatsAppOption();
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
      prioridade: 'baixa',
      anexo_url: document.getElementById('ticket-attachment').value.trim() || null,
      telefone_retorno: null,
      responsavel_local: null,
      status: 'aberto'
    };
    await submitNewTicket(payload, {
      afterSuccess: async () => {
        el.ticketForm.reset();
        syncTicketWhatsAppOption();
        if (el.ticketModal.open) {
          el.ticketModal.close();
        }
        await reloadAll();
        renderView();
      }
    });
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
    el.btnAdminQuick.classList.toggle('hidden', isAdmin());
  }
  if (el.btnOpenTicket) {
    el.btnOpenTicket.classList.toggle('hidden', isAdmin());
  }

  const allowedViews = new Set((isAdmin() ? MENU_ADMIN : MENU_FUNC).map(item => item.id));
  if (!allowedViews.has(state.currentView)) {
    state.currentView = 'dashboard';
  }

  await reloadAll();
  mountMenu();
  persistCurrentView();
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
    const telefone = normalizeWhatsAppNumber(document.getElementById('register-phone').value);
    const password = document.getElementById('register-password').value;
    const perfil = 'funcionario';
    const loja_id = document.getElementById('register-store').value;

    if (!loja_id) {
      return showToast('Selecione uma loja para concluir o cadastro.', 'error');
    }

    if (!telefone) {
      return showToast('Informe um telefone / WhatsApp válido para concluir o cadastro.', 'error');
    }
    if (!isValidBrazilWhatsAppNumber(telefone)) {
      return showToast('Informe um telefone válido no padrão brasileiro com DDI 55 e DDD.', 'error');
    }

    const { error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome,
          telefone,
          perfil,
          loja_id: Number(loja_id)
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

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || isDesktopNav()) return;
    if (!document.body.classList.contains('nav-open')) return;
    setNavOpen(false);
  });

  if (el.btnAdminQuick) {
    el.btnAdminQuick.addEventListener('click', async () => {
      if (!isAdmin()) return showToast('Acesso restrito para administradores.', 'error');
      await openCurrentView('stores');
    });
  }

  if (el.btnThemeToggle) {
    el.btnThemeToggle.addEventListener('click', () => {
      document.body.classList.toggle('theme-light');
      writeUiPrefs({ theme: document.body.classList.contains('theme-light') ? 'light' : 'dark' });
    });
  }

  window.addEventListener('resize', syncMenuState);
  window.addEventListener('resize', () => bindFilterAccordions(el.content));

  el.globalSearch.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const query = normalizeText(el.globalSearch.value);
    if (!query) return;

    const source = state.allTickets.length ? state.allTickets : state.tickets;
    const localMatches = source.filter(ticket => {
      const haystack = [
        ticket.numero_chamado,
        ticket.titulo,
        ticket.loja?.nome,
        ticket.caixa?.nome,
        ticket.tipo?.nome,
        ticket.usuario?.nome
      ].map(normalizeText).join(' ');
      return haystack.includes(query);
    });

    if (localMatches.length === 1) {
      await openTicketDetails(localMatches[0].id);
      return;
    }

    const data = await safeQuery(
      sb.from('chamados').select(TICKET_SELECT_QUERY).or(`numero_chamado.ilike.%${query}%,titulo.ilike.%${query}%`).limit(5)
    );

    if (!data || !data.length) return showToast('Chamado não encontrado', 'error');
    await fetchTickets();

    if (data.length === 1) {
      await openTicketDetails(data[0].id);
      return;
    }

    state.adminUi.tickets.tab = 'active';
    state.adminUi.tickets.filters = {
      store: '',
      checkout: '',
      type: '',
      status: '',
      priority: ''
    };
    persistTicketUiState();
    await openCurrentView('tickets');
    showToast(`${data.length} chamados encontrados. Abra pelos detalhes.`);
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

  restoreUiPrefs();
  initPhoneInputFormatting();
  bootAuth();
  bindTopActions();
  initLogoutButton();
  initCustomDialog();
  setupTicketModal();

  syncMenuState();
  el.authView.classList.add('hidden');
  el.appView.classList.add('hidden');

  const { data } = await sb.auth.getSession();
  if (data.session) {
    await bootApp(data.session);
  } else {
    await loadPublicRegisterStores();
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
