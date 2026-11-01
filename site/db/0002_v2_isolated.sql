-- Plot Architect P2 additive-only schema spike; NO alterations/backfill/deletion of legacy tables.
-- Project data belongs to a NEW projects_v2 namespace; old plots untouched.
CREATE TABLE IF NOT EXISTS projects_v2 (
 project_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0), schema_version TEXT NOT NULL CHECK(schema_version='plot-architect/v2'),
 storage_namespace TEXT NOT NULL DEFAULT 'v2', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_v2_owner ON projects_v2(owner_id,updated_at DESC,project_id);
CREATE TABLE IF NOT EXISTS plot_nodes_v2 (
 project_id TEXT NOT NULL, node_id TEXT NOT NULL, parent_id TEXT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 kind TEXT NOT NULL CHECK(kind IN ('event','process','action','decision','state','condition','container')),
 status TEXT NOT NULL CHECK(status IN ('draft','proposed','approved','archived')),
 x REAL NOT NULL, y REAL NOT NULL, width REAL NOT NULL CHECK(width>=180), height REAL NOT NULL CHECK(height>=95),
 PRIMARY KEY(project_id,node_id),FOREIGN KEY(project_id) REFERENCES projects_v2(project_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_v2_nodes_xy ON plot_nodes_v2(project_id,parent_id,x,node_id);
CREATE INDEX IF NOT EXISTS idx_v2_nodes_y ON plot_nodes_v2(project_id,parent_id,y,node_id);
CREATE INDEX IF NOT EXISTS idx_v2_nodes_status ON plot_nodes_v2(project_id,status,node_id);
CREATE TABLE IF NOT EXISTS semantic_fields_v2 (
 project_id TEXT NOT NULL, field_id TEXT NOT NULL,parent_id TEXT,title TEXT NOT NULL,assignment_mode TEXT NOT NULL CHECK(assignment_mode IN ('auto','manual','mixed')),
 x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,
 PRIMARY KEY(project_id,field_id), FOREIGN KEY(project_id) REFERENCES projects_v2(project_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_v2_fields_parent ON semantic_fields_v2(project_id,parent_id,x,field_id);
CREATE TABLE IF NOT EXISTS node_semantic_pins_v2 (
 project_id TEXT NOT NULL,node_id TEXT NOT NULL,field_id TEXT NOT NULL,
 PRIMARY KEY(project_id,node_id,field_id),FOREIGN KEY(project_id,node_id) REFERENCES plot_nodes_v2(project_id,node_id) ON DELETE RESTRICT,
 FOREIGN KEY(project_id,field_id) REFERENCES semantic_fields_v2(project_id,field_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS editorial_tasks_v2 (
 project_id TEXT NOT NULL,task_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('gap_note','rewrite_field')),
 status TEXT NOT NULL CHECK(status IN ('open','variants_ready','regeneration_requested','committed','deleted')),
 title TEXT NOT NULL DEFAULT '',offer_variants INTEGER NOT NULL DEFAULT 1 CHECK(offer_variants IN (0,1)),
 task_revision INTEGER NOT NULL DEFAULT 0 CHECK(task_revision>=0),active_set_id TEXT,created_seq INTEGER NOT NULL,
 PRIMARY KEY(project_id,task_id), FOREIGN KEY(project_id) REFERENCES projects_v2(project_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_v2_tasks_queue ON editorial_tasks_v2(project_id,status,created_seq,task_id);
CREATE TABLE IF NOT EXISTS editorial_notes_v2 (
 project_id TEXT NOT NULL,note_id TEXT NOT NULL,task_id TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('task_anchor','instruction')),
 body TEXT NOT NULL,parent_id TEXT,x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,
 PRIMARY KEY(project_id,note_id), FOREIGN KEY(project_id,task_id) REFERENCES editorial_tasks_v2(project_id,task_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_one_gap_anchor ON editorial_notes_v2(project_id,task_id) WHERE role='task_anchor';
CREATE TABLE IF NOT EXISTS editorial_fields_v2 (
 project_id TEXT NOT NULL,editorial_field_id TEXT NOT NULL,task_id TEXT NOT NULL,title TEXT NOT NULL,parent_id TEXT,
 x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,color_token TEXT,
 PRIMARY KEY(project_id,editorial_field_id),UNIQUE(project_id,task_id),
 FOREIGN KEY(project_id,task_id) REFERENCES editorial_tasks_v2(project_id,task_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS editorial_memberships_v2 (
 project_id TEXT NOT NULL,task_id TEXT NOT NULL,node_id TEXT NOT NULL,source TEXT NOT NULL DEFAULT 'explicit',
 PRIMARY KEY(project_id,task_id,node_id),
 FOREIGN KEY(project_id,task_id) REFERENCES editorial_tasks_v2(project_id,task_id) ON DELETE RESTRICT,
 FOREIGN KEY(project_id,node_id) REFERENCES plot_nodes_v2(project_id,node_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_v2_membership_overlap ON editorial_memberships_v2(project_id,node_id,task_id);
CREATE TABLE IF NOT EXISTS edges_v2 (
 project_id TEXT NOT NULL,edge_id TEXT NOT NULL,relation_scope TEXT NOT NULL CHECK(relation_scope IN ('plot','editorial')),
 source_kind TEXT NOT NULL CHECK(source_kind IN ('plot_node','editorial_note','semantic_field')),
 source_id TEXT NOT NULL,target_kind TEXT NOT NULL CHECK(target_kind IN ('plot_node','editorial_note','semantic_field')),
 target_id TEXT NOT NULL,edge_type TEXT,
 CHECK((relation_scope='plot' AND source_kind='plot_node' AND target_kind='plot_node' AND edge_type IN ('precedes','causes','enables','hinders'))
 OR (relation_scope='editorial' AND (source_kind='editorial_note' OR target_kind='editorial_note') AND edge_type IS NULL)),
 PRIMARY KEY(project_id,edge_id), FOREIGN KEY(project_id) REFERENCES projects_v2(project_id) ON DELETE RESTRICT
);
-- Polymorphic edge endpoint FK cannot use ordinary FOREIGN KEY: validate all endpoint IDs in triggers.
CREATE TRIGGER IF NOT EXISTS trg_v2_edges_ref_insert BEFORE INSERT ON edges_v2 BEGIN
 SELECT CASE WHEN
 (NEW.source_kind='plot_node' AND NOT EXISTS(SELECT 1 FROM plot_nodes_v2 WHERE project_id=NEW.project_id AND node_id=NEW.source_id)) OR
 (NEW.source_kind='editorial_note' AND NOT EXISTS(SELECT 1 FROM editorial_notes_v2 WHERE project_id=NEW.project_id AND note_id=NEW.source_id)) OR
 (NEW.source_kind='semantic_field' AND NOT EXISTS(SELECT 1 FROM semantic_fields_v2 WHERE project_id=NEW.project_id AND field_id=NEW.source_id)) OR
 (NEW.target_kind='plot_node' AND NOT EXISTS(SELECT 1 FROM plot_nodes_v2 WHERE project_id=NEW.project_id AND node_id=NEW.target_id)) OR
 (NEW.target_kind='editorial_note' AND NOT EXISTS(SELECT 1 FROM editorial_notes_v2 WHERE project_id=NEW.project_id AND note_id=NEW.target_id)) OR
 (NEW.target_kind='semantic_field' AND NOT EXISTS(SELECT 1 FROM semantic_fields_v2 WHERE project_id=NEW.project_id AND field_id=NEW.target_id))
 THEN RAISE(ABORT,'DANGLING_ENDPOINT') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_v2_edges_ref_update BEFORE UPDATE OF source_kind,source_id,target_kind,target_id ON edges_v2 BEGIN
 SELECT CASE WHEN
 (NEW.source_kind='plot_node' AND NOT EXISTS(SELECT 1 FROM plot_nodes_v2 WHERE project_id=NEW.project_id AND node_id=NEW.source_id)) OR
 (NEW.source_kind='editorial_note' AND NOT EXISTS(SELECT 1 FROM editorial_notes_v2 WHERE project_id=NEW.project_id AND note_id=NEW.source_id)) OR
 (NEW.source_kind='semantic_field' AND NOT EXISTS(SELECT 1 FROM semantic_fields_v2 WHERE project_id=NEW.project_id AND field_id=NEW.source_id)) OR
 (NEW.target_kind='plot_node' AND NOT EXISTS(SELECT 1 FROM plot_nodes_v2 WHERE project_id=NEW.project_id AND node_id=NEW.target_id)) OR
 (NEW.target_kind='editorial_note' AND NOT EXISTS(SELECT 1 FROM editorial_notes_v2 WHERE project_id=NEW.project_id AND note_id=NEW.target_id)) OR
 (NEW.target_kind='semantic_field' AND NOT EXISTS(SELECT 1 FROM semantic_fields_v2 WHERE project_id=NEW.project_id AND field_id=NEW.target_id))
 THEN RAISE(ABORT,'DANGLING_ENDPOINT') END;
END;
CREATE INDEX IF NOT EXISTS idx_v2_edges_src ON edges_v2(project_id,relation_scope,source_kind,source_id);
CREATE INDEX IF NOT EXISTS idx_v2_edges_target ON edges_v2(project_id,relation_scope,target_kind,target_id);
CREATE TABLE IF NOT EXISTS variant_sets_v2 (
 project_id TEXT NOT NULL,set_id TEXT NOT NULL,task_id TEXT NOT NULL,generation_no INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('staged','sealed')),
 digest TEXT NOT NULL,expected_count INTEGER NOT NULL CHECK(expected_count IN (1,3)),
 PRIMARY KEY(project_id,set_id), UNIQUE(project_id,task_id,generation_no),
 FOREIGN KEY(project_id,task_id) REFERENCES editorial_tasks_v2(project_id,task_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS variants_v2 (
 project_id TEXT NOT NULL,variant_id TEXT NOT NULL,set_id TEXT NOT NULL,ordinal INTEGER NOT NULL CHECK(ordinal>0 AND ordinal<=3),status TEXT NOT NULL CHECK(status IN ('staged','sealed')),
 digest TEXT NOT NULL, PRIMARY KEY(project_id,variant_id),UNIQUE(project_id,set_id,ordinal),
 FOREIGN KEY(project_id,set_id) REFERENCES variant_sets_v2(project_id,set_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS variant_chunks_v2 (
 project_id TEXT NOT NULL,variant_id TEXT NOT NULL,chunk_no INTEGER NOT NULL CHECK(chunk_no>=0),data TEXT NOT NULL,
 byte_length INTEGER NOT NULL CHECK(byte_length>=0 AND byte_length<=500000),sha256 TEXT NOT NULL,
 PRIMARY KEY(project_id,variant_id,chunk_no), FOREIGN KEY(project_id,variant_id) REFERENCES variants_v2(project_id,variant_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS task_dependencies_v2 (
 project_id TEXT NOT NULL,task_id TEXT NOT NULL,dep_kind TEXT NOT NULL,dep_id TEXT NOT NULL,dep_digest TEXT NOT NULL,
 PRIMARY KEY(project_id,task_id,dep_kind,dep_id), FOREIGN KEY(project_id,task_id) REFERENCES editorial_tasks_v2(project_id,task_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS changes_v2 (
 project_id TEXT NOT NULL,revision INTEGER NOT NULL,operation_id TEXT NOT NULL,actor TEXT NOT NULL,summary TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(project_id,revision),FOREIGN KEY(project_id) REFERENCES projects_v2(project_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS change_items_v2 (
 project_id TEXT NOT NULL,revision INTEGER NOT NULL,seq INTEGER NOT NULL,forward_json TEXT NOT NULL,inverse_json TEXT NOT NULL,
 PRIMARY KEY(project_id,revision,seq), FOREIGN KEY(project_id,revision) REFERENCES changes_v2(project_id,revision) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS operation_receipts_v2 (
 project_id TEXT NOT NULL,operation_id TEXT NOT NULL,request_digest TEXT NOT NULL,
 expected_revision INTEGER NOT NULL,expected_task_id TEXT,expected_task_revision INTEGER,
 committed_revision INTEGER,result_json TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(project_id,operation_id), FOREIGN KEY(project_id) REFERENCES projects_v2(project_id) ON DELETE RESTRICT
);
-- A failed optimistic guard MUST throw SQL RAISE(ABORT), not return UPDATE changes=0.
-- Executing the whole mutation in one D1 db.batch() transaction is a separate P2 gate.
CREATE TRIGGER IF NOT EXISTS trg_v2_receipt_cas BEFORE INSERT ON operation_receipts_v2
BEGIN
 SELECT CASE WHEN (SELECT revision FROM projects_v2 WHERE project_id=NEW.project_id) IS NULL
  OR (SELECT revision FROM projects_v2 WHERE project_id=NEW.project_id)<>NEW.expected_revision
 THEN RAISE(ABORT,'REVISION_CONFLICT') END;
 SELECT CASE WHEN NEW.expected_task_id IS NOT NULL AND
   NOT EXISTS(SELECT 1 FROM editorial_tasks_v2 WHERE project_id=NEW.project_id AND task_id=NEW.expected_task_id
   AND task_revision=NEW.expected_task_revision AND status IN ('open','variants_ready','regeneration_requested'))
 THEN RAISE(ABORT,'TASK_REVISION_CONFLICT') END;
END;
CREATE TABLE IF NOT EXISTS checkpoints_v2 (
 project_id TEXT NOT NULL,checkpoint_id TEXT NOT NULL,revision INTEGER NOT NULL,manifest_json TEXT NOT NULL,
 PRIMARY KEY(project_id,checkpoint_id),FOREIGN KEY(project_id) REFERENCES projects_v2(project_id) ON DELETE RESTRICT
);
