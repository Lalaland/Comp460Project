import MapSelect from '../shared/guibuttons/mapselect';
import Ready from '../shared/guibuttons/ready';
import RenderList from '../shared/renderlist';
import { createMap } from '../shared/maps';
import { createSource } from './audio';

export const GUI_WIDTH = 200;

export default class StartScreen {
  constructor(images, game) {
    this.canvas = document.getElementById('canvas');
    this.context = this.canvas.getContext('webgl');

    this.game = game;
    this.game.gui.displayMode = 'designer';
    this.game.gui.displayContext = 'startscreen';

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    this.images = images;
    this.team = null;

    this.mode = 'splash';

    this.epicSound = createSource(images['bensound-epic']);
    this.epicSound.loop = true;
    this.epicSound.start(0);

    this.renderList = new RenderList(this.images.pixelJson);
  }

  getMapSelectButtons() {
    const buttons = [];

    buttons.push(new MapSelect('mapselect', 680, 325, 102, 26, 0));
    buttons.push(new MapSelect('mapselect', 680, 375, 102, 26, 1));
    buttons.push(new MapSelect('mapselect', 680, 425, 102, 26, 2));
    buttons.push(new MapSelect('mapselect', 825, 325, 102, 26, 3));
    buttons.push(new MapSelect('mapselect', 825, 375, 102, 26, 4));
    buttons.push(new MapSelect('mapselect', 825, 425, 102, 26, 5));

    buttons[0].rendertype = 'westindies2';
    buttons[1].rendertype = 'tropics2';
    buttons[2].rendertype = 'greatlakes2';
    buttons[3].rendertype = 'smallRandomMap';
    buttons[4].rendertype = 'mediumRandomMap';
    buttons[5].rendertype = 'largeRandomMap';


    let readyButton;
    if (this.team === '1') {
      readyButton = new Ready('notready2', 230, 355, 128, 26);
    } else {
      readyButton = new Ready('notready2', 190, 305, 128, 26);
    }

    readyButton.setType(this.readyStates[this.team] ? 'ready2' : 'notready2');

    buttons.push(readyButton);

    buttons[this.mapNum].selected = true;

    return buttons;
  }

  render(mainProgram) {
    mainProgram.setup();

    this.context.clearColor(0.0, 0.0, 0.0, 1.0);
    this.context.clear(this.context.COLOR_BUFFER_BIT);

    this.renderList.reset();


    if (this.mode === 'splash') {
      this.renderSplash();
    } else if (this.mode === 'setup') {
      this.renderSetup();
    }

    this.renderList.render(this.context);
  }

  renderSplash() {
    this.renderList.addImage('splashscreen', 0, 0);
  }

  renderSetup() {
    this.renderList.addImage('linen', 0, 0, this.width, this.height);

    this.renderList.translate(this.width - 520, 50);
    const map = createMap(this.mapNum);
    const scale = map.width / 5;
    this.renderList.scale(1 / scale);
    this.renderList.translate(25, 25);

    map.renderStartScreenMiniMap(this.renderList, this.mapNum);

    this.renderList.translate(-25, -25);
    this.renderList.scale(scale);

    this.renderList.translate(-this.width + 520, -50);

    for (const button of this.getMapSelectButtons()) {
      button.render(this.renderList);
    }

    if (this.team == null) {
      this.renderLoading();
    } else {
      if (this.team === '1') {
        this.renderList.addImage('piratesTag', 0, 0);
      } else if (this.team === '0') {
        this.renderList.addImage('imperialsTag', 0, 0);
      }

      this.renderList.addImage('status', 40, 250);

      let startingY = 300;
      for (const team of Object.keys(this.readyStates)) {
        if (team !== this.team) {
          this.renderList.addImage((team === '1' ? 'pirates' : 'imperials') + (this.readyStates[team] ? 'Ready' : 'NotReady'), 50, startingY);
        } else {
          this.renderList.addImage((team === '1' ? 'pirates' : 'imperials'), 50, startingY);
        }

        startingY += 50;
      }
    }

    if (this.hoveredCoords && this.hoveredCoords.x >= this.width - GUI_WIDTH) {
      this.game.gui.render(this.renderList, this.map, this.hoveredCoords);
    } else {
      this.game.gui.render(this.renderList, this.map, null);
    }
  }

  renderLoading() {
    // Don't render anything for now
  }

  _assignTeam({ team, readyStates, mapNum }) {
    this.team = team;
    this.game.team = team;
    this.mapNum = mapNum;
    this.readyStates = readyStates;
  }

  _updateReadyStates({ readyStates }) {
    this.readyStates = readyStates;
  }

  selectMap(mapNum) {
    this.mapNum = mapNum;
  }

  getTeam() {
    return this.team;
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

  mousedown(event, sendMessage) {
    if (this.mode === 'splash') {
      this.mousedownSplash(event, sendMessage);
    } else if (this.mode === 'setup') {
      this.mousedownSetup(event, sendMessage);
    }
  }

  mousedownSplash() {
    this.mode = 'setup';
  }

  stopSound() {
    this.epicSound.stop(0);
  }

  mousedownSetup(event, sendMessage) {
    if (this.team == null) {
      return;
    }

    const { rawX, rawY } = this.getRawMouseCords(event);

    const item = this.game.gui.getItem(rawX, rawY);
    this.game.gui.designerSelection(item);
    this.game.gui.displayMode = 'designer';

    for (const button of this.getMapSelectButtons()) {
      if (button.isOver(rawX, rawY)) {
        if (button.getType() === 'mapselect') {
          sendMessage({ type: 'UpdateMap', mapNum: button.getSlotNum() });
        } else {
          button.setType();
          sendMessage({ type: 'SetReadyState', readyState: !this.readyStates[this.team] });
        }
      }
    }
  }
}
