-- Add locale column to team_members table
ALTER TABLE `team_members` ADD COLUMN `locale` text DEFAULT 'nl';
--> statement-breakpoint
-- Add locale column to customers table
ALTER TABLE `customers` ADD COLUMN `locale` text DEFAULT 'nl';
