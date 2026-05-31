const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");
const {
    listTeachers,
    updateTeacherStatus,
    listUsers,
    updateUserStatus
} = require("../controllers/admin.controller");

router.get("/teachers", auth, authorizeRoles("admin"), listTeachers);
router.patch("/teachers/:id/status", auth, authorizeRoles("admin"), updateTeacherStatus);
router.get("/users", auth, authorizeRoles("admin"), listUsers);
router.patch("/users/:id/status", auth, authorizeRoles("admin"), updateUserStatus);

module.exports = router;
