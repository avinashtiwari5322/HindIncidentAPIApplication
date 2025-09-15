exports.getIncidentAssignFileByPermitId = async (req, res) => {
  try {
    const { permitId } = req.params;
    if (!permitId) {
      return res.status(400).json({ message: 'permitId (FileID) is required.' });
    }
    const pool = await poolPromise;
    const result = await pool.request()
      .input('IncidentID', sql.Int, permitId)
      .query('SELECT FileName, ContentType, FileData FROM IncidentAssignFiles WHERE IncidentID = @IncidentID');
    if (!result.recordset.length) {
      return res.status(404).json({ message: 'File not found.' });
    }
    const file = result.recordset[0];
    res.setHeader('Content-Disposition', `attachment; filename="${file.FileName}"`);
    res.setHeader('Content-Type', file.ContentType || 'application/octet-stream');
    res.send(file.FileData);
  } catch (err) {
    console.error('Error serving file:', err);
    res.status(500).json({ message: 'Failed to serve file', error: err.message });
  }
};

// ---
// API: Upload files for an assignment and save in IncidentAssignFiles table
// Payload (multipart/form-data):
//   assignId: <number>
//   files: <file1>, <file2>, ... (attach as form-data fields)
//   uploadedBy: <string> (optional)
//
// Example using Postman:
//   Key: assignId      Value: 123
//   Key: files         Value: (select multiple files)
//   Key: uploadedBy    Value: "username" (optional)
// ---
exports.uploadAssignFiles = async (req, res) => {
  try {
    const { incidentId, uploadedBy } = req.body;
    if (!incidentId || !req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'incidentId and at least one file are required.' });
    }
    const pool = await poolPromise;
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      await pool.request()
        .input('IncidentID', sql.Int, incidentId)
        .input('FileName', sql.NVarChar(255), file.originalname)
        .input('ContentType', sql.NVarChar(100), file.mimetype)
        .input('FileSize', sql.Int, file.size)
        .input('FileData', sql.VarBinary(sql.MAX), file.buffer)
        .input('UploadedOn', sql.DateTime, new Date())
        .input('UploadedBy', sql.NVarChar(100), uploadedBy || null)
        .query(`
          INSERT INTO IncidentAssignFiles (IncidentID, FileName, ContentType, FileSize, FileData, UploadedOn, UploadedBy)
          VALUES (@IncidentID, @FileName, @ContentType, @FileSize, @FileData, @UploadedOn, @UploadedBy)
        `);
    }
    res.status(201).json({ message: 'Files uploaded and saved to IncidentAssignFiles table.' });
  } catch (err) {
    console.error('Error uploading assign files:', err);
    res.status(500).json({ message: 'Failed to upload assign files', error: err.message });
  }
};
// GET: Serve a file by FileID (PermitID)
// Usage: GET /api/incident/file/:permitId
exports.getIncidentFileByPermitId = async (req, res) => {
  try {
    const { permitId } = req.params;
    if (!permitId) {
      return res.status(400).json({ message: 'permitId (FileID) is required.' });
    }
    const pool = await poolPromise;
    const result = await pool.request()
      .input('IncidentID', sql.Int, permitId)
      .query('SELECT FileName, ContentType, FileData FROM IncidentFiles WHERE IncidentID = @IncidentID');
    if (!result.recordset.length) {
      return res.status(404).json({ message: 'File not found.' });
    }
    const file = result.recordset[0];
    res.setHeader('Content-Disposition', `attachment; filename="${file.FileName}"`);
    res.setHeader('Content-Type', file.ContentType || 'application/octet-stream');
    res.send(file.FileData);
  } catch (err) {
    console.error('Error serving file:', err);
    res.status(500).json({ message: 'Failed to serve file', error: err.message });
  }
};
// ---
// API: Upload files for an incident and save in IncidentFiles table
// Payload (multipart/form-data):
//   incidentId: <number>
//   files: <file1>, <file2>, ... (attach as form-data fields)
//   fileDescriptions: ["desc1", "desc2", ...] (optional, as JSON string)
//
// Example using Postman:
//   Key: incidentId      Value: 123
//   Key: files           Value: (select multiple files)
//   Key: fileDescriptions Value: ["CCTV footage", "Witness statement"]
// ---

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // Store files in memory for DB insert

