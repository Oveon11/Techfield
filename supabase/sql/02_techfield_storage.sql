begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'techfield-documents',
  'techfield-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.documents is 'Métadonnées applicatives des fichiers Techfield stockés dans Supabase Storage.';

commit;
