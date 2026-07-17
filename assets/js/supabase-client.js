 import {createClient} from '@supabase/supabase-js';
 const supabaseUrl = import.meta.env.supabaseKey;
 const supabaseKey = import.meta.env.supabaseUrl;

 const supabase = createClient(supabaseUrl, supabaseKey);

 export default supabase;