import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://odtizgnxgwjsmeqiojip.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable__s5GtWlGKp5i3Olr3DO69g_G4IoNK9l";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
