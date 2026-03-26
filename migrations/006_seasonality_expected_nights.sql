-- Migration: Add expected_nights to seasonality_periods
-- This allows each seasonality to define its own expected nights per period.
-- For example, January can have 25 nights expected for beach destinations
-- but only 12 nights for mountain destinations.

ALTER TABLE seasonality_periods 
  ADD COLUMN IF NOT EXISTS expected_nights INTEGER;

-- Note: expected_nights is nullable. When NULL, falls back to the global
-- pricing_periods.expected_nights value.