// Express route handler (to be used in routes):
// router.post('/incident/upload-files', upload.array('files'), incidentController.uploadIncidentFiles)
exports.uploadIncidentFiles = async (req, res) => {
  try {
    const { incidentId } = req.body;
    // Accept optional uploadedBy from body
    const { uploadedBy } = req.body;
    if (!incidentId || !req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'incidentId and at least one file are required.' });
    }
    const pool = await poolPromise;
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      await pool.request()
        .input('IncidentID', sql.Int, incidentId)
        .input('FileName', sql.NVarChar(255), file.originalname)
        .input('ContentType', sql.NVarChar(100), file.mimetype)
        .input('FileSize', sql.Int, file.size)
        .input('FileData', sql.VarBinary(sql.MAX), file.buffer)
        .input('UploadedOn', sql.DateTime, new Date())
        .input('UploadedBy', sql.NVarChar(100), uploadedBy || null)
        .query(`
          INSERT INTO IncidentFiles (IncidentID, FileName, ContentType, FileSize, FileData, UploadedOn, UploadedBy)
          VALUES (@IncidentID, @FileName, @ContentType, @FileSize, @FileData, @UploadedOn, @UploadedBy)
        `);
    }
    res.status(201).json({ message: 'Files uploaded and saved to IncidentFiles table.' });
  } catch (err) {
    console.error('Error uploading incident files:', err);
    res.status(500).json({ message: 'Failed to upload files', error: err.message });
  }
};
// GET: Incident details for assign user by IncidentID (join IncidentReports, IncidentActions, IncidentAssign)
exports.getIncidentByIdForAssignUser = async (req, res) => {
  try {
    const { incidentId } = req.query;
    if (!incidentId) {
      return res.status(400).json({ message: 'incidentId is required' });
    }
    const pool = await poolPromise;
    // Get IncidentReports and IncidentActions (single row)
    const mainResult = await pool.request()
      .input('incidentId', sql.Int, incidentId)
      .query(`
        SELECT
          ir.IncidentID, ir.IncidentDate, ir.IncidentTime, ir.Location, ir.WeatherCondition,
          ir.HTPLShiftInCharge, ir.ContractorSupervisor, ir.IncidentReportedBy, ir.ReportPreparedBy,
          ir.IncidentTitle, ir.IncidentSummary, ir.TypeInjury, ir.CountInjury, ir.TypePropertyDamage,
          ir.CountPropertyDamage, ir.TypeFire, ir.CountFire, ir.TypeNearMiss, ir.CountNearMiss,
          ir.TypeEnvironment, ir.CountEnvironment, ir.TypeFatality, ir.CountFatality, ir.TypeOther,
          ir.CountOther, ir.InjuredHTPLEmployees, ir.InjuredContractWorkers, ir.InjuredVisitors, ir.UploadedFiles,
          iact.CftMembers, iact.PastIncident, iact.PastIncidentDetails, iact.IncidentSummary AS ActionsIncidentSummary,
          iact.Chronology, iact.DriverStatement, iact.SupervisorStatement, iact.ManCauses, iact.MachineCauses,
          iact.MotherNatureCauses, iact.ProbableCause, iact.WhyAnalysis, iact.ActualRootCause, iact.CorrectiveAction,
          iact.PreventiveAction
        FROM IncidentReports ir
        LEFT JOIN IncidentActions iact ON ir.IncidentID = iact.IncidentID
        WHERE ir.IncidentID = @incidentId
      `);

    // Get all IncidentAssign rows for this IncidentID
    const actionsResult = await pool.request()
      .input('incidentId', sql.Int, incidentId)
      .query(`
        SELECT Action, Status, DocReff, TargetDate, AttachmentsAssign, AssignUser, ResponsibleId
        FROM IncidentAssign
        WHERE IncidentID = @incidentId
      `);

    // Build response
    if (mainResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Incident not found' });
    }
    const incident = mainResult.recordset[0];
    incident.Actions = actionsResult.recordset;
    res.json(incident);
  } catch (err) {
    console.error('Error fetching incident details for assign user:', err);
    res.status(500).json({ message: 'Failed to fetch incident details', error: err.message });
  }
};
// GET: IncidentReports for a ResponsibleId (assignuserid)
exports.getIncidentsByAssignUserId = async (req, res) => {
  try {
    const { assignUserId } = req.query;
    if (!assignUserId) {
      return res.status(400).json({ message: 'assignuserid is required' });
    }
    const pool = await poolPromise;
    const result = await pool.request()
      .input('assignuserid', sql.NVarChar(50), assignUserId)
      .query(`
        SELECT ir.*
        FROM IncidentReports ir
        INNER JOIN IncidentAssign ia ON ir.IncidentID = ia.IncidentID
        WHERE ia.ResponsibleId = @assignuserid
        ORDER BY ir.IncidentID DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching incidents by assignuserid:', err);
    res.status(500).json({ message: 'Failed to fetch incidents', error: err.message });
  }
};
// POST: Save IncidentActions
exports.saveIncidentActions = async (req, res) => {
  try {
    const {
      id,
      cftMembers,
      pastIncident,
      pastIncidentDetails,
      incidentSummary,
      chronology,
      attachments,
      facts,
      evidence,
      driverStatement,
      supervisorStatement,
      manCauses,
      machineCauses,
      methodCauses,
      motherNatureCauses,
      probableCause,
      whyAnalysis,
      actualRootCause,
      correctiveAction,
      preventiveAction,
      actions,
      preparedBy,
      preparedByUserId,
      attachmentsAssign // new array of objects for IncidentAssign
    } = req.body;

    const pool = await poolPromise;
    // Check for duplicate IncidentActions for this IncidentID
    const duplicateCheck = await pool.request()
      .input('IncidentID', sql.Int, id)
      .query('SELECT IncidentID FROM IncidentActions WHERE IncidentID = @IncidentID');
    if (duplicateCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'IncidentAction already Assigned for this IncidentID.' });
    }

    // Save IncidentActions
    await pool.request()
      .input('IncidentID', sql.Int, id)
      .input('CftMembers', sql.NVarChar(255), cftMembers)
      .input('PastIncident', sql.NVarChar(10), pastIncident)
      .input('PastIncidentDetails', sql.NVarChar(sql.MAX), pastIncidentDetails)
      .input('IncidentSummary', sql.NVarChar(sql.MAX), incidentSummary)
      .input('Chronology', sql.NVarChar(sql.MAX), JSON.stringify(chronology))
      .input('Attachments', sql.NVarChar(sql.MAX), JSON.stringify(attachments))
      .input('Facts', sql.NVarChar(sql.MAX), facts)
      .input('Evidence', sql.NVarChar(sql.MAX), evidence)
      .input('DriverStatement', sql.NVarChar(sql.MAX), driverStatement)
      .input('SupervisorStatement', sql.NVarChar(sql.MAX), supervisorStatement)
      .input('ManCauses', sql.NVarChar(sql.MAX), JSON.stringify(manCauses))
      .input('MachineCauses', sql.NVarChar(sql.MAX), JSON.stringify(machineCauses))
      .input('MethodCauses', sql.NVarChar(sql.MAX), JSON.stringify(methodCauses))
      .input('MotherNatureCauses', sql.NVarChar(sql.MAX), JSON.stringify(motherNatureCauses))
      .input('ProbableCause', sql.NVarChar(sql.MAX), probableCause)
      .input('WhyAnalysis', sql.NVarChar(sql.MAX), JSON.stringify(whyAnalysis))
      .input('ActualRootCause', sql.NVarChar(sql.MAX), actualRootCause)
      .input('CorrectiveAction', sql.NVarChar(sql.MAX), correctiveAction)
      .input('PreventiveAction', sql.NVarChar(sql.MAX), preventiveAction)
      .input('Actions', sql.NVarChar(sql.MAX), JSON.stringify(actions))
      .input('PreparedBy', sql.NVarChar(100), preparedBy)
      .input('PreparedByUserId', sql.NVarChar(50), preparedByUserId)
      .query(`
        INSERT INTO IncidentActions (
          IncidentID, CftMembers, PastIncident, PastIncidentDetails, IncidentSummary,
          Chronology, Attachments, Facts, Evidence, DriverStatement, SupervisorStatement,
          ManCauses, MachineCauses, MethodCauses, MotherNatureCauses, ProbableCause,
          WhyAnalysis, ActualRootCause, CorrectiveAction, PreventiveAction, Actions,
          PreparedBy, PreparedByUserId
        ) VALUES (
          @IncidentID, @CftMembers, @PastIncident, @PastIncidentDetails, @IncidentSummary,
          @Chronology, @Attachments, @Facts, @Evidence, @DriverStatement, @SupervisorStatement,
          @ManCauses, @MachineCauses, @MethodCauses, @MotherNatureCauses, @ProbableCause,
          @WhyAnalysis, @ActualRootCause, @CorrectiveAction, @PreventiveAction, @Actions,
          @PreparedBy, @PreparedByUserId
        )
      `);

    // Save each action in IncidentAssign table
    if (Array.isArray(actions)) {
      for (const act of actions) {
        await pool.request()
          .input('IncidentID', sql.Int, id)
          .input('Action', sql.NVarChar(sql.MAX), act.action || null)
          .input('Status', sql.NVarChar(100), act.status || null)
          .input('AssignUser', sql.NVarChar(100), act.responsibility || null)
          .input('DocReff', sql.NVarChar(100), act.docRef || null)
          .input('TargetDate', sql.Date, act.targetDate || null)
          .input('ResponsibleId', sql.NVarChar(50), act.responsibleId || null)
          .input('AttachmentsAssign', sql.NVarChar(sql.MAX), JSON.stringify(act.attachmentsAssign) || null)
          .input('IsActive', sql.Bit, 1)
          .input('DelMark', sql.Bit, 0)
          .input('CreatedOn', sql.DateTime, new Date())
          .input('CreatedBy', sql.NVarChar(100), preparedBy || null)
          .query(`
            INSERT INTO IncidentAssign (
              IncidentID, Action, Status, AssignUser, DocReff, TargetDate, ResponsibleId,
              AttachmentsAssign, IsActive, DelMark, CreatedOn, CreatedBy
            ) VALUES (
              @IncidentID, @Action, @Status, @AssignUser, @DocReff, @TargetDate, @ResponsibleId,
              @AttachmentsAssign, @IsActive, @DelMark, @CreatedOn, @CreatedBy
            )
          `);
      }
    }
    res.status(201).json({ message: 'IncidentActions and Actions saved successfully' });
  } catch (err) {
    console.error('Error saving IncidentActions:', err);
    res.status(500).json({ message: 'Failed to save IncidentActions', error: err.message });
  }
};
// GET: All users with roleid=3 (UserMaster)
exports.getAllUsersWithRole3 = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`SELECT UserId AS UserID, UserName FROM UserMaster WHERE RoleId = 3 AND IsActive = 1 AND DelMark = 0`);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error('Error fetching users with RoleId=3:', err);
    res.status(500).json({ message: 'Failed to fetch users', error: err.message });
  }
};
const { sql, poolPromise } = require('../config/db');
const dbConfig = require('../config/db'); // ✅ correct path to your db.js file
const transporter = require('../config/mailer'); // ✅ correct path to your mailer.js file

const fs = require('fs');
const path = require('path');

exports.submitIncident = async (req, res) => {
  try {
    const {
      incidentDate,
      incidentTime,
      location,
      weatherCondition,
      htplShiftInCharge,
      contractorSupervisor,
      incidentReportedBy,
      reportPreparedBy,
      incidentTitle,
      incidentSummary,
      typeOfIncident,
      injuredPersonDetails
    } = req.body;

    // Handle uploaded files
    const uploadedFiles = req.files?.map(file => ({
      originalName: file.originalname,
      storedName: file.filename,
      path: file.path,
      size: file.size
    }));

    // Connect to SQL Server
    const pool = await poolPromise;


    const result = await pool.request()
      .input('IncidentDate', sql.Date, incidentDate)
      .input('IncidentTime', sql.Time, incidentTime)
      .input('Location', sql.NVarChar(255), location)
      .input('WeatherCondition', sql.NVarChar(50), weatherCondition)
      .input('HTPLShiftInCharge', sql.NVarChar(100), htplShiftInCharge)
      .input('ContractorSupervisor', sql.NVarChar(100), contractorSupervisor)
      .input('IncidentReportedBy', sql.NVarChar(100), incidentReportedBy)
      .input('ReportPreparedBy', sql.NVarChar(100), reportPreparedBy)
      .input('IncidentTitle', sql.NVarChar(255), incidentTitle)
      .input('IncidentSummary', sql.NVarChar(sql.MAX), incidentSummary)
      .input('TypeOfIncident', sql.NVarChar(sql.MAX), JSON.stringify(typeOfIncident))
      .input('InjuredPersonDetails', sql.NVarChar(sql.MAX), JSON.stringify(injuredPersonDetails))
      .input('UploadedFiles', sql.NVarChar(sql.MAX), JSON.stringify(uploadedFiles))
      .query(`
        INSERT INTO IncidentReports (
          IncidentDate, IncidentTime, Location, WeatherCondition,
          HTPLShiftInCharge, ContractorSupervisor, IncidentReportedBy, ReportPreparedBy,
          IncidentTitle, IncidentSummary, TypeOfIncident, InjuredPersonDetails, UploadedFiles
        )
        VALUES (
          @IncidentDate, @IncidentTime, @Location, @WeatherCondition,
          @HTPLShiftInCharge, @ContractorSupervisor, @IncidentReportedBy, @ReportPreparedBy,
          @IncidentTitle, @IncidentSummary, @TypeOfIncident, @InjuredPersonDetails, @UploadedFiles
        )
      `);

    res.status(201).json({ message: 'Incident report submitted successfully' });
  } catch (err) {
    console.error('Error submitting report:', err);
    res.status(500).json({ message: 'Failed to submit report' });
  }
};

exports.getAllIncidents = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query('SELECT * FROM IncidentReports ORDER BY IncidentID DESC');
    res.json(result.recordset);
    console.log("Fetched all incidents successfully", result.recordset.length);
  } catch (err) {
    console.error('Error fetching incidents:', err);
    res.status(500).json({ message: 'Failed to fetch reports' });
  }
};

exports.getIncidentById = async (req, res) => {
  try {
    const id = req.params.id;
    const pool = await poolPromise;

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          IncidentID,
          IncidentDate,
          IncidentTime,
          Location,
          WeatherCondition,
          HTPLShiftInCharge,
          ContractorSupervisor,
          IncidentReportedBy,
          ReportPreparedBy,
          IncidentTitle,
          IncidentSummary,
          TypeInjury,
          CountInjury,
          TypePropertyDamage,
          CountPropertyDamage,
          TypeFire,
          CountFire,
          TypeNearMiss,
          CountNearMiss,
          TypeEnvironment,
          CountEnvironment,
          TypeFatality,
          CountFatality,
          TypeOther,
          CountOther,
          InjuredHTPLEmployees,
          InjuredContractWorkers,
          InjuredVisitors,
          UploadedFiles
        FROM IncidentReports 
        WHERE IncidentID = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    const incident = {
      ...result.recordset[0],
      // Parse JSON strings back to objects/arrays
      InjuredHTPLEmployees: JSON.parse(result.recordset[0].InjuredHTPLEmployees || '[]'),
      InjuredContractWorkers: JSON.parse(result.recordset[0].InjuredContractWorkers || '[]'),
      InjuredVisitors: JSON.parse(result.recordset[0].InjuredVisitors || '[]'),
      UploadedFiles: JSON.parse(result.recordset[0].UploadedFiles || '[]')
    };

    res.status(200).json(incident);
  } catch (err) {
    console.error('Error fetching incident by ID:', err);
    res.status(500).json({ message: 'Failed to fetch incident', error: err.message });
  }
};

exports.createIncident = async (req, res) => {
  try {
    const pool = await poolPromise;

    const {
      // Basic Info
      incident_date,
      incident_time,
      location,
      weather_condition,
      
      // Personnel Info
      htpl_shift_in_charge,
      contractor_supervisor,
      incident_reported_by,
      report_prepared_by,
      
      // Incident Details
      incident_title,
      incident_summary,
      
      // Type of Incident
      type_injury = false,
      count_injury = 0,
      type_property_damage = false,
      count_property_damage = 0,
      type_fire = false,
      count_fire = 0,
      type_near_miss = false,
      count_near_miss = 0,
      type_environment = false,
      count_environment = 0,
      type_fatality = false,
      count_fatality = 0,
      type_other = false,
      count_other = 0,
      
      // Injured Person Details (expecting arrays)
      injured_htpl_employees = [],
      injured_contract_workers = [],
      injured_visitors = [],
      
      // Uploaded Files
      uploaded_files = []
    } = req.body;

    // Validate required fields
    const requiredFields = {
      incident_date,
      incident_time,
      location,
      weather_condition,
      htpl_shift_in_charge,
      incident_reported_by,
      report_prepared_by,
      incident_title,
      incident_summary
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        missing_fields: missingFields
      });
    }

    // Parse and validate time format
    let parsedTime;
    try {
      // Create a Date object for today with the provided time
      const timeString = incident_time.includes('T') 
        ? incident_time 
        : `1900-01-01T${incident_time}`;
      parsedTime = new Date(timeString);
      
      if (isNaN(parsedTime.getTime())) {
        throw new Error('Invalid time format');
      }
    } catch (error) {
      return res.status(400).json({
        error: "Invalid time format. Please use HH:MM:SS format (24-hour)"
      });
    }

  const result = await pool.request()
      // Basic Info
      .input("incident_date", sql.Date, incident_date)
      .input("incident_time", sql.Time, parsedTime)
      .input("location", sql.NVarChar, location)
      .input("weather_condition", sql.NVarChar, weather_condition)
      
      // Personnel Info
      .input("htpl_shift_in_charge", sql.NVarChar, htpl_shift_in_charge)
      .input("contractor_supervisor", sql.NVarChar, contractor_supervisor)
      .input("incident_reported_by", sql.NVarChar, incident_reported_by)
      .input("report_prepared_by", sql.NVarChar, report_prepared_by)
      
      // Incident Details
      .input("incident_title", sql.NVarChar, incident_title)
      .input("incident_summary", sql.NVarChar, incident_summary)
      
      // Type of Incident
      .input("type_injury", sql.Bit, type_injury)
      .input("count_injury", sql.Int, count_injury)
      .input("type_property_damage", sql.Bit, type_property_damage)
      .input("count_property_damage", sql.Int, count_property_damage)
      .input("type_fire", sql.Bit, type_fire)
      .input("count_fire", sql.Int, count_fire)
      .input("type_near_miss", sql.Bit, type_near_miss)
      .input("count_near_miss", sql.Int, count_near_miss)
      .input("type_environment", sql.Bit, type_environment)
      .input("count_environment", sql.Int, count_environment)
      .input("type_fatality", sql.Bit, type_fatality)
      .input("count_fatality", sql.Int, count_fatality)
      .input("type_other", sql.Bit, type_other)
      .input("count_other", sql.Int, count_other)
      
      // Injured Person Details (convert arrays to JSON strings)
      .input("injured_htpl_employees", sql.NVarChar, JSON.stringify(injured_htpl_employees))
      .input("injured_contract_workers", sql.NVarChar, JSON.stringify(injured_contract_workers))
      .input("injured_visitors", sql.NVarChar, JSON.stringify(injured_visitors))
      
      // Uploaded Files (convert array to JSON string)
      .input("uploaded_files", sql.NVarChar, JSON.stringify(uploaded_files))
      
      .query(`
        INSERT INTO IncidentReports (
          IncidentDate,
          IncidentTime,
          Location,
          WeatherCondition,
          HTPLShiftInCharge,
          ContractorSupervisor,
          IncidentReportedBy,
          ReportPreparedBy,
          IncidentTitle,
          IncidentSummary,
          TypeInjury,
          CountInjury,
          TypePropertyDamage,
          CountPropertyDamage,
          TypeFire,
          CountFire,
          TypeNearMiss,
          CountNearMiss,
          TypeEnvironment,
          CountEnvironment,
          TypeFatality,
          CountFatality,
          TypeOther,
          CountOther,
          InjuredHTPLEmployees,
          InjuredContractWorkers,
          InjuredVisitors,
          UploadedFiles
        )
        OUTPUT INSERTED.IncidentID
        VALUES (
          @incident_date,
          @incident_time,
          @location,
          @weather_condition,
          @htpl_shift_in_charge,
          @contractor_supervisor,
          @incident_reported_by,
          @report_prepared_by,
          @incident_title,
          @incident_summary,
          @type_injury,
          @count_injury,
          @type_property_damage,
          @count_property_damage,
          @type_fire,
          @count_fire,
          @type_near_miss,
          @count_near_miss,
          @type_environment,
          @count_environment,
          @type_fatality,
          @count_fatality,
          @type_other,
          @count_other,
          @injured_htpl_employees,
          @injured_contract_workers,
          @injured_visitors,
          @uploaded_files
        )
      `);

    const incidentId = result.recordset && result.recordset[0] ? result.recordset[0].IncidentID : null;

    res.status(201).json({ 
      message: "Incident created successfully",
      incidentId,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Error inserting incident:", err);
    res.status(500).json({ 
      error: "Internal Server Error",
      details: err.message 
    });
  }
};


exports.getAllIncidents = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT 
        IncidentID,
        IncidentDate,
        IncidentTime,
        Location,
        WeatherCondition,
        HTPLShiftInCharge,
        ContractorSupervisor,
        IncidentReportedBy,
        ReportPreparedBy,
        IncidentTitle,
        IncidentSummary,
        TypeInjury,
        CountInjury,
        TypePropertyDamage,
        CountPropertyDamage,
        TypeFire,
        CountFire,
        TypeNearMiss,
        CountNearMiss,
        TypeEnvironment,
        CountEnvironment,
        TypeFatality,
        CountFatality,
        TypeOther,
        CountOther,
        InjuredHTPLEmployees,
        InjuredContractWorkers,
        InjuredVisitors,
        UploadedFiles,
        Status
      FROM IncidentReports
      ORDER BY IncidentID DESC
    `);

    const incidents = result.recordset.map(row => ({
      ...row,
      // Parse JSON strings back to objects/arrays
      InjuredHTPLEmployees: JSON.parse(row.InjuredHTPLEmployees || '[]'),
      InjuredContractWorkers: JSON.parse(row.InjuredContractWorkers || '[]'),
      InjuredVisitors: JSON.parse(row.InjuredVisitors || '[]'),
      UploadedFiles: JSON.parse(row.UploadedFiles || '[]')
    }));

    res.status(200).json(incidents);
  } catch (err) {
    console.error('Error fetching incidents:', err);
    res.status(500).json({ message: 'Failed to fetch reports', error: err.message });
  }
};


