import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envCode = fs.readFileSync('.env.local', 'utf-8');
const envUrl = envCode.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const envKey = envCode.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const sb = createClient(envUrl, envKey);

(async () => {
    const res = await sb.from('tournaments').select('*').limit(1);
    console.log(res);

    if (process.argv.includes('--add-col')) {
        // Not easily doable using client API to alter columns without executing an SQL query, 
        // which requires RPC or Postgres functions. 
        // We will just use an RPC if one exists or the user can run it.
    }
})();
