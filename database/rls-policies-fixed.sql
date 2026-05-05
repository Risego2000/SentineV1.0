-- Supabase RLS (Row-Level Security) Policies - Sentinel AI (FIXED)
-- Adapted to actual Sentinel schema

-- ============================================================================
-- ENABLE RLS ON CRITICAL TABLES
-- ============================================================================

ALTER TABLE expedients ENABLE ROW LEVEL SECURITY;
ALTER TABLE infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- EXPEDIENTS RLS POLICIES
-- ============================================================================

-- Policy: Operators can SELECT expedients they created
CREATE POLICY "expedients_select_own"
  ON expedients FOR SELECT
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('SUPERVISOR', 'ADMIN')
    )
  );

-- Policy: Operators can UPDATE expedients they created
CREATE POLICY "expedients_update_own"
  ON expedients FOR UPDATE
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('SUPERVISOR', 'ADMIN')
    )
  );

-- Policy: Only supervisors/admins can INSERT expedients
CREATE POLICY "expedients_insert"
  ON expedients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('OPERATOR', 'SUPERVISOR', 'ADMIN')
    )
  );

-- Policy: Only supervisors/admins can DELETE expedients
CREATE POLICY "expedients_delete"
  ON expedients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('SUPERVISOR', 'ADMIN')
    )
  );

-- ============================================================================
-- INFRACTIONS RLS POLICIES
-- ============================================================================

-- Policy: All authenticated users can read infractions
CREATE POLICY "infractions_read"
  ON infractions FOR SELECT
  USING (true);

-- Policy: Only admins can INSERT infractions
CREATE POLICY "infractions_insert"
  ON infractions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Only admins can UPDATE infractions
CREATE POLICY "infractions_update"
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

-- Policy: Users can SELECT evidence for their expedients
CREATE POLICY "evidence_select"
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

-- Policy: Users can INSERT evidence for their expedients
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
-- GRANT PERMISSIONS TO AUTHENTICATED USERS
-- ============================================================================

GRANT SELECT ON expedients TO authenticated;
GRANT INSERT, UPDATE ON expedients TO authenticated;
GRANT SELECT ON infractions TO authenticated;
GRANT SELECT ON evidence TO authenticated;
