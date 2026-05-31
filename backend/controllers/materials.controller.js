const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Ownership: frontend currently stores classes in localStorage, so we cannot reliably look up class ownership here.
// Enforce ownership by trusting authenticated teacher id.
// (Admin can view/delete all.)


const MATERIALS_DIR = path.join(__dirname, '..', '..', 'uploads', 'materials');
const METADATA_PATH = path.join(MATERIALS_DIR, 'metadata.json');

function ensureMaterialsStorage() {
  if (!fs.existsSync(MATERIALS_DIR)) fs.mkdirSync(MATERIALS_DIR, { recursive: true });
  if (!fs.existsSync(METADATA_PATH)) fs.writeFileSync(METADATA_PATH, JSON.stringify({ items: [] }, null, 2));
}

function readMetadata() {
  ensureMaterialsStorage();
  try {
    const raw = fs.readFileSync(METADATA_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function writeMetadata(items) {
  ensureMaterialsStorage();
  fs.writeFileSync(METADATA_PATH, JSON.stringify({ items }, null, 2));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return undefined;
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)} MB`;
}

// Multer stores file in MATERIALS_DIR with a temporary name.
// We'll rename to <materialId>-<originalName> after we know the generated materialId.
const upload = multer({
  dest: MATERIALS_DIR,
  limits: { fileSize: 200 * 1024 * 1024 }
});

const allowedTypes = new Set(['pdf', 'video']);

function getPublicUrl(req, filename) {
  // Backend static route will expose /uploads/materials/<filename>
  return `${req.protocol}://${req.get('host')}/uploads/materials/${encodeURIComponent(filename)}`;
}

exports.uploadMaterial = [
  upload.single('file'),
  async (req, res) => {
    try {
      const { classId, title, type, url } = req.body;

      if (!classId || !title || !type) {
        return res.status(400).json({ message: 'classId, title and type are required' });
      }

      if (!['pdf', 'video', 'link'].includes(type)) {
        return res.status(400).json({ message: 'Invalid type' });
      }

      const teacherId = req.user?.id;
      // Ownership rule: teacher can upload for their own materials.
      // Since classes are not persisted on backend DB in this project, we attach uploaderTeacherId and enforce delete/list by that.


      const materialId = `m-${uuidv4()}`;
      const uploadedDate = new Date().toISOString().split('T')[0];

      const metadataItems = readMetadata();

      if (type === 'link') {
        if (!url) return res.status(400).json({ message: 'url is required for link type' });

        const newItem = {
          id: materialId,
          classId,
          title,
          type,
          url: url,
          uploadedDate,
          uploaderTeacherId: teacherId
        };


        writeMetadata([newItem, ...metadataItems]);
        return res.status(201).json({ success: true, material: newItem });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'file is required for pdf/video types' });
      }

      if (!allowedTypes.has(type)) {
        return res.status(400).json({ message: 'Invalid type' });
      }

      const originalName = req.file.originalname || 'resource';
      const safeOriginalName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const finalFilename = `${materialId}-${safeOriginalName}`;

      // Rename multer temp file
      const tempPath = req.file.path;
      const finalPath = path.join(MATERIALS_DIR, finalFilename);
      fs.renameSync(tempPath, finalPath);

      const publicUrl = getPublicUrl(req, finalFilename);

      const newItem = {
        id: materialId,
        classId,
        title,
        type,
        url: publicUrl,
        uploadedDate,
        size: formatBytes(req.file.size),
        uploaderTeacherId: teacherId
      };


      writeMetadata([newItem, ...metadataItems]);

      return res.status(201).json({ success: true, material: newItem });
    } catch (e) {
      return res.status(500).json({ message: e.message || 'Upload failed' });
    }
  }
];

exports.listMaterials = async (req, res) => {
  try {
    const items = readMetadata();

    // Teacher: only their own class materials
    if (req.user?.role === 'teacher') {
      // Frontend stores classes in localStorage, so backend cannot reliably resolve class ownership.
      // Ownership rule: teacher sees only materials they uploaded.
      // Enforced by stored uploaderTeacherId.
      const teacherId = req.user?.id;
      const filtered = items.filter((item) => item.uploaderTeacherId === teacherId);
      return res.status(200).json({ success: true, materials: filtered });


    }

    return res.status(200).json({ success: true, materials: items });
  } catch (e) {
    return res.status(500).json({ message: e.message || 'Failed to list materials' });
  }
};

exports.deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const items = readMetadata();

    const material = items.find((m) => m.id === id);
    if (!material) return res.status(404).json({ message: 'Material not found' });

    const actorRole = req.user?.role;
    const actorTeacherId = req.user?.id;

    if (actorRole === 'teacher') {
      if (material.uploaderTeacherId !== actorTeacherId) {
        return res.status(403).json({ message: 'You can delete only your own materials' });
      }
    }


    // Delete file if pdf/video
    if (material.type === 'pdf' || material.type === 'video') {
      // filename is <materialId>-<original>
      const files = fs.readdirSync(MATERIALS_DIR);
      const match = files.find((f) => f.startsWith(`${material.id}-`));
      if (match) {
        fs.unlinkSync(path.join(MATERIALS_DIR, match));
      }
    }

    const updated = items.filter((m) => m.id !== id);
    writeMetadata(updated);

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ message: e.message || 'Delete failed' });
  }
};

