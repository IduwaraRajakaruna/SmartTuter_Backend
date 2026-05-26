const express = require('express');
const cors = require('cors');

const testRoutes = require('./backend/routes/test.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use('/api', testRoutes);

module.exports = app;