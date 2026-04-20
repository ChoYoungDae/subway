
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function revertElevators() {
  console.log('Reverting Incheon Airport T1/T2 Elevators...');

  // Revert T1 (4213)
  const { data: t1Data, error: t1Error } = await supabase
    .from('elevators')
    .update({ exit_no: '내부', is_internal: true })
    .in('id', [1024, 1025]);

  if (t1Error) console.error('T1 Revert Error:', t1Error);
  else console.log('T1 Reverted.');

  // Revert T2 (4215)
  const { data: t2Data, error: t2Error } = await supabase
    .from('elevators')
    .update({ exit_no: '내부', is_internal: true })
    .in('id', [1028, 1029, 1030, 1031, 1032, 1033]);

  if (t2Error) console.error('T2 Revert Error:', t2Error);
  else console.log('T2 Reverted.');
}

revertElevators();
