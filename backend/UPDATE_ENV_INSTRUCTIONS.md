# Backend .env Update Required

Your backend is trying to insert events into Supabase but failing with "TypeError: fetch failed". 
This is because the backend .env file still has your OLD Supabase credentials.

## Update Backend .env

Edit `/home/lezoapp/projects/lezoradio/backend/.env` and update these lines:

```bash
# OLD (remove these)
SUPABASE_URL=https://jfvebplkqeorghwcwxnx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdmVicGxrcWVvcmdod2N3eG54Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTU2OTE2NywiZXhwIjoyMDk1MTQ1MTY3fQ.XsyXczVqizlHMlviffwh6v4qUo-vqb3uY2EK3qCbmo8

# NEW (use these)
SUPABASE_URL=https://ohvdxujnzsgagdbzuhsy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odmR4dWpuenNnYWdkYnp1aHN5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY2MTMyMSwiZXhwIjoyMTAwMjM3MzIxfQ.qN5ffTWavu38sMEejR_2prB6VLy8GJZSYdU99-FmPSU
```

## Also Enable Provider Framework

Make sure these are set in backend .env:

```bash
USE_PROVIDER_FRAMEWORK=true
LEZOTRAFFIC_ENABLED=true
```

## After Updating

1. Stop the backend (Ctrl+C if running)
2. Restart the backend:
   ```bash
   cd /home/lezoapp/projects/lezoradio/backend
   npm run dev
   ```

The errors should stop and LezoTraffic data should successfully insert into your new Supabase database.
