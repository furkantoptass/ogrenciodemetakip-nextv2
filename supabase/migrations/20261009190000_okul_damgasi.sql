-- Seçili okul, satır yazılırken üzerine yazılır. Böylece iki okulun kaydı karışmaz.

CREATE OR REPLACE FUNCTION public.naeron_bi_okul_ata()
RETURNS trigger
LANGUAGE plpgsql
AS $tr$
BEGIN
  IF current_setting('odt.okul', true) IN ('alfaair', 'northfly') THEN
    NEW.okul := current_setting('odt.okul', true);
  ELSIF NEW.okul IS NULL OR btrim(NEW.okul) = '' OR NEW.okul NOT IN ('alfaair', 'northfly') THEN
    NEW.okul := 'alfaair';
  END IF;
  RETURN NEW;
END;
$tr$;

CREATE OR REPLACE FUNCTION public.odt_okul_tasi(p_table text, p_ids integer[])
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  n integer;
BEGIN
  IF p_table NOT IN (
    'naeron_bi_aircrafts_simulators_data',
    'naeron_bi_corporate_labels_data',
    'naeron_bi_currencies_data',
    'naeron_bi_employees_data',
    'naeron_bi_facilities_data',
    'naeron_bi_fleets_data',
    'naeron_bi_flights_data',
    'naeron_bi_groups_data',
    'naeron_bi_student_certificates_data',
    'naeron_bi_student_contracts_data',
    'naeron_bi_student_installments_data',
    'naeron_bi_student_payments_data',
    'naeron_bi_student_trainings_data',
    'naeron_bi_students_data',
    'naeron_bi_trainings_data'
  ) THEN
    RAISE EXCEPTION 'izin yok';
  END IF;
  EXECUTE format(
    'UPDATE public.%I SET okul = ''northfly'' WHERE okul = ''alfaair'' AND "m_ID" = ANY ($1)',
    p_table
  ) USING COALESCE(p_ids, ARRAY[]::integer[]);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$fn$;

REVOKE ALL ON FUNCTION public.odt_okul_tasi(text, integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_okul_tasi(text, integer[]) TO service_role;

NOTIFY pgrst, 'reload schema';
