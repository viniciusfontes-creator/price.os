-- Migration: Multi-Property Basket Support
-- Description: Enables baskets to contain multiple internal properties AND external competitors
-- Author: Antigravity
-- Date: 2026-02-05

-- ========================================
-- STEP 1: Modify basket_items table
-- ========================================

-- Add item_type column to distinguish between internal properties and external competitors
ALTER TABLE basket_items 
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'external' 
CHECK (item_type IN ('internal', 'external'));

-- Add internal_property_id column for internal properties
ALTER TABLE basket_items
ADD COLUMN IF NOT EXISTS internal_property_id TEXT;

-- Make airbnb_listing_id nullable (since internal items won't have it)
ALTER TABLE basket_items
ALTER COLUMN airbnb_listing_id DROP NOT NULL;

-- Add check constraint: must have either airbnb_listing_id (external) OR internal_property_id (internal)
ALTER TABLE basket_items
DROP CONSTRAINT IF EXISTS item_reference_check;

ALTER TABLE basket_items
ADD CONSTRAINT item_reference_check 
CHECK (
    (item_type = 'external' AND airbnb_listing_id IS NOT NULL AND internal_property_id IS NULL) OR
    (item_type = 'internal' AND internal_property_id IS NOT NULL AND airbnb_listing_id IS NULL)
);

-- ========================================
-- STEP 2: Modify competitor_baskets table
-- ========================================

-- Make internal_property_id nullable (baskets are now typology groups, not tied to single property)
ALTER TABLE competitor_baskets
ALTER COLUMN internal_property_id DROP NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE competitor_baskets IS 'Baskets are typology-based groups containing multiple internal properties and external competitors';
COMMENT ON COLUMN basket_items.item_type IS 'Type of item: internal (own property) or external (competitor)';
COMMENT ON COLUMN basket_items.internal_property_id IS 'Reference to propriedades table for internal items';

-- ========================================
-- STEP 3: Data Migration (Optional)
-- ========================================

-- Migrate existing baskets: move internal_property_id from baskets to basket_items
-- This preserves existing data structure while enabling new multi-property model
INSERT INTO basket_items (basket_id, item_type, internal_property_id, created_at)
SELECT 
    id,
    'internal'::TEXT,
    internal_property_id,
    created_at
FROM competitor_baskets
WHERE internal_property_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ========================================
-- STEP 4: Create indexes for performance
-- ========================================

-- Index on item_type for fast filtering
CREATE INDEX IF NOT EXISTS idx_basket_items_type 
ON basket_items(item_type);

-- Index on internal_property_id for joins
CREATE INDEX IF NOT EXISTS idx_basket_items_internal_property 
ON basket_items(internal_property_id)
WHERE internal_property_id IS NOT NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_basket_items_basket_type 
ON basket_items(basket_id, item_type);

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Count baskets by item composition
-- SELECT 
--     b.id,
--     b.name,
--     COUNT(CASE WHEN bi.item_type = 'internal' THEN 1 END) as internal_count,
--     COUNT(CASE WHEN bi.item_type = 'external' THEN 1 END) as external_count
-- FROM competitor_baskets b
-- LEFT JOIN basket_items bi ON b.id = bi.basket_id
-- GROUP BY b.id, b.name;

-- Show basket composition
-- SELECT 
--     b.name as basket_name,
--     bi.item_type,
--     CASE 
--         WHEN bi.item_type = 'internal' THEN p.nome
--         ELSE ae.nome_anuncio
--     END as item_name
-- FROM competitor_baskets b
-- JOIN basket_items bi ON b.id = bi.basket_id
-- LEFT JOIN propriedades p ON bi.internal_property_id = p.idpropriedade
-- LEFT JOIN "airbnb_extrações" ae ON bi.airbnb_listing_id = ae.id
-- ORDER BY b.name, bi.item_type;

-- ========================================
-- ROLLBACK (if needed)
-- ========================================

-- DROP INDEX IF EXISTS idx_basket_items_basket_type;
-- DROP INDEX IF EXISTS idx_basket_items_internal_property;
-- DROP INDEX IF EXISTS idx_basket_items_type;
-- ALTER TABLE basket_items DROP CONSTRAINT IF EXISTS item_reference_check;
-- ALTER TABLE basket_items DROP COLUMN IF EXISTS internal_property_id;
-- ALTER TABLE basket_items DROP COLUMN IF EXISTS item_type;
-- ALTER TABLE basket_items ALTER COLUMN airbnb_listing_id SET NOT NULL;
-- ALTER TABLE competitor_baskets ALTER COLUMN internal_property_id SET NOT NULL;
