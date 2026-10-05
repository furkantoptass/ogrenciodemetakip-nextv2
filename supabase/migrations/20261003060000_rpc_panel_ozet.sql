-- Özet paneli (dashboard): tek çağrıda tüm özet sayıları. Öğrenci filtresi liste ekranıyla aynıdır
-- (silinmiş ve sözleşmesi iptal edilmiş öğrenciler hariç).
CREATE OR REPLACE FUNCTION public.odt_panel_ozet()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH st AS (
  SELECT s."m_ID", s."firstName", s."lastName", s."trainingStatus", s."suspendFlights", s."actualTrainingName"
  FROM public.naeron_bi_students s
  WHERE LOWER(TRIM(COALESCE(s."_lastRowStatus", ''))) IN ('create', 'update')
    AND LOWER(TRIM(COALESCE(s."trainingStatus", ''))) <> 'cancelcontract'
),
fl AS (
  SELECT f."flightDate", f."studentName_", f."dutyName_", f."instructorName_",
         COALESCE(NULLIF(TRIM(f."aircraftName_"), ''), f.aircraft) AS aircraft,
         COALESCE(NULLIF(f."BlockTime", 0), NULLIF(f."flightDuration", 0), NULLIF(f.duration, 0), 0) AS minutes
  FROM public.naeron_bi_flights f
  WHERE COALESCE(f.realized, 0) = 1
    AND COALESCE(NULLIF(TRIM(f.canceled), ''), '0') = '0'
    AND f."flightDate" IS NOT NULL
    AND LOWER(TRIM(COALESCE(f."_lastRowStatus", ''))) <> 'destroy'
),
ct AS (
  SELECT c."currencyID", c.price, c.payed
  FROM public.naeron_bi_student_contracts c
  JOIN st ON st."m_ID" = c."studentID"
  WHERE LOWER(TRIM(COALESCE(c."_lastRowStatus", ''))) IN ('create', 'update')
    AND LOWER(TRIM(COALESCE(c."contractStatus", ''))) <> 'cancelcontract'
),
inst AS (
  SELECT i."studentID", i."installmentDate", i.price, i.currency,
         TRIM(COALESCE(st."firstName", '') || ' ' || COALESCE(st."lastName", '')) AS student_name
  FROM public.naeron_bi_student_installments i
  JOIN st ON st."m_ID" = i."studentID"
  WHERE LOWER(TRIM(COALESCE(i."_lastRowStatus", ''))) IN ('create', 'update')
    AND i."installmentDate" IS NOT NULL
    AND LOWER(TRIM(COALESCE(i.status, ''))) <> 'payed'
)
SELECT jsonb_build_array(jsonb_build_object(
  'students', (
    SELECT jsonb_build_object(
      'total', count(*),
      'active', count(*) FILTER (WHERE LOWER(TRIM(COALESCE("trainingStatus", ''))) NOT IN ('graduated', 'paused')),
      'graduated', count(*) FILTER (WHERE LOWER(TRIM(COALESCE("trainingStatus", ''))) = 'graduated'),
      'paused', count(*) FILTER (WHERE LOWER(TRIM(COALESCE("trainingStatus", ''))) = 'paused'),
      'suspended', count(*) FILTER (WHERE COALESCE(NULLIF(TRIM("suspendFlights"), ''), '0') = '1'))
    FROM st),
  'money', (
    SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.price DESC), '[]'::jsonb)
    FROM (
      SELECT ct."currencyID" AS "currencyId", cu.shortcode, cu.symbol,
             SUM(public.mysql_num(ct.price))::float8 AS price,
             SUM(public.mysql_num(ct.payed))::float8 AS payed,
             count(*)::int AS contracts
      FROM ct LEFT JOIN public.naeron_bi_currencies cu ON cu."m_ID" = ct."currencyID"
      GROUP BY ct."currencyID", cu.shortcode, cu.symbol
      HAVING SUM(public.mysql_num(ct.price)) <> 0) m),
  'overdue', (
    SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.amount DESC), '[]'::jsonb)
    FROM (
      SELECT inst.currency AS "currencyId", cu.shortcode, cu.symbol,
             SUM(public.mysql_num(inst.price))::float8 AS amount,
             count(*)::int AS installments,
             count(DISTINCT inst."studentID")::int AS students
      FROM inst LEFT JOIN public.naeron_bi_currencies cu ON cu."m_ID" = inst.currency
      WHERE inst."installmentDate"::date < CURRENT_DATE
      GROUP BY inst.currency, cu.shortcode, cu.symbol) o),
  'overdueList', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.date), '[]'::jsonb)
    FROM (
      SELECT inst."studentID" AS "studentId", inst.student_name AS name,
             to_char(inst."installmentDate", 'YYYY-MM-DD') AS date,
             public.mysql_num(inst.price)::float8 AS amount, cu.symbol, cu.shortcode
      FROM inst LEFT JOIN public.naeron_bi_currencies cu ON cu."m_ID" = inst.currency
      WHERE inst."installmentDate"::date < CURRENT_DATE
      ORDER BY inst."installmentDate" LIMIT 8) x),
  'upcoming', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.date), '[]'::jsonb)
    FROM (
      SELECT inst."studentID" AS "studentId", inst.student_name AS name,
             to_char(inst."installmentDate", 'YYYY-MM-DD') AS date,
             public.mysql_num(inst.price)::float8 AS amount, cu.symbol, cu.shortcode
      FROM inst LEFT JOIN public.naeron_bi_currencies cu ON cu."m_ID" = inst.currency
      WHERE inst."installmentDate"::date >= CURRENT_DATE AND inst."installmentDate"::date < CURRENT_DATE + 30
      ORDER BY inst."installmentDate" LIMIT 8) x),
  'flights30', (
    SELECT jsonb_build_object('count', count(*), 'minutes', COALESCE(SUM(minutes), 0))
    FROM fl WHERE "flightDate" >= CURRENT_DATE - 30),
  'flightsMonthly', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.month), '[]'::jsonb)
    FROM (
      SELECT to_char(date_trunc('month', "flightDate"), 'YYYY-MM') AS month,
             count(*)::int AS count, COALESCE(SUM(minutes), 0)::int AS minutes
      FROM fl
      WHERE "flightDate" >= date_trunc('month', CURRENT_DATE) - interval '11 months'
      GROUP BY 1) x),
  'recentFlights', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.ts DESC), '[]'::jsonb)
    FROM (
      SELECT "flightDate" AS ts, to_char("flightDate", 'YYYY-MM-DD') AS date,
             COALESCE("studentName_", '') AS student, COALESCE("dutyName_", '') AS duty,
             COALESCE(aircraft, '') AS aircraft, COALESCE("instructorName_", '') AS instructor, minutes
      FROM fl ORDER BY "flightDate" DESC LIMIT 8) x),
  'trainings', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.count DESC), '[]'::jsonb)
    FROM (
      SELECT COALESCE(NULLIF(TRIM("actualTrainingName"), ''), 'Belirtilmemiş') AS name, count(*)::int AS count
      FROM st
      WHERE LOWER(TRIM(COALESCE("trainingStatus", ''))) <> 'graduated'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 6) x),
  'lastSync', (
    SELECT to_char(max(last_run_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    FROM public.northfly_odt_naeron_sync WHERE ok)
));
$$;

REVOKE ALL ON FUNCTION public.odt_panel_ozet() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_panel_ozet() TO service_role;
