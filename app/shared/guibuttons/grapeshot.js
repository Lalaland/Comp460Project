import GuiButton from '../guibutton';


export default class Grapeshot extends GuiButton {

  render(renderList) {
    if (this.selected) {
      renderList.strokeRect('cyan', 2, this.x, this.y, this.width, this.height);
    }

    renderList.addImage('greenCircle', this.x - 5, this.y - 5, 50, 50);
    renderList.addImage('grapeshot', this.x, this.y, this.width, this.height);
  }

}
