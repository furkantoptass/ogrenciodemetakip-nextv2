-- Sabit RPC fonksiyonları: yetki, kaynak saati, PIC takip, WAPI geçmişi, öğrenci notları, arama.
-- Hiçbir fonksiyon dışarıdan SQL metni çalıştırmaz; yalnızca service_role çağırabilir.

-- ───────────── odt_yetki_* ─────────────

CREATE OR REPLACE FUNCTION public.odt_yetki_user_by_email(p_email text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
    SELECT id, email, full_name, is_active, is_super FROM northfly_odt_users WHERE email = p_email LIMIT 1
  ) t
$$;

CREATE OR REPLACE FUNCTION public.odt_yetki_user_by_id(p_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
    SELECT id, email, full_name, is_active, is_super FROM northfly_odt_users WHERE id = p_id LIMIT 1
  ) t
$$;

CREATE OR REPLACE FUNCTION public.odt_yetki_user_id_by_email(p_email text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
    SELECT id FROM northfly_odt_users WHERE email = p_email LIMIT 1
  ) t
$$;

CREATE OR REPLACE FUNCTION public.odt_yetki_users()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT to_jsonb(t) AS row_json FROM (
      SELECT id, email, full_name, is_active, is_super FROM northfly_odt_users ORDER BY is_super DESC, email
    ) t
  ) s
$$;

CREATE OR REPLACE FUNCTION public.odt_yetki_super_ids()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
    SELECT id FROM northfly_odt_users WHERE is_super = true
  ) t
$$;

CREATE OR REPLACE FUNCTION public.odt_yetki_super_insert(p_email text)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO northfly_odt_users (email, full_name, is_active, is_super, created_at)
    VALUES (p_email, 'Ulukan', true, true, now())
    ON CONFLICT DO NOTHING
    RETURNING 1
  ) SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_yetki_super_fix(p_email text)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    UPDATE northfly_odt_users SET is_super = true, is_active = true WHERE email = p_email
    RETURNING 1
  ) SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_yetki_user_insert(p_email text, p_name text, p_is_super boolean)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH ins AS (
    INSERT INTO northfly_odt_users (email, full_name, is_active, is_super, created_at)
    VALUES (p_email, p_name, true, p_is_super, now())
    RETURNING id
  ) SELECT COALESCE(jsonb_agg(to_jsonb(ins)), '[]'::jsonb) FROM ins
$$;

CREATE OR REPLACE FUNCTION public.odt_yetki_user_update(p_id integer, p_is_super boolean, p_is_active boolean)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    UPDATE northfly_odt_users SET is_super = p_is_super, is_active = p_is_active WHERE id = p_id
    RETURNING 1
  ) SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_yetki_modules(p_user_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
    SELECT module_id FROM northfly_odt_user_modules WHERE user_id = p_user_id
  ) t
$$;

CREATE OR REPLACE FUNCTION public.odt_yetki_modules_add(p_user_id integer, p_module_ids text[])
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO northfly_odt_user_modules (user_id, module_id)
    SELECT p_user_id, m FROM unnest(p_module_ids) AS m
    ON CONFLICT DO NOTHING
    RETURNING 1
  ) SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_yetki_modules_clear(p_user_id integer)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    DELETE FROM northfly_odt_user_modules WHERE user_id = p_user_id
    RETURNING 1
  ) SELECT count(*)::int FROM x
$$;

-- ───────────── odt_kaynak_* ─────────────

CREATE OR REPLACE FUNCTION public.odt_kaynak_ogrenci_sayisi()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
    SELECT COUNT(*) AS c FROM naeron_bi_students
  ) t
$$;

CREATE OR REPLACE FUNCTION public.odt_kaynak_sozlesme_sayisi()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
    SELECT COUNT(*) AS c FROM naeron_bi_student_contracts
  ) t
$$;

CREATE OR REPLACE FUNCTION public.odt_kaynak_ucus_sayisi()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
    SELECT COUNT(*) AS c FROM naeron_bi_flights
  ) t
$$;

CREATE OR REPLACE FUNCTION public.odt_kaynak_kayit_sayisi()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
    SELECT COUNT(*) AS c FROM northfly_odt_users
  ) t
$$;

