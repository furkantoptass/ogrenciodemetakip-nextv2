-- lib/ogrenci.ts, lib/ogrenci-detay.ts ve lib/odeme-mesaj.ts sorguları: her biri sabit bir fonksiyon.
-- Hepsi jsonb dizi döner; yalnızca service_role çağırabilir. Dinamik SQL yoktur.

-- ───────────────────────── lib/ogrenci.ts ─────────────────────────

CREATE OR REPLACE FUNCTION public.odt_ogrenci_currencies()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT "m_ID", symbol, shortcode FROM naeron_bi_currencies
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_filter_fleets()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT "m_ID", name FROM naeron_bi_fleets
    WHERE COALESCE(NULLIF(TRIM(archive), ''), '0') <> '1'
    ORDER BY name
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_filter_facilities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT "m_ID", name FROM naeron_bi_facilities ORDER BY name
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_filter_corp_labels()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT "m_ID", name, color FROM naeron_bi_corporate_labels ORDER BY name
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_filter_groups()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT g."m_ID", g.code, g."facilityID", g."fleetID", f.name AS fleet_name
    FROM naeron_bi_groups g
    LEFT JOIN naeron_bi_fleets f ON f."m_ID" = g."fleetID"
    WHERE COALESCE(NULLIF(TRIM(g.archive), ''), '0') <> '1'
    ORDER BY f.name, g.code
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_corp_label_counts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT "corpLabelID" AS id, COUNT(*)::int AS c FROM naeron_bi_students s
    WHERE "corpLabelID" IS NOT NULL AND "corpLabelID" > 0
      AND (LOWER(TRIM(COALESCE(s."_lastRowStatus", ''))) IN ('create', 'update'))
    GROUP BY "corpLabelID"
  ) t) s
$$;

