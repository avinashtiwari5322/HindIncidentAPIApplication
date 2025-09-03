const { sql, poolPromise } = require("../config/db");

exports.createIncidentReport = async (req, res) => {
  try {
    const {
      incident_date,
      incident_time,
      location,
      weather_condition,
      htpl_shift_in_charge,
      htpl_duty_in_charge,
      htpl_duty_officer,
      shift_supervisor,
      control_room_operator,
      safety_officer,
      maintenance_incharge,
      incident_reported_by,
      report_prepared_by,
      incident_title,
      incident_summary,
      uploaded_files,
      created_by,
      status,
    } = req.body;
    console.log("Request Body:", req.body);
    const pool = await poolPromise;
    const request = pool.request();

    request.input("incident_date", sql.Date, incident_date);
    request.input("incident_time", sql.Time, incident_time);
    request.input("location", sql.NVarChar(255), location);
    request.input("weather_condition", sql.NVarChar(255), weather_condition);
    request.input("htpl_shift_in_charge", sql.NVarChar(255), htpl_shift_in_charge);
    request.input("htpl_duty_in_charge", sql.NVarChar(255), htpl_duty_in_charge);
    request.input("htpl_duty_officer", sql.NVarChar(255), htpl_duty_officer);
    request.input("shift_supervisor", sql.NVarChar(255), shift_supervisor);
    request.input("control_room_operator", sql.NVarChar(255), control_room_operator);
    request.input("safety_officer", sql.NVarChar(255), safety_officer);
    request.input("maintenance_incharge", sql.NVarChar(255), maintenance_incharge);
    request.input("incident_reported_by", sql.NVarChar(255), incident_reported_by);
    request.input("report_prepared_by", sql.NVarChar(255), report_prepared_by);
    request.input("incident_title", sql.NVarChar(255), incident_title);
    request.input("incident_summary", sql.NVarChar(sql.MAX), incident_summary);
    request.input("uploaded_files", sql.NVarChar(sql.MAX), uploaded_files); // If JSON, stringify it
    request.input("created_by", sql.NVarChar(255), created_by);
    request.input("created_on", sql.DateTime, new Date());
    request.input("status", sql.NVarChar(20), status || "active");

    await request.query(`
      INSERT INTO incident_reports (
        incident_date, incident_time, location, weather_condition,
        htpl_shift_in_charge, htpl_duty_in_charge, htpl_duty_officer,
        shift_supervisor, control_room_operator, safety_officer,
        maintenance_incharge, incident_reported_by, report_prepared_by,
        incident_title, incident_summary, uploaded_files,
        created_by, created_on,status
      )
      VALUES (
        @incident_date, @incident_time, @location, @weather_condition,
        @htpl_shift_in_charge, @htpl_duty_in_charge, @htpl_duty_officer,
        @shift_supervisor, @control_room_operator, @safety_officer,
        @maintenance_incharge, @incident_reported_by, @report_prepared_by,
        @incident_title, @incident_summary, @uploaded_files,
        @created_by, @created_on, @status
      )
    `);

    res.status(201).json({ message: "Incident report created successfully." });
  } catch (error) {
    console.error("Insert Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
