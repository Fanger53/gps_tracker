const dgram = require('dgram');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const UDP_PORT = 3006;
const HTTP_PORT = 3007;

const server = dgram.createSocket('udp4');
const app = express();
const httpServer = http.createServer(app);
const io = socketIo(httpServer);

let lastLocationData = null;

// Servidor UDP para recibir datos
server.on('listening', () => {
    console.log(`Servidor UDP escuchando en el puerto ${UDP_PORT}`);
});

server.on('message', (msg, rinfo) => {
    try {
        // Parsea el mensaje recibido
        const gpsData = parseUDPMessage(msg);
        
        lastLocationData = {
            ...gpsData,
            receivedFrom: rinfo.address,
            receivedAt: new Date().toISOString()
        };

        console.log('Datos GPS recibidos por UDP:', lastLocationData);
        
        // Emitir por Socket.IO
        io.emit('gpsData', lastLocationData);
    } catch (error) {
        console.error('Error procesando mensaje UDP:', error);
    }
});

server.on('error', (err) => {
    console.error('Error en servidor UDP:', err);
    server.close();
});

// Función para parsear mensaje UDP (personalizar según tu formato)
function parseUDPMessage(msg) {
    // Ejemplo de parseo de mensaje 
    // Formato: "lat,lon,speed,timestamp"
    const msgString = msg.toString();
    const [latitude, longitude, speed, timestamp] = msgString.split(',');
    
    return {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        speed: parseFloat(speed),
        timestamp: timestamp || new Date().toISOString()
    };
}

// Rutas HTTP
app.get('/location', (req, res) => {
    if (lastLocationData) {
        res.json(lastLocationData);
    } else {
        res.status(404).json({ message: 'No hay datos de ubicación' });
    }
});

// Página web para visualización
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>GPS Tracker UDP</title>
            <script src="/socket.io/socket.io.js"></script>
        </head>
        <body>
            <h1>GPS Tracker Location</h1>
            <div id="location">Waiting for data...</div>
            <script>
                const socket = io();
                socket.on('gpsData', (data) => {
                    document.getElementById('location').innerHTML = 
                        JSON.stringify(data, null, 2);
                });
            </script>
        </body>
        </html>
    `);
});

// Bind UDP server
server.bind(UDP_PORT);

// Iniciar servidor HTTP
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`Servidor HTTP corriendo en puerto ${HTTP_PORT}`);
});