begin;

alter table public.inventory
  add column if not exists chassis_no text;

update public.inventory
set chassis_no = upper(regexp_replace(trim(marketing_label), '\s+', '', 'g'))
where (chassis_no is null or trim(chassis_no) = '')
  and marketing_label is not null
  and trim(marketing_label) <> ''
  and marketing_label ~ '[A-Za-z]'
  and marketing_label ~ '[0-9]';

update public.inventory
set chassis_no = upper(regexp_replace(trim(chassis_no), '\s+', '', 'g'))
where chassis_no is not null
  and trim(chassis_no) <> '';

update public.inventory
set marketing_label = ''
where marketing_label is not null
  and upper(regexp_replace(trim(marketing_label), '\s+', '', 'g')) = chassis_no;

create unique index if not exists inventory_chassis_no_unique
  on public.inventory ((upper(regexp_replace(chassis_no, '\s+', '', 'g'))))
  where chassis_no is not null and trim(chassis_no) <> '';

create index if not exists inventory_chassis_no_search
  on public.inventory (chassis_no);

commit;

select
  count(*) as total_inventory,
  count(*) filter (where chassis_no is not null and trim(chassis_no) <> '') as with_chassis,
  count(*) filter (where chassis_no is null or trim(chassis_no) = '') as missing_chassis,
  count(*) filter (where chassis_no is not null and trim(chassis_no) <> '')
    - count(distinct upper(regexp_replace(chassis_no, '\s+', '', 'g')))
      filter (where chassis_no is not null and trim(chassis_no) <> '') as duplicate_chassis
from public.inventory;
