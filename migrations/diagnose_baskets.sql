-- 1. Verificar últimas cestas criadas
SELECT 
    id,
    name,
    location,
    guest_capacity,
    created_at,
    internal_property_id
FROM competitor_baskets 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. Verificar basket_items das últimas cestas
SELECT 
    bi.id,
    bi.basket_id,
    bi.item_type,
    bi.internal_property_id,
    bi.airbnb_listing_id,
    cb.name as basket_name
FROM basket_items bi
JOIN competitor_baskets cb ON bi.basket_id = cb.id
WHERE cb.created_at > NOW() - INTERVAL '1 hour'
ORDER BY bi.basket_id DESC;

-- 3. Contar cestas por propriedade (para ver se há alguma)
SELECT 
    bi.internal_property_id,
    COUNT(DISTINCT bi.basket_id) as num_cestas
FROM basket_items bi
WHERE bi.item_type = 'internal'
GROUP BY bi.internal_property_id
ORDER BY num_cestas DESC;
