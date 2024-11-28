const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.raw({ type: 'application/octet-stream' }));

function parseGPSPacket(buffer) {
  // Basic protocol parsing for Concox JM-VL03
  const protocolType = buffer.readUInt8(0);
  const serialNumber = buffer.readUInt16BE(1);
  
  const lat = buffer.readFloatBE(7);  // Assuming IEEE 754 float
  const lon = buffer.readFloatBE(11); // Assuming IEEE 754 float
  
  const speed = buffer.readUInt8(15);
  const direction = buffer.readUInt16BE(16);
  const timestamp = new Date(); // Current timestamp, replace with parsed time if protocol supports
  
  return {
    protocolType,
    serialNumber,
    location: { lat, lon },
    speed,
    direction,
    timestamp
  };
}

app.post('/gps-tracker', (req, res) => {
  try {
    const rawData = req.body;
    console.log(rawData)
    const trackerData = parseGPSPacket(rawData);
    
    console.log('Received GPS Data:', trackerData);
    
    // Here you could add database storage, further processing, etc.
    
    res.status(200).send('Data Received');
  } catch (error) {
    console.error('GPS Parsing Error:', error);
    res.status(400).send('Invalid Packet');
  }
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`GPS Tracker Endpoint listening on port ${PORT}`);
});