const express = require('express');
const cors = require('cors');

// register routes
const testRoutes = require('./backend/routes/test.routes');
const authRoutes = require("./backend/routes/auth.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use('/api', testRoutes);
app.use('/api/auth', authRoutes);

module.exports = app;