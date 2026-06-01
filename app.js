const express = require('express');
const cors = require('cors');

// register routes
const testRoutes = require('./backend/routes/test.routes');
const authRoutes = require("./backend/routes/auth.routes");
const adminRoutes = require("./backend/routes/admin.routes");
const userRoutes = require("./backend/routes/user.routes");
const materialsRoutes = require('./backend/routes/materials.routes');
const teachersRoutes = require('./backend/routes/teachers.routes');
const reviewsRoutes = require('./backend/routes/reviews.routes');
const classesRoutes = require('./backend/routes/classes.routes');
const path = require('path');


const app = express();


app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use('/api', testRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/classes', classesRoutes);

// Serve uploaded materials so the frontend can open View links.
const uploadsMaterialsPath = path.join(__dirname, 'uploads', 'materials');
app.use('/uploads/materials', express.static(uploadsMaterialsPath));


module.exports = app;

