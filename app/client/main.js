import GameMap from '../shared/gamemap';
import Gui from '../shared/gui';
import ShipbuilderGui from '../shared/shipbuildergui';
import loadImages from './images';
import * as Ships from '../shared/ship';

import { defaultTemplate } from '../shared/template';

const MILLISECONDS_PER_LOGIC_UPDATE = 5;
const MILLISECONDS_PER_RENDER_UPDATE = 15;

const SCALE = 3;


const templates = [defaultTemplate(), defaultTemplate(), defaultTemplate()];

/**
 * The central game object for most of the logic.
 */
class Main {
  /**
   * Contruct the game.
   * Takes as input the images object as produced by images.js
   */
  constructor(images) {
    this.mode = 'game';

    this.canvas = document.getElementById('canvas');
    this.context = this.canvas.getContext('2d');

    this.canvas.width = 1200;
    this.canvas.height = 500;

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    this.images = images;

    this.templates = [];

    this.game = new Game(images);
    this.shipbuilder = new Shipbuilder(images);

    this.pressedKeys = new Set();

    this.teamAssigned = false;

    this.actionMap = {
      37: () => this.game.x -= 1,
      38: () => this.game.y -= 1,
      39: () => this.game.x += 1,
      40: () => this.game.y += 1,
    };

    document.addEventListener('keydown', (event) => {
      this.game.keydown(event, this.pressedKeys);
    });

    document.addEventListener('keyup', (event) => {
      this.game.keyup(event, this.pressedKeys);
    });

    // Ignore right click events on the canvas
    this.canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });

    this.canvas.addEventListener('mousedown', (event) => {
      if (this.mode === 'game') {
        this.game.mousedown(event, this.sendMessage.bind(this));
      } else if (this.mode === 'shipbuilder') {
        this.mode = this.shipbuilder.mousedown(event);
      }
    });

    this.canvas.addEventListener('mouseup', (event) => {
      if (this.mode === 'game') {
        this.mode = this.game.mouseup(event, this.sendMessage.bind(this));
      } else if (this.mode === 'shipbuilder') {
        this.shipbuilder.mouseup(event);
      }
    });

    this.canvas.addEventListener('mousemove', (event) => {
      if (this.mode === 'game') {
        this.game.mousemove(event);
      } else if (this.mode === 'shipbuilder') {
        this.shipbuilder.mousemove(event);
      }
    });

    this.messageHandlerMap = {
      'UpdateEntity': this.game._updateEntity.bind(this.game),
      'RemoveEntity': this.game._removeEntity.bind(this.game),
      'StartGame': this._startGame.bind(this),
    };
  }

  sendMessage(message) {
    console.log('Sending', message);
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Start the game by setting up the render intervals.
   */
  start() {
    this.ws = new WebSocket('ws://localhost:3000');
    this.ws.onmessage = this._onMessage.bind(this);
  }

  _startGame({ initialState, team }) {
    setInterval(this.render.bind(this), MILLISECONDS_PER_RENDER_UPDATE);
    this.lastUpdate = performance.now();

    this.start = performance.now();

    this.game.init(initialState, team);
  }

  _onMessage(event) {
    const messageData = JSON.parse(event.data);
    if (messageData.type in this.messageHandlerMap) {
      this.messageHandlerMap[messageData.type](messageData);
    } else {
      console.error('Unknown type: ', messageData.type);
    }
    // console.log('Got' + event.data);
  }

  /**
   * Update the game state when necessary.
   */
  update(currentTime) {
    while (currentTime > this.lastUpdate) {
      this.tick();
      this.lastUpdate += MILLISECONDS_PER_LOGIC_UPDATE;
    }
  }

  /**
   * Perform a discrete update of the logic.
   */
  tick() {
    for (const key in this.actionMap) {
      if (this.pressedKeys.has(+key)) {
        this.actionMap[key]();
      }
    }
  }

  /**
   * Render the game. Also performs updates if necessary.
   */
  render() {
    const time = performance.now();

    this.update(time);

    if (this.mode === 'game') {
      this.game.render();
    } else if (this.mode === 'shipbuilder') {
      this.shipbuilder.render();
    }
  }
}

