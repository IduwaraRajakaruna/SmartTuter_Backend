const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");
const {
    listTeachers,
    updateTeacherStatus
} = require("../controllers/admin.controller");

router.get("/teachers", auth, authorizeRoles("admin"), listTeachers);
router.patch("/teachers/:id/status", auth, authorizeRoles("admin"), updateTeacherStatus);

module.exports = router;
