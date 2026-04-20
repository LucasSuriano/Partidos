import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envCode = fs.readFileSync('.env.local', 'utf-8');
const envUrl = envCode.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1].trim();
const envKey = envCode.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1].trim();

const sb = createClient(envUrl, envKey);

(async () => {
    const { data } = await sb.from('tournaments').select('*, type:tournament_types(*)');
    console.log(JSON.stringify(data, null, 2));
})();
