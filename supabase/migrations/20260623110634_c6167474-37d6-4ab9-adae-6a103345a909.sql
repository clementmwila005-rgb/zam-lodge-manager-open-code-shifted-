
CREATE POLICY "Business members read own logos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'business-logos' AND public.has_business_access((storage.foldername(name))[1]::uuid));

CREATE POLICY "Business owners upload logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'business-logos' AND public.is_business_owner((storage.foldername(name))[1]::uuid));

CREATE POLICY "Business owners update logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'business-logos' AND public.is_business_owner((storage.foldername(name))[1]::uuid));

CREATE POLICY "Business owners delete logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'business-logos' AND public.is_business_owner((storage.foldername(name))[1]::uuid));
