-- Phase 0 admin: expand RBAC modules and stop leaving staff on role "none".
INSERT INTO staff_roles (id, name, description) VALUES
  ('catalog', 'Catalog', 'Categories, brands, fees, item specifics')
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff_permissions (role_id, module, action)
SELECT r, m, a FROM (VALUES
  -- Moderator extras
  ('moderator','kyc','read'), ('moderator','kyc','write'),
  ('moderator','appeals','read'), ('moderator','appeals','write'),
  ('moderator','reviews','read'), ('moderator','reviews','write'),
  ('moderator','audit','read'),
  -- Finance extras
  ('finance','finance','read'),
  ('finance','orders','write'),
  -- Support extras
  ('support','kyc','read'),
  ('support','appeals','read'),
  ('support','audit','read'),
  -- Catalog role
  ('catalog','catalog','read'), ('catalog','catalog','write'),
  -- CMS / settings for moderator + support (read) / super_admin via short-circuit
  ('moderator','cms','read'), ('moderator','cms','write'),
  ('support','cms','read'),
  ('moderator','settings','read'),
  ('finance','settings','read'),
  ('support','settings','read'),
  ('support','tickets','read'),
  ('moderator','tickets','read')
) AS t(r, m, a)
ON CONFLICT DO NOTHING;

-- Existing staff with blank role become explicit super_admin (matches prior effective behavior).
UPDATE users
SET staff_role = 'super_admin', updated_at = NOW()
WHERE is_staff = TRUE AND (staff_role IS NULL OR staff_role = 'none' OR staff_role = '');
