begin;
insert into public.projects (slug,title_fa,title_en,description_fa,description_en,tech_stack,featured,published,published_at,sort_order)
values ('fatemeh-personal-landing','لندینگ شخصی فاطمه صداقت','Fatemeh Sedaghat Personal Landing','وب‌سایت شخصی دو‌زبانه برای معرفی تجربه، مهارت‌ها، پروژه‌ها و مسیر حرفه‌ای.','A bilingual personal website for presenting experience, skills, projects, and professional background.',array['HTML','CSS','JavaScript','Supabase'],true,true,now(),10)
on conflict (slug) do nothing;
commit;
