-- Enforce the task ranges the app already validates, at the database level.
-- NOT VALID: checked on every new insert and update, but existing rows are
-- not scanned, so this cannot fail on legacy data. Run
--   ALTER TABLE "tasks" VALIDATE CONSTRAINT "tasks_progress_range";
--   ALTER TABLE "tasks" VALIDATE CONSTRAINT "tasks_nesting_level_range";
-- later to check old rows too.

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_progress_range" CHECK ("progress" BETWEEN 0 AND 100) NOT VALID;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_nesting_level_range" CHECK ("nestingLevel" BETWEEN 0 AND 3) NOT VALID;
