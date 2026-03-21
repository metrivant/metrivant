-- Migration: 067_movement_validation.sql
-- Add validation columns to strategic_movements for hallucination detection.

ALTER TABLE strategic_movements
  ADD COLUMN IF NOT EXISTS validation_status TEXT;
ALTER TABLE strategic_movements
  ADD COLUMN IF NOT EXISTS validation_reason TEXT;
