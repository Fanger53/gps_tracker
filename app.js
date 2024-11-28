const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const socketIo = require('socket.io');

const PORT = 3006;
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const io = socketIo(server);

// Almacenamiento de datos de ubicación
let lastLocationData = null;

// Conexiones WebSocket activas
const clients = new Set();

// Manejar conexiones WebSocket
wss.on('connection', (ws, req) => {
    const clientIP = req.socket.remoteAddress;
    console.log(`Nueva conexión WebSocket desde ${clientIP}`);
    clients.add(ws);

    // Manejar mensajes recibidos
    ws.on('message', (message) => {
        try {
            // Parsear el mensaje del GPS
            const gpsData = parseWebSocketMessage(message);
            
            // Preparar datos de ubicación
            lastLocationData = {
                ...gpsData,
                receivedFrom: clientIP,
                receivedAt: new Date().toISOString()
            };

            console.log('Datos GPS recibidos:', lastLocationData);

            // Emitir a todos los clientes WebSocket
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(lastLocationData));
                }
            });

            // Emitir a clientes Socket.IO
            io.emit('gpsData', lastLocationData);

            // Responder al cliente original
            ws.send(JSON.stringify({ 
                status: 'received', 
                message: 'Datos procesados correctamente' 
            }));
        } catch (error) {
            console.error('Error procesando mensaje:', error);
            ws.send(JSON.stringify({ 
                status: 'error', 
                message: 'Error procesando datos' 
            }));
        }
    });

    // Manejar cierre de conexión
    ws.on('close', () => {
        console.log(`Conexión WebSocket cerrada desde ${clientIP}`);
        clients.delete(ws);
    });

    // Manejar errores
    ws.on('error', (error) => {
        console.error('Error en WebSocket:', error);
    });
});

// Función para parsear mensaje WebSocket
function parseWebSocketMessage(message) {
    // Convertir a string si es un buffer
    const msgString = message.toString();
    
    try {
        // Intentar parsear como JSON
        const parsedData = JSON.parse(msgString);
        
        // Validar campos básicos
        if (!parsedData.latitude || !parsedData.longitude) {
            throw new Error('Datos de GPS inválidos');
        }

        return {
            latitude: parseFloat(parsedData.latitude),
            longitude: parseFloat(parsedData.longitude),
            speed: parsedData.speed || 0,
            timestamp: parsedData.timestamp || new Date().toISOString()
        };
    } catch (jsonError) {
        // Si no es JSON, intentar parseo de formato de texto plano
        // Formato esperado: "lat,lon,speed,timestamp"
        const [latitude, longitude, speed, timestamp] = msgString.split(',');
        
        return {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            speed: parseFloat(speed) || 0,
            timestamp: timestamp || new Date().toISOString()
        };
    }
}

// Rutas HTTP
app.get('/location', (req, res) => {
    if (lastLocationData) {
        res.json(lastLocationData);
    } else {
        res.status(404).json({ message: 'No hay datos de ubicación' });
    }
});

// Página web de ejemplo para mostrar datos
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>GPS Tracker WebSocket</title>
            <script src="/socket.io/socket.io.js"></script>
        </head>
        <body>
            <h1>GPS Tracker Location</h1>
            <div id="websocketLocation">WebSocket: Waiting for data...</div>
            <div id="socketioLocation">Socket.IO: Waiting for data...</div>

            <script>
                // WebSocket nativo
                const ws = new WebSocket('ws://' + window.location.host);
                ws.onmessage = (event) => {
                    document.getElementById('websocketLocation').innerHTML = 
                        'WebSocket: ' + event.data;
                };

                // Socket.IO
                const socket = io();
                socket.on('gpsData', (data) => {
                    document.getElementById('socketioLocation').innerHTML = 
                        'Socket.IO: ' + JSON.stringify(data);
                });
            </script>
        </body>
        </html>
    `);
});

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor WebSocket corriendo en puerto ${PORT}`);
});