const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const transporter = nodemailer.createTransport({
  host: "smtp.office365.com", // Outlook SMTP server
  port: 587, // TLS port
  // 'secure: false, // Use STARTTLS, not SSL
  auth: {
    user: process.env.EMAIL_USER, // Your Outlook email address
    pass: process.env.EMAIL_PASS, // Your Outlook email password or app password
  },
});

module.exports = transporter;