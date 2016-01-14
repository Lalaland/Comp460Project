import Button from './button';
import {MAP_WIDTH} from './gamemap';
import {MAP_HEIGHT} from './gamemap';


/**
 * A map of the game containing islands and all current ships.
 */
export default class Gui {

  constructor() {
    this.buttons = [new Button('mine', 1+MAP_WIDTH, 1), new Button('shipyard', 1+MAP_WIDTH, 3)];

    this.grid = {};

    this._initGrid();

    this.width = 3;
    this.height = 8;
  }

  _initGrid() {
    for (const button of this.buttons) {
      this.grid[button.getX() + ',' + button.getY()] = button;
    }
  }

  /**
   * Render the gui
   */
  render(context, images) {
    for (let x = MAP_WIDTH; x < this.width + MAP_WIDTH; x++) {
      for (let y = 0; y < this.height; y++) {
        context.fillStyle = 'gray';
        context.fillRect((x - 0.5) * 50, (y - 0.5) * 50, 50, 50);
        context.strokeRect((x - 0.5) * 50, (y - 0.5) * 50, 50, 50);
      }
    }

    for (const button of this.buttons) {
      button.render(context, images);
    }
  }

  getItem(x, y) {
    return this.grid[x + ',' + y];
  }

  displayShipyard() {
    this.buttons.push(new Button('shiptemplate', MAP_WIDTH, 5));
    for (const button of this.buttons) {
      this.grid[button.getX() + ',' + button.getY()] = button;
    }
  }

  removeShipyardDisplay() {
    for(var i = this.buttons.length - 1; i >= 0; i--) {
      if(this.buttons[i].getType() === 'shiptemplate') {
         this.grid[this.buttons[i].getX() + ',' + this.buttons[i].getY()] = null;
         this.buttons.splice(i, 1);
      }
    }
  }
}