const net = require('net');
const crypto = require('crypto');

function parseMessage(buffer) {
  // Validate start/end delimiters
  if (buffer[0] !== 0x7e || buffer[buffer.length - 1] !== 0x7e) {
    console.error('Invalid message format');
    return null;
  }

  // Remove start and end delimiters
  const messageBuffer = buffer.slice(1, -1);

  // Extract message ID (starting from byte 1)
  const messageId = messageBuffer.readUInt16BE(0);

  // Basic parsing logic based on JT808 protocol
  switch (messageId) {
    case 0x0100: // Terminal registration
      return parseRegistration(messageBuffer);
    case 0x0200: // Location report
      return parseLocationReport(messageBuffer);
    case 0x0002: // Heartbeat
      return { type: 'Heartbeat' };
    default:
      console.log(`Unhandled message type: ${messageId.toString(16)}`);
      return null;
  }
}

function parseRegistration(buffer) {
  return {
    type: 'Registration',
    provinceId: buffer.readUInt16BE(11),
    cityId: buffer.readUInt16BE(13),
    manufacturerId: buffer.slice(15, 20).toString('hex'),
    deviceModel: buffer.slice(20, 28).toString().trim(),
    deviceId: buffer.slice(28, 35).toString(),
    licensePlateColor: buffer.readUInt8(35)
  };
}

function parseLocationReport(buffer) {
  // Adjust offsets based on message header
  const alarmFlag = buffer.readUInt32BE(0);
  const statusFlag = buffer.readUInt32BE(4);
  
  const latitude = buffer.readUInt32BE(8) / 1000000;
  const longitude = buffer.readUInt32BE(12) / 1000000;
  const elevation = buffer.readUInt16BE(16);
  const speed = buffer.readUInt16BE(18) / 10; // Speed in 1/10 km/h
  const direction = buffer.readUInt16BE(20);

  // Parse time (BCD encoded)
  const time = parseBCDTime(buffer.slice(22, 28));

  // Parse additional information items
  const additionalInfo = parseAdditionalInfo(buffer.slice(28));

  return {
    type: 'LocationReport',
    alarmFlag,
    statusFlag,
    latitude,
    longitude,
    elevation,
    speed,
    direction,
    time,
    additionalInfo
  };
}

function parseBCDTime(buffer) {
  // Convert BCD encoded time to readable format
  const year = parseInt(buffer.toString('hex', 0, 1), 16);
  const month = parseInt(buffer.toString('hex', 1, 2), 16);
  const day = parseInt(buffer.toString('hex', 2, 3), 16);
  const hour = parseInt(buffer.toString('hex', 3, 4), 16);
  const minute = parseInt(buffer.toString('hex', 4, 5), 16);
  const second = parseInt(buffer.toString('hex', 5, 6), 16);

  return `20${year.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
}

function parseAdditionalInfo(buffer) {
  const additionalInfo = {};
  let offset = 0;

  while (offset < buffer.length) {
    const infoId = buffer.readUInt8(offset);
    if (infoId === 0) break; // End of additional info

    const infoLength = buffer.readUInt8(offset + 1);
    const infoValue = buffer.slice(offset + 2, offset + 2 + infoLength);

    // Parse specific additional information based on ID
    switch (infoId) {
      case 0x01: // Mileage
        additionalInfo.mileage = infoValue.readUInt32BE(0) / 10;
        break;
      case 0x30: // Network signal strength
        additionalInfo.signalStrength = infoValue.readUInt8(0);
        break;
      case 0x31: // GPS satellites
        additionalInfo.gpsSatellites = infoValue.readUInt8(0);
        break;
      case 0x61: // Main power supply voltage
        additionalInfo.voltage = infoValue.readUInt16BE(0) / 100;
        break;
      default:
        additionalInfo[`additionalInfo_0x${infoId.toString(16)}`] = infoValue.toString('hex');
    }

    offset += 2 + infoLength;
  }

  return additionalInfo;
}

function generateResponse(messageId, serialNumber, result = 0) {
  // Generate a basic response packet
  const response = Buffer.alloc(5);
  response.writeUInt16BE(serialNumber, 0);
  response.writeUInt16BE(messageId, 2);
  response.writeUInt8(result, 4);
  
  // Wrap response with delimiters and escape special characters
  return Buffer.concat([
    Buffer.from([0x7e]),
    escapeMessage(response),
    Buffer.from([0x7e])
  ]);
}

function escapeMessage(buffer) {
  const escapedBuffer = [];
  
  for (let i = 0; i < buffer.length; i++) {
    switch (buffer[i]) {
      case 0x7e:
        escapedBuffer.push(0x7d);
        escapedBuffer.push(0x02);
        break;
      case 0x7d:
        escapedBuffer.push(0x7d);
        escapedBuffer.push(0x01);
        break;
      default:
        escapedBuffer.push(buffer[i]);
    }
  }
  
  return Buffer.from(escapedBuffer);
}

const server = net.createServer((socket) => {
  console.log('GPS Tracker connected');

  socket.on('data', (buffer) => {
    try {
      const message = parseMessage(buffer);
      if (message) {
        console.log('Received message:', JSON.stringify(message, null, 2));

        // Send response based on message type
        if (message.type === 'Registration') {
          const response = generateResponse(0x8100, buffer.readUInt16BE(11));
          socket.write(response);
          console.log(response)
          console.log('Sent registration response');
        } else if (message.type === 'LocationReport') {
          // Optional: Send a response for location reports
          const response = generateResponse(0x8001, buffer.readUInt16BE(11));
          socket.write(response);
          console.log(socket.write(response))
          console.log('Sent location report response');
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  socket.on('close', () => {
    console.log('GPS Tracker disconnected');
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

const PORT = 3003;
server.listen(PORT, () => {
  console.log(`JT808 TCP Server listening on port ${PORT}`);
});