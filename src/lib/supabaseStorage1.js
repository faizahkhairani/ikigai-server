import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Pakai service_role key (bukan anon key) — Express jadi satu-satunya gatekeeper,
// jadi boleh bypass Row Level Security di sisi Storage juga.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PROOF_IMAGES_BUCKET = 'proof-images';

// Upload buffer foto (dari multer) ke Supabase Storage, return public URL
export const uploadProofImage = async (fileBuffer, fileName, mimeType) => {
  const path = `${Date.now()}-${fileName}`;

  const { error } = await supabaseAdmin.storage
    .from(PROOF_IMAGES_BUCKET)
    .upload(path, fileBuffer, { contentType: mimeType });

  if (error) throw error;

  const { data } = supabaseAdmin.storage.from(PROOF_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

export default supabaseAdmin;
