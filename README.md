# Sistema de Chamados TI - Supermercado (7 Lojas)

Aplicação web completa em `HTML + CSS + JavaScript + Supabase` para gestão de chamados de TI com foco em rapidez, organização e controle administrativo.

## Stack
- Front-end: HTML, CSS, JavaScript puro
- Banco/Auth: Supabase (PostgreSQL + Auth + RLS)
- Gráficos: Chart.js (CDN)

## Estrutura do projeto
- `index.html` - Layout principal e modais
- `styles.css` - Estilo responsivo
- `config.js` - Credenciais Supabase (URL + ANON KEY)
- `supabase.js` - Inicialização do cliente Supabase
- `app.js` - Fluxo da aplicação (auth, CRUD, dashboard, filtros, histórico)
- `sql/schema.sql` - Schema completo (tabelas, relacionamentos, RLS, funções, seeds)
- `sql/migration_2026_03_08_global_types_lojas.sql` - Ajustes para base já existente (tipos globais + observação em lojas)
- `sql/migration_2026_03_08_sync_caixas_all_stores.sql` - Replica caixas/setores existentes para todas as lojas

## Funcionalidades entregues
- Login e cadastro com perfis `admin` e `funcionario`
- Abertura de chamados com:
  - loja, caixa/setor, tipo, prioridade, título, descrição
  - campos opcionais (anexo URL, responsável local, telefone)
- Número único de chamado (`CH-YYYYMMDD-XXXXXX`)
- Status: aberto, em andamento, aguardando retorno, resolvido, fechado, cancelado
- Histórico automático de movimentações
- Observação complementar por chamado
- Busca rápida por número do chamado
- Listagem com filtros (loja, caixa, tipo, status, prioridade)
- Dashboard com KPIs e gráficos
- CRUD admin para:
  - lojas
  - caixas
  - tipos de chamado globais (compartilhados por todas as lojas)
  - usuários
- Relatório com exportação CSV (Excel)
- Regras de permissão via RLS

## Como configurar
1. Crie um projeto no Supabase.
2. Abra `sql/schema.sql` no SQL Editor do Supabase e execute tudo.
3. No arquivo `config.js`, preencha:
   - `supabaseUrl`
   - `supabaseAnonKey`
4. Sirva a pasta com um servidor web local.

Exemplo com VS Code + Live Server:
- Abra a pasta `supermercado-chamados`.
- Clique em `index.html` e rode com `Open with Live Server`.

## Regras de acesso
- Funcionário:
  - abre chamados
  - acompanha chamados
  - adiciona observações
  - visualiza chamados conforme permissões RLS
- Admin:
  - acesso completo
  - altera status
  - gerencia cadastros e usuários
  - visualiza relatórios globais

## Observações importantes
- O cadastro de usuários pelo admin usa `signUp` com cliente secundário.
- Se confirmação de email estiver habilitada no Supabase, o usuário precisa confirmar email antes do primeiro login.
- Para upload real de anexos (arquivo), pode-se evoluir para Supabase Storage (atualmente está como `anexo_url`).

## Próximas melhorias sugeridas
- Upload de anexos para Storage
- Paginação server-side
- Exportação PDF
- Registro de auditoria avançada
- SLA e tempo médio por atendimento
