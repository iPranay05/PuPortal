BEGIN;
CREATE SCHEMA accreditation;
SET LOCAL search_path = accreditation, public;
CREATE TYPE record_status AS ENUM ('Draft','Submitted','Verified');
CREATE TYPE scope_level AS ENUM ('Institute','School','Department','Own Records');
CREATE TABLE schools (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL, code text NOT NULL UNIQUE, dean_id bigint, established_year smallint, active boolean NOT NULL DEFAULT true);
CREATE TABLE departments (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, school_id bigint NOT NULL REFERENCES schools, name text NOT NULL, code text NOT NULL, head_id bigint, established_year smallint, active boolean NOT NULL DEFAULT true, UNIQUE(school_id,code), UNIQUE(id,school_id));
CREATE TABLE programmes (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, department_id bigint NOT NULL REFERENCES departments, name text NOT NULL, code text UNIQUE NOT NULL, level text CHECK(level IN ('UG','PG','PhD','Diploma')), duration_years numeric(4,1) CHECK(duration_years>0), status text CHECK(status IN ('Active','Discontinued','Proposed')), UNIQUE(id,department_id));
CREATE TABLE academic_years (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, label text UNIQUE NOT NULL, start_date date NOT NULL, end_date date NOT NULL CHECK(end_date>start_date), is_current boolean NOT NULL DEFAULT false, financial_year_label text NOT NULL);
CREATE UNIQUE INDEX one_current_year ON academic_years(is_current) WHERE is_current;
CREATE TABLE users (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, employee_id text UNIQUE NOT NULL, title text, first_name text NOT NULL, middle_name text, last_name text NOT NULL, staff_type text NOT NULL CHECK(staff_type IN ('Teaching','Non-teaching')), designation text, school_id bigint REFERENCES schools, department_id bigint, official_email text NOT NULL, phone text, faculty_profile_id uuid, account_status text NOT NULL DEFAULT 'Inactive' CHECK(account_status IN ('Active','Inactive','Locked')), joining_date date, leaving_date date, last_login timestamptz, password_reset_required boolean DEFAULT true, added_by bigint REFERENCES users, added_on timestamptz NOT NULL DEFAULT now(), edited_by bigint REFERENCES users, edited_on timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(department_id,school_id) REFERENCES departments(id,school_id));
CREATE UNIQUE INDEX user_email_ci ON users(lower(official_email));
ALTER TABLE schools ADD FOREIGN KEY(dean_id) REFERENCES users;
ALTER TABLE departments ADD FOREIGN KEY(head_id) REFERENCES users;
CREATE TABLE roles (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text UNIQUE NOT NULL, level scope_level NOT NULL, description text, can_verify boolean NOT NULL DEFAULT false, can_export boolean NOT NULL DEFAULT false, can_see_restricted boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true);
INSERT INTO roles(name,level,description,can_verify,can_export) VALUES ('Super Admin','Institute','Manages users, roles and master lists',false,false),('Principal / Director','Institute','Final approval and reporting',true,true),('IQAC Coordinator','Institute','Coordinates accreditation and verifies records',true,true),('IQAC Member','Institute','Verifies individually assigned records',true,false),('Dean','School','Verifies school records',true,false),('HOD','Department','Verifies department records',true,false),('Department Coordinator','Department','Maintains department records',false,false),('Faculty','Own Records','Maintains own records',false,false),('Non-teaching Staff','Own Records','Maintains section records',false,false),('Reviewer','Institute','Time-limited audit of verified records',false,true);
CREATE TABLE record_types (id smallint PRIMARY KEY CHECK(id BETWEEN 1 AND 25), name text UNIQUE NOT NULL);
CREATE TABLE user_role_assignments (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id bigint NOT NULL REFERENCES users, role_id bigint NOT NULL REFERENCES roles, school_id bigint REFERENCES schools, department_id bigint, valid_from date NOT NULL, valid_to date CHECK(valid_to>=valid_from), assigned_by bigint NOT NULL REFERENCES users, assigned_on timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(department_id,school_id) REFERENCES departments(id,school_id));
CREATE TABLE assignment_data_types (assignment_id bigint REFERENCES user_role_assignments, type_id smallint REFERENCES record_types, PRIMARY KEY(assignment_id,type_id));
CREATE TABLE role_permissions (role_id bigint REFERENCES roles, type_id smallint REFERENCES record_types, can_view boolean NOT NULL DEFAULT false, can_add boolean NOT NULL DEFAULT false, can_edit_own boolean NOT NULL DEFAULT false, can_edit_any boolean NOT NULL DEFAULT false, can_delete boolean NOT NULL DEFAULT false, can_submit boolean NOT NULL DEFAULT false, can_verify boolean NOT NULL DEFAULT false, can_export boolean NOT NULL DEFAULT false, can_see_restricted boolean NOT NULL DEFAULT false, PRIMARY KEY(role_id,type_id));
CREATE TABLE records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type_id smallint NOT NULL REFERENCES record_types, academic_year_id bigint NOT NULL REFERENCES academic_years, school_id bigint NOT NULL REFERENCES schools, department_id bigint NOT NULL, programme_id bigint, proof text, status record_status NOT NULL DEFAULT 'Draft', remarks text, added_by bigint NOT NULL REFERENCES users, added_on timestamptz NOT NULL DEFAULT now(), edited_by bigint NOT NULL REFERENCES users, edited_on timestamptz NOT NULL DEFAULT now(), UNIQUE(id,type_id), FOREIGN KEY(department_id,school_id) REFERENCES departments(id,school_id), FOREIGN KEY(programme_id,department_id) REFERENCES programmes(id,department_id));
CREATE INDEX records_worklist ON records(academic_year_id,school_id,department_id,status);
CREATE TABLE record_reviewers(record_id uuid REFERENCES records ON DELETE CASCADE,user_id bigint REFERENCES users,PRIMARY KEY(record_id,user_id));
CREATE TABLE record_links(source_id uuid REFERENCES records ON DELETE CASCADE,target_id uuid REFERENCES records, relationship text NOT NULL,PRIMARY KEY(source_id,target_id,relationship), CHECK(source_id<>target_id));
CREATE TABLE audit_log (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), user_id bigint REFERENCES users, role_id bigint REFERENCES roles, action text NOT NULL CHECK(action IN ('Created','Edited','Deleted','Submitted','Verified','Rejected','Viewed','Exported','Login','Failed Login','Role Changed')), type_id smallint REFERENCES record_types, record_reference uuid, field_changed text, old_value jsonb, new_value jsonb, status_before record_status, status_after record_status, reason text, school_id bigint REFERENCES schools, department_id bigint REFERENCES departments, academic_year_id bigint REFERENCES academic_years, ip_address inet, device_or_browser text, session_id text, CHECK(action NOT IN ('Rejected','Deleted') OR nullif(trim(reason),'') IS NOT NULL));
CREATE FUNCTION deny_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit history is append-only'; END $$;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION deny_audit_change();
REVOKE ALL ON audit_log FROM PUBLIC;
CREATE FUNCTION log_record_change() RETURNS trigger LANGUAGE plpgsql SET search_path=accreditation,pg_catalog AS $$ DECLARE r records; op text; BEGIN IF TG_OP='DELETE' THEN r:=OLD; op:='Deleted'; ELSE r:=NEW; op:= CASE WHEN TG_OP='INSERT' THEN 'Created' WHEN OLD.status='Submitted' AND NEW.status='Draft' THEN 'Rejected' WHEN OLD.status IS DISTINCT FROM NEW.status THEN NEW.status::text ELSE 'Edited' END; END IF; INSERT INTO audit_log(user_id,role_id,action,type_id,record_reference,old_value,new_value,status_before,status_after,reason,school_id,department_id,academic_year_id) VALUES(coalesce(nullif(current_setting('app.staff_id',true),'')::bigint,r.edited_by),nullif(current_setting('app.role_id',true),'')::bigint,op,r.type_id,r.id,to_jsonb(OLD),to_jsonb(NEW),OLD.status,NEW.status,nullif(current_setting('app.reason',true),''),r.school_id,r.department_id,r.academic_year_id); RETURN NULL; END $$;
CREATE TRIGGER record_history AFTER INSERT OR UPDATE OR DELETE ON records FOR EACH ROW EXECUTE FUNCTION log_record_change();
CREATE FUNCTION validate_record_change() RETURNS trigger LANGUAGE plpgsql SET search_path=accreditation,pg_catalog AS $$ BEGIN IF TG_OP='INSERT' AND NEW.status<>'Draft' THEN RAISE EXCEPTION 'New records must be drafts'; END IF; IF TG_OP='UPDATE' THEN IF OLD.status='Verified' OR (OLD.status='Draft' AND NEW.status='Verified') THEN RAISE EXCEPTION 'Invalid workflow transition'; END IF; NEW.edited_on:=now(); END IF; RETURN NEW; END $$;
CREATE TRIGGER record_workflow BEFORE INSERT OR UPDATE ON records FOR EACH ROW EXECUTE FUNCTION validate_record_change();

