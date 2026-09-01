-- On new auth.users row: create matching profiles + credits(balance=0) rows.
-- Runs as SECURITY DEFINER so it always succeeds regardless of the caller's RLS grants
-- (the caller here is Supabase Auth itself, not application code).

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',
    new.email,
    new.phone
  );

  insert into public.credits (user_id, balance)
  values (new.id, 0);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
