ALTER TABLE tpa.staff_roles DROP CONSTRAINT staff_roles_role_check;
ALTER TABLE tpa.staff_roles ADD CONSTRAINT staff_roles_role_check CHECK (
  role IN (
    'super_administrator', 'administrator', 'membership_reviewer', 'content_editor',
    'event_operator', 'communications_operator', 'finance_operator', 'finance_approver'
  )
);
