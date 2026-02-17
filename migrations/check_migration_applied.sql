-- Quick test: Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'competitor_baskets' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- If location and guest_capacity appear, migration was applied ✅
-- If they don't appear, you need to run migration 003 ❌
