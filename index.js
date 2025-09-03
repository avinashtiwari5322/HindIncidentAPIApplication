const express = require('express');
const app = express();
const incidentRoutes = require('./routes/incidentRoutes');
const path = require('path');
const cors = require('cors');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File access
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api', incidentRoutes);

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
