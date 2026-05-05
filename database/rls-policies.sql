-- Supabase RLS (Row-Level Security) Policies - Sentinel AI
-- Implement per-user data access control

-- ============================================================================
-- ENABLE RLS ON CRITICAL TABLES
-- ============================================================================

ALTER TABLE expedients ENABLE ROW LEVEL SECURITY;
ALTER TABLE infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE custody_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- EXPEDIENTS RLS POLICIES
-- ============================================================================

-- Operators can only see expedients they created
CREATE POLICY "operators_select_own_expedients"
  ON expedients FOR SELECT
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('SUPERVISOR', 'ADMIN')
    )
  );

-- Operators can only update expedients they created or are reviewing
CREATE POLICY "operators_update_own_expedients"
  ON expedients FOR UPDATE
  USING (
    auth.uid() = created_by
    OR auth.uid() = last_modified_by
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('SUPERVISOR', 'ADMIN')
    )
  );

-- Only supervisors and admins can delete
CREATE POLICY "supervisors_delete_expedients"
  ON expedients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('SUPERVISOR', 'ADMIN')
    )
  );

-- Only creators and supervisors can insert
CREATE POLICY "operators_insert_expedients"
  ON expedients FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('OPERATOR', 'SUPERVISOR', 'ADMIN')
    )
  );

-- ============================================================================
-- INFRACTIONS RLS POLICIES
-- ============================================================================

-- Anyone can read infractions (used in reports)
CREATE POLICY "read_infractions"
  ON infractions FOR SELECT
  USING (true);

-- Only admins can modify infractions
CREATE POLICY "admin_modify_infractions"
  ON infractions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

CREATE POLICY "admin_update_infractions"
  ON infractions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- ============================================================================
-- EVIDENCE RLS POLICIES
-- ============================================================================

-- Users can access evidence for expedients they have access to
CREATE POLICY "evidence_access"
  ON evidence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM expedients
      WHERE expedients.id = evidence.expedient_id
      AND (
        auth.uid() = expedients.created_by
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('SUPERVISOR', 'ADMIN')
        )
      )
    )
  );

CREATE POLICY "evidence_insert"
  ON evidence FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expedients
      WHERE expedients.id = evidence.expedient_id
      AND auth.uid() = expedients.created_by
    )
  );

-- ============================================================================
-- CUSTODY LOGS RLS POLICIES
-- ============================================================================

-- Immutable audit logs - read-only for authorized users
CREATE POLICY "read_custody_logs"
  ON custody_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM expedients
      WHERE expedients.id = custody_logs.expedient_id
      AND (
        auth.uid() = expedients.created_by
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('SUPERVISOR', 'ADMIN')
        )
      )
    )
  );

-- Only system can insert logs
CREATE POLICY "system_insert_logs"
  ON custody_logs FOR INSERT
  WITH CHECK (
    current_setting('app.current_user') = 'system'
    OR current_user = 'postgres'
  );

-- ============================================================================
-- GRANT PERMISSIONS TO AUTHENTICATED USERS
-- ============================================================================

GRANT SELECT ON expedients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON expedients TO authenticated;
GRANT SELECT ON infractions TO authenticated;
GRANT SELECT ON evidence TO authenticated;
GRANT SELECT ON custody_logs TO authenticated;