CREATE OR REPLACE FUNCTION public.odt_kaynak_list()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
    SELECT source_id, checked_at, ok, error_text, ozet FROM northfly_odt_kaynak_saat
  ) t
$$;

CREATE OR REPLACE FUNCTION public.odt_kaynak_upsert(p_source_id text, p_ok boolean, p_error_text text, p_ozet text)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO northfly_odt_kaynak_saat (source_id, checked_at, ok, error_text, ozet)
    VALUES (p_source_id, now() AT TIME ZONE 'Europe/Istanbul', p_ok, p_error_text, p_ozet)
    ON CONFLICT (source_id) DO UPDATE SET checked_at = now() AT TIME ZONE 'Europe/Istanbul', ok = EXCLUDED.ok, error_text = EXCLUDED.error_text, ozet = EXCLUDED.ozet
    RETURNING 1
  ) SELECT count(*)::int FROM x
$$;

-- ───────────── odt_pic_* ─────────────

CREATE OR REPLACE FUNCTION public.odt_pic_tarih_upsert(p_student_id integer, p_text text)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO northfly_odt_pic_takip (student_id, katilacagi_tarihler, updated_at)
    VALUES (p_student_id, p_text, now())
    ON CONFLICT (student_id) DO UPDATE SET katilacagi_tarihler = EXCLUDED.katilacagi_tarihler, updated_at = now()
    RETURNING 1
  ) SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_pic_students()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT to_jsonb(q) AS row_json FROM (
      SELECT s."m_ID", s."firstName", s."lastName", s."shortCode"
      FROM naeron_bi_students s
      WHERE LOWER(TRIM(COALESCE(s."_lastRowStatus", ''))) IN ('create', 'update')
        AND (s."trainingStatus" IS NULL OR TRIM(s."trainingStatus") = '' OR LOWER(TRIM(s."trainingStatus")) <> 'cancelcontract')
        AND EXISTS (
          SELECT 1
          FROM naeron_bi_student_trainings st
          INNER JOIN naeron_bi_trainings t ON t."m_ID" = st."trainingID"
          WHERE st."studentID" = s."m_ID"
            AND (st."trainingStatus" IS NULL OR LOWER(TRIM(st."trainingStatus")) <> 'cancelcontract')
            AND (
              UPPER(TRIM(COALESCE(t.name, ''))) = 'PIC'
              OR UPPER(TRIM(COALESCE(t.name, ''))) LIKE 'PIC(%'
              OR UPPER(TRIM(COALESCE(t.name, ''))) LIKE 'PIC %'
            )
        )
      ORDER BY s."lastName", s."firstName"
    ) q
  ) s2
$$;

CREATE OR REPLACE FUNCTION public.odt_pic_trainings(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb) FROM (
    SELECT st."studentID",
      SUM(CASE WHEN st.duration ~ '^[0-9]+$' THEN CAST(st.duration AS bigint) ELSE 0 END) AS plan_m,
      SUM(CASE WHEN st.done ~ '^[0-9]+$' THEN CAST(st.done AS bigint) ELSE 0 END) AS done_m
    FROM naeron_bi_student_trainings st
    INNER JOIN naeron_bi_trainings t ON t."m_ID" = st."trainingID"
    WHERE st."studentID" = ANY(p_ids)
      AND (st."trainingStatus" IS NULL OR LOWER(TRIM(st."trainingStatus")) <> 'cancelcontract')
      AND (
        UPPER(TRIM(COALESCE(t.name, ''))) = 'PIC'
        OR UPPER(TRIM(COALESCE(t.name, ''))) LIKE 'PIC(%'
        OR UPPER(TRIM(COALESCE(t.name, ''))) LIKE 'PIC %'
      )
    GROUP BY st."studentID"
  ) q
$$;

CREATE OR REPLACE FUNCTION public.odt_pic_money(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb) FROM (
    SELECT ct."studentID", ct."currencyID",
      SUM(ROUND(mysql_num(ct.price), 2)) AS sum_price,
      SUM(ROUND(mysql_num(ct.payed), 2)) AS sum_payed
    FROM naeron_bi_student_contracts ct
    WHERE ct."studentID" = ANY(p_ids)
      AND (ct."contractStatus" IS NULL OR TRIM(ct."contractStatus") = '' OR LOWER(TRIM(ct."contractStatus")) <> 'cancelcontract')
      AND (LOWER(TRIM(COALESCE(ct.subject, ''))) NOT LIKE '%extra%' AND LOWER(TRIM(COALESCE(ct.subject, ''))) NOT LIKE '%ekstra%')
    GROUP BY ct."studentID", ct."currencyID"
    HAVING COALESCE(ct."currencyID", 0) > 0 OR SUM(ROUND(mysql_num(ct.price), 2)) <> 0 OR SUM(ROUND(mysql_num(ct.payed), 2)) <> 0
  ) q