class Game {
  /**
   * Contruct the game.
   * Takes as input the images object as produced by images.js
   */
  constructor(images) {
    this.canvas = document.getElementById('canvas');
    this.context = this.canvas.getContext('2d');

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    this.selectionState = {
      gui: null,
      map: [],
    };

    this.images = images;
    this.map = new GameMap();
    this.miniMap = this.map;
    this.team = '0';
    this.gui = new Gui(this.width, this.height, templates, this.selectionState, this.map);

    this.x = 0;
    this.y = 0;

    this.startingDownPosition = null;
  }

  init(initialState, team) {
    this.map.init(initialState);

    this.team = team;
    this.map.team = team;
  }

  _updateEntity({ data }) {
    // console.log(data)
    this.map.addEntity(data);
  }

  _removeEntity({ id }) {
    this.map.removeEntity(id);
  }

  updateSelectionState(newState) {
    this.selectionState = newState;

    this.gui.setSelectionState(this.selectionState);
  }

  performMouseUp(event, sendMessage) {

    if (event.button === 0) {
      // Select/Deselect on left click or do button thingy

      const { rawX, rawY } = this.getRawMouseCords(event);

      if (rawX > this.width - (8 * 50)) {
        return this.processGuiLeftMouseClick(rawX, rawY, sendMessage);
      }

      this.processMapLeftMouseClick(rawX, rawY, sendMessage);
    } else if (event.button === 2) {
      // Go do stuff on right click,  like move or whatnot

      if (this.selectionState.gui != null) {
        // Stop gui action with right click
        this.updateSelectionState({ ...this.selectionState, gui: null });
        return 'game';
      }

      // Otherwise let's move! (or attack)

      const { rawX, rawY } = this.getRawMouseCords(event);

      if (rawX > this.width - (8 * 50)) {
        // Ignore right clicks on the gui
        return 'game';
      }

      if (this.getSelectedMapItems().length !== 0) {
        this.processRightClickOnMap(rawX, rawY, sendMessage);
      }
    }

    return 'game';
  }

  mouseup(event, sendMessage) {
    const result = this.performMouseUp(event, sendMessage);

    this.mouseDownRawPosition = null;
    this.mouseDownGamePosition = null;

    return result;
  }

  mousedown(event) {
    const { rawX, rawY } = this.getRawMouseCords(event);

    this.mouseDownRawPosition = { rawX, rawY };

    if (rawX < this.width - (8 * 50)) {
      this.mouseDownGamePosition = this.getMouseGamePosition(rawX, rawY);
    }
  }

  getMouseGamePosition(rawX, rawY) {
    const x = rawX + this.x - 25;
    const y = rawY + this.y - 25;

    // The mouse coordinates in grid coordinatess.
    let mouseX = x / (50);
    let mouseY = y / (50);

    return { mouseX, mouseY };
  }

  processRightClickOnMap(rawX, rawY, sendMessage) {
    const { mouseX, mouseY } = this.getMouseGamePosition(rawX, rawY);

    let item = this.map.getItem(mouseX, mouseY);

    if (item == null) {
      if (this.getSelectedMapItems().every(entity => entity.type === 'ship')) {
        // Try to move to that location.
        const targetLocation = { x: mouseX, y: mouseY };
        // Move to an empty place

        this.getSelectedMapItems().forEach(ship => sendMessage({ type: 'MoveShip', shipId: ship.id, targetLocation }));
      }
    } else {
      if ((item.type === 'ship' || item.type === 'shipyard') && this.getSelectedMapItems().every(entity => entity.type === 'ship')
        && item.team !== this.map.team) {
        // Trying to attack something
        if (item.type === 'ship') {
          if (this.map.targetMode === 'hull') {
            // return the item
          } else if (this.map.targetMode === 'hardpoints') {
            item = this.map.getShipHardpointItem(item.id) || item;
          }
        }
        this.getSelectedMapItems().forEach(ship => sendMessage({ type: 'AttackShip', id: ship.id, targetId: item.id }));
      }
    }
  }

