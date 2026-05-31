const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth.middleware");
const {
    getProfile,
    updateProfile
} = require("../controllers/user.controller");

router.get("/me", auth, getProfile);
router.patch("/me", auth, updateProfile);

module.exports = router;
