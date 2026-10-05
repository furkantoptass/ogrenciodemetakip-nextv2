-- Naeron REST BI v2 eşitlemesi: API satırları tablo başına sabit bir fonksiyonla upsert edilir.
-- API vm_ID alanını metin olarak verir ("s8444").
ALTER TABLE public.naeron_bi_students ALTER COLUMN "vm_ID" TYPE text USING "vm_ID"::text;
ALTER TABLE public.naeron_bi_employees ALTER COLUMN "vm_ID" TYPE text USING "vm_ID"::text;

CREATE TABLE IF NOT EXISTS public.northfly_odt_naeron_sync (
  table_name varchar(64) NOT NULL,
  last_server_time timestamp(3),
  last_run_at timestamp(3) NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT false,
  error_text varchar(500),
  PRIMARY KEY (table_name)
);
ALTER TABLE public.northfly_odt_naeron_sync ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.odt_naeron_state_list()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  FROM (SELECT table_name, last_server_time, last_run_at, row_count, ok, error_text
        FROM public.northfly_odt_naeron_sync ORDER BY table_name) t
$$;

-- p_server_time NULL ise (hata durumu) önceki eşitleme noktası korunur.
CREATE OR REPLACE FUNCTION public.odt_naeron_state_set(p_table text, p_server_time timestamp, p_rows integer, p_ok boolean, p_error text)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.northfly_odt_naeron_sync (table_name, last_server_time, last_run_at, row_count, ok, error_text)
    VALUES (p_table, p_server_time, now() AT TIME ZONE 'UTC', p_rows, p_ok, left(p_error, 500))
    ON CONFLICT (table_name) DO UPDATE SET
      last_server_time = COALESCE(EXCLUDED.last_server_time, public.northfly_odt_naeron_sync.last_server_time),
      last_run_at = EXCLUDED.last_run_at, row_count = EXCLUDED.row_count, ok = EXCLUDED.ok, error_text = EXCLUDED.error_text
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_flights_delete(p_ids integer[])
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (DELETE FROM public.naeron_bi_flights WHERE "m_ID" = ANY(p_ids) RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_upsert_corporate_labels(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.naeron_bi_corporate_labels ("m_ID", code, name, color, "_lastRowStatus", "_lastRowUpdate")
    SELECT "m_ID", code, name, color, "_lastRowStatus", "_lastRowUpdate"
    FROM jsonb_populate_recordset(NULL::public.naeron_bi_corporate_labels, p_rows)
    WHERE "m_ID" IS NOT NULL
    ON CONFLICT ("m_ID") DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, color = EXCLUDED.color, "_lastRowStatus" = EXCLUDED."_lastRowStatus", "_lastRowUpdate" = EXCLUDED."_lastRowUpdate"
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_upsert_currencies(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.naeron_bi_currencies ("m_ID", name, shortcode, symbol, "_lastRowStatus", "_lastRowUpdate")
    SELECT "m_ID", name, shortcode, symbol, "_lastRowStatus", "_lastRowUpdate"
    FROM jsonb_populate_recordset(NULL::public.naeron_bi_currencies, p_rows)
    WHERE "m_ID" IS NOT NULL
    ON CONFLICT ("m_ID") DO UPDATE SET name = EXCLUDED.name, shortcode = EXCLUDED.shortcode, symbol = EXCLUDED.symbol, "_lastRowStatus" = EXCLUDED."_lastRowStatus", "_lastRowUpdate" = EXCLUDED."_lastRowUpdate"
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_upsert_employees(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.naeron_bi_employees ("m_ID", "vm_ID", active, title, "shortCode", "firstName", "lastName", "regNo", gender, constricted, fi, obs, tki, "controlInstructor", "startDate", "endDate", "facilityID", gsm, email, "workTypeID", "lastFlight", "supervisorID", "_lastRowStatus", "_lastRowUpdate", "birthDate")
    SELECT "m_ID", "vm_ID", active, title, "shortCode", "firstName", "lastName", "regNo", gender, constricted, fi, obs, tki, "controlInstructor", "startDate", "endDate", "facilityID", gsm, email, "workTypeID", "lastFlight", "supervisorID", "_lastRowStatus", "_lastRowUpdate", "birthDate"
    FROM jsonb_populate_recordset(NULL::public.naeron_bi_employees, p_rows)
    WHERE "m_ID" IS NOT NULL
    ON CONFLICT ("m_ID") DO UPDATE SET "vm_ID" = EXCLUDED."vm_ID", active = EXCLUDED.active, title = EXCLUDED.title, "shortCode" = EXCLUDED."shortCode", "firstName" = EXCLUDED."firstName", "lastName" = EXCLUDED."lastName", "regNo" = EXCLUDED."regNo", gender = EXCLUDED.gender, constricted = EXCLUDED.constricted, fi = EXCLUDED.fi, obs = EXCLUDED.obs, tki = EXCLUDED.tki, "controlInstructor" = EXCLUDED."controlInstructor", "startDate" = EXCLUDED."startDate", "endDate" = EXCLUDED."endDate", "facilityID" = EXCLUDED."facilityID", gsm = EXCLUDED.gsm, email = EXCLUDED.email, "workTypeID" = EXCLUDED."workTypeID", "lastFlight" = EXCLUDED."lastFlight", "supervisorID" = EXCLUDED."supervisorID", "_lastRowStatus" = EXCLUDED."_lastRowStatus", "_lastRowUpdate" = EXCLUDED."_lastRowUpdate", "birthDate" = EXCLUDED."birthDate"
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_upsert_facilities(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.naeron_bi_facilities ("m_ID", icao, name, latitude, longitude, "_lastRowStatus", "_lastRowUpdate")
    SELECT "m_ID", icao, name, latitude, longitude, "_lastRowStatus", "_lastRowUpdate"
    FROM jsonb_populate_recordset(NULL::public.naeron_bi_facilities, p_rows)
    WHERE "m_ID" IS NOT NULL
    ON CONFLICT ("m_ID") DO UPDATE SET icao = EXCLUDED.icao, name = EXCLUDED.name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, "_lastRowStatus" = EXCLUDED."_lastRowStatus", "_lastRowUpdate" = EXCLUDED."_lastRowUpdate"
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_upsert_fleets(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.naeron_bi_fleets ("m_ID", name, "startDate", "trainingType", archive, "_lastRowStatus", "_lastRowUpdate")
    SELECT "m_ID", name, "startDate", "trainingType", archive, "_lastRowStatus", "_lastRowUpdate"
    FROM jsonb_populate_recordset(NULL::public.naeron_bi_fleets, p_rows)
    WHERE "m_ID" IS NOT NULL
    ON CONFLICT ("m_ID") DO UPDATE SET name = EXCLUDED.name, "startDate" = EXCLUDED."startDate", "trainingType" = EXCLUDED."trainingType", archive = EXCLUDED.archive, "_lastRowStatus" = EXCLUDED."_lastRowStatus", "_lastRowUpdate" = EXCLUDED."_lastRowUpdate"
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_upsert_groups(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.naeron_bi_groups ("m_ID", "facilityID", "fleetID", code, "trainingID", "startDate", archive, "revisionID", "inTheory", "_lastRowStatus", "_lastRowUpdate")
    SELECT "m_ID", "facilityID", "fleetID", code, "trainingID", "startDate", archive, "revisionID", "inTheory", "_lastRowStatus", "_lastRowUpdate"
    FROM jsonb_populate_recordset(NULL::public.naeron_bi_groups, p_rows)
    WHERE "m_ID" IS NOT NULL
    ON CONFLICT ("m_ID") DO UPDATE SET "facilityID" = EXCLUDED."facilityID", "fleetID" = EXCLUDED."fleetID", code = EXCLUDED.code, "trainingID" = EXCLUDED."trainingID", "startDate" = EXCLUDED."startDate", archive = EXCLUDED.archive, "revisionID" = EXCLUDED."revisionID", "inTheory" = EXCLUDED."inTheory", "_lastRowStatus" = EXCLUDED."_lastRowStatus", "_lastRowUpdate" = EXCLUDED."_lastRowUpdate"
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_upsert_trainings(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.naeron_bi_trainings ("m_ID", name, "itemOrder", "trainingType", "_lastRowStatus", "_lastRowUpdate")
    SELECT "m_ID", name, "itemOrder", "trainingType", "_lastRowStatus", "_lastRowUpdate"
    FROM jsonb_populate_recordset(NULL::public.naeron_bi_trainings, p_rows)
    WHERE "m_ID" IS NOT NULL
    ON CONFLICT ("m_ID") DO UPDATE SET name = EXCLUDED.name, "itemOrder" = EXCLUDED."itemOrder", "trainingType" = EXCLUDED."trainingType", "_lastRowStatus" = EXCLUDED."_lastRowStatus", "_lastRowUpdate" = EXCLUDED."_lastRowUpdate"
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_upsert_students(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.naeron_bi_students ("m_ID", "vm_ID", "corpLabelID", "fleetID", "shortCode", "firstName", "lastName", "studentNo", gender, "identityNo", "licenceNo", "lastFlight", "lastDuty", "trainingStatus", "facilityID", gsm, email, "inTheory", "inControl", "suspendFlights", "actualTrainingName", "actualPhaseName", "_lastRowStatus", "_lastRowUpdate", "birthDate")
    SELECT "m_ID", "vm_ID", "corpLabelID", "fleetID", "shortCode", "firstName", "lastName", "studentNo", gender, "identityNo", "licenceNo", "lastFlight", "lastDuty", "trainingStatus", "facilityID", gsm, email, "inTheory", "inControl", "suspendFlights", "actualTrainingName", "actualPhaseName", "_lastRowStatus", "_lastRowUpdate", "birthDate"
    FROM jsonb_populate_recordset(NULL::public.naeron_bi_students, p_rows)
    WHERE "m_ID" IS NOT NULL
    ON CONFLICT ("m_ID") DO UPDATE SET "vm_ID" = EXCLUDED."vm_ID", "corpLabelID" = EXCLUDED."corpLabelID", "fleetID" = EXCLUDED."fleetID", "shortCode" = EXCLUDED."shortCode", "firstName" = EXCLUDED."firstName", "lastName" = EXCLUDED."lastName", "studentNo" = EXCLUDED."studentNo", gender = EXCLUDED.gender, "identityNo" = EXCLUDED."identityNo", "licenceNo" = EXCLUDED."licenceNo", "lastFlight" = EXCLUDED."lastFlight", "lastDuty" = EXCLUDED."lastDuty", "trainingStatus" = EXCLUDED."trainingStatus", "facilityID" = EXCLUDED."facilityID", gsm = EXCLUDED.gsm, email = EXCLUDED.email, "inTheory" = EXCLUDED."inTheory", "inControl" = EXCLUDED."inControl", "suspendFlights" = EXCLUDED."suspendFlights", "actualTrainingName" = EXCLUDED."actualTrainingName", "actualPhaseName" = EXCLUDED."actualPhaseName", "_lastRowStatus" = EXCLUDED."_lastRowStatus", "_lastRowUpdate" = EXCLUDED."_lastRowUpdate", "birthDate" = EXCLUDED."birthDate"
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_upsert_student_certificates(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.naeron_bi_student_certificates ("m_ID", "studentID", "documentNo", "startDate", "endDate", note, archive, name, visibility, "_lastRowStatus", "_lastRowUpdate")
    SELECT "m_ID", "studentID", "documentNo", "startDate", "endDate", note, archive, name, visibility, "_lastRowStatus", "_lastRowUpdate"
    FROM jsonb_populate_recordset(NULL::public.naeron_bi_student_certificates, p_rows)
    WHERE "m_ID" IS NOT NULL
    ON CONFLICT ("m_ID") DO UPDATE SET "studentID" = EXCLUDED."studentID", "documentNo" = EXCLUDED."documentNo", "startDate" = EXCLUDED."startDate", "endDate" = EXCLUDED."endDate", note = EXCLUDED.note, archive = EXCLUDED.archive, name = EXCLUDED.name, visibility = EXCLUDED.visibility, "_lastRowStatus" = EXCLUDED."_lastRowStatus", "_lastRowUpdate" = EXCLUDED."_lastRowUpdate"
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_upsert_student_contracts(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.naeron_bi_student_contracts ("m_ID", "studentID", subject, "contractNo", note, "signDate", "signerID", "signerName", "contractStatus", price, payed, "currencyID", "_lastRowStatus", "_lastRowUpdate")
    SELECT "m_ID", "studentID", subject, "contractNo", note, "signDate", "signerID", "signerName", "contractStatus", price, payed, "currencyID", "_lastRowStatus", "_lastRowUpdate"
    FROM jsonb_populate_recordset(NULL::public.naeron_bi_student_contracts, p_rows)
    WHERE "m_ID" IS NOT NULL
    ON CONFLICT ("m_ID") DO UPDATE SET "studentID" = EXCLUDED."studentID", subject = EXCLUDED.subject, "contractNo" = EXCLUDED."contractNo", note = EXCLUDED.note, "signDate" = EXCLUDED."signDate", "signerID" = EXCLUDED."signerID", "signerName" = EXCLUDED."signerName", "contractStatus" = EXCLUDED."contractStatus", price = EXCLUDED.price, payed = EXCLUDED.payed, "currencyID" = EXCLUDED."currencyID", "_lastRowStatus" = EXCLUDED."_lastRowStatus", "_lastRowUpdate" = EXCLUDED."_lastRowUpdate"
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_upsert_student_installments(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.naeron_bi_student_installments ("m_ID", "studentID", "contractID", "installmentDate", name, price, currency, status, note, "_lastRowStatus", "_lastRowUpdate")
    SELECT "m_ID", "studentID", "contractID", "installmentDate", name, price, currency, status, note, "_lastRowStatus", "_lastRowUpdate"
    FROM jsonb_populate_recordset(NULL::public.naeron_bi_student_installments, p_rows)
    WHERE "m_ID" IS NOT NULL
    ON CONFLICT ("m_ID") DO UPDATE SET "studentID" = EXCLUDED."studentID", "contractID" = EXCLUDED."contractID", "installmentDate" = EXCLUDED."installmentDate", name = EXCLUDED.name, price = EXCLUDED.price, currency = EXCLUDED.currency, status = EXCLUDED.status, note = EXCLUDED.note, "_lastRowStatus" = EXCLUDED."_lastRowStatus", "_lastRowUpdate" = EXCLUDED."_lastRowUpdate"
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_upsert_student_payments(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.naeron_bi_student_payments ("m_ID", "studentID", "contractID", "paymentDate", "paymentNo", amount, "currencyID", exchange, note, "bankAccountID", "creatorID", "createDate", "creatorName", "_lastRowStatus", "_lastRowUpdate")
    SELECT "m_ID", "studentID", "contractID", "paymentDate", "paymentNo", amount, "currencyID", exchange, note, "bankAccountID", "creatorID", "createDate", "creatorName", "_lastRowStatus", "_lastRowUpdate"
    FROM jsonb_populate_recordset(NULL::public.naeron_bi_student_payments, p_rows)
    WHERE "m_ID" IS NOT NULL
    ON CONFLICT ("m_ID") DO UPDATE SET "studentID" = EXCLUDED."studentID", "contractID" = EXCLUDED."contractID", "paymentDate" = EXCLUDED."paymentDate", "paymentNo" = EXCLUDED."paymentNo", amount = EXCLUDED.amount, "currencyID" = EXCLUDED."currencyID", exchange = EXCLUDED.exchange, note = EXCLUDED.note, "bankAccountID" = EXCLUDED."bankAccountID", "creatorID" = EXCLUDED."creatorID", "createDate" = EXCLUDED."createDate", "creatorName" = EXCLUDED."creatorName", "_lastRowStatus" = EXCLUDED."_lastRowStatus", "_lastRowUpdate" = EXCLUDED."_lastRowUpdate"
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_upsert_student_trainings(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.naeron_bi_student_trainings ("m_ID", "studentID", "groupID", "trainingID", "revisionID", "contractID", finance, duration, done, "pDone", "trainingStatus", note, "_lastRowStatus", "_lastRowUpdate")
    SELECT "m_ID", "studentID", "groupID", "trainingID", "revisionID", "contractID", finance, duration, done, "pDone", "trainingStatus", note, "_lastRowStatus", "_lastRowUpdate"
    FROM jsonb_populate_recordset(NULL::public.naeron_bi_student_trainings, p_rows)
    WHERE "m_ID" IS NOT NULL
    ON CONFLICT ("m_ID") DO UPDATE SET "studentID" = EXCLUDED."studentID", "groupID" = EXCLUDED."groupID", "trainingID" = EXCLUDED."trainingID", "revisionID" = EXCLUDED."revisionID", "contractID" = EXCLUDED."contractID", finance = EXCLUDED.finance, duration = EXCLUDED.duration, done = EXCLUDED.done, "pDone" = EXCLUDED."pDone", "trainingStatus" = EXCLUDED."trainingStatus", note = EXCLUDED.note, "_lastRowStatus" = EXCLUDED."_lastRowStatus", "_lastRowUpdate" = EXCLUDED."_lastRowUpdate"
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.odt_naeron_upsert_flights(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH x AS (
    INSERT INTO public.naeron_bi_flights ("m_ID", "planID", external, "exSchoolName_", type, "flightDate", "landingDate", "OffBlock", "OnBlock", duration, "BlockTime", "plannedOffBlock", "plannedOnBlock", "TakeOff", "Landing", "flightDuration", aircraft, "a_ID", "aircraftName_", "studentVMID", "s_Type", "s_ID", "studentName_", "student2VMID", "s_Type2", "s_ID2", "student2Name_", "instructorVMID", "i_Type", "i_ID", "instructorName_", "observerVMID", "o_Type", "o_ID", "observerName_", "baseFromID", "baseFromName_", "baseToID", "baseToName_", route, "routeName_", "dutyName_", note, tacho, "formNo", "landingCount", "obsPos", "obsPosName_", night, rt, ifr, "IFRduration", complex, nm150, nm300, spic, mcc, "engineType", "noCalcStats", "noAssessment", "progressCheck", "dutyRetake", control, "controlResult", navigation, "planShift", "planShiftName_", "planShiftNote", "paidFlight", afmlcontrol, realized, canceled, "cancelNote", incomplete, "hasFault", "faultDesc", "faultState", "_flightStatus", "_lastRowStatus", "_lastRowUpdate")
    SELECT "m_ID", "planID", external, "exSchoolName_", type, "flightDate", "landingDate", "OffBlock", "OnBlock", duration, "BlockTime", "plannedOffBlock", "plannedOnBlock", "TakeOff", "Landing", "flightDuration", aircraft, "a_ID", "aircraftName_", "studentVMID", "s_Type", "s_ID", "studentName_", "student2VMID", "s_Type2", "s_ID2", "student2Name_", "instructorVMID", "i_Type", "i_ID", "instructorName_", "observerVMID", "o_Type", "o_ID", "observerName_", "baseFromID", "baseFromName_", "baseToID", "baseToName_", route, "routeName_", "dutyName_", note, tacho, "formNo", "landingCount", "obsPos", "obsPosName_", night, rt, ifr, "IFRduration", complex, nm150, nm300, spic, mcc, "engineType", "noCalcStats", "noAssessment", "progressCheck", "dutyRetake", control, "controlResult", navigation, "planShift", "planShiftName_", "planShiftNote", "paidFlight", afmlcontrol, realized, canceled, "cancelNote", incomplete, "hasFault", "faultDesc", "faultState", "_flightStatus", "_lastRowStatus", "_lastRowUpdate"
    FROM jsonb_populate_recordset(NULL::public.naeron_bi_flights, p_rows)
    WHERE "m_ID" IS NOT NULL
    ON CONFLICT ("m_ID") DO UPDATE SET "planID" = EXCLUDED."planID", external = EXCLUDED.external, "exSchoolName_" = EXCLUDED."exSchoolName_", type = EXCLUDED.type, "flightDate" = EXCLUDED."flightDate", "landingDate" = EXCLUDED."landingDate", "OffBlock" = EXCLUDED."OffBlock", "OnBlock" = EXCLUDED."OnBlock", duration = EXCLUDED.duration, "BlockTime" = EXCLUDED."BlockTime", "plannedOffBlock" = EXCLUDED."plannedOffBlock", "plannedOnBlock" = EXCLUDED."plannedOnBlock", "TakeOff" = EXCLUDED."TakeOff", "Landing" = EXCLUDED."Landing", "flightDuration" = EXCLUDED."flightDuration", aircraft = EXCLUDED.aircraft, "a_ID" = EXCLUDED."a_ID", "aircraftName_" = EXCLUDED."aircraftName_", "studentVMID" = EXCLUDED."studentVMID", "s_Type" = EXCLUDED."s_Type", "s_ID" = EXCLUDED."s_ID", "studentName_" = EXCLUDED."studentName_", "student2VMID" = EXCLUDED."student2VMID", "s_Type2" = EXCLUDED."s_Type2", "s_ID2" = EXCLUDED."s_ID2", "student2Name_" = EXCLUDED."student2Name_", "instructorVMID" = EXCLUDED."instructorVMID", "i_Type" = EXCLUDED."i_Type", "i_ID" = EXCLUDED."i_ID", "instructorName_" = EXCLUDED."instructorName_", "observerVMID" = EXCLUDED."observerVMID", "o_Type" = EXCLUDED."o_Type", "o_ID" = EXCLUDED."o_ID", "observerName_" = EXCLUDED."observerName_", "baseFromID" = EXCLUDED."baseFromID", "baseFromName_" = EXCLUDED."baseFromName_", "baseToID" = EXCLUDED."baseToID", "baseToName_" = EXCLUDED."baseToName_", route = EXCLUDED.route, "routeName_" = EXCLUDED."routeName_", "dutyName_" = EXCLUDED."dutyName_", note = EXCLUDED.note, tacho = EXCLUDED.tacho, "formNo" = EXCLUDED."formNo", "landingCount" = EXCLUDED."landingCount", "obsPos" = EXCLUDED."obsPos", "obsPosName_" = EXCLUDED."obsPosName_", night = EXCLUDED.night, rt = EXCLUDED.rt, ifr = EXCLUDED.ifr, "IFRduration" = EXCLUDED."IFRduration", complex = EXCLUDED.complex, nm150 = EXCLUDED.nm150, nm300 = EXCLUDED.nm300, spic = EXCLUDED.spic, mcc = EXCLUDED.mcc, "engineType" = EXCLUDED."engineType", "noCalcStats" = EXCLUDED."noCalcStats", "noAssessment" = EXCLUDED."noAssessment", "progressCheck" = EXCLUDED."progressCheck", "dutyRetake" = EXCLUDED."dutyRetake", control = EXCLUDED.control, "controlResult" = EXCLUDED."controlResult", navigation = EXCLUDED.navigation, "planShift" = EXCLUDED."planShift", "planShiftName_" = EXCLUDED."planShiftName_", "planShiftNote" = EXCLUDED."planShiftNote", "paidFlight" = EXCLUDED."paidFlight", afmlcontrol = EXCLUDED.afmlcontrol, realized = EXCLUDED.realized, canceled = EXCLUDED.canceled, "cancelNote" = EXCLUDED."cancelNote", incomplete = EXCLUDED.incomplete, "hasFault" = EXCLUDED."hasFault", "faultDesc" = EXCLUDED."faultDesc", "faultState" = EXCLUDED."faultState", "_flightStatus" = EXCLUDED."_flightStatus", "_lastRowStatus" = EXCLUDED."_lastRowStatus", "_lastRowUpdate" = EXCLUDED."_lastRowUpdate"
    RETURNING 1)
  SELECT count(*)::int FROM x
$$;

REVOKE ALL ON FUNCTION public.odt_naeron_state_list() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_state_list() TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_state_set(text, timestamp, integer, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_state_set(text, timestamp, integer, boolean, text) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_flights_delete(integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_flights_delete(integer[]) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_upsert_corporate_labels(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_upsert_corporate_labels(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_upsert_currencies(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_upsert_currencies(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_upsert_employees(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_upsert_employees(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_upsert_facilities(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_upsert_facilities(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_upsert_fleets(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_upsert_fleets(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_upsert_groups(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_upsert_groups(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_upsert_trainings(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_upsert_trainings(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_upsert_students(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_upsert_students(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_upsert_student_certificates(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_upsert_student_certificates(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_upsert_student_contracts(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_upsert_student_contracts(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_upsert_student_installments(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_upsert_student_installments(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_upsert_student_payments(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_upsert_student_payments(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_upsert_student_trainings(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_upsert_student_trainings(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.odt_naeron_upsert_flights(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_naeron_upsert_flights(jsonb) TO service_role;
