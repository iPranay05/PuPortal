import unittest
from datetime import date
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from api.index import app
from backend.access import MEMBER, REVIEWER, grants_for
from backend.auth import digest_token, hash_password, verify_password
from backend.db import TYPES
from backend.fields import public_details, safe_proof, validate_details
from backend.reports import csv_cell


def grant(name='Department Coordinator', level='Department', **claims):
    return {'name': name, 'level': level, 'school_id': 1, 'department_id': 2,
            'valid_to': date.today(), 'permissions': {'3': {'can_view': True, 'can_edit_any': True,
                                                          'can_export': True, 'can_verify': True,
                                                          'can_see_restricted': True}},
            'role_verify': True, 'role_export': True, 'role_restricted': False, **claims}


class ScopeTests(unittest.TestCase):
    def setUp(self):
        self.record = {'type_id': 3, 'school_id': 1, 'department_id': 2, 'added_by': 9, 'status': 'Draft'}

    def allows(self, grant_, permission, record=None, assigned=False):
        return bool(list(grants_for([grant_], record or self.record, 9, permission, assigned)))

    def test_department_scope_requires_school_and_department(self):
        self.assertTrue(self.allows(grant(), 'edit'))
        self.assertFalse(self.allows(grant(department_id=5), 'edit'))
        self.assertFalse(self.allows(grant(school_id=2), 'edit'))
        self.assertFalse(self.allows(grant(permissions={}), 'can_view'))

    def test_owned_records_require_creator_and_scope(self):
        role = grant('Faculty','Own Records')
        self.assertTrue(self.allows(role,'can_view'))
        self.assertFalse(self.allows(role,'can_view',self.record | {'added_by': 20}))
        self.assertFalse(self.allows(role,'can_view',self.record | {'department_id': 20}))

    def test_iqac_member_must_be_assigned_and_cannot_export(self):
        role = grant(MEMBER,'Institute')
        self.assertFalse(self.allows(role,'can_verify'))
        self.assertTrue(self.allows(role,'can_verify',assigned=True))
        self.assertFalse(self.allows(role,'can_export',assigned=True))

    def test_temporary_reviewer_sees_only_verified_records(self):
        role = grant(REVIEWER,'Institute')
        self.assertFalse(self.allows(role,'can_view'))
        verified = self.record | {'status':'Verified'}
        self.assertTrue(self.allows(role,'can_export',verified))
        self.assertFalse(self.allows(role,'edit',verified))
        self.assertFalse(self.allows(grant(REVIEWER,'Institute',valid_to=None),'can_view',verified))

    def test_restricted_requires_role_and_type_flags(self):
        self.assertFalse(self.allows(grant(),'can_see_restricted'))
        self.assertTrue(self.allows(grant(role_restricted=True),'can_see_restricted'))
        self.assertFalse(self.allows(grant(role_restricted=True,permissions={'3':{'can_view':True}}),'can_see_restricted'))


class ValidationTests(unittest.TestCase):
    def assert_rejected(self, status, operation, *args, **kwargs):
        with self.assertRaises(HTTPException) as result:
            operation(*args, **kwargs)
        self.assertEqual(result.exception.status_code,status)

    def test_catalog_has_25_types_and_all_fields_map_to_columns(self):
        self.assertEqual(sorted(TYPES),list(range(1,26)))
        self.assertTrue(all(len(t['columns'])==len(t['fields']) for t in TYPES.values()))
        self.assertEqual(len({t['table'] for t in TYPES.values()}),25)

    def test_pdf_specific_validation(self):
        self.assert_rejected(422,validate_details,4,{},creating=True)
        self.assert_rejected(422,validate_details,14,{'grant_year':2026})
        self.assert_rejected(422,validate_details,21,{'description':'word '*101})
        self.assert_rejected(422,validate_details,17,{'average_rating':'100'})
        self.assertEqual(str(validate_details(17,{'average_rating':'4.25'})['average_rating']),'4.25')
        self.assertEqual(validate_details(17,{'feedback_collected':False}),{'feedback_collected':False})
        self.assertEqual(validate_details(19,{'available':'NA'}),{'available':'NA'})

    def test_restricted_values_are_denied_or_redacted(self):
        secret = {'company_contact_person':'Private information'}
        self.assert_rejected(403,validate_details,3,secret)
        self.assertNotIn('company_contact_person',public_details(3,secret))
        self.assertEqual(public_details(3,secret,True)['company_contact_person'],'Private information')

    def test_proof_and_csv_validation(self):
        self.assertEqual(safe_proof('https://example.com/evidence.pdf'),'https://example.com/evidence.pdf')
        self.assert_rejected(422,safe_proof,'javascript:alert(1)')
        self.assert_rejected(422,safe_proof,'https://user:secret@example.com')
        self.assertEqual(csv_cell(' =1+1'),"' =1+1")
        self.assertEqual(csv_cell('Faculty workshop'),'Faculty workshop')

    def test_password_storage_is_salted_and_tokens_are_hashed(self):
        password = 'example-password-only-for-test'
        stored = hash_password(password)
        self.assertNotIn(password,stored)
        self.assertNotEqual(stored,hash_password(password))
        self.assertTrue(verify_password(password,stored))
        self.assertFalse(verify_password('wrong',stored))
        self.assertFalse(verify_password(password,None))
        self.assertEqual(len(digest_token('example')),64)


class WithoutDatabaseTests(unittest.TestCase):
    @patch('backend.db.os.getenv',return_value=None)
    def test_reference_is_available_and_mutations_fail_closed(self,mock_env):
        with TestClient(app) as client:
            self.assertEqual(client.get('/api/status').json(),{'status':'not_configured'})
            self.assertEqual(len(client.get('/api/catalog').json()),25)
            self.assertIn('CREATE TABLE staff_sessions',client.get('/api/schema').text)
            self.assertEqual(client.get('/api/docs').status_code,200)
            self.assertEqual(client.get('/api/records').status_code,503)
            result = client.post('/api/auth/login',json={'email':'staff@example.com','password':'not-a-real-password'})
            self.assertEqual(result.status_code,503)
            self.assertEqual(result.headers['cache-control'],'no-store')

    def test_reports_auth_and_workflow_are_in_the_openapi_contract(self):
        schema = app.openapi()
        self.assertIn('HTTPBearer',schema['components']['securitySchemes'])
        for path in ('/api/auth/login','/api/records/{record_id}/verify','/api/admin/assignments','/api/audit','/api/reports/export'):
            self.assertIn(path,schema['paths'])


if __name__ == '__main__':
    unittest.main()
