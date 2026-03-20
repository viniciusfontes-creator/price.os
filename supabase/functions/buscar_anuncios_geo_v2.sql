-- Função para buscar anúncios do Airbnb por geolocalização
-- Versão 2 com melhor performance e filtros de data

-- Dropar todas as versões existentes da função
DROP FUNCTION IF EXISTS buscar_anuncios_geo_v2;
DROP FUNCTION IF EXISTS buscar_anuncios_geo_v2(DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS buscar_anuncios_geo_v2(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS buscar_anuncios_geo_v2(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);
DROP FUNCTION IF EXISTS buscar_anuncios_geo_v2(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT);

CREATE FUNCTION buscar_anuncios_geo_v2(
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
    data_extracao TIMESTAMP WITH TIME ZONE,
    checkin_formatado TIMESTAMP WITH TIME ZONE,
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
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ae.id,
        ae.id_numerica,
        ae.data_extracao,
        ae.checkin_formatado,
        ae.tipo_propriedade,
        ae.nome_anuncio,
        ae.preco_total,
        ae.quantidade_noites,
        ae.latitude,
        ae.longitude,
        ae.hospedes_adultos,
        ae.media_avaliacao,
        ae.preferido_hospedes,
        ae.url_anuncio,
        -- Calcular distância usando fórmula de Haversine
        (
            6371 * acos(
                cos(radians(p_latitude)) *
                cos(radians(ae.latitude)) *
                cos(radians(ae.longitude) - radians(p_longitude)) +
                sin(radians(p_latitude)) *
                sin(radians(ae.latitude))
            )
        )::DOUBLE PRECISION AS distancia_km
    FROM "airbnb_extrações" ae
    WHERE
        -- Filtro de distância (bounding box rápido primeiro)
        ae.latitude BETWEEN (p_latitude - (p_raio_km / 111.0)) AND (p_latitude + (p_raio_km / 111.0))
        AND ae.longitude BETWEEN (p_longitude - (p_raio_km / (111.0 * cos(radians(p_latitude))))) AND (p_longitude + (p_raio_km / (111.0 * cos(radians(p_latitude)))))
        -- Filtro de hóspedes (mínimo)
        AND (ae.hospedes_adultos >= p_hospedes OR ae.hospedes_adultos IS NULL)
        -- Filtro de datas (opcional)
        AND (p_start_date IS NULL OR ae.checkin_formatado >= p_start_date::DATE)
        AND (p_end_date IS NULL OR ae.checkin_formatado <= p_end_date::DATE)
        -- Filtro preciso de distância usando Haversine
        AND (
            6371 * acos(
                cos(radians(p_latitude)) *
                cos(radians(ae.latitude)) *
                cos(radians(ae.longitude) - radians(p_longitude)) +
                sin(radians(p_latitude)) *
                sin(radians(ae.latitude))
            )
        ) <= p_raio_km
    ORDER BY distancia_km ASC;
END;
$$;

-- Dar permissões para usuários anônimos e autenticados
GRANT EXECUTE ON FUNCTION buscar_anuncios_geo_v2 TO anon, authenticated;

-- Comentário explicativo
COMMENT ON FUNCTION buscar_anuncios_geo_v2 IS 'Busca anúncios do Airbnb dentro de um raio específico usando coordenadas geográficas. Usa fórmula de Haversine para cálculo preciso de distância.';
