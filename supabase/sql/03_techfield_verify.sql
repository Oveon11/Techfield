select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'users',
    'clients',
    'client_contacts',
    'sites',
    'technicians',
    'projects',
    'project_assignments',
    'maintenance_contracts',
    'interventions',
    'technician_availability',
    'documents',
    'activity_logs'
  )
order by table_name;

select typname
from pg_type
where typnamespace = 'public'::regnamespace
  and typname in (
    'user_role',
    'user_status',
    'customer_type',
    'contact_type',
    'service_type',
    'project_status',
    'contract_status',
    'contract_frequency',
    'intervention_type',
    'intervention_priority',
    'intervention_status',
    'assignment_role',
    'availability_type',
    'document_type',
    'document_visibility',
    'entity_type'
  )
order by typname;

select id, name, public, file_size_limit
from storage.buckets
where id = 'techfield-documents';
