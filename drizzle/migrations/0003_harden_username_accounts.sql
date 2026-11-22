CREATE OR REPLACE FUNCTION public.create_razy_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE chosen text;
BEGIN
  chosen := btrim(NEW.raw_user_meta_data->>'username');
  IF chosen IS NULL OR char_length(chosen) NOT BETWEEN 3 AND 20 OR chosen !~ '^[[:alnum:]_.-]+$' OR chosen ~* '(admin|owner|moderator|razy|scoobert)' THEN
    RAISE EXCEPTION 'Invalid or reserved username';
  END IF;
  INSERT INTO public.profiles(id,username) VALUES(NEW.id,chosen);
  INSERT INTO public.wallet_accounts(player_id) VALUES(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_razy_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_razy_account() TO service_role;
COMMENT ON TABLE public.wallet_accounts IS 'Server-authoritative account balances and one persistent vote per account; browser writes forbidden.';