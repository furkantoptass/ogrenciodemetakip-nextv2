-- Ödeme takvimi, Askıya alınanlar ve Filo ekranları.

-- Ödeme takvimi: tarih aralığındaki taksitler (kim, ne zaman, ne kadar). "Gecikti" ayrımını uygulama bugünün tarihine göre yapar.
CREATE OR REPLACE FUNCTION public.odt_odeme_takvim(p_from date, p_to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.date, x.name, x.id), '[]'::jsonb)
  FROM (
    SELECT si."m_ID" AS id, to_char(si."installmentDate", 'YYYY-MM-DD') AS date,
           s."m_ID" AS "studentId",
           TRIM(COALESCE(s."firstName", '') || ' ' || COALESCE(s."lastName", '')) AS name,
           COALESCE(s.gsm, '') AS gsm,
           COALESCE(TRIM(c.subject), '') AS subject,
           COALESCE(TRIM(si.name), '') AS installment,
           public.mysql_num(si.price)::float8 AS amount,
           cu.symbol, cu.shortcode,
           (LOWER(TRIM(COALESCE(si.status, ''))) = 'payed') AS paid,
           COALESCE(TRIM(si.note), '') AS note
    FROM public.naeron_bi_student_installments si
    JOIN public.naeron_bi_students s ON s."m_ID" = si."studentID"
    LEFT JOIN public.naeron_bi_student_contracts c ON c."m_ID" = si."contractID"
      AND LOWER(TRIM(COALESCE(c."_lastRowStatus", ''))) IN ('create', 'update')
      AND LOWER(TRIM(COALESCE(c."contractStatus", ''))) <> 'cancelcontract'
    LEFT JOIN public.naeron_bi_currencies cu ON cu."m_ID" = si.currency
    WHERE LOWER(TRIM(COALESCE(si."_lastRowStatus", ''))) IN ('create', 'update')
      AND LOWER(TRIM(COALESCE(s."_lastRowStatus", ''))) IN ('create', 'update')
      AND LOWER(TRIM(COALESCE(s."trainingStatus", ''))) <> 'cancelcontract'
      AND si."installmentDate" IS NOT NULL
      AND si."installmentDate"::date BETWEEN p_from AND p_to
      AND (si."contractID" IS NULL OR c."m_ID" IS NOT NULL)
  ) x
$$;

