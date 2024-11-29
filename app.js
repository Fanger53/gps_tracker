const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3006;

// Middleware para parsear JSON
app.use(bodyParser.json());

// Último dato de ubicación
let lastLocationData = null;

// Endpoint para recibir datos del GPS
app.post('/gps-tracker', (req, res) => {
    try {
        const gpsData = req.body;
        
        // Validar datos recibidos (personaliza según tu formato)
        if (!gpsData.latitude || !gpsData.longitude) {
            return res.status(400).json({ error: 'Datos de GPS inválidos' });
        }

        // Almacenar último dato
        lastLocationData = {
            ...gpsData,
            receivedAt: new Date().toISOString()
        };

        // Emitir datos en tiempo real via Socket.IO
        io.emit('gpsData', lastLocationData);

        console.log('Datos GPS recibidos:', lastLocationData);

        res.status(200).json({ message: 'Datos recibidos correctamente' });
    } catch (error) {
        console.error('Error procesando datos GPS:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para obtener la última ubicación
app.get('/location', (req, res) => {
    if (lastLocationData) {
        res.json(lastLocationData);
    } else {
        res.status(404).json({ message: 'No hay datos de ubicación disponibles' });
    }
});

// Página web simple para mostrar datos
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>GPS Tracker</title>
            <script src="/socket.io/socket.io.js"></script>
        </head>
        <body>
            <h1>GPS Tracker Location</h1>
            <div id="location">Waiting for data...</div>
            <script>
                const socket = io();
                socket.on('gpsData', (data) => {
                    document.getElementById('location').innerHTML = JSON.stringify(data, null, 2);
                });
            </script>
        </body>
        </html>
    `);
});

// Iniciar servidor
server.listen(PORT, '::', () => {
    console.log(`Servidor corriendo en ${PORT}`);
    console.log('Endpoint para recibir datos: POST /gps-tracker');
});