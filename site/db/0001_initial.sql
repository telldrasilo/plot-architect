-- PA-SITE-01, snapshot + immutable revision history. D1 SQLite.
CREATE TABLE IF NOT EXISTS plot_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  graph_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision>=0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS plot_revisions (
  project_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  graph_json TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY(project_id,revision),
  FOREIGN KEY(project_id) REFERENCES plot_projects(id)
);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON plot_projects(deleted_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_revisions_project ON plot_revisions(project_id,revision DESC);
