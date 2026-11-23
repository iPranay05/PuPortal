from fastapi import HTTPException

INSTITUTE = 'Institute'
SCHOOL = 'School'
DEPARTMENT = 'Department'
OWN = 'Own Records'
ADMIN = 'Super Admin'
PRINCIPAL = 'Principal / Director'
COORDINATOR = 'IQAC Coordinator'
MEMBER = 'IQAC Member'
REVIEWER = 'Reviewer'
PERMISSIONS = (
    'can_view', 'can_add', 'can_edit_own', 'can_edit_any', 'can_delete',
    'can_submit', 'can_verify', 'can_export', 'can_see_restricted',
)

GRANTS = '''SELECT a.id, a.role_id, r.name, r.level, a.school_id, a.department_id,
    a.valid_to, r.can_verify AS role_verify, r.can_export AS role_export,
    r.can_see_restricted AS role_restricted,
    COALESCE((SELECT jsonb_object_agg(p.type_id, to_jsonb(p) - 'role_id' - 'type_id')
      FROM role_permissions p WHERE p.role_id=r.id AND (
        NOT EXISTS (SELECT 1 FROM assignment_data_types d WHERE d.assignment_id=a.id)
        OR EXISTS (SELECT 1 FROM assignment_data_types d WHERE d.assignment_id=a.id AND d.type_id=p.type_id)
      )), '{}'::jsonb) AS permissions
    FROM user_role_assignments a JOIN roles r ON a.role_id=r.id
    WHERE a.user_id=$1 AND r.active AND CURRENT_DATE >= a.valid_from
      AND (a.valid_to IS NULL OR CURRENT_DATE <= a.valid_to)
    ORDER BY a.id'''


def covers(grant, record, user_id, is_assigned=False):
    if grant['name'] == MEMBER:
        return is_assigned
    if grant['name'] == REVIEWER:
        return grant['valid_to'] is not None and record['status'] == 'Verified'
    if grant['level'] == SCHOOL:
        return grant['school_id'] is not None and grant['school_id'] == record['school_id']
    if grant['level'] == DEPARTMENT:
        return (grant['school_id'] is not None and grant['department_id'] is not None
                and grant['school_id'] == record['school_id'] and grant['department_id'] == record['department_id'])
    if grant['level'] == OWN:
        return (record['added_by'] == user_id
                and (grant['school_id'] is None or grant['school_id'] == record['school_id'])
                and (grant['department_id'] is None or grant['department_id'] == record['department_id']))
    return grant['level'] == INSTITUTE


def grants_for(grants, record, user_id, action, is_assigned=False):
    for grant in grants:
        if not covers(grant, record, user_id, is_assigned):
            continue
        flags = grant['permissions'].get(str(record['type_id']), {})
        if grant['name'] == REVIEWER and action not in ('can_view', 'can_export', 'can_see_restricted'):
            continue
        if grant['name'] == MEMBER and action not in ('can_view', 'can_verify', 'can_see_restricted'):
            continue
        if action != 'can_add' and not flags.get('can_view'):
            continue
        if action == 'edit':
            allowed = flags.get('can_edit_any') or (flags.get('can_edit_own') and record['added_by'] == user_id)
        elif action in ('can_verify', 'can_export', 'can_see_restricted'):
            role_flag = {'can_verify': 'role_verify', 'can_export': 'role_export', 'can_see_restricted': 'role_restricted'}[action]
            allowed = flags.get(action) and grant[role_flag]
        else:
            allowed = flags.get(action)
        if allowed:
            yield grant


def require_named(grants, *roles):
    for grant in grants:
        if grant['name'] in roles and grant['level'] == INSTITUTE:
            return grant
    raise HTTPException(403, 'This action is not permitted for your staff role.')


def sql_scope(parameter, actor_parameter, action='can_view'):
    permission = {'can_view': 'can_view', 'can_export': 'can_view AND p.can_export'}[action]
    export_rule = "AND g.role_export AND g.name <> 'IQAC Member'" if action == 'can_export' else ''
    return f'''EXISTS (SELECT 1 FROM jsonb_to_recordset(${parameter}::jsonb) AS g(
            name text, level text, school_id bigint, department_id bigint, valid_to date,
            role_export boolean, permissions jsonb)
        CROSS JOIN LATERAL jsonb_to_record(g.permissions -> r.type_id::text)
            AS p(can_view boolean, can_export boolean)
        WHERE p.{permission} {export_rule} AND CASE
          WHEN g.name='Reviewer' THEN g.valid_to IS NOT NULL AND r.status='Verified'
          WHEN g.name='IQAC Member' THEN EXISTS (SELECT 1 FROM record_reviewers rr WHERE rr.record_id=r.id AND rr.user_id=${actor_parameter})
          WHEN g.level='Institute' THEN true
          WHEN g.level='School' THEN g.school_id=r.school_id
          WHEN g.level='Department' THEN g.school_id=r.school_id AND g.department_id=r.department_id
          WHEN g.level='Own Records' THEN r.added_by=${actor_parameter}
            AND (g.school_id IS NULL OR g.school_id=r.school_id)
            AND (g.department_id IS NULL OR g.department_id=r.department_id)
          ELSE false END)'''
