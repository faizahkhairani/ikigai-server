import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { IMAGE_EXTENSIONS } from '../utils/imageTypes.js';

dotenv.config();

// Pakai service_role key (bukan anon key): Express jadi satu-satunya gatekeeper
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PROOF_BUCKET = 'proof-images'; // public: foto bukti admin, boleh dibuka customer di tracking
const RESI_BUCKET = 'resi-images'; // private: foto resi customer, cuma admin lewat link sementara
const SIGNED_URL_TTL_SECONDS = 60 * 60; // link sementara berlaku 1 jam

const PROOF_PUBLIC_MARKER = `/object/public/${PROOF_BUCKET}/`;

// Upload ke bucket tertentu dengan nama acak. Balikin path file di dalam bucket.
const uploadToBucket = async ({ bucket, buffer, mimeType }) => {
  const extension = IMAGE_EXTENSIONS[mimeType];
  if (!extension) throw new Error(`Tipe file tidak didukung: ${mimeType}`);

  const path = `${randomUUID()}.${extension}`;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, { contentType: mimeType });
  if (error) throw error;

  return path;
};

// Foto bukti admin (bucket public): balikin URL publik
export const uploadProofImage = async ({ buffer, mimeType }) => {
  const path = await uploadToBucket({ bucket: PROOF_BUCKET, buffer, mimeType });
  const { data } = supabaseAdmin.storage.from(PROOF_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

// Foto resi customer (bucket private): balikin PATH saja, bukan URL
export const uploadResiImage = ({ buffer, mimeType }) =>
  uploadToBucket({ bucket: RESI_BUCKET, buffer, mimeType });

// Bikin link sementara untuk membuka foto resi
export const getResiImageSignedUrl = async (path) => {
  const { data, error } = await supabaseAdmin.storage
    .from(RESI_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) return null; // gagal bikin link: detail order tetap tampil, tanpa foto resi
  return data.signedUrl;
};

// URL publik -> path file di dalam bucket
const pathFromProofUrl = (publicUrl) => {
  const index = publicUrl.indexOf(PROOF_PUBLIC_MARKER);
  if (index === -1) return null;
  return decodeURIComponent(publicUrl.slice(index + PROOF_PUBLIC_MARKER.length));
};

const removeFile = async (bucket, path) => {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
  // Gagal hapus file cuma meninggalkan file yatim: dicatat, tidak menggagalkan aksi admin
  if (error) console.error(`Gagal menghapus file ${bucket}/${path}:`, error.message);
};

export const deleteProofImageFile = async (publicUrl) => {
  const path = pathFromProofUrl(publicUrl);
  if (path) await removeFile(PROOF_BUCKET, path);
};

// value = path di bucket private, atau URL publik lama (dari sebelum bucket private dipakai)
export const deleteResiImageFile = async (value) => {
  if (value.startsWith('http')) return deleteProofImageFile(value);
  return removeFile(RESI_BUCKET, value);
};

export default supabaseAdmin;