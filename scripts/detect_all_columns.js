const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkFullSchema() {
  // Try to use a raw query via rpc if available, or just fetch one row and list all keys
  // Since I don't know if there's an rpc for schema, I'll fetch 100 rows to be safe and merge keys
  const { data, error } = await supabase.from('elevators').select('*').limit(100);
  
  if (error) {
    console.error(error);
    return;
  }
  
  const allKeys = new Set();
  data.forEach(row => {
    Object.keys(row).forEach(k => allKeys.add(k));
  });
  
  console.log('Detected Columns:', Array.from(allKeys));
}

checkFullSchema();
