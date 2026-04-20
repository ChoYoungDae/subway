const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSchema() {
  const { data, error } = await supabase
    .from('elevators')
    .select('*')
    .limit(10);
    
  if (error) {
    console.error('Error fetching data:', error);
    return;
  }
  
  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log('Columns:', columns);
    
    // Check how many nulls in a sample of 1000
    const { data: sampleData, error: sampleError } = await supabase.from('elevators').select('*').limit(1000);
    if (sampleError) {
      console.error('Error fetching sample data:', sampleError);
      return;
    }

    const stats = {};
    columns.forEach(col => stats[col] = { populated: 0, nullOrEmpty: 0 });
    
    sampleData.forEach(row => {
      columns.forEach(col => {
        if (row[col] !== null && row[col] !== '') {
          stats[col].populated++;
        } else {
          stats[col].nullOrEmpty++;
        }
      });
    });
    
    console.log('\nColumn Population Stats (out of ' + sampleData.length + ' rows):');
    console.table(stats);
  } else {
    console.log('No data found in the elevators table.');
  }
}

checkSchema();