$$;

CREATE OR REPLACE FUNCTION public.odt_pic_schedule(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb) FROM (
    SELECT si."studentID", si.currency AS "currencyID",
      SUM(ROUND(mysql_num(si.price), 2)) AS sum_schedule
    FROM naeron_bi_student_installments si
    INNER JOIN naeron_bi_student_contracts c ON c."m_ID" = si."contractID"
      AND (c."contractStatus" IS NULL OR TRIM(c."contractStatus") = '' OR LOWER(TRIM(c."contractStatus")) <> 'cancelcontract')
    WHERE si."studentID" = ANY(p_ids)
      AND (LOWER(TRIM(COALESCE(si."_lastRowStatus", ''))) IN ('create', 'update'))
    GROUP BY si."studentID", si.currency
    HAVING COALESCE(si.currency, 0) > 0 OR SUM(ROUND(mysql_num(si.price), 2)) <> 0
  ) q
$$;

CREATE OR REPLACE FUNCTION public.odt_pic_plan_due(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb) FROM (
    SELECT si."studentID", si.currency AS "currencyID",
      SUM(ROUND(mysql_num(si.price), 2)) AS sum_plan
    FROM naeron_bi_student_installments si
    INNER JOIN naeron_bi_student_contracts c ON c."m_ID" = si."contractID"
      AND (c."contractStatus" IS NULL OR TRIM(c."contractStatus") = '' OR LOWER(TRIM(c."contractStatus")) <> 'cancelcontract')
    WHERE si."studentID" = ANY(p_ids)
      AND (LOWER(TRIM(COALESCE(si."_lastRowStatus", ''))) IN ('create', 'update'))
      AND si."installmentDate" IS NOT NULL
      AND si."installmentDate"::date <= CURRENT_DATE
    GROUP BY si."studentID", si.currency
    HAVING COALESCE(si.currency, 0) > 0 OR SUM(ROUND(mysql_num(si.price), 2)) <> 0
  ) q
$$;

CREATE OR REPLACE FUNCTION public.odt_pic_flights(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT to_jsonb(q) AS row_json FROM (
      SELECT f."s_ID" AS "studentID",
        to_char(f."flightDate", 'YYYY-MM-DD') AS "flightDate",
        COALESCE(f."dutyName_", '') AS "dutyName",
        COALESCE(f."routeName_", '') AS "routeName",
        COALESCE(f."baseFromName_", '') AS "baseFrom",
        COALESCE(f."baseToName_", '') AS "baseTo",
        COALESCE(NULLIF(f."BlockTime",0), NULLIF(f."flightDuration",0), NULLIF(f.duration,0), 0) AS minutes
      FROM naeron_bi_flights f
      WHERE f."s_ID" = ANY(p_ids)
        AND COALESCE(f.realized, 0) = 1
        AND COALESCE(NULLIF(TRIM(f.canceled),''),'0') <> '1'
        AND f."flightDate" IS NOT NULL
      ORDER BY f."flightDate", f."m_ID"
    ) q
  ) s
$$;

CREATE OR REPLACE FUNCTION public.odt_pic_tarihler(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb) FROM (
    SELECT student_id, katilacagi_tarihler FROM northfly_odt_pic_takip WHERE student_id = ANY(p_ids)
  ) q
$$;

-- ───────────── odt_wapi_* ─────────────

CREATE OR REPLACE FUNCTION public.odt_wapi_send_log(
  p_author_email text, p_integration_id integer, p_phone text, p_kind text, p_body text,
  p_template_name text, p_ok boolean, p_error_text text, p_message_id text
)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO northfly_wapi_sends
      (created_at, author_email, integration_id, phone, kind, body, template_name, ok, error_text, message_id)
    VALUES (now() AT TIME ZONE 'UTC', p_author_email, p_integration_id, p_phone, p_kind, p_body, p_template_name, p_ok, p_error_text, p_message_id)
    RETURNING 1
  ) SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_wapi_sends(p_integration_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT to_jsonb(t) AS row_json FROM (
      SELECT id, created_at, author_email, integration_id, phone, kind, body, template_name, ok, error_text, message_id
      FROM northfly_wapi_sends
      WHERE integration_id = p_integration_id
      ORDER BY id DESC
      LIMIT 40
    ) t
  ) s
