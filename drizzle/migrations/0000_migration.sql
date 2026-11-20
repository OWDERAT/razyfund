CREATE TABLE public.scoobert_votes (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), total bigint NOT NULL DEFAULT 0);
INSERT INTO public.scoobert_votes (id, total) VALUES (1, 0);
GRANT ALL ON public.scoobert_votes TO service_role;
ALTER TABLE public.scoobert_votes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.token_leaderboard (
  player_id uuid PRIMARY KEY,
  name text NOT NULL,
  tokens bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.token_leaderboard TO service_role;
ALTER TABLE public.token_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE INDEX token_leaderboard_tokens_idx ON public.token_leaderboard (tokens DESC);

CREATE OR REPLACE FUNCTION public.add_scoobert_vote() RETURNS bigint
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.scoobert_votes SET total = total + 1 WHERE id = 1 RETURNING total;
$$;

CREATE OR REPLACE FUNCTION public.add_leaderboard_tokens(p_player uuid, p_name text, p_tokens bigint) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.token_leaderboard (player_id, name, tokens) VALUES (p_player, p_name, p_tokens)
  ON CONFLICT (player_id) DO UPDATE SET tokens = public.token_leaderboard.tokens + EXCLUDED.tokens, name = EXCLUDED.name, updated_at = now();
$$;

REVOKE EXECUTE ON FUNCTION public.add_scoobert_vote() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_leaderboard_tokens(uuid, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_scoobert_vote() TO service_role;
GRANT EXECUTE ON FUNCTION public.add_leaderboard_tokens(uuid, text, bigint) TO service_role;