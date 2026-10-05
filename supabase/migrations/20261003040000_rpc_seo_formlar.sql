-- lib/seo-kayit.ts ve lib/wp-formlar.ts sorguları: her biri sabit bir fonksiyon (dinamik SQL yok).
-- Yalnızca service_role çağırabilir.

-- ---------------------------------------------------------------- SEO

CREATE OR REPLACE FUNCTION public.odt_seo_run_ok(p_run_date date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT to_jsonb(t) AS row_json FROM (
      SELECT ok FROM northfly_odt_seo_runs WHERE run_date = p_run_date LIMIT 1
    ) t
  ) s
$$;

CREATE OR REPLACE FUNCTION public.odt_seo_run_start(p_run_date date)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH x AS (
    INSERT INTO northfly_odt_seo_runs (run_date, started_at, finished_at, posts_n, pages_n, ok, error_text)
    VALUES (p_run_date, now(), NULL, 0, 0, false, NULL)
    ON CONFLICT (run_date) DO UPDATE SET started_at = now(), finished_at = NULL, ok = false, error_text = NULL
    RETURNING 1
  )
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_seo_run_finish(p_run_date date, p_posts_n integer, p_pages_n integer)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH x AS (
    UPDATE northfly_odt_seo_runs
    SET finished_at = now(), posts_n = p_posts_n, pages_n = p_pages_n, ok = true, error_text = NULL
    WHERE run_date = p_run_date
    RETURNING 1
  )
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_seo_run_fail(p_run_date date, p_error_text text)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH x AS (
    UPDATE northfly_odt_seo_runs
    SET finished_at = now(), ok = false, error_text = p_error_text
    WHERE run_date = p_run_date
    RETURNING 1
  )
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_seo_rows_delete(p_run_date date)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH x AS (
    DELETE FROM northfly_odt_seo_rows WHERE run_date = p_run_date RETURNING 1
  )
  SELECT count(*)::int FROM x
$$;

-- p_rows: [{wp_id, link, title, score, keyword, seo_title, description}, ...]
CREATE OR REPLACE FUNCTION public.odt_seo_rows_insert(p_run_date date, p_kind text, p_rows jsonb)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH x AS (
    INSERT INTO northfly_odt_seo_rows
      (run_date, kind, wp_id, link, title, score, keyword, seo_title, description)
    SELECT p_run_date, p_kind, r.wp_id, r.link, r.title, r.score::smallint, r.keyword, r.seo_title, r.description
    FROM jsonb_to_recordset(p_rows) AS r(
      wp_id integer, link text, title text, score numeric, keyword text, seo_title text, description text
    )
    RETURNING 1
  )
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_seo_rows_list(p_run_date date, p_kind text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT to_jsonb(t) AS row_json FROM (
      SELECT run_date, kind, wp_id, link, title, score, keyword, seo_title, description
      FROM northfly_odt_seo_rows
      WHERE run_date = p_run_date AND kind = p_kind
    ) t
  ) s
$$;

CREATE OR REPLACE FUNCTION public.odt_seo_ok_days(p_from date, p_to date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT to_jsonb(t) AS row_json FROM (
      SELECT run_date FROM northfly_odt_seo_runs
      WHERE ok = true AND run_date >= p_from AND run_date <= p_to
      ORDER BY run_date
    ) t
  ) s
$$;

CREATE OR REPLACE FUNCTION public.odt_seo_last_ok_run()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT to_jsonb(t) AS row_json FROM (
      SELECT run_date, finished_at FROM northfly_odt_seo_runs
      WHERE ok = true ORDER BY run_date DESC LIMIT 1
    ) t
  ) s
$$;

CREATE OR REPLACE FUNCTION public.odt_seo_prev_ok_day(p_before date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT to_jsonb(t) AS row_json FROM (
      SELECT run_date FROM northfly_odt_seo_runs
      WHERE ok = true AND run_date < p_before
      ORDER BY run_date DESC LIMIT 1
    ) t
  ) s
$$;

-- ---------------------------------------------------------------- WP formları

CREATE OR REPLACE FUNCTION public.odt_form_list()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT to_jsonb(t) AS row_json FROM (
      SELECT f.form_id, f.title, f.field_labels, f.active, f.active_manual,
        CASE WHEN EXISTS (
          SELECT 1 FROM northfly_wp_form_entries e
          WHERE e.form_id = f.form_id AND e.entry_date >= now() - interval '1 month'
        ) THEN true ELSE false END AS auto_active
      FROM northfly_wp_forms f
      ORDER BY title
    ) t
  ) s
$$;

