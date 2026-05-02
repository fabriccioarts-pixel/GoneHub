-- ============================================================
-- RLS POLICIES — Gone Hub
-- Cole este script no Supabase SQL Editor e execute.
-- ============================================================

-- ── Habilitar RLS em todas as tabelas ───────────────────────
ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;

-- ── Helper: retorna o client_id do usuário logado ───────────
CREATE OR REPLACE FUNCTION my_client_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT client_id FROM profiles WHERE id = auth.uid()
$$;

-- ── Helper: retorna true se o usuário logado é admin ────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT role = 'admin' FROM profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- TABELA: profiles
-- ============================================================
-- Cada usuário lê apenas o próprio perfil
CREATE POLICY "profiles: leitura própria"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Cada usuário atualiza apenas o próprio perfil
CREATE POLICY "profiles: atualização própria"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Insert é feito via Edge Function (service role), sem política pública

-- ============================================================
-- TABELA: clients
-- ============================================================
-- Admin vê todos; cliente vê apenas o próprio
CREATE POLICY "clients: admin vê todos"
  ON clients FOR SELECT
  USING (is_admin());

CREATE POLICY "clients: cliente vê o próprio"
  ON clients FOR SELECT
  USING (id = my_client_id());

-- Somente admin pode criar, editar e deletar clientes
CREATE POLICY "clients: admin gerencia"
  ON clients FOR ALL
  USING (is_admin());

-- ============================================================
-- TABELA: client_reports
-- ============================================================
CREATE POLICY "client_reports: admin acessa todos"
  ON client_reports FOR ALL
  USING (is_admin());

CREATE POLICY "client_reports: cliente lê os próprios"
  ON client_reports FOR SELECT
  USING (client_id = my_client_id());

-- ============================================================
-- TABELA: calendar_posts
-- ============================================================
CREATE POLICY "calendar_posts: admin gerencia todos"
  ON calendar_posts FOR ALL
  USING (is_admin());

-- Cliente lê apenas posts do próprio cliente que não sejam Rascunho
CREATE POLICY "calendar_posts: cliente lê aprovados"
  ON calendar_posts FOR SELECT
  USING (
    client_id = my_client_id()
    AND status != 'Rascunho'
  );

-- ============================================================
-- TABELA: post_comments
-- ============================================================
CREATE POLICY "post_comments: admin acessa todos"
  ON post_comments FOR ALL
  USING (is_admin());

-- Cliente lê comentários dos próprios posts
CREATE POLICY "post_comments: cliente lê dos próprios posts"
  ON post_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calendar_posts
      WHERE calendar_posts.id = post_comments.post_id
        AND calendar_posts.client_id = my_client_id()
    )
  );

-- Cliente pode inserir comentários nos próprios posts
CREATE POLICY "post_comments: cliente comenta nos próprios posts"
  ON post_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendar_posts
      WHERE calendar_posts.id = post_comments.post_id
        AND calendar_posts.client_id = my_client_id()
    )
  );

-- ============================================================
-- TABELA: notifications
-- ============================================================
CREATE POLICY "notifications: admin gerencia todos"
  ON notifications FOR ALL
  USING (is_admin());

-- Cliente lê apenas as próprias notificações
CREATE POLICY "notifications: cliente lê as próprias"
  ON notifications FOR SELECT
  USING (client_id = my_client_id());

-- ============================================================
-- REMOVER a VITE_SUPABASE_SERVICE_ROLE_KEY do .env do frontend
-- após implantar a Edge Function create-client-user.
-- ============================================================
