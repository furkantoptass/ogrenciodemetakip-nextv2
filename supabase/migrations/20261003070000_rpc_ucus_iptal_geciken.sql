-- Uçuşlar, İptaller ve Geciken ödemeler ekranları.

-- Filtre seçenekleri: uçuşlarda geçen öğretmenler ve uçaklar.
CREATE OR REPLACE FUNCTION public.odt_ucus_filtreler()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_array(jsonb_build_object(
    'instructors', (
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.name), '[]'::jsonb)
      FROM (SELECT f."i_ID" AS id, max(TRIM(f."instructorName_")) AS name
            FROM public.naeron_bi_flights f
            WHERE f."i_ID" IS NOT NULL AND NULLIF(TRIM(f."instructorName_"), '') IS NOT NULL
            GROUP BY f."i_ID") x),
    'aircraft', (
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.name), '[]'::jsonb)
      FROM (SELECT f."a_ID" AS id, max(COALESCE(NULLIF(TRIM(f."aircraftName_"), ''), f.aircraft)) AS name
            FROM public.naeron_bi_flights f
            WHERE f."a_ID" IS NOT NULL AND COALESCE(NULLIF(TRIM(f."aircraftName_"), ''), NULLIF(TRIM(f.aircraft), '')) IS NOT NULL
            GROUP BY f."a_ID") x)
  ));
$$;

-- Uçuş listesi + dönem özeti. p_status: 'realized' | 'canceled' | NULL (hepsi). Özet durum filtresinden bağımsızdır.
CREATE OR REPLACE FUNCTION public.odt_ucus_sayfa(
  p_from date, p_to date, p_q text, p_student integer, p_instructor integer, p_aircraft integer, p_status text, p_limit integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH f AS (
  SELECT f."m_ID" AS id, f."flightDate" AS ts, f.type, f."s_ID", f."s_Type",
         COALESCE(f."studentName_", '') AS student, COALESCE(f."instructorName_", '') AS instructor,
         COALESCE(NULLIF(TRIM(f."aircraftName_"), ''), f.aircraft, '') AS aircraft,
         COALESCE(f."dutyName_", '') AS duty, COALESCE(f."routeName_", '') AS route,
         COALESCE(TRIM(f."cancelNote"), '') AS cancel_note,
         COALESCE(NULLIF(f."BlockTime", 0), NULLIF(f."flightDuration", 0), NULLIF(f.duration, 0), 0) AS minutes,
         (COALESCE(NULLIF(TRIM(f.canceled), ''), '0') <> '0') AS canceled
  FROM public.naeron_bi_flights f
  WHERE LOWER(TRIM(COALESCE(f."_lastRowStatus", ''))) <> 'destroy'
    AND f."flightDate" IS NOT NULL
    AND (p_from IS NULL OR f."flightDate"::date >= p_from)
    AND (p_to IS NULL OR f."flightDate"::date <= p_to)
    AND (p_student IS NULL OR (f."s_ID" = p_student AND COALESCE(f."s_Type", 'student') = 'student'))
    AND (p_instructor IS NULL OR f."i_ID" = p_instructor)
    AND (p_aircraft IS NULL OR f."a_ID" = p_aircraft)
    AND (p_q IS NULL OR f."studentName_" ILIKE '%' || p_q || '%' OR f."instructorName_" ILIKE '%' || p_q || '%'
         OR f."dutyName_" ILIKE '%' || p_q || '%')
),
sel AS (
  SELECT * FROM f
  WHERE p_status IS NULL OR (p_status = 'canceled' AND canceled) OR (p_status = 'realized' AND NOT canceled)
)
SELECT jsonb_build_array(jsonb_build_object(
  'ozet', (SELECT jsonb_build_object(
      'total', count(*),
      'realized', count(*) FILTER (WHERE NOT canceled),
      'canceled', count(*) FILTER (WHERE canceled),
      'minutes', COALESCE(SUM(minutes) FILTER (WHERE NOT canceled), 0),
      'students', count(DISTINCT "s_ID") FILTER (WHERE NOT canceled AND COALESCE("s_Type", '') = 'student')) FROM f),
  'matched', (SELECT count(*) FROM sel),
  'rows', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.ts DESC, x.id DESC), '[]'::jsonb)
    FROM (
      SELECT id, ts, to_char(ts, 'YYYY-MM-DD') AS date, to_char(ts, 'HH24:MI') AS time, type,
             CASE WHEN COALESCE("s_Type", '') = 'student' THEN "s_ID" END AS "studentId",
             student, instructor, aircraft, duty, route, cancel_note AS "cancelNote", minutes, canceled
      FROM sel ORDER BY ts DESC, id DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 1000)) x)
));
$$;

