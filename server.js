require('dotenv').config();
const app = require('./app');
const connectDB  = require('./backend/config/db.config');

const PORT = process.env.PORT || 8000;

connectDB();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});