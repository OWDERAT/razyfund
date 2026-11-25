CREATE TABLE public.visitor_players (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token_hash text UNIQUE NOT NULL,
 name text NOT NULL DEFAULT 'Anonymous',
 banned boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.visitor_players TO service_role;
ALTER TABLE public.visitor_players ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX visitor_players_named_unique ON public.visitor_players (lower(name)) WHERE name <> 'Anonymous';
CREATE TABLE public.visitor_orders (
 player_id uuid NOT NULL REFERENCES public.visitor_players(id),
 order_id uuid NOT NULL,
 plan text NOT NULL,
 tokens integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(player_id,order_id)
);
GRANT ALL ON public.visitor_orders TO service_role;
ALTER TABLE public.visitor_orders ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.visitor_wallet_action(p_player uuid, p_action text, p_plan text DEFAULT NULL, p_name text DEFAULT NULL, p_order uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_player public.visitor_players%ROWTYPE; v_wallet public.wallet_accounts%ROWTYPE; v_tokens integer; v_claimed uuid;
BEGIN
 SELECT * INTO v_player FROM public.visitor_players WHERE id=p_player FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','unknown_player'); END IF;
 IF v_player.banned THEN RETURN jsonb_build_object('ok',false,'error','banned'); END IF;
 INSERT INTO public.wallet_accounts(player_id) VALUES(p_player) ON CONFLICT DO NOTHING;
 SELECT * INTO v_wallet FROM public.wallet_accounts WHERE player_id=p_player FOR UPDATE;
 IF p_action='vote' THEN
  INSERT INTO public.scoobert_vote_claims(player_id) VALUES(p_player) ON CONFLICT DO NOTHING RETURNING player_id INTO v_claimed;
  IF v_claimed IS NULL THEN RETURN jsonb_build_object('ok',false,'error','already_voted'); END IF;
  UPDATE public.wallet_accounts SET votes=1,updated_at=now() WHERE player_id=p_player;
  UPDATE public.scoobert_votes SET total=total+1 WHERE id=1;
  RETURN jsonb_build_object('ok',true);
 ELSIF p_action='buy' THEN
  IF p_order IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_order'); END IF;
  IF EXISTS(SELECT 1 FROM public.visitor_orders WHERE player_id=p_player AND order_id=p_order) THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
  v_tokens := CASE p_plan WHEN 'Starter' THEN 500 WHEN 'Professional' THEN 2500 WHEN 'Enterprise' THEN 10000 ELSE NULL END;
  IF v_tokens IS NULL OR p_name IS NULL OR length(p_name)<1 OR length(p_name)>20 OR p_name !~ '^[[:alnum:] ._-]+$' THEN RETURN jsonb_build_object('ok',false,'error','invalid_order'); END IF;
  IF lower(p_name)='anonymous' OR EXISTS(SELECT 1 FROM public.profiles WHERE lower(username)=lower(p_name)) THEN RETURN jsonb_build_object('ok',false,'error','name_taken'); END IF;
  IF EXISTS(SELECT 1 FROM public.visitor_players WHERE id<>p_player AND lower(name)=lower(p_name)) THEN RETURN jsonb_build_object('ok',false,'error','name_taken'); END IF;
  UPDATE public.visitor_players SET name=p_name WHERE id=p_player;
  INSERT INTO public.visitor_orders(player_id,order_id,plan,tokens) VALUES(p_player,p_order,p_plan,v_tokens);
  UPDATE public.wallet_accounts SET balance=least(10000000,balance+v_tokens),updated_at=now() WHERE player_id=p_player;
  RETURN jsonb_build_object('ok',true,'tokens',v_tokens);
 END IF;
 RETURN jsonb_build_object('ok',false,'error','invalid_action');
END $$;
REVOKE ALL ON FUNCTION public.visitor_wallet_action(uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_wallet_action(uuid,text,text,text,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.moderate_visitor(p_player uuid,p_banned boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM public.visitor_players WHERE id=p_player FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.visitor_players SET banned=p_banned WHERE id=p_player;
 INSERT INTO public.admin_audit_log(action,target_player,details) VALUES(CASE WHEN p_banned THEN 'ban_player' ELSE 'unban_player' END,p_player,jsonb_build_object('banned',p_banned));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.moderate_visitor(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_visitor(uuid,boolean) TO service_role;