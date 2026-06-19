SELECT COUNT(1) AS contacts_count FROM contacts;
SELECT id, COALESCE(NULLIF(display_name,''), first_name) AS name, email FROM contacts ORDER BY created_at DESC LIMIT 5;
