
ALTER FUNCTION public.handle_new_auth_user() SET search_path = public;
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.current_business_id() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.has_business_access(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_business_owner(uuid) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_business_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_business_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_owner(uuid) TO authenticated;
