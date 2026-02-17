SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'airbnb_extrações' 
ORDER BY ordinal_position;
