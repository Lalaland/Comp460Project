import { loadBuffer } from './audio';

// A mapping of image name to image source location.
const sources = {
  ship: 'ship.png',
  mine: 'mine2.png',
  shipyard: 'shipyard2.png',
  money: 'coin2.png',
  shipskeleton: 'shipskeleton.png',
  roundshot: 'roundshot.png',
  chainshot: 'chainshot.png',
  grapeshot: 'grapeshot.png',
  shell: 'shell.png',
  cancelshot: 'cancelshot.png',
  gunboat: 'gunboat2.png',
  frigate: 'frigate2.png',
  galleon: 'galleon2.png',
  template: 'template.png',
  stats: 'stats.png',
  info: 'info.png',
  exit: 'exit.png',
  smoke: 'smoke.png',
  cannon: 'cannon.png',
  designer: 'designer2.png',
  targettoggleHull: 'targettoggleHull2.png',
  targettoggleCannon: 'targettoggleCannon2.png',
  blueFlag: 'blueFlag.png',
  redFlag: 'redFlag.png',
  save: 'save2.png',
  grayBack: 'grayBack.png',
  splashscreen: 'splashscreen.png',
  notready: 'notready2.png',
  ready: 'ready2.png',
  restart: 'restart.png',
  piratesTag: 'piratesTag.png',
  imperialsTag: 'imperialsTag.png',
  piratesWinTag: 'piratesWinTag.png',
  imperialsWinTag: 'imperialsWinTag.png',
  westindies: 'westindies2.png',
  tropics: 'tropics2.png',
  greatlakes: 'greatlakes2.png',
  island: '1x1islandDot.png',

  test: 'test.mp3',
  'bensound-epic': 'bensound-epic.mp3',

  'cannon-sound': 'cannon.mp3',

  'pirateCommand': 'pirateCommandVoice.mp3',
  'empireCommand': 'empireCommandVoice.mp3',

  'pirateMoreGold': 'pirateMoreGold.mp3',
  'empireMoreGold': 'empireMoreGold.mp3',
};

/**
 * Load a single image.
 * Takes as input the url source and returns a Promise<Image>
 */
function loadImage(source) {
  const img = new Image();

  return new Promise((resolve) => {
    img.onload = () => {
      resolve(img);
    };
    img.src = '/static/' + source;
  });
}

/**
 * Load a single sound.
 * Takes as input the url source and returns a Promise<Audio>
 */
function loadSound(source) {
  return loadBuffer('/static/' + source);
}

function loadAsset(source) {
  if (source.endsWith('.png')) {
    return loadImage(source);
  }

  return loadSound(source);
}

/**
 * Load all the assets in the asset map.
 * Returns a promise for a mapping from image name to the Image objects.
 * See the `sources` map at the top of the file
 */
export default function loadAssets() {
  const assetNames = Object.keys(sources);
  const assetPromises = assetNames.map((name) => loadAsset(sources[name]));

  return Promise.all(assetPromises).then(assets => {
    const result = {};
    for (let i = 0; i < assetNames.length; i++) {
      result[assetNames[i]] = assets[i];
    }

    return result;
  });
}
