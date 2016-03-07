import GameMap from '../shared/gamemap';
import buildingConstants from '../shared/buildingconstants';

import * as Ships from '../shared/ship';
import * as BuildingTemplates from '../shared/buildingtemplate';
import * as Shipyards from '../shared/shipyard';
import { getStats } from '../shared/template';

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

const playerSockets = {};

const debug = false;

let pendingUpdates = [];

function serializeMapEntities() {
  const result = [];
  for (const [key, entity] of map.entities) {
    result[key] = JSON.stringify(entity);
  }
  return result;
}

let lastEntityState = serializeMapEntities();

function updateGameState() {
  const updateMessages = pendingUpdates;

  map.processUpdate();

  const currentEntityState = serializeMapEntities();

  // Scan for changes in entities and add new entities
  // TODO: Need a faster way to scan for changes
  for (const id of Object.keys(currentEntityState)) {
    if (lastEntityState[id] !== currentEntityState[id]) {
      updateMessages.push({ type: 'UpdateEntity', id, data: JSON.parse(currentEntityState[id]) });
    }
  }

  // Remove removed things
  for (const id of Object.keys(lastEntityState)) {
    if (!(id in currentEntityState)) {
      updateMessages.push({ type: 'RemoveEntity', id });
    }
  }

  lastEntityState = currentEntityState;

  // Clear the pending updates list.
  pendingUpdates = [];

  for (const updateMessage of updateMessages) {
    for (const team of Object.keys(playerSockets)) {
      const playerSocket = playerSockets[team];
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

function moveShipHandler({ shipId, targetLocation }, playerTeam) {
  // Move the ship
  const ship = map.getEntity(shipId);

  if (ship == null) {
    return;
  }

  if (ship.team === playerTeam) {
    Ships.moveTo(ship, map, targetLocation);
  }
}

function makeBuildingHandler({ building, x, y }, playerTeam) {
  const island = map.getIsland(x, y);

  if (map.getItem(x, y) != null) {
    console.error('Something blocking the space');
    return;
  }

  if (island == null || island.team !== playerTeam) {
    console.error('Wrong team for island', island, playerTeam);
    return;
  }

  const buildingStats = buildingConstants[building];
  if (buildingStats.coinCost > map.getEntity(playerTeam).coins) {
    console.error('Trying to build a buildng you cant afford');
    return;
  }
  map.getEntity(playerTeam).coins -= buildingStats.coinCost;
  BuildingTemplates.createBuildingTemplate(map, x, y, playerTeam, island.id, building);
}

function makeShipHandler({ shipyardId, template, templateNumber }, playerTeam) {
  const shipyard = map.getEntity(shipyardId);
  if (shipyard == null) {
    return;
  }

  if (shipyard.team !== playerTeam) {
    console.error('Not allowed to use enemy shipyard');
    return;
  }

  const stats = getStats(template);

  if (stats.cost > map.getEntity(playerTeam).coins) {
    console.error('Trying to build a ship you cant afford');
    return;
  }

  map.getEntity(playerTeam).coins -= stats.cost;

  Shipyards.addTemplateToQueue(shipyard, templateNumber, template);
}

function attackShipHandler({ id, targetId }, playerTeam) {
  const sourceShip = map.getEntity(id);
  const targetShip = map.getEntity(targetId);

  if (sourceShip == null) {
    return;
  }

  if (targetShip == null) {
    // Target is already dead!
    return;
  }

  if (sourceShip.team !== playerTeam) {
    console.error('You are not allowed to command enemy ships.');
    return;
  }

  Ships.attackTarget(sourceShip, targetShip);
}

function updateModeHandler({ targetMode }, playerTeam) {
  map.getEntity(playerTeam).targetMode = targetMode;
}

const teamReadyMap = {
  '0': false,
  '1': false,
};

function startNewGame({}) {
  for (const team of Object.keys(teamReadyMap)) {
    teamReadyMap[team] = false;
  }

  for (const team of Object.keys(playerSockets)) {
    playerSockets[team].send(JSON.stringify({ type: 'UpdateReadyStates', readyStates: teamReadyMap }));
  }

  map.initialSetup();
}

function updateMap({ mapNum }) {
  map.initialSetup(mapNum);

  for (const team of Object.keys(playerSockets)) {
    playerSockets[team].send(JSON.stringify({ type: 'UpdateMap', mapNum: mapNum, initialState: map.getInitialState(), team }));
  }
}

function updateReadyState({ readyState }, playerTeam) {
  teamReadyMap[playerTeam] = readyState;

  for (const team of Object.keys(playerSockets)) {
    playerSockets[team].send(JSON.stringify({ type: 'UpdateReadyStates', readyStates: teamReadyMap }));
  }

  for (const team of Object.keys(teamReadyMap)) {
    if (teamReadyMap[team] === false) {
      return; // Some is not ready yet
    }
  }

  for (const team of Object.keys(playerSockets)) {
    playerSockets[team].send(JSON.stringify({ type: 'StartGame', initialState: map.getInitialState(), team }));
  }
}

const messageHandlers = {
  'MoveShip': moveShipHandler,
  'MakeBuilding': makeBuildingHandler,
  'MakeShip': makeShipHandler,
  'AttackShip': attackShipHandler,
  'UpdateMode': updateModeHandler,
  'SetReadyState': updateReadyState,
  'StartNewGame': startNewGame,
  'UpdateMap': updateMap,
};

let nextTeam = 0;

wss.on('connection', function connection(socket) {
  let playerTeam = String(nextTeam);
  if (debug) {
    playerTeam = '0';
  }

  nextTeam += 1;

  playerSockets[playerTeam] = socket;

  if (debug) {
    socket.send(JSON.stringify({ type: 'StartGame', initialState: map.getInitialState(), team: playerTeam }));
  } else {
    socket.send(JSON.stringify({ type: 'AssignTeam', team: playerTeam, readyStates: teamReadyMap }));
  }

  socket.on('message', function incoming(message) {
    console.error('received: "%s"', message);
    const actualMessage = JSON.parse(message);
    if (actualMessage.type in messageHandlers) {
      messageHandlers[actualMessage.type](actualMessage, playerTeam);
    } else {
      console.error('No handler for type:', actualMessage.type);
    }
  });

  socket.on('close', function close() {
    // TODO: Need to implement this properly!
  });
});

server.on('request', app);
server.listen(3000, () => {
  console.log('Listening on ' + server.address().port);
});
