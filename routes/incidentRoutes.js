// GET incident details for assign user by IncidentID
// GET incidents by assignuserid (ResponsibleId)
const express = require("express");
const router = express.Router();
const incidentController = require("../controller/incidentController");
const loginController = require("../controller/loginController");

// Save IncidentActions
router.post("/incident-actions", incidentController.saveIncidentActions);
router.get("/incident/assign-user/details", incidentController.getIncidentByIdForAssignUser);

router.get("/incidents/assign-user", incidentController.getIncidentsByAssignUserId);
// Existing GET API
router.get("/incidents", incidentController.getAllIncidents);
router.get("/incident/:id", incidentController.getIncidentById);

// GET all users with roleid=3
router.get("/users/role3", incidentController.getAllUsersWithRole3);

// ✅ New POST API for creating an incident
router.post("/incidents", incidentController.createIncident);

router.put('/incident/:id', incidentController.updateTrainingInfo);
router.post("/login", loginController.loginUser);

module.exports = router;
