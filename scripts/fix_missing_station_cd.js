const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function fixMissingStationCd() {
  console.log('Fetching elevators with missing station_cd...');
  const { data: missingElevators, error: fetchError } = await supabase
    .from('elevators')
    .select('id, station_name_ko, line')
    .is('station_cd', null);

  if (fetchError) {
    console.error('Error fetching missing elevators:', fetchError);
    return;
  }

  console.log(`Found ${missingElevators.length} records missing station_cd.`);

  if (missingElevators.length === 0) return;

  // Fetch all stations to build a lookup map
  const { data: stations, error: stationsError } = await supabase
    .from('stations')
    .select('name_ko, line, station_cd');

  if (stationsError) {
    console.error('Error fetching stations:', stationsError);
    return;
  }

  // Build a map for quick lookup: "normalized_name|normalized_line" -> station_cd
  const stationMap = new Map();
  stations.forEach(s => {
    const normName = s.name_ko.replace(/역$/, '');
    const normLine = s.line.replace('호선', '').replace('선', '');
    
    // Multiple ways to match
    stationMap.set(`${normName}|${normLine}`, s.station_cd);
    stationMap.set(`${s.name_ko}|${s.line}`, s.station_cd);
  });

  let fixedCount = 0;
  for (const elevator of missingElevators) {
    const normElevName = elevator.station_name_ko.replace(/역$/, '');
    const normElevLine = elevator.line.replace('호선', '').replace('선', '');
    
    const key = `${normElevName}|${normElevLine}`;
    const stationCd = stationMap.get(key);
    
    if (stationCd) {
      const { error: updateError } = await supabase
        .from('elevators')
        .update({ station_cd: stationCd })
        .eq('id', elevator.id);
        
      if (updateError) {
        console.error(`Error updating id ${elevator.id}:`, updateError);
      } else {
        fixedCount++;
      }
    } else {
      console.warn(`Could not find station matching: ${elevator.station_name_ko} (${elevator.line}) -> Key: ${key}`);
    }
  }

  console.log(`Fixed ${fixedCount} out of ${missingElevators.length} records.`);
}

fixMissingStationCd();
