import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://eviukbluwrwcblwhkzwz.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function check() {
  const { data, error } = await supabase.rpc('get_table_info', { table_name: 'withdrawal_requests' })
  if (error) {
    // If RPC doesn't exist, try a direct query to information_schema
    const { data: cols, error: colError } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .limit(1)
    
    console.log('Sample Data:', cols)
    console.log('Error if any:', colError)
  } else {
    console.log('Table Info:', data)
  }
}

check()
