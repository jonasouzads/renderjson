const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
