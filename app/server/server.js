import GameMap from '../shared/gamemap';
import astar from '../shared/astar';

const http = require('http');
const ws = require('ws');
const path = require('path');

const express = require('express');
const server = http.createServer();

const WebSocketServer = ws.Server;
const wss = new WebSocketServer({ server });

const app = express();

const appDir = path.dirname(require.main.filename);

const MILLISECONDS_PER_LOGIC_UPDATE = 30;

const map = new GameMap();

const playerSockets = [];

function updateGameState() {
  const updateMessages = map.getUpdateMessages();
  for (const updateMessage of updateMessages) {
    for (const playerSocket of playerSockets) {
      playerSocket.send(JSON.stringify(updateMessage));
    }
  }
}

setInterval(updateGameState, MILLISECONDS_PER_LOGIC_UPDATE);

app.get('/', (req, res) => {
  res.sendFile(appDir + '/static/index.html');
});

app.use('/dist', express.static('dist'));
app.use('/static', express.static('static'));

function moveShipHandler(moveShipMessage) {
  // Move the ship
  const { shipId, targetLocation } = moveShipMessage;

  const ship = map.getShip(shipId);

  const startPosition = { x: ship.getX(), y: ship.getY() };

  const isEmpty = ({ x: tempX, y: tempY }) => {
    return map.getItem(tempX, tempY) == null && !map.isIsland(tempX, tempY);
  };
  const isValid = ({ x: tempX, y: tempY }) => {
    return tempX >= 0 && tempX < map.width && tempY >= 0 && tempY < map.height;
  };
  const moves = astar(startPosition, targetLocation, isEmpty, isValid);

  console.log('move the ship', moveShipMessage, moves);

  if (moves == null) {
    console.log('no such path');
  } else {
    ship.setMoves(moves);
  }
}

const messageHandlers = {
  'MoveShip': moveShipHandler,
};

wss.on('connection', function connection(socket) {
  playerSockets.push(socket);

  socket.on('message', function incoming(message) {
    console.error('received: "%s"', message);
    const actualMessage = JSON.parse(message);
    if (actualMessage.type in messageHandlers) {
      messageHandlers[actualMessage.type](actualMessage);
    }
  });

  socket.on('close', function close() {
    const index = playerSockets.indexOf(socket);
    playerSockets.splice(index, 1);
  });
});

server.on('request', app);
server.listen(3000, () => {
  console.log('Listening on ' + server.address().port);
});