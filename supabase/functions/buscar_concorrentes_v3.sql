-- ================================================
-- RPC v3: Busca de concorrentes com PostGIS + tabelas normalizadas
-- Substitui buscar_anuncios_geo_v2 que dava timeout
--
-- Performance: ~1.9s (vs. timeout de >3.7s na v2)
-- Ganho: PostGIS GiST index para filtro espacial + tabelas normalizadas
-- ================================================

-- Dropar versões existentes
DROP FUNCTION IF EXISTS buscar_concorrentes_v3;

CREATE FUNCTION buscar_concorrentes_v3(
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_raio_km DOUBLE PRECISION DEFAULT 10,
    p_hospedes INTEGER DEFAULT 1,
    p_start_date TEXT DEFAULT NULL,
    p_end_date TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    id_numerica NUMERIC,
    data_extracao TIMESTAMPTZ,
    checkin_formatado TIMESTAMPTZ,
    tipo_propriedade TEXT,
    nome_anuncio TEXT,
    preco_total NUMERIC,
    quantidade_noites NUMERIC,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    hospedes_adultos NUMERIC,
    media_avaliacao TEXT,
    preferido_hospedes BOOLEAN,
    url_anuncio TEXT,
    distancia_km DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
    WITH nearby AS (
        SELECT 
            p.id_numerica,
            p.tipo_propriedade,
            p.nome_anuncio,
            p.latitude,
            p.longitude,
            p.hospedes_adultos,
            p.media_avaliacao,
            p.url_anuncio,
            ROUND((ST_Distance(
                p.geom::geography, 
                ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
            ) / 1000)::NUMERIC, 2)::DOUBLE PRECISION AS dist_km
        FROM airbnb_propriedades p
        WHERE ST_DWithin(
            p.geom::geography, 
            ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography, 
            p_raio_km * 1000
        )
        AND (p.hospedes_adultos >= p_hospedes OR p.hospedes_adultos IS NULL)
    )
    SELECT 
        pr.id,
        n.id_numerica,
        pr.data_extracao,
        pr.checkin_formatado,
        n.tipo_propriedade,
        n.nome_anuncio,
        pr.preco_total,
        pr.quantidade_noites,
        n.latitude,
        n.longitude,
        n.hospedes_adultos,
        n.media_avaliacao,
        pr.preferido_hospedes,
        n.url_anuncio,
        n.dist_km
    FROM nearby n
    INNER JOIN airbnb_precos pr ON pr.id_numerica = n.id_numerica
    WHERE (p_start_date IS NULL OR pr.checkin_formatado >= p_start_date::DATE)
      AND (p_end_date IS NULL OR pr.checkin_formatado <= p_end_date::DATE)
    ORDER BY n.dist_km ASC, pr.data_extracao DESC;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION buscar_concorrentes_v3 TO anon, authenticated;

COMMENT ON FUNCTION buscar_concorrentes_v3 IS 'RPC v3: PostGIS GiST filter + normalized tables JOIN. Returns flat rows compatible with v2 format. Grouping done client-side.';