-- İptal analizi: dönem içinde iptal oranları ve iptal edilen uçuşların listesi.
CREATE OR REPLACE FUNCTION public.odt_iptal_sayfa(p_from date, p_to date, p_q text, p_only_note boolean, p_limit integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH f AS (
  SELECT f."m_ID" AS id, f."flightDate" AS ts, f."s_ID", f."s_Type", f."i_ID", f."a_ID",
         COALESCE(f."studentName_", '') AS student, COALESCE(f."instructorName_", '') AS instructor,
         COALESCE(NULLIF(TRIM(f."aircraftName_"), ''), f.aircraft, '') AS aircraft,
         COALESCE(f."dutyName_", '') AS duty,
         COALESCE(TRIM(f."cancelNote"), '') AS cancel_note,
         (COALESCE(NULLIF(TRIM(f.canceled), ''), '0') <> '0') AS canceled
  FROM public.naeron_bi_flights f
  WHERE LOWER(TRIM(COALESCE(f."_lastRowStatus", ''))) <> 'destroy'
    AND f."flightDate" IS NOT NULL
    AND (p_from IS NULL OR f."flightDate"::date >= p_from)
    AND (p_to IS NULL OR f."flightDate"::date <= p_to)
),
sel AS (
  SELECT * FROM f
  WHERE canceled
    AND (NOT COALESCE(p_only_note, false) OR cancel_note <> '')
    AND (p_q IS NULL OR student ILIKE '%' || p_q || '%' OR instructor ILIKE '%' || p_q || '%'
         OR cancel_note ILIKE '%' || p_q || '%' OR duty ILIKE '%' || p_q || '%')
)
SELECT jsonb_build_array(jsonb_build_object(
  'ozet', (SELECT jsonb_build_object(
      'total', count(*),
      'canceled', count(*) FILTER (WHERE canceled),
      'withNote', count(*) FILTER (WHERE canceled AND cancel_note <> '')) FROM f),
  'monthly', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.month), '[]'::jsonb)
    FROM (SELECT to_char(date_trunc('month', ts), 'YYYY-MM') AS month, count(*)::int AS total,
                 (count(*) FILTER (WHERE canceled))::int AS canceled
          FROM f GROUP BY 1) x),
  'byInstructor', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.canceled DESC, x.total DESC), '[]'::jsonb)
    FROM (SELECT max(instructor) AS name, count(*)::int AS total, (count(*) FILTER (WHERE canceled))::int AS canceled
          FROM f WHERE "i_ID" IS NOT NULL AND instructor <> ''
          GROUP BY "i_ID" HAVING count(*) FILTER (WHERE canceled) > 0
          ORDER BY 3 DESC, 2 DESC LIMIT 15) x),
  'byAircraft', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.canceled DESC, x.total DESC), '[]'::jsonb)
    FROM (SELECT max(aircraft) AS name, count(*)::int AS total, (count(*) FILTER (WHERE canceled))::int AS canceled
          FROM f WHERE "a_ID" IS NOT NULL AND aircraft <> ''
          GROUP BY "a_ID" HAVING count(*) FILTER (WHERE canceled) > 0
          ORDER BY 3 DESC, 2 DESC LIMIT 15) x),
  'byStudent', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.canceled DESC, x.total DESC), '[]'::jsonb)
    FROM (SELECT "s_ID" AS "studentId", max(student) AS name, count(*)::int AS total,
                 (count(*) FILTER (WHERE canceled))::int AS canceled
          FROM f WHERE COALESCE("s_Type", '') = 'student' AND "s_ID" IS NOT NULL AND student <> ''
          GROUP BY "s_ID" HAVING count(*) FILTER (WHERE canceled) > 0
          ORDER BY 4 DESC, 3 DESC LIMIT 15) x),
  'matched', (SELECT count(*) FROM sel),
  'rows', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.ts DESC, x.id DESC), '[]'::jsonb)
    FROM (
      SELECT id, ts, to_char(ts, 'YYYY-MM-DD') AS date,
             CASE WHEN COALESCE("s_Type", '') = 'student' THEN "s_ID" END AS "studentId",
             student, instructor, aircraft, duty, cancel_note AS "cancelNote"
      FROM sel ORDER BY ts DESC, id DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 1000)) x)
));
$$;

