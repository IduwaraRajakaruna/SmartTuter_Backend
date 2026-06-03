const express = require('express');

const router = express.Router();

const auth = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const {
    getAllClasses,
    getClassById,
    createClass,
    updateClass,
    deleteClass,
} = require('../controllers/classes.controller');

router.get('/', getAllClasses);
router.get('/:id', getClassById);
router.post('/', auth, authorizeRoles('admin', 'teacher'), createClass);
router.put('/:id', auth, authorizeRoles('admin', 'teacher'), updateClass);
router.delete('/:id', auth, authorizeRoles('admin', 'teacher'), deleteClass);

module.exports = router;