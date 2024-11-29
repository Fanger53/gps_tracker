const net = require('net');
const crypto = require('crypto');

function parseMessage(buffer) {
  // Validate start/end delimiters
  if (buffer[0] !== 0x7e || buffer[buffer.length - 1] !== 0x7e) {
    console.error('Invalid message format');
    return null;
  }

  // Extract message ID
  const messageId = buffer.readUInt16BE(1);
  console.log("messageId")
  console.log(messageId)
  // Basic parsing logic based on JT808 protocol
  switch (messageId) {
    case 0x0200: // Location report
      return parseLocationReport(buffer);
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
    provinceId: buffer.readUInt16BE(13),
    cityId: buffer.readUInt16BE(15),
    manufacturerId: buffer.slice(17, 22).toString('hex'),
    deviceModel: buffer.slice(22, 30).toString().trim(),
    deviceId: buffer.slice(30, 37).toString(),
    licensePlateColor: buffer.readUInt8(37),
    latitude: buffer.readUInt32BE(8) / 1000000,
    longitude: buffer.readUInt32BE(12) / 1000000,
    speed: buffer.readUInt16BE(18) / 10
  };
}

function parseLocationReport(buffer) {
  // Detailed location parsing (similar to previous example)
  return {
    type: 'LocationReport',
    latitude: buffer.readUInt32BE(8) / 1000000,
    longitude: buffer.readUInt32BE(12) / 1000000,
    speed: buffer.readUInt16BE(18) / 10
  };
}

function generateResponse(messageId, serialNumber, result = 0) {
  // Generate a basic response packet
  const response = Buffer.alloc(5);
  response.writeUInt16BE(serialNumber, 0);
  response.writeUInt16BE(messageId, 2);
  response.writeUInt8(result, 4);
  return response;
}

const server = net.createServer((socket) => {
  console.log('GPS Tracker connected');

  socket.on('data', (buffer) => {
    console.log(buffer)
    try {
      const message = parseMessage(buffer);
      if (message) {
        console.log('Received message:', message);
        
        // Send response based on message type
        if (message.type === 'Registration') {
          const response = generateResponse(0x8100, buffer.readUInt16BE(11));
          socket.write(Buffer.concat([Buffer.from([0x7e]), response, Buffer.from([0x7e])]));
          console.log(response)
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