-- Askıya alınanlar: Naeron'da "uçuşları askıya al" (suspendFlights) işaretli öğrenciler.
-- Naeron askıya alma nedeni ya da tarihi vermez; bağlam için son uçuş, açık bakiye, vadesi geçmiş taksit ve son not eklenir.
CREATE OR REPLACE FUNCTION public.odt_askida_sayfa(p_today date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH al AS (
  SELECT s.* FROM public.naeron_bi_students s
  WHERE LOWER(TRIM(COALESCE(s."_lastRowStatus", ''))) IN ('create', 'update')
    AND LOWER(TRIM(COALESCE(s."trainingStatus", ''))) <> 'cancelcontract'
),
st AS (
  SELECT * FROM al WHERE COALESCE(NULLIF(TRIM(al."suspendFlights"), ''), '0') <> '0'
),
fl AS (
  SELECT f."s_ID" AS id,
         MAX(f.d) FILTER (WHERE NOT f.canceled AND f.d <= p_today) AS last_flight,
         (count(*) FILTER (WHERE NOT f.canceled))::int AS flights,
         COALESCE(SUM(f.minutes) FILTER (WHERE NOT f.canceled), 0)::int AS minutes,
         (count(*) FILTER (WHERE f.canceled))::int AS canceled
  FROM (
    SELECT f."s_ID", f."flightDate"::date AS d,
           COALESCE(NULLIF(f."BlockTime", 0), NULLIF(f."flightDuration", 0), NULLIF(f.duration, 0), 0) AS minutes,
           (COALESCE(NULLIF(TRIM(f.canceled), ''), '0') <> '0') AS canceled
    FROM public.naeron_bi_flights f
    WHERE f."s_ID" IN (SELECT "m_ID" FROM st)
      AND COALESCE(f."s_Type", 'student') = 'student'
      AND LOWER(TRIM(COALESCE(f."_lastRowStatus", ''))) <> 'destroy'
      AND f."flightDate" IS NOT NULL
  ) f
  GROUP BY 1
),
ct AS (
  SELECT c."m_ID", c."studentID", c."currencyID", public.mysql_num(c.price) AS price, public.mysql_num(c.payed) AS payed
  FROM public.naeron_bi_student_contracts c
  WHERE c."studentID" IN (SELECT "m_ID" FROM st)
    AND LOWER(TRIM(COALESCE(c."_lastRowStatus", ''))) IN ('create', 'update')
    AND LOWER(TRIM(COALESCE(c."contractStatus", ''))) <> 'cancelcontract'
),
acik AS (
  SELECT g."studentID",
         jsonb_agg(jsonb_build_object('amount', g.remaining::float8, 'symbol', cu.symbol, 'shortcode', cu.shortcode)
                   ORDER BY g.remaining DESC) AS list
  FROM (SELECT "studentID", "currencyID", SUM(price) - SUM(payed) AS remaining FROM ct GROUP BY 1, 2) g
  LEFT JOIN public.naeron_bi_currencies cu ON cu."m_ID" = g."currencyID"
  WHERE g.remaining > 0.5
  GROUP BY 1
),
geciken AS (
  SELECT g."studentID", MIN(g.since) AS since,
         jsonb_agg(jsonb_build_object('amount', g.amount::float8, 'symbol', cu.symbol, 'shortcode', cu.shortcode)
                   ORDER BY g.amount DESC) AS list
  FROM (
    SELECT si."studentID", si.currency, SUM(public.mysql_num(si.price)) AS amount, MIN(si."installmentDate"::date) AS since
    FROM public.naeron_bi_student_installments si
    LEFT JOIN ct ON ct."m_ID" = si."contractID"
    WHERE si."studentID" IN (SELECT "m_ID" FROM st)
      AND LOWER(TRIM(COALESCE(si."_lastRowStatus", ''))) IN ('create', 'update')
      AND si."installmentDate" IS NOT NULL AND si."installmentDate"::date < p_today
      AND LOWER(TRIM(COALESCE(si.status, ''))) <> 'payed'
      AND (si."contractID" IS NULL OR ct."m_ID" IS NOT NULL)
    GROUP BY 1, 2
  ) g
  LEFT JOIN public.naeron_bi_currencies cu ON cu."m_ID" = g.currency
  GROUP BY 1
),
nt AS (
  SELECT DISTINCT ON (n.student_id) n.student_id, n.body, n.author_name, n.created_at
  FROM public.northfly_odt_student_notes n
  WHERE n.student_id IN (SELECT "m_ID" FROM st)
  ORDER BY n.student_id, n.id DESC
)
SELECT jsonb_build_array(jsonb_build_object(
  'total', (SELECT count(*) FROM al),
  'rows', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.graduated, x."lastFlight" DESC NULLS LAST, x.name), '[]'::jsonb)
    FROM (
      SELECT st."m_ID" AS id,
             TRIM(COALESCE(st."firstName", '') || ' ' || COALESCE(st."lastName", '')) AS name,
             COALESCE(st."studentNo", '') AS "studentNo", COALESCE(st.gsm, '') AS gsm,
             LOWER(TRIM(COALESCE(st."trainingStatus", ''))) AS "trainingStatus",
             (LOWER(TRIM(COALESCE(st."trainingStatus", ''))) = 'graduated') AS graduated,
             COALESCE(st."actualTrainingName", '') AS training, COALESCE(st."actualPhaseName", '') AS phase,
             COALESCE(st."lastDuty", '') AS "lastDuty",
             to_char(GREATEST(fl.last_flight,
               CASE WHEN st."lastFlight" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN LEFT(st."lastFlight", 10)::date END), 'YYYY-MM-DD') AS "lastFlight",
             COALESCE(fl.flights, 0) AS flights, COALESCE(fl.minutes, 0) AS minutes, COALESCE(fl.canceled, 0) AS canceled,
             COALESCE(fle.name, '') AS fleet, COALESCE(cl.name, '') AS label, cl.color AS "labelColor",
             COALESCE(acik.list, '[]'::jsonb) AS open,
             COALESCE(geciken.list, '[]'::jsonb) AS overdue, to_char(geciken.since, 'YYYY-MM-DD') AS "overdueSince",
             COALESCE(nt.body, '') AS note, COALESCE(nt.author_name, '') AS "noteAuthor",
             to_char(nt.created_at, 'YYYY-MM-DD') AS "noteDate",
             to_char(st."_lastRowUpdate", 'YYYY-MM-DD') AS updated
      FROM st
      LEFT JOIN fl ON fl.id = st."m_ID"
      LEFT JOIN acik ON acik."studentID" = st."m_ID"
      LEFT JOIN geciken ON geciken."studentID" = st."m_ID"
      LEFT JOIN nt ON nt.student_id = st."m_ID"
      LEFT JOIN public.naeron_bi_fleets fle ON fle."m_ID" = st."fleetID"
      LEFT JOIN public.naeron_bi_corporate_labels cl ON cl."m_ID" = st."corpLabelID"
    ) x)
));
$$;

