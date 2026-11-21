GRANT SELECT ON public.scoobert_votes TO anon,authenticated;
CREATE POLICY public_vote_total ON public.scoobert_votes FOR SELECT TO anon,authenticated USING(true);
GRANT SELECT(name,tokens) ON public.token_leaderboard TO anon,authenticated;
CREATE POLICY public_leaderboard ON public.token_leaderboard FOR SELECT TO anon,authenticated USING(true);
GRANT SELECT ON public.site_events TO anon,authenticated;
CREATE POLICY public_events ON public.site_events FOR SELECT TO anon,authenticated USING(true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_events;
CREATE TABLE public.legacy_wallet_claims (legacy_id uuid PRIMARY KEY,account_id uuid NOT NULL);
GRANT ALL ON public.legacy_wallet_claims TO service_role;
ALTER TABLE public.legacy_wallet_claims ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.attach_legacy_wallet(p_user uuid,p_legacy uuid,p_balance bigint,p_voted boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF p_balance<0 OR p_balance>10000000 OR NOT EXISTS(SELECT 1 FROM public.wallet_accounts WHERE player_id=p_user) THEN RETURN; END IF;
 INSERT INTO public.legacy_wallet_claims(legacy_id,account_id) VALUES(p_legacy,p_user) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.wallet_accounts SET balance=least(10000000,balance+p_balance),updated_at=now() WHERE player_id=p_user;
 IF p_voted THEN INSERT INTO public.scoobert_vote_claims(player_id) VALUES(p_user) ON CONFLICT DO NOTHING; UPDATE public.wallet_accounts SET votes=1 WHERE player_id=p_user; END IF;
 UPDATE public.token_leaderboard SET name=(SELECT username FROM public.profiles WHERE id=p_user) WHERE player_id=p_legacy;
 END $$;
REVOKE ALL ON FUNCTION public.attach_legacy_wallet(uuid,uuid,bigint,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.attach_legacy_wallet(uuid,uuid,bigint,boolean) TO service_role;
CREATE FUNCTION public.sync_razy_leaderboard_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 UPDATE public.token_leaderboard SET name=NEW.username WHERE player_id=NEW.id OR player_id IN(SELECT legacy_id FROM public.legacy_wallet_claims WHERE account_id=NEW.id); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.sync_razy_leaderboard_name() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER razy_name_changed AFTER UPDATE OF username ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_razy_leaderboard_name();