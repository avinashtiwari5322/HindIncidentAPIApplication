const express = require("express");
const router = express.Router();

// Import controllers
const { getUsers } = require("./adminController"); // ✅ Change to correct controller
const { createIncidentReport } = require("./incidentController"); // ✅ Correct path

// Routes
router.get("/", getUsers); // Optional test route
router.post("/incident-report", createIncidentReport); // Your working POST route

module.exports = router;
