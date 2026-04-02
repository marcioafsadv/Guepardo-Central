import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const supabaseUrl = 'https://eviukbluwrwcblwhkzwz.supabase.co'
const supabaseKey = 'sb_publishable_5FFYs0bPMCjQZTawObPk2A_lK5jmGJY' // Using anon key for probe
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkColumns() {
  const { data, error } = await supabase.from('stores').select('*').limit(1)
  if (error) {
    console.error('Error fetching stores:', error.message)
    return
  }
  if (data && data.length > 0) {
    console.log('Columns in stores:', Object.keys(data[0]))
  } else {
    console.log('No data in stores table to check columns.')
  }
}

checkColumns()