  mousemove(event) {
    const { rawX, rawY } = this.getRawMouseCords(event);
    this.hoveredCoords = { x: rawX, y: rawY };
  }

  getRawMouseCords(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      rawX: event.clientX - rect.left,
      rawY: event.clientY - rect.top,
    };
  }

  processGuiLeftMouseClick(rawX, rawY, sendMessage) {
    // In the gui
    const item = this.gui.getItem(rawX, rawY);
    if (item != null) {
      if (item.getType() === 'shipbuilder') {
        return 'shipbuilder';
      } else if (item.getType() === 'shiptemplate') {
        const template = templates[item.templateNum];
        this.getSelectedMapItems().forEach(shipyard => sendMessage({ type: 'MakeShip', islandID: shipyard.islandID, template }));
        return 'game';
      } else if (item.getType() === 'hull') {
        this.map.targetMode = 'hardpoints';
        this.updateTargetMode(sendMessage, 'hardpoints');
        return 'game';
      } else if (item.getType() === 'hardpoints') {
        this.map.targetMode = 'hull';
        this.updateTargetMode(sendMessage, 'hull');
        return 'game';
      }
      this.updateSelectionState({ ...this.selectionState, gui: { type: item.getType(), templateNum: item.getTemplateNum() } });
    }

    return 'game';
  }

  getSelectedMapItems() {
    return this.selectionState.map.map(id => this.map.getEntity(id));
  }

  updateTargetMode(sendMessage, mode) {
    for (const entity of this.map.entities.values()) {
      if (entity.team === this.team) {
        sendMessage({ type: 'UpdateMode', id: entity.id, targetMode: mode });
      }
    }
  }

  isDragAction(mouseX, mouseY) {
    const hoverGameCoords = this.getMouseGamePosition(this.hoveredCoords.x, this.hoveredCoords.y);

    if (this.mouseDownGamePosition == null ||
      this.mouseDownGamePosition.mouseX === mouseX ||
      this.mouseDownGamePosition.mouseY === mouseY) {
      return false;
    }

    if (
      hoverGameCoords.mouseX < this.mouseDownGamePosition.mouseX ||
      hoverGameCoords.mouseY < this.mouseDownGamePosition.mouseY) {
      return false;
    }

    return true;
  }

  processMapLeftMouseClick(rawX, rawY, sendMessage) {
    const x = rawX + this.x - 25;
    const y = rawY + this.y - 25;

    // The mouse coordinates in grid coordinatess.
    let mouseX = x / (50);
    let mouseY = y / (50);

    const mouseRoundedX = Math.round(mouseX);
    const mouseRoundedY = Math.round(mouseY);

    let item = this.map.getItem(mouseX, mouseY);

    if (this.selectionState.gui != null) {
      // The gui stuff always has priority.
      // If an empty tile on an island is selected then add a building
      if (this.selectionState.gui.type === 'mine' || this.selectionState.gui.type === 'shipyard') {
        const buildingType = this.selectionState.gui.type;
        sendMessage({ type: 'MakeBuilding', building: buildingType, x: mouseRoundedX, y: mouseRoundedY });
        this.updateSelectionState({ ...this.selectionState, gui: null });
      } else if (this.selectionState.gui.type === 'roundshot' && item != null && (item.type === 'ship' || item.type === 'shipyard')
        && this.map.team !== item.team) {
        if (item.type === 'ship') {
          item = this.map.getHardpointItem(mouseX, mouseY) || item;
        }
        sendMessage({ type: 'FireShot', id: this.selectionState.gui.templateNum, targetId: item.id });
      }
    } else if (this.isDragAction(mouseX, mouseY)) {
      // Perform a drag select.
      const hoverGameCoords = this.getMouseGamePosition(this.hoveredCoords.x, this.hoveredCoords.y);

      const items = this.map.getItemsWithinRectangle(this.mouseDownGamePosition.mouseX, this.mouseDownGamePosition.mouseY, hoverGameCoords.mouseX, hoverGameCoords.mouseY);

      this.updateSelectionState({ ...this.selectionState, map: items });
    } else if (item != null) {
      // Select
      this.updateSelectionState({ ...this.selectionState, map: [item.id] });
    } else {
      // Deselect
      this.updateSelectionState({ ...this.selectionState, map: [] });
    }
  }

  /**
   * Render the game. Also performs updates if necessary.
   */
  render() {
    this.context.clearRect(0, 0, this.width, this.height);

    this.context.save();

    this.context.translate(25, 25);

    this.context.translate(-this.x, -this.y);

    // Render the map and everything on it.
    this.map.render(this.context, this.images, this.selectionState);

    if (this.hoveredCoords && this.hoveredCoords.x < 400 && this.selectionState.gui == null) {
      if (this.mouseDownGamePosition != null) {
        const hoverGameCoords = this.getMouseGamePosition(this.hoveredCoords.x, this.hoveredCoords.y);

        const dx = hoverGameCoords.mouseX - this.mouseDownGamePosition.mouseX;
        const dy = hoverGameCoords.mouseY - this.mouseDownGamePosition.mouseY;

        if (dx > 0 && dy > 0) {
          this.context.strokeStyle = 'white';
          this.context.strokeRect(this.mouseDownGamePosition.mouseX * 50, this.mouseDownGamePosition.mouseY * 50, dx * 50, dy * 50);
        }
      }
    }

    this.context.restore();

    if (this.hoveredCoords && this.hoveredCoords.x >= 400) {
      this.gui.render(this.context, this.images, this.map, this.hoveredCoords);
    } else {
      this.gui.render(this.context, this.images, this.map, null);
    }

    this.context.translate(this.width - 150, 50);
    this.context.scale(0.25, 0.25);
    this.miniMap.renderMiniMap(this.context, this.images, this.x, this.y, this.width, this.height);
    this.context.scale(4, 4);
    this.context.translate(-this.width + 150, -50);
  }

  keydown(event, pressedKeys) {
    pressedKeys.add(event.keyCode);
  }

  keyup(event, pressedKeys) {
    pressedKeys.delete(event.keyCode);
  }
}

