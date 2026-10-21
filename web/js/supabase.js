import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://reahrymrstohysmriyvk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jrVdr5OlR8fVmLRhdndTMA_orVrl14F';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);