-- Filo: Naeron uçak/simülatör listesi + uçuş kayıtlarından kullanım özeti.
CREATE OR REPLACE FUNCTION public.odt_filo_sayfa(p_today date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH fl AS (
  SELECT f."a_ID" AS id,
         (count(*) FILTER (WHERE NOT f.canceled))::int AS flights,
         COALESCE(SUM(f.minutes) FILTER (WHERE NOT f.canceled), 0)::int AS minutes,
         (count(*) FILTER (WHERE NOT f.canceled AND f.d > p_today - 30))::int AS flights30,
         COALESCE(SUM(f.minutes) FILTER (WHERE NOT f.canceled AND f.d > p_today - 30), 0)::int AS minutes30,
         (count(*) FILTER (WHERE f.canceled AND f.d > p_today - 30))::int AS canceled30,
         MAX(f.d) FILTER (WHERE NOT f.canceled) AS last_flight
  FROM (
    SELECT f."a_ID", f."flightDate"::date AS d,
           COALESCE(NULLIF(f."BlockTime", 0), NULLIF(f."flightDuration", 0), NULLIF(f.duration, 0), 0) AS minutes,
           (COALESCE(NULLIF(TRIM(f.canceled), ''), '0') <> '0') AS canceled
    FROM public.naeron_bi_flights f
    WHERE LOWER(TRIM(COALESCE(f."_lastRowStatus", ''))) <> 'destroy'
      AND f."flightDate" IS NOT NULL AND f."a_ID" IS NOT NULL
      AND f."flightDate"::date <= p_today
  ) f
  GROUP BY 1
)
SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.reg, x.id), '[]'::jsonb)
FROM (
  SELECT a."m_ID" AS id, COALESCE(TRIM(a."regNo"), '') AS reg, COALESCE(TRIM(a."aircraftType"), '') AS model,
         COALESCE(NULLIF(LOWER(TRIM(a.type)), ''), 'aircraft') AS kind,
         (COALESCE(NULLIF(TRIM(a.external), ''), '0') <> '0') AS external,
         (COALESCE(NULLIF(TRIM(a."outOfInventory"), ''), '0') <> '0') AS "outOfInventory",
         (COALESCE(NULLIF(TRIM(a."underMaintenance"), ''), '0') <> '0') AS "underMaintenance",
         COALESCE(a."engineType", '') AS engine,
         NULLIF(public.mysql_num(a.tacho), 0)::float8 AS tacho,
         a.color, COALESCE(TRIM(a."lastBaseTo"), '') AS "lastBase",
         to_char(GREATEST(fl.last_flight, a."lastFlightDate"::date), 'YYYY-MM-DD') AS "lastFlight",
         to_char(a."UEGGS", 'YYYY-MM-DD') AS arc,
         COALESCE(fl.flights, 0) AS flights, COALESCE(fl.minutes, 0) AS minutes,
         COALESCE(fl.flights30, 0) AS flights30, COALESCE(fl.minutes30, 0) AS minutes30,
         COALESCE(fl.canceled30, 0) AS canceled30
  FROM public.naeron_bi_aircrafts_simulators a
  LEFT JOIN fl ON fl.id = a."m_ID"
  WHERE LOWER(TRIM(COALESCE(a."_lastRowStatus", ''))) <> 'destroy'
) x
$$;

REVOKE ALL ON FUNCTION public.odt_odeme_takvim(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_odeme_takvim(date, date) TO service_role;
REVOKE ALL ON FUNCTION public.odt_askida_sayfa(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_askida_sayfa(date) TO service_role;
REVOKE ALL ON FUNCTION public.odt_filo_sayfa(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_filo_sayfa(date) TO service_role;