// 
exports.updateTrainingInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { training_type_required, training_description, updated_by } = req.body;

    if (!training_type_required && !training_description) {
      return res.status(400).json({
        message: "At least one of 'training_type_required' or 'training_description' must be provided"
      });
    }

    const pool = await poolPromise;

    const result = await pool.request()
      .input('IncidentID', sql.Int, id)
      .input('TrainingTypeRequired', sql.NVarChar, training_type_required || null)
      .input('TrainingDescription', sql.NVarChar(sql.MAX), training_description || null)
      .query(`
        UPDATE IncidentReports
        SET
          TrainingTypeRequired = ISNULL(@TrainingTypeRequired, TrainingTypeRequired),
          TrainingDescription = ISNULL(@TrainingDescription, TrainingDescription)
        WHERE IncidentID = @IncidentID
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Incident not found or no changes made' });
    }

    // ✅ Email sending logic inside the same function
    const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: [
        "Mukund.Kumar@hindterminals.com",
        "amit.singh@elogisol.in",
        "dinesh.gautam@elogisol.in",
        "info@elogisol.in",
        "avinashtiwari5322@gmail.com"
      ],
      subject: `Training Info Updated for Incident #${id}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #007bff;">Incident Training Info Updated</h2>
          <p>The training information for Incident <strong>#${id}</strong> has been updated.</p>
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
            <tr>
              <th align="left" style="background-color: #f2f2f2;">Training Type Required</th>
              <td>${training_type_required || "No change"}</td>
            </tr>
            <tr>
              <th align="left" style="background-color: #f2f2f2;">Training Description</th>
              <td>${training_description || "No change"}</td>
            </tr>
            <tr>
              <th align="left" style="background-color: #f2f2f2;">Updated By</th>
              <td>${ "Updated by System"}</td>
            </tr>
            <tr>
              <th align="left" style="background-color: #f2f2f2;">Updated On</th>
              <td>${now}</td>
            </tr>
          </table>
          <p style="margin-top: 20px;">Please review the changes and take necessary action.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Training info updated and email sent successfully' });

  } catch (err) {
    console.error('Error updating training info:', err);
    res.status(500).json({ message: 'Failed to update training info' });
  }
};


  