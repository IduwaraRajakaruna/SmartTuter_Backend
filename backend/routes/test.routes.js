const express = require('express');
const route = express.Router();

const { healthCheck } = require('../controllers/test.controller');

route.get('/test', healthCheck);

module.exports = route;