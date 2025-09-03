const express = require("express");
const router = express.Router();
const { createIncidentReport } = require('./incidentController');


router.post("/incident-reports", createIncidentReport);

module.exports = router;
