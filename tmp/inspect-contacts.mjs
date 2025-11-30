import { createClient } from '@supabase/supabase-js';

const url = 'https://okzgxhennmjmvcnnzyur.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9remd4aGVubm1qbXZjbm56eXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODA1NjUsImV4cCI6MjA3NTk1NjU2NX0.Sc3ZH9wm_iblGXvKhFS_ZMwwudfvACnLJZh2CyuV4gA';

const client = createClient(url, anonKey);

const { data, error } = await client.from('contacts').select('*').limit(5);
if (error) {
  console.error('error', error);
  process.exit(1);
}
console.log(JSON.stringify(data, null, 2));
