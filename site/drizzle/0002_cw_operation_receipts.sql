-- CW-020: optional creative-workflow operation receipts.
-- Additive metadata only: plot_projects.graph_json stays the single story source.
-- Production application and CW_WORKFLOW_ENABLED=true require separate owner
-- authorization and native Sites D1 migration safety checks.
CREATE TABLE IF NOT EXISTS cw_operation_receipts (
  project_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, operation_id),
  FOREIGN KEY (project_id) REFERENCES plot_projects(id)
);
