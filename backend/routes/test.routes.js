const express = require('express');
const router = express.Router();

const { healthCheck } = require('../controllers/test.controller');

router.get('/test', healthCheck);

const authMiddleware =
require("../middleware/auth.middleware");

const {
    authorizeRoles
} = require("../middleware/role.middleware");

router.get(
    "/admin",
    authMiddleware,
    authorizeRoles("admin"),
    (req,res)=>{
        res.json({
            message:"Admin Route"
        });
    }
);

router.get(
    "/teacher",
    authMiddleware,
    authorizeRoles("teacher"),
    (req,res)=>{
        res.json({
            message:"Teacher Route"
        });
    }
);

router.get(
    "/student",
    authMiddleware,
    authorizeRoles("student"),
    (req,res)=>{
        res.json({
            message:"Student Route"
        });
    }
);

module.exports = router;