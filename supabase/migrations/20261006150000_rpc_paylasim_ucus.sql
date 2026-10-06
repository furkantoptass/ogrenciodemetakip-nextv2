-- Dış paylaşım: tüm okul, baştan bugüne. Gerçekleşmiş, iptal edilmemiş, silinmemiş uçuşlar.
CREATE OR REPLACE FUNCTION public.odt_paylasim_ucus()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_array(jsonb_build_object(
    'dakika', COALESCE(SUM(src.minutes), 0)::int,
    'sorti', count(*)::int
  ))
  FROM (
    SELECT COALESCE(NULLIF(f."BlockTime", 0), NULLIF(f."flightDuration", 0), NULLIF(f.duration, 0), 0) AS minutes
    FROM public.naeron_bi_flights f
    WHERE COALESCE(f.realized, 0) = 1
      AND COALESCE(NULLIF(TRIM(f.canceled), ''), '0') = '0'
      AND LOWER(TRIM(COALESCE(f."_lastRowStatus", ''))) <> 'destroy'
  ) src;
$$;

REVOKE ALL ON FUNCTION public.odt_paylasim_ucus() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odt_paylasim_ucus() TO service_role;
