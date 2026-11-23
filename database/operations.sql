CREATE TABLE staff_credentials (
  user_id bigint PRIMARY KEY REFERENCES users ON DELETE CASCADE,
  password_hash text NOT NULL
);
CREATE TABLE staff_sessions (
  token_hash text PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX staff_sessions_user ON staff_sessions(user_id);
CREATE TABLE sign_in_limits (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE record_evidence (
  record_id uuid PRIMARY KEY REFERENCES records ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text NOT NULL,
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 3145728)
);
CREATE INDEX role_assignments_staff ON user_role_assignments (user_id, valid_from, valid_to);
CREATE INDEX records_staff_queue ON records (edited_on DESC, id DESC);
CREATE INDEX audit_staff_history ON audit_log (at DESC, id DESC);
ALTER TABLE users ADD CHECK (department_id IS NULL OR school_id IS NOT NULL);
ALTER TABLE users ADD CHECK (leaving_date IS NULL OR joining_date IS NULL OR leaving_date >= joining_date);
ALTER TABLE user_role_assignments ADD CHECK (department_id IS NULL OR school_id IS NOT NULL);

INSERT INTO role_permissions (role_id, type_id, can_view, can_add, can_edit_own, can_edit_any, can_delete, can_submit, can_verify, can_export)
SELECT r.id, t.id, r.name <> 'Super Admin',
  r.name IN ('Department Coordinator', 'Faculty', 'Non-teaching Staff'),
  r.name IN ('Department Coordinator', 'Faculty', 'Non-teaching Staff'),
  r.name = 'Department Coordinator',
  r.name IN ('Department Coordinator', 'Faculty', 'Non-teaching Staff'),
  r.name IN ('Department Coordinator', 'Faculty', 'Non-teaching Staff'),
  r.can_verify, r.can_export
FROM roles r CROSS JOIN record_types t
ON CONFLICT (role_id, type_id) DO NOTHING;

CREATE OR REPLACE FUNCTION validate_record_change() RETURNS trigger LANGUAGE plpgsql SET search_path=accreditation,pg_catalog AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status <> 'Draft' THEN RAISE EXCEPTION 'Only drafts may be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' AND NEW.status<>'Draft' THEN RAISE EXCEPTION 'New records must be drafts'; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.status='Verified' OR (OLD.status='Draft' AND NEW.status='Verified') THEN
      RAISE EXCEPTION 'Invalid workflow transition';
    END IF;
    IF OLD.status='Submitted' AND (NEW.status='Submitted' OR
      (to_jsonb(OLD) - ARRAY['status','edited_by','edited_on']) IS DISTINCT FROM
      (to_jsonb(NEW) - ARRAY['status','edited_by','edited_on'])) THEN
      RAISE EXCEPTION 'Submitted records may only change review status';
    END IF;
    NEW.edited_on:=now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER record_workflow ON records;
CREATE TRIGGER record_workflow BEFORE INSERT OR UPDATE OR DELETE ON records FOR EACH ROW EXECUTE FUNCTION validate_record_change();

CREATE OR REPLACE FUNCTION log_record_change() RETURNS trigger LANGUAGE plpgsql SET search_path=accreditation,pg_catalog AS $$
DECLARE r records; op text;
BEGIN
  IF TG_OP='DELETE' THEN r:=OLD; op:='Deleted';
  ELSE
    r:=NEW;
    op:=CASE WHEN TG_OP='INSERT' THEN 'Created'
      WHEN OLD.status='Submitted' AND NEW.status='Draft' THEN 'Rejected'
      WHEN OLD.status IS DISTINCT FROM NEW.status THEN NEW.status::text ELSE 'Edited' END;
  END IF;
  INSERT INTO audit_log(user_id,role_id,action,type_id,record_reference,old_value,new_value,status_before,status_after,reason,school_id,department_id,academic_year_id,ip_address,device_or_browser,session_id)
  VALUES(coalesce(nullif(current_setting('app.staff_id',true),'')::bigint,r.edited_by),
    nullif(current_setting('app.role_id',true),'')::bigint,op,r.type_id,r.id,to_jsonb(OLD),to_jsonb(NEW),OLD.status,NEW.status,
    nullif(current_setting('app.reason',true),''),r.school_id,r.department_id,r.academic_year_id,
    nullif(current_setting('app.client_ip',true),'')::inet,nullif(current_setting('app.device',true),''),nullif(current_setting('app.session_id',true),''));
  RETURN NULL;
END $$;

REVOKE ALL ON staff_credentials, staff_sessions, sign_in_limits, record_evidence FROM PUBLIC;
