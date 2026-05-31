const express = require("express");

const router = express.Router();

const {
  listActiveTeachers,
  getTeacherPublicProfile,
} = require("../controllers/teachers.controller");

// Public (no auth)
router.get("/active", listActiveTeachers);
router.get("/:teacherId", getTeacherPublicProfile);

module.exports = router;

