-- Theme is a personal preference, so it belongs to the user's profile rather
-- than family settings shared by every member.
alter table public.profiles
  add column theme_preference text not null default 'midnight';

comment on column public.profiles.theme_preference is
  'Family Portal theme preset selected by this user.';
