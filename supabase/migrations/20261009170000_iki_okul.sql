-- İki okul: mevcut satırlar AlfaAIR kalır. Aynı m_ID iki okulda ayrı durur.
-- Okuma fonksiyonları aynı isimli görünüme bakar; görünüm seçili okula göre süzülür.
-- Seçim tek istekte odt_okul_call içinde ayarlanır.

CREATE OR REPLACE FUNCTION public.naeron_bi_okul_ata()
RETURNS trigger
LANGUAGE plpgsql
AS $tr$
BEGIN
  IF NEW.okul IS NULL OR btrim(NEW.okul) = '' OR NEW.okul NOT IN ('alfaair', 'northfly') THEN
    NEW.okul := CASE
      WHEN current_setting('odt.okul', true) IN ('alfaair', 'northfly') THEN current_setting('odt.okul', true)
      ELSE 'alfaair'
    END;
  END IF;
  RETURN NEW;
END;
$tr$;

DO $mig$
DECLARE
  t text;
  tables text[] := ARRAY[
    'naeron_bi_aircrafts_simulators',
    'naeron_bi_corporate_labels',
    'naeron_bi_currencies',
    'naeron_bi_employees',
    'naeron_bi_facilities',
    'naeron_bi_fleets',
    'naeron_bi_flights',
    'naeron_bi_groups',
    'naeron_bi_student_certificates',
    'naeron_bi_student_contracts',
    'naeron_bi_student_installments',
    'naeron_bi_student_payments',
    'naeron_bi_student_trainings',
    'naeron_bi_students',
    'naeron_bi_trainings'
  ];
  conname text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL
       AND to_regclass('public.' || t || '_data') IS NULL
       AND (SELECT relkind FROM pg_class WHERE oid = ('public.' || t)::regclass) = 'r' THEN
      EXECUTE format('ALTER TABLE public.%I RENAME TO %I', t, t || '_data');
    END IF;

    IF to_regclass('public.' || t || '_data') IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS okul text NOT NULL DEFAULT ''alfaair''', t || '_data');

    FOR conname IN
      SELECT c.conname
      FROM pg_constraint c
      WHERE c.conrelid = ('public.' || t || '_data')::regclass
        AND c.contype = 'u'
        AND pg_get_constraintdef(c.oid) NOT ILIKE '%okul%'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t || '_data', conname);
    END LOOP;

    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (okul, "m_ID")',
      t || '_okul_mid',
      t || '_data'
    );

    EXECUTE format('DROP TRIGGER IF EXISTS naeron_bi_okul_ata ON public.%I', t || '_data');
    EXECUTE format(
      'CREATE TRIGGER naeron_bi_okul_ata BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.naeron_bi_okul_ata()',
      t || '_data'
    );

    EXECUTE format(
      'CREATE OR REPLACE VIEW public.%I AS SELECT * FROM public.%I WHERE okul = CASE WHEN current_setting(''odt.okul'', true) IN (''alfaair'', ''northfly'') THEN current_setting(''odt.okul'', true) ELSE ''alfaair'' END',
      t,
      t || '_data'
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t || '_data');
  END LOOP;
END
$mig$;

-- Upsert artık veri tablosuna yazar; çakışma okul + m_ID üzerinden çözülür.
DO $mig$
DECLARE
  r record;
  def text;
  t text;
  tables text[] := ARRAY[
    'naeron_bi_aircrafts_simulators',
    'naeron_bi_corporate_labels',
    'naeron_bi_currencies',
    'naeron_bi_employees',
    'naeron_bi_facilities',
    'naeron_bi_fleets',
    'naeron_bi_flights',
    'naeron_bi_groups',
    'naeron_bi_student_certificates',
    'naeron_bi_student_contracts',
    'naeron_bi_student_installments',
    'naeron_bi_student_payments',
    'naeron_bi_student_trainings',
    'naeron_bi_students',
    'naeron_bi_trainings'
  ];
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'odt_naeron_upsert%'
  LOOP
    def := pg_get_functiondef(r.oid);
    FOREACH t IN ARRAY tables LOOP
      def := regexp_replace(def, 'public\.' || t || '(?!_data)', 'public.' || t || '_data', 'g');
    END LOOP;
    def := replace(def, 'ON CONFLICT ("m_ID")', 'ON CONFLICT (okul, "m_ID")');
    EXECUTE def;
  END LOOP;
END
$mig$;

ALTER TABLE public.northfly_odt_naeron_sync ADD COLUMN IF NOT EXISTS okul text NOT NULL DEFAULT 'alfaair';

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.northfly_odt_naeron_sync'::regclass
      AND contype = 'p'
      AND pg_get_constraintdef(oid) ILIKE '%okul%'
  ) THEN
    ALTER TABLE public.northfly_odt_naeron_sync DROP CONSTRAINT IF EXISTS northfly_odt_naeron_sync_pkey;
    ALTER TABLE public.northfly_odt_naeron_sync ADD PRIMARY KEY (okul, table_name);
  END IF;
END
$mig$;

CREATE OR REPLACE FUNCTION public.odt_naeron_state_list()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  FROM (
    SELECT table_name, last_server_time, last_run_at, row_count, ok, error_text
    FROM public.northfly_odt_naeron_sync
    WHERE okul = CASE
      WHEN current_setting('odt.okul', true) IN ('alfaair', 'northfly') THEN current_setting('odt.okul', true)
      ELSE 'alfaair'
    END
    ORDER BY table_name
  ) t
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_state_set(p_table text, p_server_time timestamp, p_rows integer, p_ok boolean, p_error text)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.northfly_odt_naeron_sync (okul, table_name, last_server_time, last_run_at, row_count, ok, error_text)
    VALUES (
      CASE
        WHEN current_setting('odt.okul', true) IN ('alfaair', 'northfly') THEN current_setting('odt.okul', true)
        ELSE 'alfaair'
      END,
      p_table, p_server_time, now() AT TIME ZONE 'UTC', p_rows, p_ok, left(p_error, 500)
    )
    ON CONFLICT (okul, table_name) DO UPDATE SET
      last_server_time = COALESCE(EXCLUDED.last_server_time, public.northfly_odt_naeron_sync.last_server_time),
      last_run_at = EXCLUDED.last_run_at,
      row_count = EXCLUDED.row_count,
      ok = EXCLUDED.ok,
      error_text = EXCLUDED.error_text
    RETURNING 1
  )
  SELECT count(*)::int FROM x
$$;

CREATE TABLE IF NOT EXISTS public.northfly_odt_user_okul (
  user_id integer NOT NULL REFERENCES public.northfly_odt_users(id) ON DELETE CASCADE,
  okul text NOT NULL,
  PRIMARY KEY (user_id, okul)
);
ALTER TABLE public.northfly_odt_user_okul ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.odt_yetki_okullar(p_user_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(okul ORDER BY okul), '[]'::jsonb)
  FROM public.northfly_odt_user_okul
  WHERE user_id = p_user_id
$$;

CREATE OR REPLACE FUNCTION public.odt_yetki_okullar_set(p_user_id integer, p_okullar text[])
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.northfly_odt_user_okul WHERE user_id = p_user_id;
  INSERT INTO public.northfly_odt_user_okul (user_id, okul)
  SELECT DISTINCT p_user_id, x
  FROM unnest(COALESCE(p_okullar, ARRAY[]::text[])) AS x
  WHERE x IN ('alfaair', 'northfly');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.odt_okul_call(p_okul text, p_fn text, p_args jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  fn_oid oid;
  n integer;
  rec record;
  assigns text[] := ARRAY[]::text[];
  expr text;
  sql text;
  result jsonb;
  okul text;
BEGIN
  IF p_fn IS NULL OR p_fn !~ '^odt_[a-z0-9_]+$' OR p_fn = 'odt_okul_call' THEN
    RAISE EXCEPTION 'izin yok';
  END IF;

  SELECT count(*) INTO n
  FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.proname = p_fn;

  IF n <> 1 THEN
    RAISE EXCEPTION 'fonksiyon yok';
  END IF;

  SELECT p.oid INTO fn_oid
  FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.proname = p_fn;

  okul := CASE WHEN p_okul IN ('alfaair', 'northfly') THEN p_okul ELSE 'alfaair' END;
  PERFORM set_config('odt.okul', okul, true);

  FOR rec IN
    SELECT a.argname, t.typname
    FROM pg_proc p
    JOIN LATERAL unnest(p.proargnames) WITH ORDINALITY AS a(argname, ord) ON a.ord <= p.pronargs
    JOIN LATERAL unnest(p.proargtypes::oid[]) WITH ORDINALITY AS x(typoid, ord) ON x.ord = a.ord
    JOIN pg_type t ON t.oid = x.typoid
    WHERE p.oid = fn_oid AND a.argname IS NOT NULL
    ORDER BY a.ord
  LOOP
    IF p_args IS NULL OR NOT (p_args ? rec.argname) THEN
      CONTINUE;
    END IF;

    expr := CASE rec.typname
      WHEN 'int2' THEN format('CASE WHEN jsonb_typeof($1->%L) = ''number'' THEN ($1->>%L)::smallint ELSE NULL END', rec.argname, rec.argname)
      WHEN 'int4' THEN format('CASE WHEN jsonb_typeof($1->%L) = ''number'' THEN ($1->>%L)::integer ELSE NULL END', rec.argname, rec.argname)
      WHEN 'int8' THEN format('CASE WHEN jsonb_typeof($1->%L) = ''number'' THEN ($1->>%L)::bigint ELSE NULL END', rec.argname, rec.argname)
      WHEN 'bool' THEN format('CASE WHEN jsonb_typeof($1->%L) = ''boolean'' THEN ($1->>%L)::boolean ELSE NULL END', rec.argname, rec.argname)
      WHEN 'date' THEN format('CASE WHEN jsonb_typeof($1->%L) = ''string'' THEN ($1->>%L)::date ELSE NULL END', rec.argname, rec.argname)
      WHEN 'timestamp' THEN format('CASE WHEN jsonb_typeof($1->%L) = ''string'' THEN ($1->>%L)::timestamp ELSE NULL END', rec.argname, rec.argname)
      WHEN 'timestamptz' THEN format('CASE WHEN jsonb_typeof($1->%L) = ''string'' THEN ($1->>%L)::timestamptz ELSE NULL END', rec.argname, rec.argname)
      WHEN 'jsonb' THEN format('CASE WHEN jsonb_typeof($1->%L) IS NULL THEN NULL ELSE $1->%L END', rec.argname, rec.argname)
      WHEN 'numeric' THEN format('CASE WHEN jsonb_typeof($1->%L) = ''number'' THEN ($1->>%L)::numeric ELSE NULL END', rec.argname, rec.argname)
      WHEN 'float8' THEN format('CASE WHEN jsonb_typeof($1->%L) = ''number'' THEN ($1->>%L)::double precision ELSE NULL END', rec.argname, rec.argname)
      WHEN '_int4' THEN format('CASE WHEN jsonb_typeof($1->%L) = ''array'' THEN ARRAY(SELECT jsonb_array_elements_text($1->%L)::integer) ELSE NULL END', rec.argname, rec.argname)
      WHEN '_int8' THEN format('CASE WHEN jsonb_typeof($1->%L) = ''array'' THEN ARRAY(SELECT jsonb_array_elements_text($1->%L)::bigint) ELSE NULL END', rec.argname, rec.argname)
      WHEN '_text' THEN format('CASE WHEN jsonb_typeof($1->%L) = ''array'' THEN ARRAY(SELECT jsonb_array_elements_text($1->%L)) ELSE NULL END', rec.argname, rec.argname)
      WHEN '_varchar' THEN format('CASE WHEN jsonb_typeof($1->%L) = ''array'' THEN ARRAY(SELECT jsonb_array_elements_text($1->%L))::varchar[] ELSE NULL END', rec.argname, rec.argname)
      ELSE format('CASE WHEN jsonb_typeof($1->%L) IN (''string'', ''number'') THEN $1->>%L ELSE NULL END', rec.argname, rec.argname)
    END;

    assigns := assigns || format('%I := %s', rec.argname, expr);
  END LOOP;

  IF array_length(assigns, 1) IS NULL THEN
    sql := format('SELECT to_jsonb(public.%I())', p_fn);
    EXECUTE sql INTO result;
  ELSE
    sql := format('SELECT to_jsonb(public.%I(%s))', p_fn, array_to_string(assigns, ', '));
    EXECUTE sql USING COALESCE(p_args, '{}'::jsonb) INTO result;
  END IF;

  RETURN result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.odt_okul_call(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_okul_call(text, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_yetki_okullar(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_yetki_okullar(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_yetki_okullar_set(integer, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_yetki_okullar_set(integer, text[]) TO service_role;
REVOKE ALL ON FUNCTION public.naeron_bi_okul_ata() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
