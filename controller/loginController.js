const axios = require('axios');
const { sql, poolPromise } = require('../config/db');
const dbConfig = require('../config/db'); // ✅ correct path to your db.js file

exports.loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'userId and password are required' });
    }

    // Query the database for user
    const pool = await poolPromise;

    const result = await pool.request()
      .input('UserName', sql.NVarChar(50), username)
      .input('Password', sql.NVarChar(255), password)
      .query(`
        SELECT u.UserId, u.UserName, u.RoleId, r.RoleName, u.IsActive, u.DelMark
        FROM UserMaster u
        INNER JOIN RoleMaster r ON u.RoleId = r.RoleId
        WHERE u.UserName = @UserName 
          AND u.Password = @Password
          AND u.IsActive = 1
          AND u.DelMark = 0
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials or inactive user' });
    }

    const user = result.recordset[0];

    // Get IP
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip.includes('::ffff:')) {
      ip = ip.split('::ffff:')[1];
    }
    if (ip === '127.0.0.1' || ip === '::1') {
      ip = '27.123.242.135'; // sample IP for local testing
    }

    // Get location from IP
    const geoResponse = await axios.get(`http://ip-api.com/json/${ip}`);
    const locationData = geoResponse.data;

    res.json({
      message: 'success login',
      user: {
        userId: user.UserId,
        username: user.UserName,
        role: user.RoleName
      },
      location: {
        ip: ip,
        city: locationData.city,
        region: locationData.regionName,
        country: locationData.country
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
