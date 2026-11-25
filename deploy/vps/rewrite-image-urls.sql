-- Image links in the database point at Neon Object Storage, e.g.
--   https://br-xxxx.storage.c-7.us-east-2.aws.neon.tech/uploads/listings/abc.jpg
-- After the move the same files are served by this server as /uploads/listings/abc.jpg.
-- This rewrites every text / varchar / jsonb column that contains the old address.
-- Usage (done by migrate-from-neon.sh):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v old_origin='https://br-xxxx.storage...neon.tech/uploads/' -f rewrite-image-urls.sql
BEGIN;

SELECT set_config('mero.old_origin', :'old_origin', true);

DO $$
DECLARE
  old_prefix text := current_setting('mero.old_origin');
  new_prefix text := '/uploads/';
  r record;
  changed bigint;
  total bigint := 0;
BEGIN
  IF old_prefix IS NULL OR old_prefix = '' OR old_prefix = '/uploads/' THEN
    RAISE EXCEPTION 'old_origin must be the full old address, ending in /uploads/';
  END IF;

  FOR r IN
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.data_type IN ('text', 'character varying', 'jsonb')
      AND c.is_generated = 'NEVER'
      AND c.table_name <> 'schema_migrations'
  LOOP
    IF r.data_type = 'jsonb' THEN
      EXECUTE format(
        'UPDATE public.%I SET %I = replace(%I::text, %L, %L)::jsonb WHERE %I::text LIKE %L',
        r.table_name, r.column_name, r.column_name, old_prefix, new_prefix, r.column_name, '%' || old_prefix || '%');
    ELSE
      EXECUTE format(
        'UPDATE public.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
        r.table_name, r.column_name, r.column_name, old_prefix, new_prefix, r.column_name, '%' || old_prefix || '%');
    END IF;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed > 0 THEN
      RAISE NOTICE 'rewrote % rows in %.%', changed, r.table_name, r.column_name;
      total := total + changed;
    END IF;
  END LOOP;
  RAISE NOTICE 'total rows rewritten: %', total;
END
$$;

COMMIT;
