-- Hat durumu (PPL) sayfasının sorguları: lib/hat-durumu-ppl.ts
-- Her sorgu sabit bir fonksiyondur; dinamik SQL yoktur. Yalnızca service_role çağırabilir.

CREATE OR REPLACE FUNCTION public.odt_hatppl_students(
  p_q text DEFAULT NULL,
  p_fleet integer DEFAULT NULL,
  p_facility text DEFAULT NULL,
  p_group text DEFAULT NULL,
  p_student integer DEFAULT NULL,
  p_corp_ids integer[] DEFAULT NULL,
  p_corp_unlabeled boolean DEFAULT false,
  p_exclude_ppl_grads boolean DEFAULT true,
  p_show_graduates boolean DEFAULT false,
  p_show_suspended boolean DEFAULT true
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
SELECT
  s."m_ID",
  s."firstName",
  s."lastName",
  s."shortCode",
  s."corpLabelID",
  cl.name  AS corp_label_name,
  cl.color AS corp_label_color,
  fl.name  AS fleet_name,
  (SELECT "documentNo"
   FROM naeron_bi_student_certificates
   WHERE "studentID" = s."m_ID" AND name = 'StPL'
   LIMIT 1)                                                                 AS stpl_no,
  (SELECT to_char("startDate", 'YYYY-MM-DD')
   FROM naeron_bi_student_certificates
   WHERE "studentID" = s."m_ID" AND name = 'StPL'
     AND "startDate" IS NOT NULL
   ORDER BY "startDate" ASC
   LIMIT 1)                                                                 AS stpl_start_date,
  (SELECT COUNT(1)
   FROM naeron_bi_student_certificates
   WHERE "studentID" = s."m_ID" AND name = 'StPL')                          AS stpl_var,
  (SELECT COUNT(1)
   FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1
     AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0')                   AS ucus_sayisi,
  (SELECT st."revisionID"
   FROM naeron_bi_student_trainings st
   INNER JOIN naeron_bi_trainings t ON t."m_ID" = st."trainingID"
   WHERE st."studentID" = s."m_ID" AND t.name = 'PPL(A)'
     AND (st."trainingStatus" IS NULL OR LOWER(TRIM(st."trainingStatus")) <> 'cancelcontract')
   LIMIT 1)                                                                 AS ppl_revision_id,
  (SELECT st.duration
   FROM naeron_bi_student_trainings st
   INNER JOIN naeron_bi_trainings t ON t."m_ID" = st."trainingID"
   WHERE st."studentID" = s."m_ID" AND t.name = 'PPL(A)'
     AND (st."trainingStatus" IS NULL OR LOWER(TRIM(st."trainingStatus")) <> 'cancelcontract')
   LIMIT 1)                                                                 AS ppl_duration,
  (SELECT st.done
   FROM naeron_bi_student_trainings st
   INNER JOIN naeron_bi_trainings t ON t."m_ID" = st."trainingID"
   WHERE st."studentID" = s."m_ID" AND t.name = 'PPL(A)'
     AND (st."trainingStatus" IS NULL OR LOWER(TRIM(st."trainingStatus")) <> 'cancelcontract')
   LIMIT 1)                                                                 AS ppl_done,
  (SELECT COALESCE(SUM(f."BlockTime"), 0)
   FROM naeron_bi_flights f
   WHERE f."s_ID" = s."m_ID" AND f.realized = 1
     AND COALESCE(NULLIF(TRIM(f.canceled), ''), '0') = '0'
     AND (f."dutyName_" ILIKE '%EXTRA%'
       OR f."dutyName_" ILIKE '%-E/T%'
       OR f."dutyName_" ILIKE '%PPT-E/%'))                                  AS extra_min,
  (SELECT COUNT(1) FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ILIKE '%E-15B%')                                       AS e15b,
  (SELECT COUNT(1) FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ILIKE '%E-19%')                                        AS e19_var,
  (SELECT COUNT(1) FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ILIKE '%E-24A%')                                       AS e24a_var,
  (SELECT COUNT(1) FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ILIKE '%E-25B%')                                       AS e25b,
  (SELECT COUNT(1) FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ILIKE '%E-20%')                                        AS e20_var,
  (SELECT COUNT(1) FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ILIKE '%E-26%')                                        AS e26_var,
  (SELECT COUNT(1) FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ILIKE '%E-29B%')                                       AS e29b_var,
  (SELECT to_char("flightDate", 'YYYY-MM-DD')
   FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
   ORDER BY "flightDate" DESC NULLS LAST, "OffBlock" DESC NULLS LAST, "m_ID" DESC NULLS LAST
   LIMIT 1)                                                                 AS last_date,
  (SELECT "dutyName_"
   FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
   ORDER BY "flightDate" DESC NULLS LAST, "OffBlock" DESC NULLS LAST, "m_ID" DESC NULLS LAST
   LIMIT 1)                                                                 AS last_duty,
  (SELECT "instructorName_"
   FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
   ORDER BY "flightDate" DESC NULLS LAST, "OffBlock" DESC NULLS LAST, "m_ID" DESC NULLS LAST
   LIMIT 1)                                                                 AS last_instr,
  (SELECT "dutyName_"
   FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" NOT ILIKE '%EXTRA%'
     AND "dutyName_" NOT ILIKE '%-E/T%'
     AND "dutyName_" NOT ILIKE '%PPT-E/%'
   ORDER BY "flightDate" DESC NULLS LAST, "OffBlock" DESC NULLS LAST, "m_ID" DESC NULLS LAST
   LIMIT 1)                                                                 AS last_curriculum_duty,
  (SELECT to_char(MIN("flightDate"), 'YYYY-MM-DD')
   FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ~* '(^|[^0-9A-Za-z])E-1([AB])?([^0-9A-Za-z]|$)')       AS e1_first_date,
  (SELECT to_char(MIN("flightDate"), 'YYYY-MM-DD')
   FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0') AS first_flight_date,
  (SELECT to_char(MIN("flightDate"), 'YYYY-MM-DD')
   FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ILIKE '%E-15B%')                                       AS e15b_first_date,
  (SELECT to_char(MIN("flightDate"), 'YYYY-MM-DD')
   FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ILIKE '%E-19%')                                        AS e19_first_date,
  (SELECT to_char(MIN("flightDate"), 'YYYY-MM-DD')
   FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ILIKE '%E-24A%')                                       AS e24a_first_date,
  (SELECT to_char(MIN("flightDate"), 'YYYY-MM-DD')
   FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ILIKE '%E-25B%')                                       AS e25b_first_date,
  (SELECT to_char(MIN("flightDate"), 'YYYY-MM-DD')
   FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ILIKE '%E-20%')                                        AS e20_first_date,
  (SELECT to_char(MIN("flightDate"), 'YYYY-MM-DD')
   FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ILIKE '%E-26%')                                        AS e26_first_date,
  (SELECT to_char(MIN("flightDate"), 'YYYY-MM-DD')
   FROM naeron_bi_flights
   WHERE "s_ID" = s."m_ID" AND realized = 1 AND COALESCE(NULLIF(TRIM(canceled), ''), '0') = '0'
     AND "dutyName_" ILIKE '%E-29B%')                                       AS e29b_first_date
FROM naeron_bi_students s
LEFT JOIN naeron_bi_corporate_labels cl ON cl."m_ID" = s."corpLabelID"
LEFT JOIN naeron_bi_fleets fl            ON fl."m_ID" = s."fleetID"
WHERE (LOWER(TRIM(COALESCE(s."_lastRowStatus", ''))) IN ('create', 'update')
       AND (s."trainingStatus" IS NULL OR TRIM(s."trainingStatus") = '' OR LOWER(TRIM(s."trainingStatus")) <> 'cancelcontract'))
  AND (p_q IS NULL OR p_q = ''
       OR s."firstName" ILIKE '%' || p_q || '%'
       OR s."lastName"  ILIKE '%' || p_q || '%'
       OR s."shortCode" ILIKE '%' || p_q || '%'
       OR s.gsm         ILIKE '%' || p_q || '%'
       OR s."studentNo" ILIKE '%' || p_q || '%')
  AND (p_fleet IS NULL OR s."fleetID" = p_fleet)
  AND (p_facility IS NULL OR s."facilityID" = p_facility)
  AND (p_group IS NULL OR EXISTS (
        SELECT 1 FROM naeron_bi_student_trainings stg
        WHERE stg."studentID" = s."m_ID" AND stg."groupID" = p_group))
  AND ((COALESCE(cardinality(p_corp_ids), 0) = 0 AND NOT COALESCE(p_corp_unlabeled, false))
       OR s."corpLabelID" = ANY (p_corp_ids)
       OR (COALESCE(p_corp_unlabeled, false) AND (s."corpLabelID" IS NULL OR s."corpLabelID" = 0)))
  AND (p_student IS NULL OR s."m_ID" = p_student)
  AND (CASE
         WHEN COALESCE(p_exclude_ppl_grads, false) THEN NOT EXISTS (
           SELECT 1 FROM naeron_bi_student_trainings st
           INNER JOIN naeron_bi_trainings t ON t."m_ID" = st."trainingID"
           WHERE st."studentID" = s."m_ID"
             AND LOWER(TRIM(COALESCE(t.name, ''))) LIKE '%ppl%'
             AND LOWER(TRIM(COALESCE(st."trainingStatus", ''))) = 'graduated')
         WHEN NOT COALESCE(p_show_graduates, false) THEN
           (COALESCE(NULLIF(TRIM(s."trainingStatus"), ''), '') = '' OR LOWER(TRIM(s."trainingStatus")) <> 'graduated')
         ELSE true
       END)
  AND (COALESCE(p_show_suspended, true) OR COALESCE(NULLIF(TRIM(s."suspendFlights"), ''), '0') <> '1')
ORDER BY s."lastName", s."firstName"
) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_hatppl_fleets() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
  SELECT "m_ID", name FROM naeron_bi_fleets
  WHERE COALESCE(NULLIF(TRIM(archive), ''), '0') <> '1'
  ORDER BY name
) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_hatppl_facilities() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
  SELECT "m_ID", name FROM naeron_bi_facilities ORDER BY name
) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_hatppl_groups() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
  SELECT g."m_ID", g.code, f.name AS fleet_name
  FROM naeron_bi_groups g
  LEFT JOIN naeron_bi_fleets f ON f."m_ID" = g."fleetID"
  WHERE COALESCE(NULLIF(TRIM(g.archive), ''), '0') <> '1'
  ORDER BY f.name, g.code
) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_hatppl_student_pick() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
  SELECT s."m_ID", s."firstName", s."lastName" FROM naeron_bi_students s
  WHERE (LOWER(TRIM(COALESCE(s."_lastRowStatus", ''))) IN ('create', 'update')
         AND (s."trainingStatus" IS NULL OR TRIM(s."trainingStatus") = '' OR LOWER(TRIM(s."trainingStatus")) <> 'cancelcontract'))
  ORDER BY s."lastName", s."firstName" LIMIT 800
) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_hatppl_corp_labels_all() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
  SELECT "m_ID", name, color FROM naeron_bi_corporate_labels ORDER BY name ASC
) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_hatppl_corp_labels_used() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
  SELECT c."m_ID", c.name, c.color
  FROM naeron_bi_corporate_labels c
  INNER JOIN (
      SELECT s."corpLabelID" AS id, COUNT(*) AS cnt
      FROM naeron_bi_students s
      WHERE s."corpLabelID" IS NOT NULL AND s."corpLabelID" > 0
        AND (LOWER(TRIM(COALESCE(s."_lastRowStatus", ''))) IN ('create', 'update')
             AND (s."trainingStatus" IS NULL OR TRIM(s."trainingStatus") = '' OR LOWER(TRIM(s."trainingStatus")) <> 'cancelcontract'))
      GROUP BY s."corpLabelID"
  ) u ON u.id = c."m_ID"
  ORDER BY c.name ASC
) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_hatppl_nazari_counted() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
  SELECT COUNT(*) AS c FROM northfly_odt_nazari_subjects WHERE counts_toward_total = true
) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_hatppl_nazari_scores(p_student_ids integer[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
  SELECT sc.student_id,
         COUNT(DISTINCT sc.subject_id) AS subj_with,
         SUM(CASE WHEN sc.score >= sub.pass_min_score THEN 1 ELSE 0 END) AS x_pass
  FROM northfly_odt_nazari_subject_scores sc
  INNER JOIN northfly_odt_nazari_subjects sub
          ON sub."m_ID" = sc.subject_id AND sub.counts_toward_total = true
  WHERE sc.student_id = ANY (p_student_ids)
  GROUP BY sc.student_id
) t) s
$$;

