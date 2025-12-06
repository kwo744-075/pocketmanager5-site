-- Seed alignment_memberships by mapping legacy company_alignment_email_map to auth.users
-- Assumes:
--  - `company_alignment_email_map` view exists (created by normalize migration)
--  - `shops` and `alignments` have been created and populated (codes include 'SHOP:'||shop_number, 'DIST:'||md5(district_name), 'REG:'||md5(region_name), 'DIV:'||md5(division_name))
--  - `alignment_memberships` table exists with columns (user_id, alignment_id, shop_id, role, is_primary)

-- Shop-level memberships: map Shop_Email -> DM
INSERT INTO alignment_memberships (user_id, alignment_id, shop_id, role, is_primary, created_at)
SELECT u.id AS user_id,
       a.id AS alignment_id,
       s.shop_number AS shop_id,
       'dm' AS role,
       true AS is_primary,
       now() as created_at
FROM company_alignment_email_map cam
JOIN auth.users u ON lower(u.email) = lower(cam.shop_email)
JOIN shops s ON s.shop_number = cam.shop_number
JOIN alignments a ON a.code = ('SHOP:' || s.shop_number)
ON CONFLICT (user_id, alignment_id, shop_id) DO NOTHING;

-- District-level memberships: map District_Email -> dm
INSERT INTO alignment_memberships (user_id, alignment_id, shop_id, role, is_primary, created_at)
SELECT u.id AS user_id,
       a.id AS alignment_id,
       NULL AS shop_id,
       'dm' AS role,
       false AS is_primary,
       now() as created_at
FROM company_alignment_email_map cam
JOIN auth.users u ON lower(u.email) = lower(cam.district_email)
JOIN alignments a ON a.code = ('DIST:' || md5(coalesce(cam.district_name, '')))
ON CONFLICT (user_id, alignment_id, shop_id) DO NOTHING;

-- Region-level memberships: map Region_Email -> rd
INSERT INTO alignment_memberships (user_id, alignment_id, shop_id, role, is_primary, created_at)
SELECT u.id AS user_id,
       a.id AS alignment_id,
       NULL AS shop_id,
       'rd' AS role,
       false AS is_primary,
       now() as created_at
FROM company_alignment_email_map cam
JOIN auth.users u ON lower(u.email) = lower(cam.region_email)
JOIN alignments a ON a.code = ('REG:' || md5(coalesce(cam.region_name, '')))
ON CONFLICT (user_id, alignment_id, shop_id) DO NOTHING;

-- Division-level memberships: map Division_Email -> vp
INSERT INTO alignment_memberships (user_id, alignment_id, shop_id, role, is_primary, created_at)
SELECT u.id AS user_id,
       a.id AS alignment_id,
       NULL AS shop_id,
       'vp' AS role,
       false AS is_primary,
       now() as created_at
FROM company_alignment_email_map cam
JOIN auth.users u ON lower(u.email) = lower(cam.division_email)
JOIN alignments a ON a.code = ('DIV:' || md5(coalesce(cam.division_name, '')))
ON CONFLICT (user_id, alignment_id, shop_id) DO NOTHING;

-- Notes:
-- - Run this migration after you run the normalization migration that creates `shops` and `alignments`.
-- - Inspect inserted rows and adjust role mappings if your org uses different role naming.
-- - After confirming memberships, update RLS policies to reference alignment_memberships (we've already switched cadence RLS to do that).
