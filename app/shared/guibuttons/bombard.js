import GuiButton from '../guibutton';


export default class Bombard extends GuiButton {

  render(context, images) {
    if (this.selected) {
      context.strokeStyle = 'cyan';
      context.strokeRect(this.x, this.y, this.width, this.height);
    }

    context.fillStyle = 'lightgreen';
  	context.beginPath();
  	context.arc(this.x + this.width/2, this.y + this.width/2, this.height/2 + 5, 0, Math.PI * 2, true);
  	context.fill();

    context.drawImage(images.bombard, this.x, this.y, this.width, this.height);
  }

}
