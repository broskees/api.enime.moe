CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION most_similar(text, text[]) RETURNS DOUBLE PRECISION
LANGUAGE SQL AS $$
SELECT max(similarity($1,x)) FROM unnest($2) f(x)
    $$;