-- Geciken ödemeler: vadesi geçmiş taksitler, plana göre geride kalan öğrenciler ve açık sözleşme bakiyeleri.
-- "Geride kalan" hesabı öğrenci listesindekiyle aynıdır: vadesi gelen taksit toplamı − sözleşmelerde tahsil edilen.
CREATE OR REPLACE FUNCTION public.odt_geciken_sayfa()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH st AS (
  SELECT s."m_ID" AS id, TRIM(COALESCE(s."firstName", '') || ' ' || COALESCE(s."lastName", '')) AS name,
         COALESCE(s.gsm, '') AS gsm, COALESCE(s."trainingStatus", '') AS training_status
  FROM public.naeron_bi_students s
  WHERE LOWER(TRIM(COALESCE(s."_lastRowStatus", ''))) IN ('create', 'update')
    AND LOWER(TRIM(COALESCE(s."trainingStatus", ''))) <> 'cancelcontract'
),
ct AS (
  SELECT c."m_ID", c."studentID", c."currencyID", c.subject,
         public.mysql_num(c.price) AS price, public.mysql_num(c.payed) AS payed,
         (LOWER(COALESCE(c.subject, '')) LIKE '%extra%' OR LOWER(COALESCE(c.subject, '')) LIKE '%ekstra%') AS is_extra
  FROM public.naeron_bi_student_contracts c
  WHERE LOWER(TRIM(COALESCE(c."_lastRowStatus", ''))) IN ('create', 'update')
    AND LOWER(TRIM(COALESCE(c."contractStatus", ''))) <> 'cancelcontract'
),
inst AS (
  SELECT si."m_ID", si."studentID", si."contractID", si.currency, si."installmentDate"::date AS d,
         COALESCE(si.name, '') AS name, public.mysql_num(si.price) AS amount, LOWER(TRIM(COALESCE(si.status, ''))) AS status
  FROM public.naeron_bi_student_installments si
  WHERE LOWER(TRIM(COALESCE(si."_lastRowStatus", ''))) IN ('create', 'update')
    AND si."installmentDate" IS NOT NULL
),
paid AS (
  SELECT "studentID", "currencyID", SUM(payed) AS paid FROM ct WHERE NOT is_extra GROUP BY 1, 2
),
dr AS (
  SELECT i."studentID", i.currency, i.d,
         SUM(i.amount) OVER (PARTITION BY i."studentID", i.currency ORDER BY i.d, i."m_ID") AS cum
  FROM inst i JOIN ct ON ct."m_ID" = i."contractID"
  WHERE i.d <= CURRENT_DATE
),
behind AS (
  SELECT dr."studentID", dr.currency, MAX(dr.cum) AS due, COALESCE(p.paid, 0) AS paid,
         MIN(dr.d) FILTER (WHERE dr.cum > COALESCE(p.paid, 0) + 0.5) AS since
  FROM dr LEFT JOIN paid p ON p."studentID" = dr."studentID" AND p."currencyID" IS NOT DISTINCT FROM dr.currency
  GROUP BY dr."studentID", dr.currency, p.paid
  HAVING MAX(dr.cum) - COALESCE(p.paid, 0) > 0.5
)
SELECT jsonb_build_array(jsonb_build_object(
  'installments', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.date, x.name), '[]'::jsonb)
    FROM (
      SELECT st.id AS "studentId", st.name, st.gsm, COALESCE(ct.subject, '') AS subject, i.name AS installment,
             to_char(i.d, 'YYYY-MM-DD') AS date, (CURRENT_DATE - i.d)::int AS days,
             i.amount::float8 AS amount, cu.symbol, cu.shortcode
      FROM inst i
      JOIN st ON st.id = i."studentID"
      LEFT JOIN ct ON ct."m_ID" = i."contractID"
      LEFT JOIN public.naeron_bi_currencies cu ON cu."m_ID" = i.currency
      WHERE i.d < CURRENT_DATE AND i.status <> 'payed'
        AND (i."contractID" IS NULL OR ct."m_ID" IS NOT NULL)) x),
  'behind', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.behind DESC), '[]'::jsonb)
    FROM (
      SELECT st.id AS "studentId", st.name, st.gsm, b.due::float8 AS due, b.paid::float8 AS paid,
             (b.due - b.paid)::float8 AS behind, to_char(b.since, 'YYYY-MM-DD') AS since,
             (CURRENT_DATE - b.since)::int AS days, cu.symbol, cu.shortcode
      FROM behind b
      JOIN st ON st.id = b."studentID"
      LEFT JOIN public.naeron_bi_currencies cu ON cu."m_ID" = b.currency) x),
  'open', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.remaining DESC), '[]'::jsonb)
    FROM (
      SELECT st.id AS "studentId", st.name, st.training_status AS "trainingStatus",
             SUM(ct.price)::float8 AS price, SUM(ct.payed)::float8 AS payed,
             (SUM(ct.price) - SUM(ct.payed))::float8 AS remaining, count(*)::int AS contracts,
             cu.symbol, cu.shortcode
      FROM ct
      JOIN st ON st.id = ct."studentID"
      LEFT JOIN public.naeron_bi_currencies cu ON cu."m_ID" = ct."currencyID"
      GROUP BY st.id, st.name, st.training_status, ct."currencyID", cu.symbol, cu.shortcode
      HAVING SUM(ct.price) - SUM(ct.payed) > 0.5
      ORDER BY 6 DESC LIMIT 300) x)
));
$$;

REVOKE ALL ON FUNCTION public.odt_ucus_filtreler() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ucus_filtreler() TO service_role;
REVOKE ALL ON FUNCTION public.odt_ucus_sayfa(date, date, text, integer, integer, integer, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ucus_sayfa(date, date, text, integer, integer, integer, text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_iptal_sayfa(date, date, text, boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_iptal_sayfa(date, date, text, boolean, integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_geciken_sayfa() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_geciken_sayfa() TO service_role;
