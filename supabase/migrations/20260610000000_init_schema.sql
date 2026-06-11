-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    is_guest BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create games table
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(6) UNIQUE NOT NULL,
    host_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'lobby' NOT NULL,
    current_round INTEGER DEFAULT 0 NOT NULL,
    total_rounds INTEGER DEFAULT 15 NOT NULL,
    exclude_u BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT check_status CHECK (status IN ('lobby', 'active', 'completed'))
);

-- Create game_players table
CREATE TABLE IF NOT EXISTS public.game_players (
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    score INTEGER DEFAULT 0 NOT NULL,
    is_ready BOOLEAN DEFAULT FALSE NOT NULL,
    PRIMARY KEY (game_id, user_id)
);

-- Create rounds table
CREATE TABLE IF NOT EXISTS public.rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    letter CHAR(1) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_game_round UNIQUE(game_id, round_number)
);

-- Create submissions table
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    category VARCHAR(10) NOT NULL,
    answer_text TEXT,
    is_valid BOOLEAN DEFAULT TRUE NOT NULL,
    points INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_submission UNIQUE(game_id, round_number, user_id, category),
    CONSTRAINT check_category CHECK (category IN ('name', 'place', 'animal', 'thing'))
);

-- Create challenges table
CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    challenger_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    category VARCHAR(10) NOT NULL,
    answer_text TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    yes_votes INTEGER DEFAULT 0 NOT NULL,
    no_votes INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_challenge UNIQUE(game_id, round_number, target_user_id, category),
    CONSTRAINT check_challenge_category CHECK (category IN ('name', 'place', 'animal', 'thing')),
    CONSTRAINT check_challenge_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Create challenge_votes table
CREATE TABLE IF NOT EXISTS public.challenge_votes (
    challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
    voter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    vote BOOLEAN NOT NULL, -- TRUE for Yes (Invalid), FALSE for No (Valid)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (challenge_id, voter_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_players_user ON public.game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_rounds_game ON public.rounds(game_id);
CREATE INDEX IF NOT EXISTS idx_submissions_game_round ON public.submissions(game_id, round_number);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_game_round ON public.challenges(game_id, round_number);
CREATE INDEX IF NOT EXISTS idx_challenge_votes_challenge ON public.challenge_votes(challenge_id);

-- Disable Row-Level Security (RLS) on all tables since access is mediated via FastAPI backend
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.games DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_votes DISABLE ROW LEVEL SECURITY;

