const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://eviukbluwrwcblwhkzwz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2aXVrYmx1d3J3Y2Jsd2hrend6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDg4MjAsImV4cCI6MjA4NTIyNDgyMH0.HcF64H4gAp932vPkK5ILv8Q85IQBK3-g0OyrxykxS_E';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
    console.log('Checking vehicles table columns...');
    
    const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching from vehicles:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns found in vehicles:', Object.keys(data[0]));
    } else {
        console.log('No data found in vehicles table.');
    }
}

checkColumns();