INSERT INTO record_types VALUES (1,'Higher Studies');
CREATE TABLE higher_studies (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (1) STORED,
  student_name text,
  admission_no text,
  student_gender text,
  programme_completed text,
  graduation_year smallint,
  institution_joined text,
  country text,
  programme_admitted_to text,
  level text CHECK (level IN ('Masters', 'PhD', 'MBA', 'Other')),
  admission_year smallint,
  joined boolean,
  scholarship text,
  exam_qualified text,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN higher_studies.student_name IS 'Student Name';
COMMENT ON COLUMN higher_studies.admission_no IS 'Admission No';
COMMENT ON COLUMN higher_studies.student_gender IS 'Student Gender';
COMMENT ON COLUMN higher_studies.programme_completed IS 'Programme Completed';
COMMENT ON COLUMN higher_studies.graduation_year IS 'Graduation Year';
COMMENT ON COLUMN higher_studies.institution_joined IS 'Institution Joined';
COMMENT ON COLUMN higher_studies.country IS 'Country';
COMMENT ON COLUMN higher_studies.programme_admitted_to IS 'Programme Admitted To';
COMMENT ON COLUMN higher_studies.level IS 'Level (Masters / PhD / MBA / Other)';
COMMENT ON COLUMN higher_studies.admission_year IS 'Admission Year';
COMMENT ON COLUMN higher_studies.joined IS 'Joined (Yes / No)';
COMMENT ON COLUMN higher_studies.scholarship IS 'Scholarship (if any)';
COMMENT ON COLUMN higher_studies.exam_qualified IS 'Exam Qualified (GATE / GRE / etc., optional)';
INSERT INTO record_types VALUES (2,'Placements');
CREATE TABLE placements (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (2) STORED,
  student_name text,
  admission_no text,
  student_gender text,
  programme_completed text,
  graduation_year smallint,
  company_name text,
  company_location text,
  company_sector text CHECK (company_sector IN ('IT', 'Core', 'Finance', 'Other')),
  company_type text CHECK (company_type IN ('MNC', 'Startup', 'PSU', 'Other')),
  job_role text,
  package numeric(16,2) CHECK (package >= 0),
  package_type text CHECK (package_type IN ('Fixed', 'Variable', 'Includes bonus')),
  offer_type text CHECK (offer_type IN ('On-campus', 'Off-campus', 'Pool')),
  offer_date date,
  joining_date date,
  joining_status text,
  internship_converted_to_offer boolean,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN placements.student_name IS 'Student Name';
COMMENT ON COLUMN placements.admission_no IS 'Admission No';
COMMENT ON COLUMN placements.student_gender IS 'Student Gender';
COMMENT ON COLUMN placements.programme_completed IS 'Programme Completed';
COMMENT ON COLUMN placements.graduation_year IS 'Graduation Year';
COMMENT ON COLUMN placements.company_name IS 'Company Name';
COMMENT ON COLUMN placements.company_location IS 'Company Location';
COMMENT ON COLUMN placements.company_sector IS 'Company Sector (IT / Core / Finance / Other)';
COMMENT ON COLUMN placements.company_type IS 'Company Type (MNC / Startup / PSU / Other)';
COMMENT ON COLUMN placements.job_role IS 'Job Role';
COMMENT ON COLUMN placements.package IS 'Package (LPA)';
COMMENT ON COLUMN placements.package_type IS 'Package Type (Fixed / Variable / Includes bonus)';
COMMENT ON COLUMN placements.offer_type IS 'Offer Type (On-campus / Off-campus / Pool)';
COMMENT ON COLUMN placements.offer_date IS 'Offer Date';
COMMENT ON COLUMN placements.joining_date IS 'Joining Date';
COMMENT ON COLUMN placements.joining_status IS 'Joining Status';
COMMENT ON COLUMN placements.internship_converted_to_offer IS 'Internship Converted to Offer (Yes / No)';
INSERT INTO record_types VALUES (3,'Internships');
CREATE TABLE internships (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (3) STORED,
  student_name text,
  admission_no text,
  student_gender text,
  class text,
  company_name text,
  company_address text,
  company_sector text CHECK (company_sector IN ('IT', 'Core', 'Finance', 'Other')),
  company_type text CHECK (company_type IN ('MNC', 'Startup', 'PSU', 'Other')),
  company_contact_person text,
  role_project_title text,
  skills_or_domain text,
  type_of_internship text,
  credit_based boolean,
  credits numeric(16,2) CHECK (credits >= 0),
  start_date date,
  end_date date,
  duration numeric(16,2) CHECK (duration >= 0),
  mode text CHECK (mode IN ('Onsite', 'Remote', 'Hybrid')),
  stipend numeric(16,2) CHECK (stipend >= 0),
  faculty_mentor text,
  mou_linked text,
  outcome text CHECK (outcome IN ('Certificate', 'Report submitted', 'Pre-placement offer')),
  pre_placement_offer_received boolean,
  CHECK(end_date >= start_date),
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN internships.student_name IS 'Student Name';
COMMENT ON COLUMN internships.admission_no IS 'Admission No';
COMMENT ON COLUMN internships.student_gender IS 'Student Gender';
COMMENT ON COLUMN internships.class IS 'Class';
COMMENT ON COLUMN internships.company_name IS 'Company Name';
COMMENT ON COLUMN internships.company_address IS 'Company Address';
COMMENT ON COLUMN internships.company_sector IS 'Company Sector (IT / Core / Finance / Other)';
COMMENT ON COLUMN internships.company_type IS 'Company Type (MNC / Startup / PSU / Other)';
COMMENT ON COLUMN internships.company_contact_person IS 'Company Contact Person (restricted)';
COMMENT ON COLUMN internships.role_project_title IS 'Role / Project Title';
COMMENT ON COLUMN internships.skills_or_domain IS 'Skills or Domain';
COMMENT ON COLUMN internships.type_of_internship IS 'Type of Internship';
COMMENT ON COLUMN internships.credit_based IS 'Credit Based (Yes / No)';
COMMENT ON COLUMN internships.credits IS 'Credits';
COMMENT ON COLUMN internships.start_date IS 'Start Date';
COMMENT ON COLUMN internships.end_date IS 'End Date';
COMMENT ON COLUMN internships.duration IS 'Duration (Months)';
COMMENT ON COLUMN internships.mode IS 'Mode (Onsite / Remote / Hybrid)';
COMMENT ON COLUMN internships.stipend IS 'Stipend';
COMMENT ON COLUMN internships.faculty_mentor IS 'Faculty Mentor';
COMMENT ON COLUMN internships.mou_linked IS 'MoU Linked (optional)';
COMMENT ON COLUMN internships.outcome IS 'Outcome (Certificate / Report submitted / Pre-placement offer)';
COMMENT ON COLUMN internships.pre_placement_offer_received IS 'Pre-Placement Offer Received (Yes / No)';
INSERT INTO record_types VALUES (4,'Value-Added Courses Organized');
CREATE TABLE value_added_courses (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (4) STORED,
  course_name text,
  course_code text,
  course_type text CHECK (course_type IN ('Value-Added', 'Skill Enhancement', 'Certificate')),
  department_s_offering_the_course text,
  provider text,
  provider_type text CHECK (provider_type IN ('In-house', 'External', 'Spoken Tutorial', 'Industry')),
  resource_person_instructor text,
  target_year_of_students text CHECK (target_year_of_students IN ('FY', 'SY', 'TY', 'LY')),
  duration numeric(16,2) CHECK (duration >= 0) NOT NULL,
  times_offered_in_year integer CHECK (times_offered_in_year >= 0),
  start_date date,
  end_date date,
  mode text,
  fee_per_student numeric(16,2) CHECK (fee_per_student >= 0),
  assessment_method text CHECK (assessment_method IN ('Exam', 'Project', 'Attendance')),
  students_enrolled integer CHECK (students_enrolled >= 0),
  students_completed integer CHECK (students_completed >= 0),
  certificate_issued boolean,
  syllabus_link text,
  CHECK(end_date >= start_date),
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN value_added_courses.course_name IS 'Course Name';
COMMENT ON COLUMN value_added_courses.course_code IS 'Course Code';
COMMENT ON COLUMN value_added_courses.course_type IS 'Course Type (Value-Added / Skill Enhancement / Certificate)';
COMMENT ON COLUMN value_added_courses.department_s_offering_the_course IS 'Department(s) offering the course';
COMMENT ON COLUMN value_added_courses.provider IS 'Provider';
COMMENT ON COLUMN value_added_courses.provider_type IS 'Provider Type (In-house / External / Spoken Tutorial / Industry)';
COMMENT ON COLUMN value_added_courses.resource_person_instructor IS 'Resource Person / Instructor';
COMMENT ON COLUMN value_added_courses.target_year_of_students IS 'Target Year of Students (FY / SY / TY / LY)';
COMMENT ON COLUMN value_added_courses.duration IS 'Duration (Hours), required';
COMMENT ON COLUMN value_added_courses.times_offered_in_year IS 'Times Offered in Year';
COMMENT ON COLUMN value_added_courses.start_date IS 'Start Date';
COMMENT ON COLUMN value_added_courses.end_date IS 'End Date';
COMMENT ON COLUMN value_added_courses.mode IS 'Mode';
COMMENT ON COLUMN value_added_courses.fee_per_student IS 'Fee per Student';
COMMENT ON COLUMN value_added_courses.assessment_method IS 'Assessment Method (Exam / Project / Attendance)';
COMMENT ON COLUMN value_added_courses.students_enrolled IS 'Students Enrolled';
COMMENT ON COLUMN value_added_courses.students_completed IS 'Students Completed';
COMMENT ON COLUMN value_added_courses.certificate_issued IS 'Certificate Issued (Yes / No)';
COMMENT ON COLUMN value_added_courses.syllabus_link IS 'Syllabus Link';
INSERT INTO record_types VALUES (5,'Industry Certificates / Courses Attended by Students');
CREATE TABLE student_certificates (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (5) STORED,
  certificate_course_name text,
  source text CHECK (source IN ('In-house', 'Outside')),
  provider_certifying_body text,
  platform text CHECK (platform IN ('Coursera', 'NPTEL', 'Udemy', 'Oracle', 'Other')),
  domain text CHECK (domain IN ('AI', 'Cyber Security', 'Web Development', 'Cloud', 'Other')),
  level text CHECK (level IN ('Foundation', 'Intermediate', 'Advanced')),
  mode text CHECK (mode IN ('Online', 'Offline', 'Hybrid')),
  target_year_of_students text CHECK (target_year_of_students IN ('FY', 'SY', 'TY', 'LY')),
  resource_person_instructor text,
  linked_mou text,
  duration numeric(16,2) CHECK (duration >= 0),
  start_date date,
  end_date date,
  fee_per_student numeric(16,2) CHECK (fee_per_student >= 0),
  fee_paid_by text CHECK (fee_paid_by IN ('Student', 'Institution', 'Sponsored')),
  total_expenditure_by_institution numeric(16,2) CHECK (total_expenditure_by_institution >= 0),
  students_enrolled integer CHECK (students_enrolled >= 0),
  students_attended integer CHECK (students_attended >= 0),
  students_completed integer CHECK (students_completed >= 0),
  students_certified integer CHECK (students_certified >= 0),
  gender_wise_count jsonb,
  exam_required boolean,
  outcome text CHECK (outcome IN ('Certificate', 'Badge', 'Exam score', 'Attendance only')),
  certificate_link_or_sample text,
  CHECK(end_date >= start_date),
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN student_certificates.certificate_course_name IS 'Certificate / Course Name';
COMMENT ON COLUMN student_certificates.source IS 'Source (In-house / Outside)';
COMMENT ON COLUMN student_certificates.provider_certifying_body IS 'Provider / Certifying Body';
COMMENT ON COLUMN student_certificates.platform IS 'Platform (Coursera / NPTEL / Udemy / Oracle / Other)';
COMMENT ON COLUMN student_certificates.domain IS 'Domain (AI / Cyber Security / Web Development / Cloud / Other)';
COMMENT ON COLUMN student_certificates.level IS 'Level (Foundation / Intermediate / Advanced)';
COMMENT ON COLUMN student_certificates.mode IS 'Mode (Online / Offline / Hybrid)';
COMMENT ON COLUMN student_certificates.target_year_of_students IS 'Target Year of Students (FY / SY / TY / LY)';
COMMENT ON COLUMN student_certificates.resource_person_instructor IS 'Resource Person / Instructor';
COMMENT ON COLUMN student_certificates.linked_mou IS 'Linked MoU';
COMMENT ON COLUMN student_certificates.duration IS 'Duration (Hours)';
COMMENT ON COLUMN student_certificates.start_date IS 'Start Date';
COMMENT ON COLUMN student_certificates.end_date IS 'End Date';
COMMENT ON COLUMN student_certificates.fee_per_student IS 'Fee per Student';
COMMENT ON COLUMN student_certificates.fee_paid_by IS 'Fee Paid By (Student / Institution / Sponsored)';
COMMENT ON COLUMN student_certificates.total_expenditure_by_institution IS 'Total Expenditure by Institution';
COMMENT ON COLUMN student_certificates.students_enrolled IS 'Students Enrolled';
COMMENT ON COLUMN student_certificates.students_attended IS 'Students Attended';
COMMENT ON COLUMN student_certificates.students_completed IS 'Students Completed';
COMMENT ON COLUMN student_certificates.students_certified IS 'Students Certified (passed the exam)';
COMMENT ON COLUMN student_certificates.gender_wise_count IS 'Gender-wise Count (Male / Female / Other)';
COMMENT ON COLUMN student_certificates.exam_required IS 'Exam Required (Yes / No)';
COMMENT ON COLUMN student_certificates.outcome IS 'Outcome (Certificate / Badge / Exam score / Attendance only)';
COMMENT ON COLUMN student_certificates.certificate_link_or_sample IS 'Certificate Link or Sample';
INSERT INTO record_types VALUES (6,'Scholarships');
CREATE TABLE scholarships (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (6) STORED,
  scheme_name text,
  scheme_level text CHECK (scheme_level IN ('Central', 'State', 'Institute', 'Private')),
  scholarship_type text CHECK (scholarship_type IN ('Merit', 'Need-based', 'Minority', 'Disability', 'Sports', 'Other')),
  provider_type text CHECK (provider_type IN ('Government', 'Institution', 'Private', 'NGO')),
  provider_name text,
  sanction_order_no text,
  date_awarded date,
  disbursement_date date,
  disbursement_mode text CHECK (disbursement_mode IN ('Bank transfer', 'Fee waiver', 'Cheque')),
  total_amount_sanctioned numeric(16,2) CHECK (total_amount_sanctioned >= 0),
  total_amount_disbursed numeric(16,2) CHECK (total_amount_disbursed >= 0),
  number_of_beneficiaries integer CHECK (number_of_beneficiaries >= 0),
  fresh_beneficiaries integer CHECK (fresh_beneficiaries >= 0),
  renewed_beneficiaries integer CHECK (renewed_beneficiaries >= 0),
  male_students integer CHECK (male_students >= 0),
  female_students integer CHECK (female_students >= 0),
  other_not_disclosed integer CHECK (other_not_disclosed >= 0),
  general text,
  sc text,
  st text,
  obc text,
  ews text,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN scholarships.scheme_name IS 'Scheme Name';
COMMENT ON COLUMN scholarships.scheme_level IS 'Scheme Level (Central / State / Institute / Private)';
COMMENT ON COLUMN scholarships.scholarship_type IS 'Scholarship Type (Merit / Need-based / Minority / Disability / Sports / Other)';
COMMENT ON COLUMN scholarships.provider_type IS 'Provider Type (Government / Institution / Private / NGO)';
COMMENT ON COLUMN scholarships.provider_name IS 'Provider Name';
COMMENT ON COLUMN scholarships.sanction_order_no IS 'Sanction Order No';
COMMENT ON COLUMN scholarships.date_awarded IS 'Date Awarded';
COMMENT ON COLUMN scholarships.disbursement_date IS 'Disbursement Date';
COMMENT ON COLUMN scholarships.disbursement_mode IS 'Disbursement Mode (Bank transfer / Fee waiver / Cheque)';
COMMENT ON COLUMN scholarships.total_amount_sanctioned IS 'Total Amount Sanctioned';
COMMENT ON COLUMN scholarships.total_amount_disbursed IS 'Total Amount Disbursed';
COMMENT ON COLUMN scholarships.number_of_beneficiaries IS 'Number of Beneficiaries';
COMMENT ON COLUMN scholarships.fresh_beneficiaries IS 'Fresh Beneficiaries';
COMMENT ON COLUMN scholarships.renewed_beneficiaries IS 'Renewed Beneficiaries';
COMMENT ON COLUMN scholarships.male_students IS 'Male Students';
COMMENT ON COLUMN scholarships.female_students IS 'Female Students';
COMMENT ON COLUMN scholarships.other_not_disclosed IS 'Other / Not Disclosed';
COMMENT ON COLUMN scholarships.general IS 'General (category-wise count)';
COMMENT ON COLUMN scholarships.sc IS 'SC (category-wise count)';
COMMENT ON COLUMN scholarships.st IS 'ST (category-wise count)';
COMMENT ON COLUMN scholarships.obc IS 'OBC (category-wise count)';
COMMENT ON COLUMN scholarships.ews IS 'EWS (category-wise count)';
INSERT INTO record_types VALUES (7,'Clubs');
CREATE TABLE clubs (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (7) STORED,
  club_name text,
  club_type text CHECK (club_type IN ('NSS', 'NCC', 'Red Cross', 'Eco', 'Cultural', 'Technical', 'Other')),
  club_description_objectives text,
  affiliated_body text CHECK (affiliated_body IN ('University NSS Cell', 'National Body', 'Other')),
  faculty_coordinator text,
  student_lead text,
  year_established smallint,
  socially_engaging boolean,
  number_of_members integer CHECK (number_of_members >= 0),
  male_members integer CHECK (male_members >= 0),
  female_members integer CHECK (female_members >= 0),
  other_not_disclosed integer CHECK (other_not_disclosed >= 0),
  number_of_activities_conducted_in_the_year integer CHECK (number_of_activities_conducted_in_the_year >= 0),
  awards_received_in_the_year integer CHECK (awards_received_in_the_year >= 0),
  total_budget_expenditure_for_the_year numeric(16,2) CHECK (total_budget_expenditure_for_the_year >= 0),
  club_email_or_social_media_link text,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN clubs.club_name IS 'Club Name';
COMMENT ON COLUMN clubs.club_type IS 'Club Type (NSS / NCC / Red Cross / Eco / Cultural / Technical / Other)';
COMMENT ON COLUMN clubs.club_description_objectives IS 'Club Description / Objectives';
COMMENT ON COLUMN clubs.affiliated_body IS 'Affiliated Body (University NSS Cell / National Body / Other)';
COMMENT ON COLUMN clubs.faculty_coordinator IS 'Faculty Coordinator';
COMMENT ON COLUMN clubs.student_lead IS 'Student Lead';
COMMENT ON COLUMN clubs.year_established IS 'Year Established';
COMMENT ON COLUMN clubs.socially_engaging IS 'Socially Engaging (Yes / No)';
COMMENT ON COLUMN clubs.number_of_members IS 'Number of Members (for the academic year)';
COMMENT ON COLUMN clubs.male_members IS 'Male Members';
COMMENT ON COLUMN clubs.female_members IS 'Female Members';
COMMENT ON COLUMN clubs.other_not_disclosed IS 'Other / Not Disclosed';
COMMENT ON COLUMN clubs.number_of_activities_conducted_in_the_year IS 'Number of Activities Conducted in the Year';
COMMENT ON COLUMN clubs.awards_received_in_the_year IS 'Awards Received in the Year (count)';
COMMENT ON COLUMN clubs.total_budget_expenditure_for_the_year IS 'Total Budget / Expenditure for the Year';
COMMENT ON COLUMN clubs.club_email_or_social_media_link IS 'Club Email or Social Media Link';
INSERT INTO record_types VALUES (8,'Faculty Profile');
CREATE TABLE faculty_profiles (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (8) STORED,
  employee_id text,
  name jsonb,
  photo text,
  gender text,
  date_of_birth date,
  category text CHECK (category IN ('General', 'SC', 'ST', 'OBC', 'EWS')),
  designation text,
  employment_type text CHECK (employment_type IN ('Full-time', 'Part-time', 'Visiting', 'Contract')),
  nature_of_appointment text CHECK (nature_of_appointment IN ('Regular', 'Ad-hoc', 'Contract', 'Visiting')),
  cadre text CHECK (cadre IN ('Teaching', 'Non-teaching')),
  pay_scale_pay_level text,
  university_approval_status text,
  university_approval_ref_no text,
  joining_date date,
  date_of_last_promotion date,
  leaving_date date,
  employment_status text CHECK (employment_status IN ('Active', 'On Leave', 'Resigned', 'Retired')),
  highest_qualification text,
  ug_education_details text,
  pg_education_details text,
  phd_education_details text,
  certifications text,
  phd boolean,
  phd_university text,
  phd_award_year smallint,
  recognised_phd_guide boolean,
  number_of_scholars_registered integer CHECK (number_of_scholars_registered >= 0),
  specialisation text,
  research_interests text,
  total_experience jsonb,
  email text,
  phone text,
  orcid_id text,
  scopus_id text,
  google_scholar_id text,
  vidwan_or_other_research_profile_link text,
  sanctioned_posts jsonb,
  previous_experience jsonb,
  phd_guidance jsonb,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN faculty_profiles.employee_id IS 'Employee ID (restricted)';
COMMENT ON COLUMN faculty_profiles.name IS 'Name (Title, First, Middle, Last)';
COMMENT ON COLUMN faculty_profiles.photo IS 'Photo';
COMMENT ON COLUMN faculty_profiles.gender IS 'Gender';
COMMENT ON COLUMN faculty_profiles.date_of_birth IS 'Date of Birth (restricted)';
COMMENT ON COLUMN faculty_profiles.category IS 'Category (General / SC / ST / OBC / EWS)';
COMMENT ON COLUMN faculty_profiles.designation IS 'Designation';
COMMENT ON COLUMN faculty_profiles.employment_type IS 'Employment Type (Full-time / Part-time / Visiting / Contract)';
COMMENT ON COLUMN faculty_profiles.nature_of_appointment IS 'Nature of Appointment (Regular / Ad-hoc / Contract / Visiting)';
COMMENT ON COLUMN faculty_profiles.cadre IS 'Cadre (Teaching / Non-teaching)';
COMMENT ON COLUMN faculty_profiles.pay_scale_pay_level IS 'Pay Scale / Pay Level';
COMMENT ON COLUMN faculty_profiles.university_approval_status IS 'University Approval Status';
COMMENT ON COLUMN faculty_profiles.university_approval_ref_no IS 'University Approval Ref No';
COMMENT ON COLUMN faculty_profiles.joining_date IS 'Joining Date';
COMMENT ON COLUMN faculty_profiles.date_of_last_promotion IS 'Date of Last Promotion';
COMMENT ON COLUMN faculty_profiles.leaving_date IS 'Leaving Date';
COMMENT ON COLUMN faculty_profiles.employment_status IS 'Employment Status (Active / On Leave / Resigned / Retired)';
COMMENT ON COLUMN faculty_profiles.highest_qualification IS 'Highest Qualification';
COMMENT ON COLUMN faculty_profiles.ug_education_details IS 'UG Education Details';
COMMENT ON COLUMN faculty_profiles.pg_education_details IS 'PG Education Details';
COMMENT ON COLUMN faculty_profiles.phd_education_details IS 'PhD Education Details';
COMMENT ON COLUMN faculty_profiles.certifications IS 'Certifications (Diploma, etc.)';
COMMENT ON COLUMN faculty_profiles.phd IS 'PhD (Yes / No)';
COMMENT ON COLUMN faculty_profiles.phd_university IS 'PhD University';
COMMENT ON COLUMN faculty_profiles.phd_award_year IS 'PhD Award Year';
COMMENT ON COLUMN faculty_profiles.recognised_phd_guide IS 'Recognised PhD Guide (Yes / No)';
COMMENT ON COLUMN faculty_profiles.number_of_scholars_registered IS 'Number of Scholars Registered';
COMMENT ON COLUMN faculty_profiles.specialisation IS 'Specialisation';
COMMENT ON COLUMN faculty_profiles.research_interests IS 'Research Interests';
COMMENT ON COLUMN faculty_profiles.total_experience IS 'Total Experience (Teaching / Industry / Research)';
COMMENT ON COLUMN faculty_profiles.email IS 'Email (restricted)';
COMMENT ON COLUMN faculty_profiles.phone IS 'Phone (restricted)';
COMMENT ON COLUMN faculty_profiles.orcid_id IS 'ORCID ID';
COMMENT ON COLUMN faculty_profiles.scopus_id IS 'Scopus ID';
COMMENT ON COLUMN faculty_profiles.google_scholar_id IS 'Google Scholar ID';
COMMENT ON COLUMN faculty_profiles.vidwan_or_other_research_profile_link IS 'Vidwan or Other Research Profile Link';
COMMENT ON COLUMN faculty_profiles.sanctioned_posts IS 'Sanctioned Posts (per department, designation, year)';
COMMENT ON COLUMN faculty_profiles.previous_experience IS 'Previous Experience (Employer, Role, From, To)';
COMMENT ON COLUMN faculty_profiles.phd_guidance IS 'PhD Guidance (Scholar, Status, Thesis Title)';
INSERT INTO record_types VALUES (9,'Programs Attended by Faculty');
CREATE TABLE faculty_programs (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (9) STORED,
  faculty_name text,
  program_title text,
  type text CHECK (type IN ('Workshop', 'Seminar', 'Orientation', 'STTP', 'FDP', 'Conference')),
  role text CHECK (role IN ('Participant', 'Presenter', 'Session Chair', 'Resource Person')),
  organised_by text,
  location text,
  mode text CHECK (mode IN ('Online', 'Offline', 'Hybrid')),
  level text CHECK (level IN ('State', 'National', 'International')),
  start_date date,
  end_date date,
  number_of_days integer CHECK (number_of_days >= 0),
  number_of_hours integer CHECK (number_of_hours >= 0),
  program_website_or_brochure_link text,
  funded_by_the_organiser boolean,
  financial_support_given boolean,
  sponsoring_body_for_the_support text CHECK (sponsoring_body_for_the_support IN ('Institution', 'AICTE', 'University', 'Other')),
  support_type text,
  amount_supported numeric(16,2) CHECK (amount_supported >= 0),
  key_learning_or_outcome text,
  CHECK(end_date >= start_date),
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN faculty_programs.faculty_name IS 'Faculty Name';
COMMENT ON COLUMN faculty_programs.program_title IS 'Program Title';
COMMENT ON COLUMN faculty_programs.type IS 'Type (Workshop / Seminar / Orientation / STTP / FDP / Conference)';
COMMENT ON COLUMN faculty_programs.role IS 'Role (Participant / Presenter / Session Chair / Resource Person)';
COMMENT ON COLUMN faculty_programs.organised_by IS 'Organised By';
COMMENT ON COLUMN faculty_programs.location IS 'Location';
COMMENT ON COLUMN faculty_programs.mode IS 'Mode (Online / Offline / Hybrid)';
COMMENT ON COLUMN faculty_programs.level IS 'Level (State / National / International)';
COMMENT ON COLUMN faculty_programs.start_date IS 'Start Date';
COMMENT ON COLUMN faculty_programs.end_date IS 'End Date';
COMMENT ON COLUMN faculty_programs.number_of_days IS 'Number of Days';
COMMENT ON COLUMN faculty_programs.number_of_hours IS 'Number of Hours';
COMMENT ON COLUMN faculty_programs.program_website_or_brochure_link IS 'Program Website or Brochure Link';
COMMENT ON COLUMN faculty_programs.funded_by_the_organiser IS 'Funded by the Organiser (Yes / No)';
COMMENT ON COLUMN faculty_programs.financial_support_given IS 'Financial Support Given (Yes / No)';
COMMENT ON COLUMN faculty_programs.sponsoring_body_for_the_support IS 'Sponsoring Body for the Support (Institution / AICTE / University / Other)';
COMMENT ON COLUMN faculty_programs.support_type IS 'Support Type (Registration fee / Travel / Accommodation / Membership fee)';
COMMENT ON COLUMN faculty_programs.amount_supported IS 'Amount Supported';
COMMENT ON COLUMN faculty_programs.key_learning_or_outcome IS 'Key Learning or Outcome';
INSERT INTO record_types VALUES (10,'Faculty Interaction with Outside World');
CREATE TABLE faculty_interactions (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (10) STORED,
  faculty_name text,
  interaction_type text CHECK (interaction_type IN ('Subject Expert', 'Membership', 'Industry Training', 'Resource Person', 'Reviewer', 'Editorial Board', 'BOS Member', 'Other')),
  title text,
  organisation text,
  organisation_type text CHECK (organisation_type IN ('University', 'Industry', 'Government', 'Professional Body', 'Other')),
  position_role text,
  membership_no_and_grade text,
  level text CHECK (level IN ('State', 'National', 'International')),
  mode text CHECK (mode IN ('Online', 'Offline', 'Hybrid')),
  place text,
  start_date date,
  end_date date,
  number_of_days integer CHECK (number_of_days >= 0),
  number_of_hours integer CHECK (number_of_hours >= 0),
  paid_or_honorary text CHECK (paid_or_honorary IN ('Paid', 'Honorary')),
  amount_received numeric(16,2) CHECK (amount_received >= 0),
  website_or_invitation_link text,
  linked_mou text,
  description text,
  contribution_description text,
  number_of_students_or_participants_benefited integer CHECK (number_of_students_or_participants_benefited >= 0),
  outcome text,
  CHECK(end_date >= start_date),
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN faculty_interactions.faculty_name IS 'Faculty Name';
COMMENT ON COLUMN faculty_interactions.interaction_type IS 'Interaction Type (Subject Expert / Membership / Industry Training / Resource Person / Reviewer / Editorial Board / BOS Member / Other)';
COMMENT ON COLUMN faculty_interactions.title IS 'Title';
COMMENT ON COLUMN faculty_interactions.organisation IS 'Organisation';
COMMENT ON COLUMN faculty_interactions.organisation_type IS 'Organisation Type (University / Industry / Government / Professional Body / Other)';
COMMENT ON COLUMN faculty_interactions.position_role IS 'Position / Role';
COMMENT ON COLUMN faculty_interactions.membership_no_and_grade IS 'Membership No and Grade (only for Membership)';
COMMENT ON COLUMN faculty_interactions.level IS 'Level (State / National / International)';
COMMENT ON COLUMN faculty_interactions.mode IS 'Mode (Online / Offline / Hybrid)';
COMMENT ON COLUMN faculty_interactions.place IS 'Place';
COMMENT ON COLUMN faculty_interactions.start_date IS 'Start Date';
COMMENT ON COLUMN faculty_interactions.end_date IS 'End Date';
COMMENT ON COLUMN faculty_interactions.number_of_days IS 'Number of Days';
COMMENT ON COLUMN faculty_interactions.number_of_hours IS 'Number of Hours';
COMMENT ON COLUMN faculty_interactions.paid_or_honorary IS 'Paid or Honorary (Paid / Honorary)';
COMMENT ON COLUMN faculty_interactions.amount_received IS 'Amount Received (only if Paid)';
COMMENT ON COLUMN faculty_interactions.website_or_invitation_link IS 'Website or Invitation Link';
COMMENT ON COLUMN faculty_interactions.linked_mou IS 'Linked MoU';
COMMENT ON COLUMN faculty_interactions.description IS 'Description';
COMMENT ON COLUMN faculty_interactions.contribution_description IS 'Contribution Description (for example papers reviewed, sessions taken)';
COMMENT ON COLUMN faculty_interactions.number_of_students_or_participants_benefited IS 'Number of Students or Participants Benefited';
COMMENT ON COLUMN faculty_interactions.outcome IS 'Outcome';
INSERT INTO record_types VALUES (11,'Publications');
CREATE TABLE publications (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (11) STORED,
  type text CHECK (type IN ('Journal', 'Conference', 'Book', 'Book Chapter')),
  paper_status text CHECK (paper_status IN ('Accepted', 'Published')),
  title text,
  authors jsonb,
  corresponding_author text,
  number_of_authors_from_the_institute integer CHECK (number_of_authors_from_the_institute >= 0),
  student_co_author boolean,
  author_s_affiliation_at_the_time text,
  journal_name_book_title text,
  volume_and_issue text,
  page_numbers text,
  chapter_title text,
  edition_and_year text,
  conference_name text,
  conference_location_and_dates text,
  proceedings_title text,
  series_name text,
  level text CHECK (level IN ('National', 'International')),
  publisher text,
  issn text,
  isbn text,
  doi text,
  indexing text CHECK (indexing IN ('Scopus', 'WoS', 'UGC CARE', 'Other')),
  indexing_valid_for_year text,
  ugc_care_link text,
  quartile text CHECK (quartile IN ('Q1', 'Q2', 'Q3', 'Q4')),
  impact_factor numeric(16,2) CHECK (impact_factor >= 0),
  citations integer CHECK (citations >= 0),
  peer_reviewed boolean,
  open_access boolean,
  publication_date date,
  link text,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN publications.type IS 'Type (Journal / Conference / Book / Book Chapter)';
COMMENT ON COLUMN publications.paper_status IS 'Paper Status (Accepted / Published)';
COMMENT ON COLUMN publications.title IS 'Title';
COMMENT ON COLUMN publications.authors IS 'Authors (in order, Faculty / Student / External)';
COMMENT ON COLUMN publications.corresponding_author IS 'Corresponding Author';
COMMENT ON COLUMN publications.number_of_authors_from_the_institute IS 'Number of Authors from the Institute';
COMMENT ON COLUMN publications.student_co_author IS 'Student Co-author (Yes / No)';
COMMENT ON COLUMN publications.author_s_affiliation_at_the_time IS 'Author''s Affiliation at the Time';
COMMENT ON COLUMN publications.journal_name_book_title IS 'Journal Name / Book Title';
COMMENT ON COLUMN publications.volume_and_issue IS 'Volume and Issue';
COMMENT ON COLUMN publications.page_numbers IS 'Page Numbers';
COMMENT ON COLUMN publications.chapter_title IS 'Chapter Title';
COMMENT ON COLUMN publications.edition_and_year IS 'Edition and Year (for books)';
COMMENT ON COLUMN publications.conference_name IS 'Conference Name';
COMMENT ON COLUMN publications.conference_location_and_dates IS 'Conference Location and Dates';
COMMENT ON COLUMN publications.proceedings_title IS 'Proceedings Title';
COMMENT ON COLUMN publications.series_name IS 'Series Name';
COMMENT ON COLUMN publications.level IS 'Level (National / International)';
COMMENT ON COLUMN publications.publisher IS 'Publisher';
COMMENT ON COLUMN publications.issn IS 'ISSN';
COMMENT ON COLUMN publications.isbn IS 'ISBN';
COMMENT ON COLUMN publications.doi IS 'DOI';
COMMENT ON COLUMN publications.indexing IS 'Indexing (Scopus / WoS / UGC CARE / Other)';
COMMENT ON COLUMN publications.indexing_valid_for_year IS 'Indexing Valid For Year';
COMMENT ON COLUMN publications.ugc_care_link IS 'UGC CARE Link';
COMMENT ON COLUMN publications.quartile IS 'Quartile (Q1 / Q2 / Q3 / Q4)';
COMMENT ON COLUMN publications.impact_factor IS 'Impact Factor';
COMMENT ON COLUMN publications.citations IS 'Citations';
COMMENT ON COLUMN publications.peer_reviewed IS 'Peer Reviewed (Yes / No)';
COMMENT ON COLUMN publications.open_access IS 'Open Access (Yes / No)';
COMMENT ON COLUMN publications.publication_date IS 'Publication Date';
COMMENT ON COLUMN publications.link IS 'Link';
INSERT INTO record_types VALUES (12,'Grants');
CREATE TABLE grants (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (12) STORED,
  grant_type text CHECK (grant_type IN ('Proposal', 'Sponsored Project', 'Seed Money', 'CSR')),
  project_category text CHECK (project_category IN ('Sponsored Research', 'Infrastructure', 'CSR', 'Internal')),
  title text,
  principal_investigator text,
  principal_investigator_s_department text,
  co_investigators text,
  co_investigators_departments text,
  funding_agency text,
  agency_type text CHECK (agency_type IN ('Government', 'Non-Government')),
  agency_source_category text CHECK (agency_source_category IN ('Government', 'Non-Government', 'CSR', 'Industry')),
  scheme_name text,
  submission_date date,
  proposal_status text CHECK (proposal_status IN ('Submitted', 'Accepted', 'Rejected', 'Withdrawn')),
  decision_date date,
  reason_for_rejection text,
  sanction_order_no text,
  sanction_date date,
  amount_requested numeric(16,2) CHECK (amount_requested >= 0),
  amount_sanctioned numeric(16,2) CHECK (amount_sanctioned >= 0),
  start_date date,
  end_date date,
  duration numeric(16,2) CHECK (duration >= 0),
  extension_granted boolean,
  extended_end_date date,
  instalments jsonb,
  month_and_year_grant_received text,
  total_amount_received_to_date date,
  amount_utilised numeric(16,2) CHECK (amount_utilised >= 0),
  utilisation_certificate boolean,
  number_of_students_involved integer CHECK (number_of_students_involved >= 0),
  number_of_publications_resulting integer CHECK (number_of_publications_resulting >= 0),
  outcomes text,
  linked_publication_patent_or_prototype text,
  CHECK(end_date >= start_date),
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN grants.grant_type IS 'Grant Type (Proposal / Sponsored Project / Seed Money / CSR)';
COMMENT ON COLUMN grants.project_category IS 'Project Category (Sponsored Research / Infrastructure / CSR / Internal)';
COMMENT ON COLUMN grants.title IS 'Title';
COMMENT ON COLUMN grants.principal_investigator IS 'Principal Investigator';
COMMENT ON COLUMN grants.principal_investigator_s_department IS 'Principal Investigator''s Department';
COMMENT ON COLUMN grants.co_investigators IS 'Co-Investigators';
COMMENT ON COLUMN grants.co_investigators_departments IS 'Co-Investigators'' Departments';
COMMENT ON COLUMN grants.funding_agency IS 'Funding Agency';
COMMENT ON COLUMN grants.agency_type IS 'Agency Type (Government / Non-Government)';
COMMENT ON COLUMN grants.agency_source_category IS 'Agency Source Category (Government / Non-Government / CSR / Industry)';
COMMENT ON COLUMN grants.scheme_name IS 'Scheme Name';
COMMENT ON COLUMN grants.submission_date IS 'Submission Date';
COMMENT ON COLUMN grants.proposal_status IS 'Proposal Status (Submitted / Accepted / Rejected / Withdrawn)';
COMMENT ON COLUMN grants.decision_date IS 'Decision Date';
COMMENT ON COLUMN grants.reason_for_rejection IS 'Reason for Rejection';
COMMENT ON COLUMN grants.sanction_order_no IS 'Sanction Order No';
COMMENT ON COLUMN grants.sanction_date IS 'Sanction Date';
COMMENT ON COLUMN grants.amount_requested IS 'Amount Requested';
COMMENT ON COLUMN grants.amount_sanctioned IS 'Amount Sanctioned';
COMMENT ON COLUMN grants.start_date IS 'Start Date';
COMMENT ON COLUMN grants.end_date IS 'End Date';
COMMENT ON COLUMN grants.duration IS 'Duration (Months)';
COMMENT ON COLUMN grants.extension_granted IS 'Extension Granted (Yes / No)';
COMMENT ON COLUMN grants.extended_end_date IS 'Extended End Date';
COMMENT ON COLUMN grants.instalments IS 'Instalments (Date, Amount)';
COMMENT ON COLUMN grants.month_and_year_grant_received IS 'Month and Year Grant Received';
COMMENT ON COLUMN grants.total_amount_received_to_date IS 'Total Amount Received to Date';
COMMENT ON COLUMN grants.amount_utilised IS 'Amount Utilised';
COMMENT ON COLUMN grants.utilisation_certificate IS 'Utilisation Certificate (Yes / No)';
COMMENT ON COLUMN grants.number_of_students_involved IS 'Number of Students Involved';
COMMENT ON COLUMN grants.number_of_publications_resulting IS 'Number of Publications Resulting';
COMMENT ON COLUMN grants.outcomes IS 'Outcomes (Publications, Prototypes, PhD graduates, Other)';
COMMENT ON COLUMN grants.linked_publication_patent_or_prototype IS 'Linked Publication, Patent or Prototype';
INSERT INTO record_types VALUES (13,'Consultancy');
CREATE TABLE consultancy (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (13) STORED,
  project_title text,
  category text,
  description text,
  project_status text CHECK (project_status IN ('Ongoing', 'Completed')),
  client_organisation text,
  client_type text CHECK (client_type IN ('Industry', 'Government', 'NGO', 'Startup', 'Other')),
  client_location text,
  client_contact_person text,
  linked_mou text,
  work_order_agreement_no text,
  agreement_date date,
  sanction_year smallint,
  faculty_involved jsonb,
  students_involved text,
  number_of_students_involved integer CHECK (number_of_students_involved >= 0),
  project_type text CHECK (project_type IN ('Group', 'Individual')),
  start_date date,
  end_date date,
  duration text,
  outcome_deliverable text,
  fees_without_gst numeric(16,2) CHECK (fees_without_gst >= 0),
  fees_received numeric(16,2) CHECK (fees_received >= 0),
  balance_fees_pending numeric(16,2) CHECK (balance_fees_pending >= 0),
  date_received_by_college date,
  payment_mode text CHECK (payment_mode IN ('Cheque', 'Bank transfer', 'Other')),
  institution_share numeric(16,2) CHECK (institution_share >= 0),
  faculty_share numeric(16,2) CHECK (faculty_share >= 0),
  client_feedback_or_completion_certificate text,
  CHECK(end_date >= start_date),
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN consultancy.project_title IS 'Project Title';
COMMENT ON COLUMN consultancy.category IS 'Category';
COMMENT ON COLUMN consultancy.description IS 'Description';
COMMENT ON COLUMN consultancy.project_status IS 'Project Status (Ongoing / Completed)';
COMMENT ON COLUMN consultancy.client_organisation IS 'Client / Organisation';
COMMENT ON COLUMN consultancy.client_type IS 'Client Type (Industry / Government / NGO / Startup / Other)';
COMMENT ON COLUMN consultancy.client_location IS 'Client Location';
COMMENT ON COLUMN consultancy.client_contact_person IS 'Client Contact Person (restricted)';
COMMENT ON COLUMN consultancy.linked_mou IS 'Linked MoU';
COMMENT ON COLUMN consultancy.work_order_agreement_no IS 'Work Order / Agreement No';
COMMENT ON COLUMN consultancy.agreement_date IS 'Agreement Date';
COMMENT ON COLUMN consultancy.sanction_year IS 'Sanction Year';
COMMENT ON COLUMN consultancy.faculty_involved IS 'Faculty Involved (PI, Co-PI)';
COMMENT ON COLUMN consultancy.students_involved IS 'Students Involved';
COMMENT ON COLUMN consultancy.number_of_students_involved IS 'Number of Students Involved';
COMMENT ON COLUMN consultancy.project_type IS 'Project Type (Group / Individual)';
COMMENT ON COLUMN consultancy.start_date IS 'Start Date';
COMMENT ON COLUMN consultancy.end_date IS 'End Date';
COMMENT ON COLUMN consultancy.duration IS 'Duration';
COMMENT ON COLUMN consultancy.outcome_deliverable IS 'Outcome / Deliverable';
COMMENT ON COLUMN consultancy.fees_without_gst IS 'Fees Without GST';
COMMENT ON COLUMN consultancy.fees_received IS 'Fees Received';
COMMENT ON COLUMN consultancy.balance_fees_pending IS 'Balance Fees Pending';
COMMENT ON COLUMN consultancy.date_received_by_college IS 'Date Received by College';
COMMENT ON COLUMN consultancy.payment_mode IS 'Payment Mode (Cheque / Bank transfer / Other)';
COMMENT ON COLUMN consultancy.institution_share IS 'Institution Share';
COMMENT ON COLUMN consultancy.faculty_share IS 'Faculty Share';
COMMENT ON COLUMN consultancy.client_feedback_or_completion_certificate IS 'Client Feedback or Completion Certificate';
INSERT INTO record_types VALUES (14,'Patents');
CREATE TABLE patents (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (14) STORED,
  title text,
  domain_field_of_invention text,
  abstract text,
  patent_type text CHECK (patent_type IN ('Utility', 'Design', 'Provisional', 'Complete')),
  patent_office_country text CHECK (patent_office_country IN ('India', 'US', 'PCT', 'Other')),
  inventors jsonb,
  number_of_inventors_from_the_institute integer CHECK (number_of_inventors_from_the_institute >= 0),
  inventor_departments text,
  inventor_affiliations_at_the_time_of_filing text,
  applicant_name text,
  applicant_type text CHECK (applicant_type IN ('Institution', 'Individual', 'Joint')),
  application_no text,
  filing_date_of_provisional_application date,
  filing_date date,
  publication_date date,
  request_for_examination_date date,
  patent_no text,
  grant_date date,
  grant_year smallint GENERATED ALWAYS AS (extract(year FROM grant_date)::smallint) STORED,
  patent_status text CHECK (patent_status IN ('Filed', 'Published', 'Granted')),
  fees_paid numeric(16,2) CHECK (fees_paid >= 0),
  renewal_fee_paid_till date,
  commercialised_or_licensed boolean,
  linked_startup_grant_or_prototype text,
  patent_link text,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN patents.title IS 'Title';
COMMENT ON COLUMN patents.domain_field_of_invention IS 'Domain / Field of Invention';
COMMENT ON COLUMN patents.abstract IS 'Abstract';
COMMENT ON COLUMN patents.patent_type IS 'Patent Type (Utility / Design / Provisional / Complete)';
COMMENT ON COLUMN patents.patent_office_country IS 'Patent Office / Country (India / US / PCT / Other)';
COMMENT ON COLUMN patents.inventors IS 'Inventors (Lead, Co-inventors)';
COMMENT ON COLUMN patents.number_of_inventors_from_the_institute IS 'Number of Inventors from the Institute';
COMMENT ON COLUMN patents.inventor_departments IS 'Inventor Departments';
COMMENT ON COLUMN patents.inventor_affiliations_at_the_time_of_filing IS 'Inventor Affiliations at the Time of Filing';
COMMENT ON COLUMN patents.applicant_name IS 'Applicant Name';
COMMENT ON COLUMN patents.applicant_type IS 'Applicant Type (Institution / Individual / Joint)';
COMMENT ON COLUMN patents.application_no IS 'Application No';
COMMENT ON COLUMN patents.filing_date_of_provisional_application IS 'Filing Date of Provisional Application';
COMMENT ON COLUMN patents.filing_date IS 'Filing Date';
COMMENT ON COLUMN patents.publication_date IS 'Publication Date';
COMMENT ON COLUMN patents.request_for_examination_date IS 'Request for Examination Date';
COMMENT ON COLUMN patents.patent_no IS 'Patent No';
COMMENT ON COLUMN patents.grant_date IS 'Grant Date';
COMMENT ON COLUMN patents.grant_year IS 'Grant Year (filled in automatically)';
COMMENT ON COLUMN patents.patent_status IS 'Patent Status (Filed / Published / Granted)';
COMMENT ON COLUMN patents.fees_paid IS 'Fees Paid';
COMMENT ON COLUMN patents.renewal_fee_paid_till IS 'Renewal Fee Paid Till';
COMMENT ON COLUMN patents.commercialised_or_licensed IS 'Commercialised or Licensed (Yes / No)';
COMMENT ON COLUMN patents.linked_startup_grant_or_prototype IS 'Linked Startup, Grant or Prototype';
COMMENT ON COLUMN patents.patent_link IS 'Patent Link (public record)';
INSERT INTO record_types VALUES (15,'Copyright');
CREATE TABLE copyrights (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (15) STORED,
  title text,
  type_of_work text CHECK (type_of_work IN ('Software', 'Dataset', 'Literary', 'Other')),
  class_of_work text CHECK (class_of_work IN ('Literary', 'Software', 'Artistic', 'Musical', 'Cinematographic', 'Sound Recording')),
  description_of_the_work text,
  language_of_the_work text,
  published_unpublished text CHECK (published_unpublished IN ('Published', 'Unpublished')),
  year_of_creation_or_first_publication text,
  author_s_faculty text,
  number_of_authors_from_the_institute integer CHECK (number_of_authors_from_the_institute >= 0),
  author_departments text,
  author_affiliations_at_the_time_of_filing text,
  applicant text,
  applicant_type text CHECK (applicant_type IN ('Institution', 'Individual', 'Joint')),
  diary_no text,
  date_of_filing date,
  registration_office text CHECK (registration_office IN ('Copyright Office, New Delhi', 'Other')),
  objection_or_examiner_reply_date date,
  registration_no text,
  registration_date date,
  registration_charges text,
  copyright_status text CHECK (copyright_status IN ('Filed', 'Registered')),
  commercialised_or_licensed boolean,
  linked_startup_grant_or_prototype text,
  linked_publication text,
  public_link text,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN copyrights.title IS 'Title';
COMMENT ON COLUMN copyrights.type_of_work IS 'Type of Work (Software / Dataset / Literary / Other)';
COMMENT ON COLUMN copyrights.class_of_work IS 'Class of Work (Literary / Software / Artistic / Musical / Cinematographic / Sound Recording)';
COMMENT ON COLUMN copyrights.description_of_the_work IS 'Description of the Work';
COMMENT ON COLUMN copyrights.language_of_the_work IS 'Language of the Work';
COMMENT ON COLUMN copyrights.published_unpublished IS 'Published / Unpublished';
COMMENT ON COLUMN copyrights.year_of_creation_or_first_publication IS 'Year of Creation or First Publication';
COMMENT ON COLUMN copyrights.author_s_faculty IS 'Author(s) / Faculty';
COMMENT ON COLUMN copyrights.number_of_authors_from_the_institute IS 'Number of Authors from the Institute';
COMMENT ON COLUMN copyrights.author_departments IS 'Author Departments';
COMMENT ON COLUMN copyrights.author_affiliations_at_the_time_of_filing IS 'Author Affiliations at the Time of Filing';
COMMENT ON COLUMN copyrights.applicant IS 'Applicant';
COMMENT ON COLUMN copyrights.applicant_type IS 'Applicant Type (Institution / Individual / Joint)';
COMMENT ON COLUMN copyrights.diary_no IS 'Diary No';
COMMENT ON COLUMN copyrights.date_of_filing IS 'Date of Filing';
COMMENT ON COLUMN copyrights.registration_office IS 'Registration Office (Copyright Office, New Delhi / Other)';
COMMENT ON COLUMN copyrights.objection_or_examiner_reply_date IS 'Objection or Examiner Reply Date';
COMMENT ON COLUMN copyrights.registration_no IS 'Registration No';
COMMENT ON COLUMN copyrights.registration_date IS 'Registration Date';
COMMENT ON COLUMN copyrights.registration_charges IS 'Registration Charges';
COMMENT ON COLUMN copyrights.copyright_status IS 'Copyright Status (Filed / Registered)';
COMMENT ON COLUMN copyrights.commercialised_or_licensed IS 'Commercialised or Licensed (Yes / No)';
COMMENT ON COLUMN copyrights.linked_startup_grant_or_prototype IS 'Linked Startup, Grant or Prototype';
COMMENT ON COLUMN copyrights.linked_publication IS 'Linked Publication';
COMMENT ON COLUMN copyrights.public_link IS 'Public Link';
INSERT INTO record_types VALUES (16,'Entrepreneurship / Startups');
CREATE TABLE startups (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (16) STORED,
  company_name text,
  company_address text,
  relationship_to_institute text CHECK (relationship_to_institute IN ('Faculty', 'Student', 'Alumni Startup')),
  date_of_incorporation date,
  year_of_registration smallint,
  legal_structure text CHECK (legal_structure IN ('Private Ltd', 'LLP', 'OPC', 'Partnership', 'Proprietorship')),
  sector text,
  product_service_description text,
  type_of_innovation text CHECK (type_of_innovation IN ('IP-based', 'Non-IP', 'Service', 'Manufacturing')),
  stage numeric(16,2) CHECK (stage >= 0),
  dpiit_startup_india_recognition boolean,
  recognition_no text,
  registration_numbers jsonb,
  founders jsonb,
  number_of_founders integer CHECK (number_of_founders >= 0),
  number_of_women_founders integer CHECK (number_of_women_founders >= 0),
  founder_batch_passing_year text,
  current_status text CHECK (current_status IN ('Incubated', 'Graduated', 'Exited')),
  incubation_unit text,
  incubation_start_date date,
  incubation_end_date date,
  incubation_support_received text,
  exit_date date,
  awards text,
  patents_copyrights_linked text,
  number_of_employees integer CHECK (number_of_employees >= 0),
  number_of_jobs_created integer CHECK (number_of_jobs_created >= 0),
  income_generated numeric(16,2) CHECK (income_generated >= 0),
  turnover numeric(16,2) CHECK (turnover >= 0),
  valuation numeric(16,2) CHECK (valuation >= 0),
  funding_received numeric(16,2) CHECK (funding_received >= 0),
  grant_from_institute numeric(16,2) CHECK (grant_from_institute >= 0),
  seed_angel_funding jsonb,
  linked_grant_or_seed_money_record text,
  website text,
  social_media_link text,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN startups.company_name IS 'Company Name';
COMMENT ON COLUMN startups.company_address IS 'Company Address';
COMMENT ON COLUMN startups.relationship_to_institute IS 'Relationship to Institute (Faculty / Student / Alumni Startup)';
COMMENT ON COLUMN startups.date_of_incorporation IS 'Date of Incorporation';
COMMENT ON COLUMN startups.year_of_registration IS 'Year of Registration';
COMMENT ON COLUMN startups.legal_structure IS 'Legal Structure (Private Ltd / LLP / OPC / Partnership / Proprietorship)';
COMMENT ON COLUMN startups.sector IS 'Sector';
COMMENT ON COLUMN startups.product_service_description IS 'Product / Service Description';
COMMENT ON COLUMN startups.type_of_innovation IS 'Type of Innovation (IP-based / Non-IP / Service / Manufacturing)';
COMMENT ON COLUMN startups.stage IS 'Stage (Idea / Prototype / Revenue / Scaling)';
COMMENT ON COLUMN startups.dpiit_startup_india_recognition IS 'DPIIT / Startup India Recognition (Yes / No)';
COMMENT ON COLUMN startups.recognition_no IS 'Recognition No';
COMMENT ON COLUMN startups.registration_numbers IS 'Registration Numbers (CIN / DIPP / MSME / GST / PAN)';
COMMENT ON COLUMN startups.founders IS 'Founders (Name, Type, Gender, DIN, Email, Phone)';
COMMENT ON COLUMN startups.number_of_founders IS 'Number of Founders';
COMMENT ON COLUMN startups.number_of_women_founders IS 'Number of Women Founders';
COMMENT ON COLUMN startups.founder_batch_passing_year IS 'Founder Batch / Passing Year';
COMMENT ON COLUMN startups.current_status IS 'Current Status (Incubated / Graduated / Exited)';
COMMENT ON COLUMN startups.incubation_unit IS 'Incubation Unit';
COMMENT ON COLUMN startups.incubation_start_date IS 'Incubation Start Date';
COMMENT ON COLUMN startups.incubation_end_date IS 'Incubation End Date';
COMMENT ON COLUMN startups.incubation_support_received IS 'Incubation Support Received (Space / Mentoring / Funding / Other)';
COMMENT ON COLUMN startups.exit_date IS 'Exit Date';
COMMENT ON COLUMN startups.awards IS 'Awards';
COMMENT ON COLUMN startups.patents_copyrights_linked IS 'Patents / Copyrights Linked';
COMMENT ON COLUMN startups.number_of_employees IS 'Number of Employees';
COMMENT ON COLUMN startups.number_of_jobs_created IS 'Number of Jobs Created';
COMMENT ON COLUMN startups.income_generated IS 'Income Generated';
COMMENT ON COLUMN startups.turnover IS 'Turnover';
COMMENT ON COLUMN startups.valuation IS 'Valuation';
COMMENT ON COLUMN startups.funding_received IS 'Funding Received';
COMMENT ON COLUMN startups.grant_from_institute IS 'Grant from Institute';
COMMENT ON COLUMN startups.seed_angel_funding IS 'Seed / Angel Funding (Funder, Amount, Date)';
COMMENT ON COLUMN startups.linked_grant_or_seed_money_record IS 'Linked Grant or Seed Money Record';
COMMENT ON COLUMN startups.website IS 'Website';
COMMENT ON COLUMN startups.social_media_link IS 'Social Media Link';
INSERT INTO record_types VALUES (17,'Events');
CREATE TABLE events (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (17) STORED,
  event_title text,
  type text CHECK (type IN ('Workshop', 'Seminar', 'Orientation', 'FDP', 'STTP', 'Concert', 'Exhibition', 'Competition', 'Outreach', 'Guest Lecture', 'Other')),
  themes jsonb,
  event text CHECK (event IN ('Team', 'Individual')),
  parent_event text,
  objective_of_the_event text,
  organising_department_s text,
  organising_club_committee text,
  coordinator_convener text,
  collaborating_sponsoring_agencies jsonb,
  linked_mou text,
  linked_club text,
  scheme_or_programme_name text,
  start_date date,
  end_date date,
  number_of_days integer CHECK (number_of_days >= 0),
  number_of_hours integer CHECK (number_of_hours >= 0),
  venue text,
  mode text CHECK (mode IN ('Online', 'Offline', 'Hybrid')),
  level text CHECK (level IN ('College', 'University', 'State', 'National', 'International')),
  external_event boolean,
  language_of_delivery text,
  target_audience text CHECK (target_audience IN ('Students', 'Faculty', 'Public', 'Industry')),
  speakers_performers jsonb,
  number_of_resource_persons integer CHECK (number_of_resource_persons >= 0),
  participants_count integer CHECK (participants_count >= 0),
  students_participated_count integer CHECK (students_participated_count >= 0),
  faculty_participated_count integer CHECK (faculty_participated_count >= 0),
  external_participants_count integer CHECK (external_participants_count >= 0),
  female_participants_count integer CHECK (female_participants_count >= 0),
  registration_fee_per_participant numeric(16,2) CHECK (registration_fee_per_participant >= 0),
  total_expenditure numeric(16,2) CHECK (total_expenditure >= 0),
  total_revenue numeric(16,2) CHECK (total_revenue >= 0),
  sponsorship_amount_received numeric(16,2) CHECK (sponsorship_amount_received >= 0),
  ticket_revenue numeric(16,2) CHECK (ticket_revenue >= 0),
  outcome text,
  feedback_collected boolean,
  certificates_issued boolean,
  event_website_or_registration_link text,
  video_or_recording_link text,
  social_media_links text,
  average_rating numeric(4,2) CHECK (average_rating >= 0),
  CHECK(end_date >= start_date),
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN events.event_title IS 'Event Title';
COMMENT ON COLUMN events.type IS 'Type (Workshop / Seminar / Orientation / FDP / STTP / Concert / Exhibition / Competition / Outreach / Guest Lecture / Other)';
COMMENT ON COLUMN events.themes IS 'Themes (IPR / Research Methodology / Entrepreneurship / Skill Development / Cultural / Sports / Social / Other)';
COMMENT ON COLUMN events.event IS 'Event (Team / Individual)';
COMMENT ON COLUMN events.parent_event IS 'Parent Event (for fests)';
COMMENT ON COLUMN events.objective_of_the_event IS 'Objective of the Event';
COMMENT ON COLUMN events.organising_department_s IS 'Organising Department(s)';
COMMENT ON COLUMN events.organising_club_committee IS 'Organising Club / Committee';
COMMENT ON COLUMN events.coordinator_convener IS 'Coordinator / Convener (faculty)';
COMMENT ON COLUMN events.collaborating_sponsoring_agencies IS 'Collaborating / Sponsoring Agencies (Name, Role, Amount)';
COMMENT ON COLUMN events.linked_mou IS 'Linked MoU';
COMMENT ON COLUMN events.linked_club IS 'Linked Club';
COMMENT ON COLUMN events.scheme_or_programme_name IS 'Scheme or Programme Name (for example AICTE VAANI, NSS)';
COMMENT ON COLUMN events.start_date IS 'Start Date';
COMMENT ON COLUMN events.end_date IS 'End Date';
COMMENT ON COLUMN events.number_of_days IS 'Number of Days';
COMMENT ON COLUMN events.number_of_hours IS 'Number of Hours';
COMMENT ON COLUMN events.venue IS 'Venue';
COMMENT ON COLUMN events.mode IS 'Mode (Online / Offline / Hybrid)';
COMMENT ON COLUMN events.level IS 'Level (College / University / State / National / International)';
COMMENT ON COLUMN events.external_event IS 'External Event (Yes / No)';
COMMENT ON COLUMN events.language_of_delivery IS 'Language of Delivery';
COMMENT ON COLUMN events.target_audience IS 'Target Audience (Students / Faculty / Public / Industry)';
COMMENT ON COLUMN events.speakers_performers IS 'Speakers / Performers (Name, Designation, Organisation)';
COMMENT ON COLUMN events.number_of_resource_persons IS 'Number of Resource Persons';
COMMENT ON COLUMN events.participants_count IS 'Participants Count';
COMMENT ON COLUMN events.students_participated_count IS 'Students Participated Count';
COMMENT ON COLUMN events.faculty_participated_count IS 'Faculty Participated Count';
COMMENT ON COLUMN events.external_participants_count IS 'External Participants Count';
COMMENT ON COLUMN events.female_participants_count IS 'Female Participants Count';
COMMENT ON COLUMN events.registration_fee_per_participant IS 'Registration Fee per Participant';
COMMENT ON COLUMN events.total_expenditure IS 'Total Expenditure';
COMMENT ON COLUMN events.total_revenue IS 'Total Revenue';
COMMENT ON COLUMN events.sponsorship_amount_received IS 'Sponsorship Amount Received';
COMMENT ON COLUMN events.ticket_revenue IS 'Ticket Revenue';
COMMENT ON COLUMN events.outcome IS 'Outcome';
COMMENT ON COLUMN events.feedback_collected IS 'Feedback Collected (Yes / No), with Average Rating';
COMMENT ON COLUMN events.certificates_issued IS 'Certificates Issued (Yes / No)';
COMMENT ON COLUMN events.event_website_or_registration_link IS 'Event Website or Registration Link';
COMMENT ON COLUMN events.video_or_recording_link IS 'Video or Recording Link';
COMMENT ON COLUMN events.social_media_links IS 'Social Media Links';
COMMENT ON COLUMN events.average_rating IS 'Average Rating';
INSERT INTO record_types VALUES (18,'MoUs');
CREATE TABLE mous (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (18) STORED,
  organisation text,
  organisation_type text CHECK (organisation_type IN ('Industry', 'University', 'Government', 'NGO', 'Professional Body', 'Other')),
  organisation_location text,
  organisation_contact_person text,
  level text CHECK (level IN ('National', 'International')),
  initiating_department text,
  other_departments text,
  faculty_coordinators text,
  mou_type text CHECK (mou_type IN ('Training', 'R&D', 'Internship', 'Placement', 'Consultancy', 'Academic')),
  purpose text,
  activities_planned_under_the_mou text,
  date_of_signing date,
  signatory_from_the_institute jsonb,
  signatory_from_the_organisation jsonb,
  duration_valid_until text,
  mou_status text CHECK (mou_status IN ('Active', 'Expired', 'Terminated')),
  renewed boolean,
  renewal_date date,
  termination_date date,
  termination_reason text,
  financial_value_if_any numeric(16,2) CHECK (financial_value_if_any >= 0),
  yearly_activities jsonb,
  number_of_activities_conducted_in_the_year integer CHECK (number_of_activities_conducted_in_the_year >= 0),
  number_of_students_benefited_in_the_year integer CHECK (number_of_students_benefited_in_the_year >= 0),
  number_of_faculty_benefited_in_the_year integer CHECK (number_of_faculty_benefited_in_the_year >= 0),
  outcomes text,
  linked_events_internships_or_consultancy_records text,
  website_or_public_link text,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN mous.organisation IS 'Organisation';
COMMENT ON COLUMN mous.organisation_type IS 'Organisation Type (Industry / University / Government / NGO / Professional Body / Other)';
COMMENT ON COLUMN mous.organisation_location IS 'Organisation Location (City, State, Country)';
COMMENT ON COLUMN mous.organisation_contact_person IS 'Organisation Contact Person (restricted)';
COMMENT ON COLUMN mous.level IS 'Level (National / International)';
COMMENT ON COLUMN mous.initiating_department IS 'Initiating Department';
COMMENT ON COLUMN mous.other_departments IS 'Other Departments';
COMMENT ON COLUMN mous.faculty_coordinators IS 'Faculty Coordinators';
COMMENT ON COLUMN mous.mou_type IS 'MoU Type (Training / R&D / Internship / Placement / Consultancy / Academic)';
COMMENT ON COLUMN mous.purpose IS 'Purpose';
COMMENT ON COLUMN mous.activities_planned_under_the_mou IS 'Activities Planned Under the MoU';
COMMENT ON COLUMN mous.date_of_signing IS 'Date of Signing';
COMMENT ON COLUMN mous.signatory_from_the_institute IS 'Signatory from the Institute (Name, Designation)';
COMMENT ON COLUMN mous.signatory_from_the_organisation IS 'Signatory from the Organisation (Name, Designation)';
COMMENT ON COLUMN mous.duration_valid_until IS 'Duration / Valid Until';
COMMENT ON COLUMN mous.mou_status IS 'MoU Status (Active / Expired / Terminated)';
COMMENT ON COLUMN mous.renewed IS 'Renewed (Yes / No)';
COMMENT ON COLUMN mous.renewal_date IS 'Renewal Date';
COMMENT ON COLUMN mous.termination_date IS 'Termination Date';
COMMENT ON COLUMN mous.termination_reason IS 'Termination Reason';
COMMENT ON COLUMN mous.financial_value_if_any IS 'Financial Value, if any (amount received or spent)';
COMMENT ON COLUMN mous.yearly_activities IS 'Yearly Activities (Year, Activity, Students Benefited, Faculty Benefited)';
COMMENT ON COLUMN mous.number_of_activities_conducted_in_the_year IS 'Number of Activities Conducted in the Year';
COMMENT ON COLUMN mous.number_of_students_benefited_in_the_year IS 'Number of Students Benefited in the Year';
COMMENT ON COLUMN mous.number_of_faculty_benefited_in_the_year IS 'Number of Faculty Benefited in the Year';
COMMENT ON COLUMN mous.outcomes IS 'Outcomes (internships, placements, projects, training)';
COMMENT ON COLUMN mous.linked_events_internships_or_consultancy_records IS 'Linked Events, Internships or Consultancy Records';
COMMENT ON COLUMN mous.website_or_public_link IS 'Website or Public Link';
INSERT INTO record_types VALUES (19,'Infrastructure');
CREATE TABLE infrastructure (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (19) STORED,
  facility_name text,
  category text CHECK (category IN ('Classroom', 'Seminar Hall', 'Lab', 'Library', 'Auditorium', 'Gallery', 'Studio', 'Sports', 'Other')),
  facility_type text CHECK (facility_type IN ('Teaching', 'Research', 'Support', 'Student Amenity')),
  building_block_and_floor text,
  room_no text,
  area numeric(16,2) CHECK (area >= 0),
  capacity integer CHECK (capacity >= 0),
  year_established smallint,
  ict_features jsonb,
  available text CHECK (available IN ('Yes', 'No', 'NA')),
  exclusive_use boolean,
  major_equipment jsonb,
  total_equipment_cost numeric(16,2) CHECK (total_equipment_cost >= 0),
  funding_source text CHECK (funding_source IN ('Institution', 'Grant', 'CSR', 'Other')),
  usage_hours_per_week numeric(16,2) CHECK (usage_hours_per_week >= 0),
  in_charge_faculty_or_staff text,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN infrastructure.facility_name IS 'Facility Name';
COMMENT ON COLUMN infrastructure.category IS 'Category (Classroom / Seminar Hall / Lab / Library / Auditorium / Gallery / Studio / Sports / Other)';
COMMENT ON COLUMN infrastructure.facility_type IS 'Facility Type (Teaching / Research / Support / Student Amenity)';
COMMENT ON COLUMN infrastructure.building_block_and_floor IS 'Building / Block and Floor';
COMMENT ON COLUMN infrastructure.room_no IS 'Room No';
COMMENT ON COLUMN infrastructure.area IS 'Area';
COMMENT ON COLUMN infrastructure.capacity IS 'Capacity';
COMMENT ON COLUMN infrastructure.year_established IS 'Year Established';
COMMENT ON COLUMN infrastructure.ict_features IS 'ICT Features (Projector, LAN, WiFi, Smart Board, LMS)';
COMMENT ON COLUMN infrastructure.available IS 'Available (Yes / No / NA), for checklist items';
COMMENT ON COLUMN infrastructure.exclusive_use IS 'Exclusive Use (Yes / No)';
COMMENT ON COLUMN infrastructure.major_equipment IS 'Major Equipment (name, quantity, cost)';
COMMENT ON COLUMN infrastructure.total_equipment_cost IS 'Total Equipment Cost';
COMMENT ON COLUMN infrastructure.funding_source IS 'Funding Source (Institution / Grant / CSR / Other)';
COMMENT ON COLUMN infrastructure.usage_hours_per_week IS 'Usage Hours per Week';
COMMENT ON COLUMN infrastructure.in_charge_faculty_or_staff IS 'In-charge Faculty or Staff';
INSERT INTO record_types VALUES (20,'Best Practices');
CREATE TABLE best_practices (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (20) STORED,
  title text,
  type text CHECK (type IN ('Best Practice', 'Institutional Distinctiveness')),
  objectives text,
  context text,
  practice_description text,
  evidence_of_success text,
  problems_encountered text,
  resources_required text,
  coordinator text,
  outcomes jsonb,
  linked_events_awards_mous text,
  version text,
  valid_from date,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN best_practices.title IS 'Title';
COMMENT ON COLUMN best_practices.type IS 'Type (Best Practice / Institutional Distinctiveness)';
COMMENT ON COLUMN best_practices.objectives IS 'Objectives';
COMMENT ON COLUMN best_practices.context IS 'Context';
COMMENT ON COLUMN best_practices.practice_description IS 'Practice Description';
COMMENT ON COLUMN best_practices.evidence_of_success IS 'Evidence of Success';
COMMENT ON COLUMN best_practices.problems_encountered IS 'Problems Encountered';
COMMENT ON COLUMN best_practices.resources_required IS 'Resources Required';
COMMENT ON COLUMN best_practices.coordinator IS 'Coordinator';
COMMENT ON COLUMN best_practices.outcomes IS 'Outcomes (Measure, Value)';
COMMENT ON COLUMN best_practices.linked_events_awards_mous IS 'Linked Events / Awards / MoUs';
COMMENT ON COLUMN best_practices.version IS 'Version';
COMMENT ON COLUMN best_practices.valid_from IS 'Valid From';
INSERT INTO record_types VALUES (21,'Notable Achievements');
CREATE TABLE achievements (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (21) STORED,
  recipient_type text CHECK (recipient_type IN ('Faculty', 'Student', 'Institution', 'Startup', 'Club')),
  recipient_name text,
  admission_no_employee_id text,
  gender_of_the_recipient text,
  class_year_of_study text,
  team_or_individual text,
  team_members text,
  number_of_team_members integer CHECK (number_of_team_members >= 0),
  award_recognition_name text,
  award_type text CHECK (award_type IN ('Award', 'Medal', 'Certificate of Appreciation', 'Trophy', 'Grant')),
  category text CHECK (category IN ('Academic', 'Research', 'Sports', 'Cultural', 'Extension', 'Social', 'Other')),
  competition_category text,
  position text CHECK (position IN ('First', 'Second', 'Third', 'Consolation', 'Special', 'Participation')),
  is_participation_certificate_only boolean,
  prize_amount_or_cash_award numeric(16,2) CHECK (prize_amount_or_cash_award >= 0),
  awarding_agency text,
  awarding_agency_type text CHECK (awarding_agency_type IN ('Government', 'Government-recognised', 'Industry', 'NGO', 'Professional Body')),
  agency_nature text CHECK (agency_nature IN ('State Govt', 'Central Govt', 'Philanthropist', 'Private', 'Other')),
  awarding_agency_location text,
  is_external_award boolean,
  level text CHECK (level IN ('University', 'Zonal', 'State', 'National', 'International')),
  event_name text,
  event_location text,
  date_from date,
  date_to date,
  description text CHECK (cardinality(regexp_split_to_array(trim(description), '\s+')) <= 100),
  translation_required boolean,
  club_linked text,
  linked_event_startup_or_club_record text,
  website_or_news_link text,
  photo_of_the_award text,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN achievements.recipient_type IS 'Recipient Type (Faculty / Student / Institution / Startup / Club)';
COMMENT ON COLUMN achievements.recipient_name IS 'Recipient Name';
COMMENT ON COLUMN achievements.admission_no_employee_id IS 'Admission No / Employee ID (restricted)';
COMMENT ON COLUMN achievements.gender_of_the_recipient IS 'Gender of the Recipient';
COMMENT ON COLUMN achievements.class_year_of_study IS 'Class / Year of Study (for students)';
COMMENT ON COLUMN achievements.team_or_individual IS 'Team or Individual';
COMMENT ON COLUMN achievements.team_members IS 'Team Members (if team)';
COMMENT ON COLUMN achievements.number_of_team_members IS 'Number of Team Members';
COMMENT ON COLUMN achievements.award_recognition_name IS 'Award / Recognition Name';
COMMENT ON COLUMN achievements.award_type IS 'Award Type (Award / Medal / Certificate of Appreciation / Trophy / Grant)';
COMMENT ON COLUMN achievements.category IS 'Category (Academic / Research / Sports / Cultural / Extension / Social / Other)';
COMMENT ON COLUMN achievements.competition_category IS 'Competition Category (for example Classical Solo)';
COMMENT ON COLUMN achievements.position IS 'Position (First / Second / Third / Consolation / Special / Participation)';
COMMENT ON COLUMN achievements.is_participation_certificate_only IS 'Is Participation Certificate Only (Yes / No)';
COMMENT ON COLUMN achievements.prize_amount_or_cash_award IS 'Prize Amount or Cash Award';
COMMENT ON COLUMN achievements.awarding_agency IS 'Awarding Agency';
COMMENT ON COLUMN achievements.awarding_agency_type IS 'Awarding Agency Type (Government / Government-recognised / Industry / NGO / Professional Body)';
COMMENT ON COLUMN achievements.agency_nature IS 'Agency Nature (State Govt / Central Govt / Philanthropist / Private / Other)';
COMMENT ON COLUMN achievements.awarding_agency_location IS 'Awarding Agency Location';
COMMENT ON COLUMN achievements.is_external_award IS 'Is External Award (Yes / No)';
COMMENT ON COLUMN achievements.level IS 'Level (University / Zonal / State / National / International)';
COMMENT ON COLUMN achievements.event_name IS 'Event Name';
COMMENT ON COLUMN achievements.event_location IS 'Event Location';
COMMENT ON COLUMN achievements.date_from IS 'Date From';
COMMENT ON COLUMN achievements.date_to IS 'Date To';
COMMENT ON COLUMN achievements.description IS 'Description (max 100 words)';
COMMENT ON COLUMN achievements.translation_required IS 'Translation Required (Yes / No)';
COMMENT ON COLUMN achievements.club_linked IS 'Club Linked';
COMMENT ON COLUMN achievements.linked_event_startup_or_club_record IS 'Linked Event, Startup or Club Record';
COMMENT ON COLUMN achievements.website_or_news_link IS 'Website or News Link';
COMMENT ON COLUMN achievements.photo_of_the_award IS 'Photo of the Award';
INSERT INTO record_types VALUES (22,'Committees');
CREATE TABLE committees (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (22) STORED,
  committee_name text,
  type text CHECK (type IN ('Ethics', 'BOS', 'IQAC', 'CDC', 'Grievance', 'Other')),
  issuing_body text CHECK (issuing_body IN ('College', 'University')),
  constituted_date date,
  valid_from date,
  valid_to date,
  roles_and_responsibilities text,
  members jsonb,
  meetings jsonb,
  actions_taken jsonb,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN committees.committee_name IS 'Committee Name';
COMMENT ON COLUMN committees.type IS 'Type (Ethics / BOS / IQAC / CDC / Grievance / Other)';
COMMENT ON COLUMN committees.issuing_body IS 'Issuing Body (College / University)';
COMMENT ON COLUMN committees.constituted_date IS 'Constituted Date';
COMMENT ON COLUMN committees.valid_from IS 'Valid From';
COMMENT ON COLUMN committees.valid_to IS 'Valid To';
COMMENT ON COLUMN committees.roles_and_responsibilities IS 'Roles and Responsibilities';
COMMENT ON COLUMN committees.members IS 'Members (Name, Category: Faculty / Alumni / Student / External / Industry, Role, From, To)';
COMMENT ON COLUMN committees.meetings IS 'Meetings (Date, Agenda, Attendance, Minutes)';
COMMENT ON COLUMN committees.actions_taken IS 'Actions Taken (Action, Owner, Due Date, Status)';
INSERT INTO record_types VALUES (23,'Policies');
CREATE TABLE policies (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (23) STORED,
  title text,
  type text CHECK (type IN ('Research Ethics', 'Animal Ethics', 'Biosafety', 'BOS', 'Recruitment', 'Appraisal', 'Staff Conduct', 'Student Conduct', 'Water', 'Energy', 'Waste', 'Other')),
  issuing_body text CHECK (issuing_body IN ('College', 'University')),
  version text,
  approved_date date,
  next_review_date date,
  applies_to text,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN policies.title IS 'Title';
COMMENT ON COLUMN policies.type IS 'Type (Research Ethics / Animal Ethics / Biosafety / BOS / Recruitment / Appraisal / Staff Conduct / Student Conduct / Water / Energy / Waste / Other)';
COMMENT ON COLUMN policies.issuing_body IS 'Issuing Body (College / University)';
COMMENT ON COLUMN policies.version IS 'Version';
COMMENT ON COLUMN policies.approved_date IS 'Approved Date';
COMMENT ON COLUMN policies.next_review_date IS 'Next Review Date';
COMMENT ON COLUMN policies.applies_to IS 'Applies To';
INSERT INTO record_types VALUES (24,'Programs Offered and Intake');
CREATE TABLE program_intake (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (24) STORED,
  level text CHECK (level IN ('UG', 'PG', 'PhD', 'Diploma')),
  duration numeric(16,2) CHECK (duration >= 0),
  start_year text,
  approving_body text CHECK (approving_body IN ('AICTE', 'University', 'Other')),
  approval_reference_and_validity text,
  sanctioned_intake integer CHECK (sanctioned_intake >= 0),
  lateral_entry_intake integer CHECK (lateral_entry_intake >= 0),
  students_enrolled integer CHECK (students_enrolled >= 0),
  seats_filled integer CHECK (seats_filled >= 0),
  programme_status text CHECK (programme_status IN ('Active', 'Discontinued', 'Proposed')),
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN program_intake.level IS 'Level (UG / PG / PhD / Diploma)';
COMMENT ON COLUMN program_intake.duration IS 'Duration (Years)';
COMMENT ON COLUMN program_intake.start_year IS 'Start Year (for example 2026-27)';
COMMENT ON COLUMN program_intake.approving_body IS 'Approving Body (AICTE / University / Other)';
COMMENT ON COLUMN program_intake.approval_reference_and_validity IS 'Approval Reference and Validity';
COMMENT ON COLUMN program_intake.sanctioned_intake IS 'Sanctioned Intake';
COMMENT ON COLUMN program_intake.lateral_entry_intake IS 'Lateral Entry Intake';
COMMENT ON COLUMN program_intake.students_enrolled IS 'Students Enrolled';
COMMENT ON COLUMN program_intake.seats_filled IS 'Seats Filled';
COMMENT ON COLUMN program_intake.programme_status IS 'Programme Status (Active / Discontinued / Proposed)';
INSERT INTO record_types VALUES (25,'Faculty Citation and h-index Details');
CREATE TABLE faculty_citations (
  record_id uuid PRIMARY KEY,
  type_id smallint GENERATED ALWAYS AS (25) STORED,
  faculty_name text,
  source text CHECK (source IN ('Scopus', 'Web of Science', 'Google Scholar')),
  author_profile_id_link text,
  total_publications integer CHECK (total_publications >= 0),
  total_citations integer CHECK (total_citations >= 0),
  h_index integer CHECK (h_index >= 0),
  i10_index integer CHECK (i10_index >= 0),
  as_on_date date,
  FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE
);
COMMENT ON COLUMN faculty_citations.faculty_name IS 'Faculty Name';
COMMENT ON COLUMN faculty_citations.source IS 'Source (Scopus / Web of Science / Google Scholar)';
COMMENT ON COLUMN faculty_citations.author_profile_id_link IS 'Author Profile ID / Link';
COMMENT ON COLUMN faculty_citations.total_publications IS 'Total Publications';
COMMENT ON COLUMN faculty_citations.total_citations IS 'Total Citations';
COMMENT ON COLUMN faculty_citations.h_index IS 'h-index';
COMMENT ON COLUMN faculty_citations.i10_index IS 'i10-index';
COMMENT ON COLUMN faculty_citations.as_on_date IS 'As-on Date';
ALTER TABLE users ADD FOREIGN KEY(faculty_profile_id) REFERENCES faculty_profiles(record_id);
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
REVOKE ALL ON ALL TABLES IN SCHEMA accreditation FROM PUBLIC;
COMMIT;
