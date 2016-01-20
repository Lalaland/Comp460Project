import {MAP_WIDTH} from './gamemap';
import {MAP_HEIGHT} from './gamemap';
import Mine from './mine';
import Shipyard from './shipyard';


/**
 * A button entity.
 */

export default class Button {

  constructor(type, x, y, templateNum) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.isSelected = false;

    this.templateNum = templateNum;
  }

  render(context, images) {
    switch (this.type) {
      case 'mine':
        context.drawImage(images.mine, this.x * 50, this.y * 50, 50, 50);
        break;
      case 'shipyard':
        context.drawImage(images.shipyard, this.x * 50, this.y * 50, 50, 50);
        break;
      case 'shiptemplate':
        context.drawImage(images.ship, this.x * 50, this.y * 50, 50, 50);
        break;
      case 'shipbuilder':
        context.fillStyle = 'red';
        context.fillRect(this.x * 50, this.y * 50, 50, 50);
        context.font="10px Arial"
        context.fillStyle = 'black';
        context.fillText('SHIP', this.x * 50 + 15, this.y * 50 + 10);
        context.fillText('BUILDER', this.x * 50 + 5, this.y * 50 + 20);
        break;
      default:
        console.error('Trying to render unknown button');
    }

    if (this.isSelected) {
      context.strokeStyle = 'cyan';
      context.strokeRect(
        this.x * 50,
        this.y * 50,
        50,
        50
      );
    }
  }

  getX() {
    return this.x;
  }

  getY() {
    return this.y;
  }

  getTemplateNum() {
    return this.templateNum;
  }

  getBuilding() {
    switch (this.type) {
      case 'mine':
        return 'mine';
      case 'shipyard':
        return 'shipyard';
      default:
        console.error('unknown building type');
        return null;
    }
  }

  getType() {
    return this.type;
  }
}
