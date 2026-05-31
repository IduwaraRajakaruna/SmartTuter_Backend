/**
 * In this project, classes are currently stored in the frontend's localStorage (no DB models exist for classes).
 * To enforce "teacher can upload/delete only their own classes", we need to know the class owner.
 *
 * For now we keep a lightweight server-side map that teachers populate when uploading.
 * uploadMaterial will still validate ownership against this map.
 *
 * NOTE: The teacher-materials page already knows class teacherId through localStorage,
 * but we don't have that info in backend requests. So we rely on a request-time cache.
 */

const fs = require('fs');
const path = require('path');

const OWNER_PATH = path.join(__dirname, '..', '..', 'uploads', 'materials', 'classOwners.json');

function ensure() {
  const dir = path.dirname(OWNER_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(OWNER_PATH)) fs.writeFileSync(OWNER_PATH, JSON.stringify({ owners: {} }, null, 2));
}

function readOwners() {
  ensure();
  try {
    const raw = fs.readFileSync(OWNER_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.owners && typeof parsed.owners === 'object' ? parsed.owners : {};
  } catch {
    return {};
  }
}

function writeOwners(owners) {
  ensure();
  fs.writeFileSync(OWNER_PATH, JSON.stringify({ owners }, null, 2));
}

// This helper currently only reads owner from the map.
exports.getClassOwnerTeacherId = async (classId) => {
  if (!classId) return null;
  const owners = readOwners();
  return owners[classId] || null;
};

// Optional helper to set owners (not used by default yet).
exports.setClassOwnerTeacherId = async (classId, teacherId) => {
  if (!classId || !teacherId) return;
  const owners = readOwners();
  owners[classId] = teacherId;
  writeOwners(owners);
};