$$;

CREATE OR REPLACE FUNCTION public.odt_wapi_already_sent(p_template_name text, p_phone text, p_like text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
    SELECT id FROM northfly_wapi_sends
    WHERE ok = true AND template_name = p_template_name AND phone = p_phone
      AND created_at > (now() AT TIME ZONE 'UTC') - INTERVAL '14 days'
      AND COALESCE(body,'') ILIKE p_like
    LIMIT 1
  ) t
$$;

CREATE OR REPLACE FUNCTION public.odt_wapi_auto_ensure()
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO northfly_wapi_auto (id, enabled) VALUES (1, false) ON CONFLICT DO NOTHING
    RETURNING 1
  ) SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_wapi_auto_get()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
    SELECT enabled, last_run FROM northfly_wapi_auto WHERE id = 1
  ) t
$$;

CREATE OR REPLACE FUNCTION public.odt_wapi_auto_set(p_enabled boolean)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    UPDATE northfly_wapi_auto SET enabled = p_enabled WHERE id = 1
    RETURNING 1
  ) SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_wapi_auto_touch()
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    UPDATE northfly_wapi_auto SET last_run = now() AT TIME ZONE 'UTC' WHERE id = 1
    RETURNING 1
  ) SELECT count(*)::int FROM x
$$;

-- ───────────── odt_not_* ─────────────

CREATE OR REPLACE FUNCTION public.odt_not_insert(p_student_id integer, p_body text, p_author_name text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH ins AS (
    INSERT INTO northfly_odt_student_notes (student_id, body, created_at, author_name)
    VALUES (p_student_id, p_body, now() AT TIME ZONE 'UTC', p_author_name)
    RETURNING id, body, created_at, author_name
  ) SELECT COALESCE(jsonb_agg(to_jsonb(ins)), '[]'::jsonb) FROM ins
$$;

CREATE OR REPLACE FUNCTION public.odt_not_delete(p_id integer)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    DELETE FROM northfly_odt_student_notes WHERE id = p_id
    RETURNING 1
  ) SELECT count(*)::int FROM x
$$;

-- ───────────── odt_arama_* ─────────────

CREATE OR REPLACE FUNCTION public.odt_arama_students(p_like text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT to_jsonb(t) AS row_json FROM (
      SELECT "m_ID", "firstName", "lastName", "shortCode", gsm
      FROM naeron_bi_students
      WHERE "firstName" ILIKE p_like OR "lastName" ILIKE p_like
         OR (COALESCE("firstName",'') || ' ' || COALESCE("lastName",'')) ILIKE p_like
         OR (COALESCE("lastName",'') || ' ' || COALESCE("firstName",'')) ILIKE p_like
         OR "shortCode" ILIKE p_like OR gsm ILIKE p_like OR "studentNo" ILIKE p_like
      ORDER BY "lastName", "firstName"
      LIMIT 8
    ) t
  ) s
$$;

CREATE OR REPLACE FUNCTION public.odt_arama_employees(p_like text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT to_jsonb(t) AS row_json FROM (
      SELECT "m_ID", "firstName", "lastName", "shortCode", gsm
      FROM naeron_bi_employees
      WHERE "firstName" ILIKE p_like OR "lastName" ILIKE p_like
         OR (COALESCE("firstName",'') || ' ' || COALESCE("lastName",'')) ILIKE p_like
         OR (COALESCE("lastName",'') || ' ' || COALESCE("firstName",'')) ILIKE p_like
         OR "shortCode" ILIKE p_like OR gsm ILIKE p_like OR COALESCE(email,'') ILIKE p_like
      ORDER BY "lastName", "firstName"
      LIMIT 8
    ) t
  ) s
$$;