CREATE OR REPLACE FUNCTION public.odt_form_auto_active(p_form_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_array(jsonb_build_object('auto_active',
    CASE WHEN EXISTS (
      SELECT 1 FROM northfly_wp_form_entries e
      WHERE e.form_id = p_form_id AND e.entry_date >= now() - interval '1 month'
    ) THEN true ELSE false END))
$$;

CREATE OR REPLACE FUNCTION public.odt_form_set_active(p_form_id integer, p_active boolean, p_active_manual boolean)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH x AS (
    UPDATE northfly_wp_forms SET active = p_active, active_manual = p_active_manual
    WHERE form_id = p_form_id
    RETURNING 1
  )
  SELECT count(*)::int FROM x
$$;

-- p_rows: [{form_id, title, field_labels, field_types}, ...] (form_id tekil olmalı)
CREATE OR REPLACE FUNCTION public.odt_form_upsert(p_rows jsonb)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH x AS (
    INSERT INTO northfly_wp_forms (form_id, title, field_labels, field_types, active, updated_at)
    SELECT r.form_id, r.title, r.field_labels, r.field_types, false, now()
    FROM jsonb_to_recordset(p_rows) AS r(form_id integer, title text, field_labels text, field_types text)
    ON CONFLICT (form_id) DO UPDATE SET title = EXCLUDED.title, field_labels = EXCLUDED.field_labels,
      field_types = EXCLUDED.field_types, updated_at = now()
    RETURNING 1
  )
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_form_fields()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT to_jsonb(t) AS row_json FROM (
      SELECT form_id, field_labels, field_types FROM northfly_wp_forms
    ) t
  ) s
$$;

-- p_rows: [{entry_id, form_id, entry_date, status, fields_json, ad, telefon, eposta, ozet}, ...] (entry_id tekil olmalı)
CREATE OR REPLACE FUNCTION public.odt_form_entries_upsert(p_rows jsonb)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH x AS (
    INSERT INTO northfly_wp_form_entries
      (entry_id, form_id, entry_date, status, fields_json, ad, telefon, eposta, ozet, pulled_at)
    SELECT r.entry_id, r.form_id, r.entry_date, r.status, r.fields_json, r.ad, r.telefon, r.eposta, r.ozet, now()
    FROM jsonb_to_recordset(p_rows) AS r(
      entry_id integer, form_id integer, entry_date timestamp, status text, fields_json text,
      ad text, telefon text, eposta text, ozet text
    )
    ON CONFLICT (entry_id) DO UPDATE SET
      form_id = EXCLUDED.form_id, entry_date = EXCLUDED.entry_date, status = EXCLUDED.status,
      fields_json = EXCLUDED.fields_json, ad = EXCLUDED.ad, telefon = EXCLUDED.telefon,
      eposta = EXCLUDED.eposta, ozet = EXCLUDED.ozet, pulled_at = now()
    RETURNING 1
  )
  SELECT count(*)::int FROM x
$$;

-- p_form_ids: açık formlar; p_form_id: tek form süzgeci (NULL = yok); p_search: aranan metin (NULL = yok)
CREATE OR REPLACE FUNCTION public.odt_form_entries_list(p_form_ids integer[], p_form_id integer, p_search text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT to_jsonb(t) AS row_json FROM (
      SELECT entry_id, form_id, entry_date, ad, telefon, eposta, ozet, fields_json
      FROM northfly_wp_form_entries
      WHERE form_id = ANY (p_form_ids)
        AND (p_form_id IS NULL OR form_id = p_form_id)
        AND (p_search IS NULL OR (
          ad ILIKE '%' || p_search || '%' OR telefon ILIKE '%' || p_search || '%'
          OR eposta ILIKE '%' || p_search || '%' OR ozet ILIKE '%' || p_search || '%'
        ))
      ORDER BY entry_date DESC NULLS LAST, entry_id DESC
      LIMIT 300
    ) t
  ) s
$$;

-- ---------------------------------------------------------------- Yetkiler

REVOKE ALL ON FUNCTION public.odt_seo_run_ok(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_seo_run_ok(date) TO service_role;
REVOKE ALL ON FUNCTION public.odt_seo_run_start(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_seo_run_start(date) TO service_role;
REVOKE ALL ON FUNCTION public.odt_seo_run_finish(date, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_seo_run_finish(date, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_seo_run_fail(date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_seo_run_fail(date, text) TO service_role;
REVOKE ALL ON FUNCTION public.odt_seo_rows_delete(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_seo_rows_delete(date) TO service_role;
REVOKE ALL ON FUNCTION public.odt_seo_rows_insert(date, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_seo_rows_insert(date, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_seo_rows_list(date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_seo_rows_list(date, text) TO service_role;
REVOKE ALL ON FUNCTION public.odt_seo_ok_days(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_seo_ok_days(date, date) TO service_role;
REVOKE ALL ON FUNCTION public.odt_seo_last_ok_run() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_seo_last_ok_run() TO service_role;
REVOKE ALL ON FUNCTION public.odt_seo_prev_ok_day(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_seo_prev_ok_day(date) TO service_role;

REVOKE ALL ON FUNCTION public.odt_form_list() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_form_list() TO service_role;
REVOKE ALL ON FUNCTION public.odt_form_auto_active(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_form_auto_active(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_form_set_active(integer, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_form_set_active(integer, boolean, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.odt_form_upsert(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_form_upsert(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_form_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_form_fields() TO service_role;
REVOKE ALL ON FUNCTION public.odt_form_entries_upsert(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_form_entries_upsert(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_form_entries_list(integer[], integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_form_entries_list(integer[], integer, text) TO service_role;