-- Liste: isteğe bağlı süzgeçler NULL/false ise uygulanmaz.
-- Etiket süzgeci: p_student doluysa yok sayılır; p_corp_no_label "etiketsiz" (-1) seçeneğidir.
CREATE OR REPLACE FUNCTION public.odt_ogrenci_list(
  p_grad boolean,
  p_susp boolean,
  p_exclude_ppl_grad boolean,
  p_fleet integer,
  p_facility text,
  p_group text,
  p_student integer,
  p_search text,
  p_corp_ids integer[],
  p_corp_no_label boolean
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT s."m_ID", s."firstName", s."lastName", s."shortCode", s."trainingStatus",
      s."facilityID" AS "facilityId", fc.name AS "facilityName",
      s."fleetID" AS "fleetId", fl.name AS "fleetName",
      s."corpLabelID" AS "corpLabelId", cl.name AS "corpLabelName", cl.color AS "corpLabelColor"
    FROM naeron_bi_students s
    LEFT JOIN naeron_bi_fleets fl ON fl."m_ID" = s."fleetID"
    LEFT JOIN naeron_bi_facilities fc ON fc."m_ID"::text = s."facilityID"
    LEFT JOIN naeron_bi_corporate_labels cl ON cl."m_ID" = s."corpLabelID"
    WHERE (LOWER(TRIM(COALESCE(s."_lastRowStatus", ''))) IN ('create', 'update'))
      AND (s."trainingStatus" IS NULL OR TRIM(s."trainingStatus") = '' OR LOWER(TRIM(s."trainingStatus")) <> 'cancelcontract')
      AND (COALESCE(p_grad, false)
           OR (s."trainingStatus" IS NULL OR LOWER(TRIM(s."trainingStatus")) <> 'graduated'))
      AND (COALESCE(p_susp, false)
           OR (s."suspendFlights" IS NULL OR TRIM(s."suspendFlights") = '' OR s."suspendFlights" = '0'))
      AND (NOT COALESCE(p_exclude_ppl_grad, false)
           OR NOT EXISTS (
             SELECT 1 FROM naeron_bi_student_trainings st
             INNER JOIN naeron_bi_trainings tr ON tr."m_ID" = st."trainingID"
             WHERE st."studentID" = s."m_ID"
               AND LOWER(TRIM(COALESCE(tr.name, ''))) LIKE '%ppl%'
               AND LOWER(TRIM(COALESCE(st."trainingStatus", ''))) = 'graduated'
           ))
      AND (p_fleet IS NULL OR s."fleetID" = p_fleet)
      AND (p_facility IS NULL OR s."facilityID" = p_facility)
      AND (p_group IS NULL
           OR EXISTS (SELECT 1 FROM naeron_bi_student_trainings stg WHERE stg."studentID" = s."m_ID" AND stg."groupID" = p_group))
      AND (p_student IS NULL OR s."m_ID" = p_student)
      AND (p_search IS NULL
           OR (s."firstName" ILIKE '%' || p_search || '%' OR s."lastName" ILIKE '%' || p_search || '%'
               OR s."shortCode" ILIKE '%' || p_search || '%' OR s.gsm ILIKE '%' || p_search || '%'
               OR s."studentNo" ILIKE '%' || p_search || '%'))
      AND (p_student IS NOT NULL
           OR NOT (COALESCE(p_corp_no_label, false) OR COALESCE(cardinality(p_corp_ids), 0) > 0)
           OR (COALESCE(p_corp_no_label, false) AND (s."corpLabelID" IS NULL OR s."corpLabelID" = 0))
           OR s."corpLabelID" = ANY(COALESCE(p_corp_ids, '{}'::integer[])))
    ORDER BY s."m_ID" DESC
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_train_keep(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT st0."studentID", MAX(st0."m_ID") AS keep_id
    FROM naeron_bi_student_trainings st0
    LEFT JOIN naeron_bi_student_contracts cx ON cx."m_ID" = st0."contractID"
    WHERE st0."studentID" = ANY(p_ids)
      AND (st0."trainingStatus" IS NULL OR TRIM(st0."trainingStatus") = '' OR LOWER(TRIM(st0."trainingStatus")) <> 'cancelcontract')
      AND LOWER(TRIM(COALESCE(st0."_lastRowStatus", ''))) <> 'destroy'
      AND (
        st0."contractID" IS NULL OR st0."contractID" = 0
        OR (cx."m_ID" IS NOT NULL AND (cx."contractStatus" IS NULL OR TRIM(cx."contractStatus") = '' OR LOWER(TRIM(cx."contractStatus")) <> 'cancelcontract'))
      )
    GROUP BY st0."studentID", COALESCE(st0."contractID", -1), st0."trainingID", COALESCE(st0."revisionID", '-1')
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_subjects(p_keep_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT d."studentID",
      string_agg(DISTINCT CASE
        WHEN LOWER(TRIM(COALESCE(c.subject, ''))) NOT LIKE '%extra%'
         AND LOWER(TRIM(COALESCE(c.subject, ''))) NOT LIKE '%ekstra%'
        THEN NULLIF(TRIM(c.subject), '')
        END, ' | ' ORDER BY CASE
        WHEN LOWER(TRIM(COALESCE(c.subject, ''))) NOT LIKE '%extra%'
         AND LOWER(TRIM(COALESCE(c.subject, ''))) NOT LIKE '%ekstra%'
        THEN NULLIF(TRIM(c.subject), '')
        END) AS subjects
    FROM (SELECT st."studentID", st."contractID" FROM naeron_bi_student_trainings st WHERE st."m_ID" = ANY(p_keep_ids)) d
    LEFT JOIN naeron_bi_student_contracts c ON c."m_ID" = d."contractID"
      AND (c."contractStatus" IS NULL OR TRIM(c."contractStatus") = '' OR LOWER(TRIM(c."contractStatus")) <> 'cancelcontract')
    GROUP BY d."studentID"
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_subjects_extra(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT c."studentID",
      string_agg(DISTINCT NULLIF(TRIM(c.subject), ''), ' | ' ORDER BY NULLIF(TRIM(c.subject), '')) AS subjects_extra
    FROM naeron_bi_student_contracts c
    WHERE c."studentID" = ANY(p_ids)
      AND (c."contractStatus" IS NULL OR TRIM(c."contractStatus") = '' OR LOWER(TRIM(c."contractStatus")) <> 'cancelcontract')
      AND (LOWER(TRIM(COALESCE(c.subject, ''))) LIKE '%extra%' OR LOWER(TRIM(COALESCE(c.subject, ''))) LIKE '%ekstra%')
    GROUP BY c."studentID"
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_money(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT ct."studentID", ct."currencyID",
      SUM(mysql_num(ct.price))::float8 AS sum_price,
      SUM(mysql_num(ct.payed))::float8 AS sum_payed
    FROM naeron_bi_student_contracts ct
    WHERE ct."studentID" = ANY(p_ids)
      AND (ct."contractStatus" IS NULL OR TRIM(ct."contractStatus") = '' OR LOWER(TRIM(ct."contractStatus")) <> 'cancelcontract')
      AND (LOWER(TRIM(COALESCE(ct.subject, ''))) NOT LIKE '%extra%' AND LOWER(TRIM(COALESCE(ct.subject, ''))) NOT LIKE '%ekstra%')
    GROUP BY ct."studentID", ct."currencyID"
    HAVING COALESCE(ct."currencyID", 0) > 0 OR SUM(mysql_num(ct.price)) <> 0 OR SUM(mysql_num(ct.payed)) <> 0
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_money_extra(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT ct."studentID", ct."currencyID",
      SUM(mysql_num(ct.price))::float8 AS sum_price,
      SUM(mysql_num(ct.payed))::float8 AS sum_payed
    FROM naeron_bi_student_contracts ct
    WHERE ct."studentID" = ANY(p_ids)
      AND (ct."contractStatus" IS NULL OR TRIM(ct."contractStatus") = '' OR LOWER(TRIM(ct."contractStatus")) <> 'cancelcontract')
      AND (LOWER(TRIM(COALESCE(ct.subject, ''))) LIKE '%extra%' OR LOWER(TRIM(COALESCE(ct.subject, ''))) LIKE '%ekstra%')
    GROUP BY ct."studentID", ct."currencyID"
    HAVING COALESCE(ct."currencyID", 0) > 0 OR SUM(mysql_num(ct.price)) <> 0 OR SUM(mysql_num(ct.payed)) <> 0
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_plan_due(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT si."studentID", si.currency AS "currencyID",
      SUM(mysql_num(si.price))::float8 AS sum_plan
    FROM naeron_bi_student_installments si
    INNER JOIN naeron_bi_student_contracts c ON c."m_ID" = si."contractID"
      AND (c."contractStatus" IS NULL OR TRIM(c."contractStatus") = '' OR LOWER(TRIM(c."contractStatus")) <> 'cancelcontract')
    WHERE si."studentID" = ANY(p_ids)
      AND (LOWER(TRIM(COALESCE(si."_lastRowStatus", ''))) IN ('create', 'update'))
      AND si."installmentDate" IS NOT NULL
      AND si."installmentDate"::date <= CURRENT_DATE
    GROUP BY si."studentID", si.currency
    HAVING COALESCE(si.currency, 0) > 0 OR SUM(mysql_num(si.price)) <> 0
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_schedule_total(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT si."studentID", si.currency AS "currencyID",
      SUM(mysql_num(si.price))::float8 AS sum_schedule
    FROM naeron_bi_student_installments si
    INNER JOIN naeron_bi_student_contracts c ON c."m_ID" = si."contractID"
      AND (c."contractStatus" IS NULL OR TRIM(c."contractStatus") = '' OR LOWER(TRIM(c."contractStatus")) <> 'cancelcontract')
    WHERE si."studentID" = ANY(p_ids)
      AND (LOWER(TRIM(COALESCE(si."_lastRowStatus", ''))) IN ('create', 'update'))
    GROUP BY si."studentID", si.currency
    HAVING COALESCE(si.currency, 0) > 0 OR SUM(mysql_num(si.price)) <> 0
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_ppl_extra(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT f."s_ID" AS "studentID",
      SUM(COALESCE(NULLIF(f."BlockTime",0), NULLIF(f."flightDuration",0), NULLIF(f.duration,0), 0))::int AS minutes
    FROM naeron_bi_flights f
    WHERE f."s_ID" = ANY(p_ids)
      AND COALESCE(f.realized, 0) = 1
      AND COALESCE(NULLIF(TRIM(f.canceled),''),'0') <> '1'
      AND COALESCE(NULLIF(TRIM(f."paidFlight"),''),'0') = '1'
      AND COALESCE(NULLIF(TRIM(f.control),''),'0') <> '1'
    GROUP BY f."s_ID"
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_train_minutes(p_keep_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT st."studentID", tr.name AS tname,
      SUM(CASE WHEN st.duration ~ '^[0-9]+$' THEN CAST(st.duration AS bigint) ELSE 0 END)::float8 AS plan_m,
      SUM(CASE WHEN st.done ~ '^[0-9]+$' THEN CAST(st.done AS bigint) ELSE 0 END)::float8 AS done_m
    FROM naeron_bi_student_trainings st
    INNER JOIN naeron_bi_trainings tr ON tr."m_ID" = st."trainingID"
    WHERE st."m_ID" = ANY(p_keep_ids)
    GROUP BY st."studentID", tr.name
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_bits(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT * FROM northfly_odt_student_bits WHERE student_id = ANY(p_ids)
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_last_notes(p_ids integer[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT n.student_id, n.body, n.author_name, n.created_at
    FROM northfly_odt_student_notes n
    INNER JOIN (
      SELECT student_id, MAX(id) AS max_id FROM northfly_odt_student_notes WHERE student_id = ANY(p_ids) GROUP BY student_id
    ) latest ON latest.student_id = n.student_id AND latest.max_id = n.id
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_ogrenci_dropdown()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT "m_ID", "firstName", "lastName" FROM naeron_bi_students
    WHERE LOWER(TRIM(COALESCE("_lastRowStatus", ''))) IN ('create', 'update')
    ORDER BY "lastName", "firstName"
    LIMIT 800
  ) t) s
$$;

-- ───────────────────────── lib/ogrenci-detay.ts ─────────────────────────

CREATE OR REPLACE FUNCTION public.odt_detay_installments(p_student_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT si."contractID" AS "contractId", COALESCE(NULLIF(TRIM(c.subject),''), 'Sözleşme') AS subject,
           si."installmentDate" AS dt, COALESCE(si.name,'') AS name,
           mysql_num(si.price)::float8 AS price, si.currency AS "currencyId",
           COALESCE(si.status,'') AS status, COALESCE(si.note,'') AS note
    FROM naeron_bi_student_installments si
    LEFT JOIN naeron_bi_student_contracts c ON c."m_ID" = si."contractID"
      AND (c."contractStatus" IS NULL OR TRIM(c."contractStatus") = '' OR LOWER(TRIM(c."contractStatus")) <> 'cancelcontract')
    WHERE si."studentID" = p_student_id
      AND (LOWER(TRIM(COALESCE(si."_lastRowStatus", ''))) IN ('create', 'update'))
    ORDER BY si."installmentDate", si."m_ID"
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_detay_payments(p_student_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT p."contractID" AS "contractId", COALESCE(NULLIF(TRIM(c.subject),''), 'Sözleşme') AS subject,
           p."paymentDate" AS dt, mysql_num(p.amount)::float8 AS amount,
           p."currencyID" AS "currencyId", COALESCE(p.note,'') AS note, COALESCE(p."creatorName",'') AS creator
    FROM naeron_bi_student_payments p
    LEFT JOIN naeron_bi_student_contracts c ON c."m_ID" = p."contractID"
    WHERE p."studentID" = p_student_id
      AND (p."_lastRowStatus" IS NULL OR LOWER(TRIM(COALESCE(p."_lastRowStatus",''))) IN ('create','update',''))
    ORDER BY p."paymentDate" DESC, p."m_ID" DESC
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_detay_notes(p_student_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT id, body, created_at AS "createdAt", author_name AS "authorName"
    FROM northfly_odt_student_notes
    WHERE student_id = p_student_id
    ORDER BY id DESC
    LIMIT 80
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_detay_flights(p_student_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT "flightDate" AS dt, COALESCE("dutyName_",'') AS duty, COALESCE("aircraftName_", COALESCE(aircraft,'')) AS aircraft,
           COALESCE("routeName_",'') AS route,
           COALESCE(NULLIF("BlockTime",0), NULLIF("flightDuration",0), NULLIF(duration,0), 0) AS minutes,
           COALESCE("instructorName_",'') AS instructor,
           COALESCE("paidFlight",'0') AS "paidFlight", COALESCE(control,'') AS control
    FROM naeron_bi_flights
    WHERE "s_ID" = p_student_id
      AND COALESCE(NULLIF(TRIM(canceled),''),'0') <> '1'
    ORDER BY "flightDate" DESC, "m_ID" DESC
    LIMIT 400
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_detay_pdfs(p_student_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT contract_subject AS subject, sign_date AS "signDate", storage_path AS "storagePath", full_url AS url
    FROM northfly_odt_contract_pdf_links
    WHERE student_id = p_student_id
    ORDER BY sign_date DESC, contract_id DESC
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_detay_extra_minutes(p_student_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT SUM(COALESCE(NULLIF("BlockTime",0), NULLIF("flightDuration",0), NULLIF(duration,0), 0))::int AS minutes
    FROM naeron_bi_flights
    WHERE "s_ID" = p_student_id
      AND COALESCE(realized, 0) = 1
      AND COALESCE(NULLIF(TRIM(canceled),''),'0') <> '1'
      AND COALESCE(NULLIF(TRIM("paidFlight"),''),'0') = '1'
      AND COALESCE(NULLIF(TRIM(control),''),'0') <> '1'
  ) t) s
$$;

-- ───────────────────────── lib/odeme-mesaj.ts ─────────────────────────
-- dt alanları 'YYYY-MM-DD' metni döner (uygulama isoToYmd ile metin bekler).

CREATE OR REPLACE FUNCTION public.odt_odeme_student(p_student_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT "m_ID", "firstName", "lastName", gsm FROM naeron_bi_students WHERE "m_ID" = p_student_id LIMIT 1
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_odeme_installments(p_student_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT si."m_ID" AS id, to_char(si."installmentDate", 'YYYY-MM-DD') AS dt,
           mysql_num(si.price)::float8 AS price, si.currency AS "currencyId",
           COALESCE(si.status,'') AS status
    FROM naeron_bi_student_installments si
    INNER JOIN naeron_bi_student_contracts c ON c."m_ID" = si."contractID"
      AND (c."contractStatus" IS NULL OR TRIM(c."contractStatus") = '' OR LOWER(TRIM(c."contractStatus")) <> 'cancelcontract')
    WHERE si."studentID" = p_student_id
      AND (LOWER(TRIM(COALESCE(si."_lastRowStatus", ''))) IN ('create', 'update'))
      AND si."installmentDate" IS NOT NULL
    ORDER BY si."installmentDate", si."m_ID"
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_odeme_payments(p_student_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT to_char(p."paymentDate", 'YYYY-MM-DD') AS dt, mysql_num(p.amount)::float8 AS amount, p."currencyID" AS "currencyId"
    FROM naeron_bi_student_payments p
    LEFT JOIN naeron_bi_student_contracts c ON c."m_ID" = p."contractID"
    WHERE p."studentID" = p_student_id
      AND (p."_lastRowStatus" IS NULL OR LOWER(TRIM(COALESCE(p."_lastRowStatus",''))) IN ('create','update',''))
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_odeme_due(p_student_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT si.currency AS "currencyID",
      SUM(mysql_num(si.price))::float8 AS sum_plan
    FROM naeron_bi_student_installments si
    INNER JOIN naeron_bi_student_contracts c ON c."m_ID" = si."contractID"
      AND (c."contractStatus" IS NULL OR TRIM(c."contractStatus") = '' OR LOWER(TRIM(c."contractStatus")) <> 'cancelcontract')
    WHERE si."studentID" = p_student_id
      AND (LOWER(TRIM(COALESCE(si."_lastRowStatus", ''))) IN ('create', 'update'))
      AND si."installmentDate" IS NOT NULL
      AND si."installmentDate"::date <= CURRENT_DATE
    GROUP BY si.currency
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_odeme_paid(p_student_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT ct."currencyID",
      SUM(mysql_num(ct.payed))::float8 AS sum_payed
    FROM naeron_bi_student_contracts ct
    WHERE ct."studentID" = p_student_id
      AND (ct."contractStatus" IS NULL OR TRIM(ct."contractStatus") = '' OR LOWER(TRIM(ct."contractStatus")) <> 'cancelcontract')
      AND (LOWER(TRIM(COALESCE(ct.subject, ''))) NOT LIKE '%extra%' AND LOWER(TRIM(COALESCE(ct.subject, ''))) NOT LIKE '%ekstra%')
    GROUP BY ct."currencyID"
  ) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_odeme_auto_student_ids(p_ymd_a text, p_ymd_b text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
    SELECT DISTINCT si."studentID"
    FROM naeron_bi_student_installments si
    INNER JOIN naeron_bi_student_contracts c ON c."m_ID" = si."contractID"
      AND (c."contractStatus" IS NULL OR TRIM(c."contractStatus") = '' OR LOWER(TRIM(c."contractStatus")) <> 'cancelcontract')
    WHERE (LOWER(TRIM(COALESCE(si."_lastRowStatus", ''))) IN ('create', 'update'))
      AND si."installmentDate" IS NOT NULL
      AND to_char(si."installmentDate", 'YYYY-MM-DD') IN (p_ymd_a, p_ymd_b)
  ) t) s
$$;

-- ───────────────────────── Yetkiler ─────────────────────────

REVOKE ALL ON FUNCTION public.odt_ogrenci_currencies() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_currencies() TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_filter_fleets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_filter_fleets() TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_filter_facilities() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_filter_facilities() TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_filter_corp_labels() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_filter_corp_labels() TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_filter_groups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_filter_groups() TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_corp_label_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_corp_label_counts() TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_list(boolean, boolean, boolean, integer, text, text, integer, text, integer[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_list(boolean, boolean, boolean, integer, text, text, integer, text, integer[], boolean) TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_train_keep(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_train_keep(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_subjects(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_subjects(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_subjects_extra(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_subjects_extra(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_money(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_money(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_money_extra(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_money_extra(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_plan_due(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_plan_due(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_schedule_total(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_schedule_total(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_ppl_extra(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_ppl_extra(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_train_minutes(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_train_minutes(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_bits(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_bits(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_last_notes(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_last_notes(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_ogrenci_dropdown() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_ogrenci_dropdown() TO service_role;

REVOKE ALL ON FUNCTION public.odt_detay_installments(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_detay_installments(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_detay_payments(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_detay_payments(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_detay_notes(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_detay_notes(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_detay_flights(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_detay_flights(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_detay_pdfs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_detay_pdfs(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_detay_extra_minutes(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_detay_extra_minutes(integer) TO service_role;

REVOKE ALL ON FUNCTION public.odt_odeme_student(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_odeme_student(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_odeme_installments(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_odeme_installments(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_odeme_payments(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_odeme_payments(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_odeme_due(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_odeme_due(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_odeme_paid(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_odeme_paid(integer) TO service_role;
REVOKE ALL ON FUNCTION public.odt_odeme_auto_student_ids(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_odeme_auto_student_ids(text, text) TO service_role;
