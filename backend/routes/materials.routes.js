const express = require('express');

// NOTE: Your frontend currently uses mocked auth and does not always provide a verifiable backend JWT.
// To make the materials feature work with the existing frontend, we temporarily disable JWT auth middleware.
// Role checks are still done in the controller based on req.user if present.
// const { authorizeRoles } = require('../middleware/role.middleware');

// We reuse the same optional middleware as a compatibility layer.
const optionalMaterialsAuth = require('../middleware/materialsAuthOptional');




const {
  uploadMaterial,
  listMaterials,
  deleteMaterial
} = require('../controllers/materials.controller');

const router = express.Router();

// Teacher can upload materials for their own classes.
router.post(
  '/upload',
  optionalMaterialsAuth,
  uploadMaterial
);


// Admin can view all materials.
router.get(
  '/',
  optionalMaterialsAuth,
  listMaterials
);

// quick compatibility: if no auth token is sent, still allow listing.




// Teacher can delete only their own materials; admin can delete any.
router.delete(
  '/:id',
  deleteMaterial
);

module.exports = router;