CREATE OR REPLACE FUNCTION public.odt_hatppl_nazari_legacy(p_student_ids integer[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row_json FROM (
  SELECT student_id FROM northfly_odt_nazari_legacy_pass WHERE student_id = ANY (p_student_ids)
) t) s
$$;

REVOKE ALL ON FUNCTION public.odt_hatppl_students(text, integer, text, text, integer, integer[], boolean, boolean, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_hatppl_students(text, integer, text, text, integer, integer[], boolean, boolean, boolean, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.odt_hatppl_fleets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_hatppl_fleets() TO service_role;
REVOKE ALL ON FUNCTION public.odt_hatppl_facilities() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_hatppl_facilities() TO service_role;
REVOKE ALL ON FUNCTION public.odt_hatppl_groups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_hatppl_groups() TO service_role;
REVOKE ALL ON FUNCTION public.odt_hatppl_student_pick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_hatppl_student_pick() TO service_role;
REVOKE ALL ON FUNCTION public.odt_hatppl_corp_labels_all() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_hatppl_corp_labels_all() TO service_role;
REVOKE ALL ON FUNCTION public.odt_hatppl_corp_labels_used() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_hatppl_corp_labels_used() TO service_role;
REVOKE ALL ON FUNCTION public.odt_hatppl_nazari_counted() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_hatppl_nazari_counted() TO service_role;
REVOKE ALL ON FUNCTION public.odt_hatppl_nazari_scores(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_hatppl_nazari_scores(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_hatppl_nazari_legacy(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_hatppl_nazari_legacy(integer[]) TO service_role;
