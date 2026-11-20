-- Server-authoritative wallet state and per-wallet Scoobert cooldowns.
CREATE TABLE IF NOT EXISTS public.wallet_accounts (
  player_id uuid PRIMARY KEY,
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0 AND balance <= 10000000),
  votes integer NOT NULL DEFAULT 0 CHECK (votes >= 0 AND votes <= 999),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  player_id uuid PRIMARY KEY REFERENCES public.wallet_accounts(player_id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE CHECK (char_length(username) BETWEEN 3 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_idx ON public.user_profiles (lower(username));

CREATE TABLE IF NOT EXISTS public.scoobert_vote_claims (
  player_id uuid PRIMARY KEY REFERENCES public.wallet_accounts(player_id) ON DELETE CASCADE,
  last_vote_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.site_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('rain','announcement','banner','maintenance')),
  title text NOT NULL DEFAULT '',
  image_url text,
  sound_url text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL,
  target_player uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoobert_vote_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.wallet_accounts, public.user_profiles, public.scoobert_vote_claims,
  public.site_events, public.admin_audit_log TO service_role;
GRANT SELECT ON public.user_profiles, public.site_events TO anon, authenticated;

-- A single atomic operation enforces the one-second cooldown even for concurrent/replayed requests.
CREATE OR REPLACE FUNCTION public.claim_scoobert_vote(p_player uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed integer;
BEGIN
  INSERT INTO public.wallet_accounts(player_id) VALUES (p_player)
  ON CONFLICT (player_id) DO NOTHING;

  INSERT INTO public.scoobert_vote_claims(player_id, last_vote_at)
  VALUES (p_player, now())
  ON CONFLICT (player_id) DO UPDATE
    SET last_vote_at = now()
    WHERE public.scoobert_vote_claims.last_vote_at <= now() - interval '1 second';

  GET DIAGNOSTICS claimed = ROW_COUNT;
  IF claimed = 0 THEN
    RETURN false;
  END IF;

  UPDATE public.wallet_accounts
  SET votes = LEAST(votes + 1, 999), updated_at = now()
  WHERE player_id = p_player AND votes < 999;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.scoobert_votes SET total = total + 1 WHERE id = 1;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_scoobert_vote(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scoobert_vote(uuid) TO service_role;

-- Remove the old unauthenticated-style crediting primitive from all client roles.
REVOKE EXECUTE ON FUNCTION public.add_leaderboard_tokens(uuid, text, bigint) FROM PUBLIC, anon, authenticated;

-- Preserve existing leaderboard balances where possible during the transition.
INSERT INTO public.wallet_accounts(player_id, balance)
SELECT player_id, LEAST(GREATEST(tokens, 0), 10000000)
FROM public.token_leaderboard
ON CONFLICT (player_id) DO NOTHING;

-- Atomic administrator balance updates; the browser never writes wallet rows directly.
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet_balance(p_player uuid, p_mode text, p_amount bigint)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_balance bigint;
BEGIN
  IF p_amount < 0 OR p_amount > 10000000 OR p_mode NOT IN ('add','remove','set') THEN
    RAISE EXCEPTION 'invalid balance adjustment';
  END IF;
  UPDATE public.wallet_accounts
  SET balance = CASE
    WHEN p_mode = 'set' THEN p_amount
    WHEN p_mode = 'add' THEN balance + p_amount
    ELSE balance - p_amount
  END,
  updated_at = now()
  WHERE player_id = p_player
  RETURNING balance INTO new_balance;
  IF new_balance IS NULL THEN RAISE EXCEPTION 'wallet not found'; END IF;
  IF new_balance < 0 OR new_balance > 10000000 THEN RAISE EXCEPTION 'balance out of range'; END IF;
  RETURN new_balance;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_wallet_balance(uuid,text,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet_balance(uuid,text,bigint) TO service_role;

CREATE TABLE IF NOT EXISTS public.admin_login_limits (
  ip_hash text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  blocked_until timestamptz
);
ALTER TABLE public.admin_login_limits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.admin_login_limits TO service_role;

CREATE OR REPLACE FUNCTION public.admin_login_is_blocked(p_ip_hash text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT blocked_until > now() FROM public.admin_login_limits WHERE ip_hash = p_ip_hash), false);
$$;
CREATE OR REPLACE FUNCTION public.admin_login_failed(p_ip_hash text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_login_limits(ip_hash, attempts, blocked_until)
  VALUES (p_ip_hash, 1, NULL)
  ON CONFLICT (ip_hash) DO UPDATE
  SET attempts = CASE WHEN public.admin_login_limits.attempts + 1 >= 5 THEN 0 ELSE public.admin_login_limits.attempts + 1 END,
      blocked_until = CASE WHEN public.admin_login_limits.attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE public.admin_login_limits.blocked_until END;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_login_succeeded(p_ip_hash text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.admin_login_limits WHERE ip_hash = p_ip_hash;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_login_is_blocked(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_login_failed(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_login_succeeded(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_login_is_blocked(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_login_failed(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_login_succeeded(text) TO service_role;
