import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createMerchantBucket() {
    // Try to create bucket
    const { data, error } = await supabase.storage.createBucket('merchant-documents', {
        public: true,
        fileSizeLimit: 20971520, // 20 MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
    });

    if (error) {
        if (error.message?.includes('already exists') || error.message?.includes('Duplicate')) {
            console.log('✅ Bucket "merchant-documents" já existe.');
        } else {
            console.error('❌ Erro ao criar bucket:', error.message);
            console.log('\n⚠️  Execute o SQL abaixo no Supabase Dashboard (SQL Editor):');
            console.log(`
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'merchant-documents',
  'merchant-documents',
  true,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;
            `);
        }
        return;
    }

    console.log('✅ Bucket "merchant-documents" criado com sucesso!', data);
}

createMerchantBucket();
