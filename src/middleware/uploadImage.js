import multer from 'multer';
import { ALLOWED_MIME_TYPES, detectImageMime } from '../utils/imageTypes.js';

const MAX_SIZE_MB = 5;
const FORMAT_ERROR = 'Foto harus berformat JPG, PNG, atau WebP';

// File ditahan di memori (gak disimpan ke disk), langsung diteruskan ke Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  // Saringan awal berdasarkan klaim client, supaya file jelas salah tidak sempat dibaca
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new Error(FORMAT_ERROR));
  },
});

export const uploadSingleImage = (req, res, next) =>
  upload.single('image')(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? `Ukuran foto maksimal ${MAX_SIZE_MB}MB` : err.message;
      return res.status(400).json({ error: message });
    }

    // Pemeriksaan sungguhan: baca isi file
    if (req.file) {
      const realMime = detectImageMime(req.file.buffer);
      if (!realMime) return res.status(400).json({ error: FORMAT_ERROR });
      req.file.mimetype = realMime; // pakai hasil deteksi, bukan klaim client
    }

    return next();
  });