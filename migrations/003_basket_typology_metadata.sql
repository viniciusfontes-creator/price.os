-- Migration: Basket Typology Metadata
-- Description: Adds location and guest capacity fields to baskets for typology-based filtering
-- Author: Antigravity
-- Date: 2026-02-05

-- ========================================
-- STEP 1: Add typology metadata columns
-- ========================================

-- Add location column (e.g., "João Pessoa - Beira Mar", "Recife - Centro")
ALTER TABLE competitor_baskets
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add guest capacity column (e.g., 2, 4, 6)
ALTER TABLE competitor_baskets
ADD COLUMN IF NOT EXISTS guest_capacity INTEGER;

-- ========================================
-- STEP 2: Add documentation
-- ========================================

COMMENT ON COLUMN competitor_baskets.location IS 'Geographic location/neighborhood for filtering (e.g., "João Pessoa - Beira Mar")';
COMMENT ON COLUMN competitor_baskets.guest_capacity IS 'Maximum number of guests supported by this typology';

-- ========================================
-- STEP 3: Create indexes for filtering
-- ========================================

-- Index on location for geographic filtering
CREATE INDEX IF NOT EXISTS idx_baskets_location 
ON competitor_baskets(location) WHERE location IS NOT NULL;

-- Index on guest capacity for capacity-based filtering
CREATE INDEX IF NOT EXISTS idx_baskets_guest_capacity 
ON competitor_baskets(guest_capacity) WHERE guest_capacity IS NOT NULL;

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_baskets_location_capacity 
ON competitor_baskets(location, guest_capacity) 
WHERE location IS NOT NULL AND guest_capacity IS NOT NULL;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Count baskets by typology
-- SELECT 
--     location,
--     guest_capacity,
--     COUNT(*) as basket_count
-- FROM competitor_baskets
-- WHERE location IS NOT NULL
-- GROUP BY location, guest_capacity
-- ORDER BY location, guest_capacity;

-- ========================================
-- ROLLBACK (if needed)
-- ========================================

-- DROP INDEX IF EXISTS idx_baskets_location_capacity;
-- DROP INDEX IF EXISTS idx_baskets_guest_capacity;
-- DROP INDEX IF EXISTS idx_baskets_location;
-- ALTER TABLE competitor_baskets DROP COLUMN IF EXISTS guest_capacity;
-- ALTER TABLE competitor_baskets DROP COLUMN IF EXISTS location;