class Shipbuilder {
  /**
   * Contruct the shipbuilder menu
   */
  constructor(images) {
    this.images = images;
    this.shipbuildergui = new ShipbuilderGui(templates);

    this.canvas = document.getElementById('canvas');
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.context = this.canvas.getContext('2d');

    this.x = 0;
    this.y = 0;
  }

  mousedown(event) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left + this.x - 25;
    const mouseY = event.clientY - rect.top + this.y - 25;

    if (event.button === 2) {
      // Deselect on right click
      this.shipbuildergui.deselect();
      this.shipbuildergui.emptyslot(mouseX, mouseY);
    } else if (event.button === 0) {
      return this.shipbuildergui.select(mouseX, mouseY);
    }
    return 'shipbuilder';
  }

  mouseup(event) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left + this.x - 25;
    const mouseY = event.clientY - rect.top + this.y - 25;

    this.shipbuildergui.releaseItem(mouseX, mouseY);
  }

  mousemove(event) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left + this.x - 25;
    const mouseY = event.clientY - rect.top + this.y - 25;

    this.shipbuildergui.updatePos(mouseX, mouseY);
  }

  /**
   * Render the game. Also performs updates if necessary.
   */
  render() {
    this.context.clearRect(0, 0, this.width, this.height);
    this.context.save();

    this.context.translate(25, 25);

    this.context.translate(-this.x, -this.y);

    // Render the gui
    this.shipbuildergui.render(this.context, this.images);

    this.context.restore();
  }
}

document.addEventListener('DOMContentLoaded', function startCanvas() {
  loadImages().then((images) => {
    const main = new Main(images);
    main.start();
  });
});