-- p_codes büyük harfe çevrilmiş kısa kodlar, p_gsms yalnızca rakamlardan oluşan numaralar.
CREATE OR REPLACE FUNCTION public.odt_arama_student_match(p_codes text[], p_gsms text[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
    SELECT "m_ID", "shortCode", gsm FROM naeron_bi_students
    WHERE UPPER(TRIM("shortCode")) = ANY(p_codes)
       OR REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(gsm,''),' ',''),'(',''),')',''),'-','') = ANY(p_gsms)
  ) t
$$;

-- ───────────── Yetkiler: yalnızca service_role ─────────────

REVOKE ALL ON FUNCTION public.odt_yetki_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_yetki_user_by_email(text) TO service_role;
REVOKE ALL ON FUNCTION public.odt_yetki_user_by_id(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_yetki_user_by_id(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_yetki_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_yetki_user_id_by_email(text) TO service_role;
REVOKE ALL ON FUNCTION public.odt_yetki_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_yetki_users() TO service_role;
REVOKE ALL ON FUNCTION public.odt_yetki_super_ids() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_yetki_super_ids() TO service_role;
REVOKE ALL ON FUNCTION public.odt_yetki_super_insert(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_yetki_super_insert(text) TO service_role;
REVOKE ALL ON FUNCTION public.odt_yetki_super_fix(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_yetki_super_fix(text) TO service_role;
REVOKE ALL ON FUNCTION public.odt_yetki_user_insert(text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_yetki_user_insert(text, text, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.odt_yetki_user_update(integer, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_yetki_user_update(integer, boolean, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.odt_yetki_modules(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_yetki_modules(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_yetki_modules_add(integer, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_yetki_modules_add(integer, text[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_yetki_modules_clear(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_yetki_modules_clear(integer) TO service_role;

REVOKE ALL ON FUNCTION public.odt_kaynak_ogrenci_sayisi() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_kaynak_ogrenci_sayisi() TO service_role;
REVOKE ALL ON FUNCTION public.odt_kaynak_sozlesme_sayisi() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_kaynak_sozlesme_sayisi() TO service_role;
REVOKE ALL ON FUNCTION public.odt_kaynak_ucus_sayisi() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_kaynak_ucus_sayisi() TO service_role;
REVOKE ALL ON FUNCTION public.odt_kaynak_kayit_sayisi() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_kaynak_kayit_sayisi() TO service_role;
REVOKE ALL ON FUNCTION public.odt_kaynak_list() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_kaynak_list() TO service_role;
REVOKE ALL ON FUNCTION public.odt_kaynak_upsert(text, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_kaynak_upsert(text, boolean, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.odt_pic_tarih_upsert(integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_pic_tarih_upsert(integer, text) TO service_role;
REVOKE ALL ON FUNCTION public.odt_pic_students() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_pic_students() TO service_role;
REVOKE ALL ON FUNCTION public.odt_pic_trainings(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_pic_trainings(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_pic_money(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_pic_money(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_pic_schedule(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_pic_schedule(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_pic_plan_due(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_pic_plan_due(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_pic_flights(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_pic_flights(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_pic_tarihler(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_pic_tarihler(integer[]) TO service_role;

REVOKE ALL ON FUNCTION public.odt_wapi_send_log(text, integer, text, text, text, text, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_wapi_send_log(text, integer, text, text, text, text, boolean, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.odt_wapi_sends(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_wapi_sends(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_wapi_already_sent(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_wapi_already_sent(text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.odt_wapi_auto_ensure() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_wapi_auto_ensure() TO service_role;
REVOKE ALL ON FUNCTION public.odt_wapi_auto_get() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_wapi_auto_get() TO service_role;
REVOKE ALL ON FUNCTION public.odt_wapi_auto_set(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_wapi_auto_set(boolean) TO service_role;
REVOKE ALL ON FUNCTION public.odt_wapi_auto_touch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_wapi_auto_touch() TO service_role;

REVOKE ALL ON FUNCTION public.odt_not_insert(integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_not_insert(integer, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.odt_not_delete(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_not_delete(integer) TO service_role;

REVOKE ALL ON FUNCTION public.odt_arama_students(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_arama_students(text) TO service_role;
REVOKE ALL ON FUNCTION public.odt_arama_employees(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_arama_employees(text) TO service_role;
REVOKE ALL ON FUNCTION public.odt_arama_student_match(text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_arama_student_match(text[], text[]) TO service_role;
