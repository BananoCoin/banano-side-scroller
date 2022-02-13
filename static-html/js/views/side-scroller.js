import {get, set, clear, addChildSvgElement, displayErrorMessage} from '../lib/util.js';
import {bmcaptcha} from '../lib/bm-captcha.js';

const LOG_ALL_HREFS = false;
const BACKGROUND_WIDTH = 700;
const BACKGROUND_HEIGHT = 700;
const ASSET_INTERSECT_HEIGHT = 10;
const PENALTY_SIZE = 85;
const ASSET_SIZE = 75;
const MOVE_DX = 25;
const OBSTACLE_MAX_Y = BACKGROUND_HEIGHT - ASSET_SIZE;
const FOREGROUND_MAX_Y = BACKGROUND_HEIGHT - (ASSET_SIZE*2);
const FOREGROUND_START_Y = FOREGROUND_MAX_Y - 5;
const BACKGROUND_IMAGE_WIDTH = 700;
const FOREGROUND_DY = 15;
const MOVE_X = 40;
const MOVE_Y = 200;

const INTERVAL = 100;

const BURN_ACCOUNT = 'ban_1uo1cano1bot1a1pha1616161616161616161616161616161616p3s5tifp';

const MONKEY_HREF = 'monkey/monkey';

const REWARD_HREF = 'rewards/banana';

const WATER_HREF = 'ground/water';

const GROUND1_HREF = 'ground/ground1';

const GROUND2_HREF = 'ground/ground2';

const OBSTACLE_HREF = 'ground/obstacle';

const FLAVOR1_HREF = 'ground/flavor1';

const FLAVOR2_HREF = 'ground/flavor2';

const FLAVOR3_HREF = 'ground/flavor3';

const STATIC_BACKGROUND_HREF = 'background/static-background';

const MOVING_BACKGROUND_HREF = 'background/moving-background';

const BACKGROUND_OBJECT_HREFS = [
  'background/tipbot',
  'background/donations',
];

const assetsHrefs = [
  GROUND1_HREF,
  WATER_HREF,
  REWARD_HREF,
  OBSTACLE_HREF,
  FLAVOR1_HREF,
  FLAVOR2_HREF,
  FLAVOR3_HREF,
  GROUND2_HREF,
];

const allHrefs = [
  MONKEY_HREF,
  REWARD_HREF,
  WATER_HREF,
  STATIC_BACKGROUND_HREF,
  MOVING_BACKGROUND_HREF,
  'background/tipbot',
  'background/donations',
  GROUND1_HREF,
  GROUND2_HREF,
  FLAVOR1_HREF,
  FLAVOR2_HREF,
  FLAVOR3_HREF,
];

if (LOG_ALL_HREFS) {
  allHrefs.forEach((href, ix) => {
    console.log('href', href, 'ix', ix);
  });
}

const LOADING = 'loading...';

const CAPTCHA_HIDDEN = 'hidden';

const CAPTCHA_VISIBLE = 'visible';

const CAPTCHA_RESPONSE = 'response';

let score = LOADING;
let remaining = 0;
let captchaStatus = CAPTCHA_HIDDEN;
let sessionClosed = false;
let boardLoaded = false;
let boardLoading = false;
let sessionClosedCountdown = 0;
let continueConfetti = false;
let remainingJumpCount = 2;
let retryNow = 0;

const onLoad = async () => {
  document.addEventListener('keydown', keyDown, false);
  loadAccount();
  const dataPacksElt = document.querySelector('#data_packs');
  dataPacksElt.addEventListener('change', async (event) => {
    const response = await fetch('/data_pack', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: `{"data_pack": "${event.target.value}"}`,
    });
    const responseJson = await response.json();
    // console.log('data_pack', responseJson);
    if (responseJson.success) {
      location.reload();
    } else {
      displayErrorMessage(responseJson.message);
    }
  });

  const mainElt = document.querySelector('#side_scroller');
  clear(mainElt);
  bmcaptcha.init('#side_scroller', captchaClicked);

  const svgElt = addChildSvgElement(mainElt, 'svg', {
    'width': BACKGROUND_WIDTH,
    'height': BACKGROUND_HEIGHT,
    'stroke': 'black',
    'stroke-width': '2',
    'style': 'background-color:darkgray',
    'id': 'game',
  });
  addChildSvgElement(svgElt, 'image', {
    'y': '0',
    'x': '0',
    'width': BACKGROUND_WIDTH,
    'height': BACKGROUND_HEIGHT,
    'fill': 'none',
    'stroke': 'none',
    'class': 'background',
    'data_dx': 0,
    'href': STATIC_BACKGROUND_HREF,
  });

  for (let x = -BACKGROUND_IMAGE_WIDTH; x <= BACKGROUND_WIDTH; x += BACKGROUND_IMAGE_WIDTH) {
    addChildSvgElement(svgElt, 'image', {
      'y': '0',
      'x': x,
      'width': BACKGROUND_IMAGE_WIDTH,
      'height': BACKGROUND_HEIGHT,
      'fill': 'none',
      'stroke': 'none',
      'class': 'background',
      'data_dx': 10,
      'href': MOVING_BACKGROUND_HREF,
    });
  }
  addChildSvgElement(svgElt, 'image', {
    'y': FOREGROUND_MAX_Y-ASSET_SIZE,
    'x': ASSET_SIZE,
    'width': ASSET_SIZE,
    'height': ASSET_SIZE*2,
    'fill': 'none',
    'stroke': 'none',
    'class': 'background',
    'data_dx': 10,
    'href': BACKGROUND_OBJECT_HREFS[0],
  });

  addChildSvgElement(svgElt, 'image', {
    'y': FOREGROUND_MAX_Y-ASSET_SIZE,
    'x': (BACKGROUND_IMAGE_WIDTH/2)+ASSET_SIZE,
    'width': ASSET_SIZE,
    'height': ASSET_SIZE*2,
    'fill': 'none',
    'stroke': 'none',
    'class': 'background',
    'data_dx': 10,
    'href': BACKGROUND_OBJECT_HREFS[1],
  });

  const groupSvgElt = addChildSvgElement(svgElt, 'g');

  addChildSvgElement(svgElt, 'image', {
    'y': FOREGROUND_START_Y,
    'x': ASSET_SIZE,
    'width': ASSET_SIZE,
    'height': ASSET_SIZE,
    'fill': 'red',
    'stroke': 'none',
    'class': 'foreground',
    'href': MONKEY_HREF,
  });

  const sessionPauseTimeCallback = async () => {
    const response = await fetch('/session_pause_time', {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
      },
    });
    const responseJson = await response.json();
    // console.log('session_pause_time', responseJson);
    sessionClosedCountdown = parseInt(responseJson.pause_time, 0) / INTERVAL;
  };

  await sessionPauseTimeCallback();

  setInterval(() => {
    if (captchaStatus == CAPTCHA_HIDDEN) {
      if (boardLoaded) {
        if (sessionClosed) {
          if (sessionClosedCountdown > 0) {
            sessionClosedCountdown--;
            const sessionElt = document.querySelector('#session');
            sessionElt.innerHTML = '<span class="bg_pink">Session closed countdown:' + sessionClosedCountdown + '</span>';
          } else {
            location.reload();
          }
        } else {
          remaining--;
          if (remaining == 0) {
            showCaptcha();
          } else {
            moveBackground();
            moveFlavor();
            moveObstacle();
            moveReward();
            movePenalty();
            moveForegroundDown();
            updateScore();
          }
        }
      } else {
        loadBoard(groupSvgElt);
      }
    }
  }, INTERVAL);
};

const loadAccount = () => {
  const accountElt = document.querySelector('#account');
  if (window.localStorage.account === undefined) {
    window.localStorage.account = BURN_ACCOUNT;
  }
  accountElt.value = window.localStorage.account;
  updateAccountColor();
};

const saveAccount = () => {
  const accountElt = document.querySelector('#account');
  window.localStorage.account = accountElt.value;
  updateAccountColor();
};

const updateAccount = () => {
  saveAccount();
};

const updateAccountColor = () => {
  const accountElt = document.querySelector('#account');
  const accountRegexElt = document.querySelector('#accountRegex');

  const accountRegex = accountRegexElt.innerText;
  const accountRegExp = new RegExp(accountRegex);

  if (accountRegExp.test(accountElt.value)) {
    if (accountElt.value == BURN_ACCOUNT) {
      accountElt.className = 'bg_pink';
    } else {
      accountElt.className = 'bg_white';
    }
  } else {
    accountElt.className = 'bg_yellow';
  }
  // console.log('updateAccountColor', 'accountRegex', accountRegex, 'className', accountElt.className);
};

const incrementScore = async (rewardElt) => {
  if (window.grecaptchaToken == undefined) {
    return;
  }
  let grecaptchaToken;
  const retryNowDiff = retryNow - Date.now();

  // const retryNowMsg = `retryNow = ${retryNow}, now = ${Date.now()}, diff = ${retryNowDiff}`;
  // console.log(retryNowMsg);

  if (retryNowDiff > 1000) {
    grecaptchaToken = '';
  } else {
    retryNow = 0;
    grecaptchaToken = window.grecaptchaToken;
    window.grecaptchaToken = undefined;
    window.refreshGrecaptchaToken();
  }

  const ix = rewardElt.dataset.chunkIx;
  const id = rewardElt.dataset.chunkId;
  const colIx = rewardElt.dataset.chunkColIx;
  const rowIx = rewardElt.dataset.chunkRowIx;
  const account = window.localStorage.account;
  const url = '/increment_score?' +
   `account=${account}&id=${id}&ix=${ix}&col_ix=${colIx}`+
   `&row_ix=${rowIx}&token=${grecaptchaToken}`;
  const response = await fetch(url, {
    method: 'GET',
  });
  const responseJson = await response.json();
  // console.log('incrementScore', responseJson);
  if (!responseJson.success) {
    displayErrorMessage(responseJson.message);
  } else {
    if (responseJson.retrySeconds !== undefined) {
      retryNow = Date.now() + (responseJson.retrySeconds * 1000);
      // displayErrorMessage(retryNowMsg);
    }
  }
  sessionClosed = !responseJson.session_open;

  const sessionElt = document.querySelector('#session');
  sessionElt.innerText = responseJson.session_description;

  await loadScore();
};

const loadScore = async () => {
  const account = window.localStorage.account;
  const url = `/score?account=${account}`;
  const response = await fetch(url, {
    method: 'GET',
  });
  if (response.status === 200) {
    const responseJson = await response.json();
    if (responseJson.success) {
      score = `${responseJson.tempScore} pending, ${responseJson.finalScore} cemented.`;
    } else {
      displayErrorMessage(responseJson.message);
    }
    await updateScore();
  } else {
    displayErrorMessage(response.statusText);
  }
};

const loadChunkIds = async () => {
  const account = window.localStorage.account;
  const response = await fetch(`/board?account=${account}`, {
    method: 'GET',
  });
  const responseJson = await response.json();
  return responseJson.chunk_ids;
};

const loadChunkById = async (id) => {
  const response = await fetch('/chunk?id=' + id, {
    method: 'GET',
  });
  const responseJson = await response.json();
  return responseJson.chunk;
};

const loadBoard = async (groupSvgElt) => {
  if (boardLoading) {
    return;
  }
  boardLoading = true;
  boardLoaded = false;
  clear(groupSvgElt);
  const chunkIds = await loadChunkIds();
  remaining = 0;
  let x = 0;

  const steps = parseInt(ASSET_SIZE / MOVE_DX, 0);

  for (let ix = 0; ix < chunkIds.length; ix++) {
    const id = chunkIds[ix];
    const chunk = await loadChunkById(id);
    remaining += chunk.length * steps;

    for (let chunkColumnIx = 0; chunkColumnIx < chunk.length; chunkColumnIx++) {
      const chunkColumn = chunk[chunkColumnIx];
      let y = OBSTACLE_MAX_Y;
      for (let chunkRowIx = 0; chunkRowIx < chunkColumn.length; chunkRowIx++) {
        const assetId = chunkColumn[chunkRowIx];
        if (assetId >= 0) {
          if (assetId < assetsHrefs.length) {
            const href = assetsHrefs[assetId];
            let classNm = 'obstacle';
            switch (href) {
              case GROUND1_HREF:
              case GROUND2_HREF:
                classNm = 'obstacle';
                break;
              case REWARD_HREF:
                classNm = 'reward';
                break;
              case WATER_HREF:
              case OBSTACLE_HREF:
                classNm = 'penalty';
                break;
              case FLAVOR1_HREF:
              case FLAVOR2_HREF:
              case FLAVOR3_HREF:
                classNm = 'flavor';
                break;
            }
            addChildSvgElement(groupSvgElt, 'image', {
              'y': y,
              'x': x,
              'width': ASSET_SIZE,
              'height': ASSET_SIZE,
              'fill': 'none',
              'stroke': 'none',
              'class': classNm,
              'href': href,
              'data-chunk-ix': ix,
              'data-chunk-id': id,
              'data-chunk-col-ix': chunkColumnIx,
              'data-chunk-row-ix': chunkRowIx,
            });
          } else {
            console.log('no asset:' + assetId);
          }
        }
        y -= ASSET_SIZE;
      }
      x += ASSET_SIZE;
    }
  }
  boardLoaded = true;
  boardLoading = false;
  await loadScore();
};

const moveUp = (event) => {
  // console.log('moveUp', event);
  if (!event.isTrusted) {
    return;
  }
  // console.log('moveUp');
  if (remainingJumpCount > 0) {
    remainingJumpCount--;
    synchJumpCount();
    moveForeground(0, -MOVE_Y);
  }
  return false;
};

const moveLeft = (event) => {
  // console.log('moveLeft', event);
  if (!event.isTrusted) {
    return;
  }
  // console.log('moveLeft');
  moveForeground(-MOVE_X, 0);
  return false;
};

const moveRight = (event) => {
  // console.log('moveRight', event);
  if (!event.isTrusted) {
    return;
  }
  // console.log('moveRight');
  moveForeground(MOVE_X, 0);
  return false;
};

const moveForeground = (x, y) => {
  if (sessionClosed) {
    displayErrorMessage('cannot move when session is closed.');
    return;
  }
  if (captchaStatus != CAPTCHA_HIDDEN) {
    displayErrorMessage('cannot move when captcha is displayed.');
    return;
  }
  const foregroundElts = [...document.getElementsByClassName('foreground')];
  foregroundElts.forEach((foregroundElt) => {
    const eltX = parseFloat(get(foregroundElt, 'x'));
    const eltY = parseFloat(get(foregroundElt, 'y'));
    const eltWidth = parseFloat(get(foregroundElt, 'width'));
    if (eltX + x < 0) {
      set(foregroundElt, 'x', 0);
    } else if (eltX + x > BACKGROUND_WIDTH - eltWidth) {
      set(foregroundElt, 'x', BACKGROUND_WIDTH - eltWidth);
    } else {
      set(foregroundElt, 'x', eltX + x);
    }
    if (eltY + y < 0) {
      set(foregroundElt, 'y', 0);
    } else if (eltY + y > FOREGROUND_MAX_Y) {
      set(foregroundElt, 'y', FOREGROUND_MAX_Y);
    } else {
      set(foregroundElt, 'y', eltY + y);
    }
  });
};

const moveBackground = () => {
  if (sessionClosed) {
    return;
  }
  if (captchaStatus != CAPTCHA_HIDDEN) {
    return;
  }
  const backgroundElts = [...document.getElementsByClassName('background')];
  backgroundElts.forEach((backgroundElt) => {
    const dx = parseFloat(get(backgroundElt, 'data_dx'));
    const x = parseFloat(get(backgroundElt, 'x'));
    const eltWidth = parseFloat(get(backgroundElt, 'width'));
    if (x < -eltWidth) {
      set(backgroundElt, 'x', (x - dx) + BACKGROUND_IMAGE_WIDTH + eltWidth);
    } else {
      set(backgroundElt, 'x', x - dx);
    }
  });
};

const movePenalty = () => {
  if (sessionClosed) {
    return;
  }
  if (captchaStatus != CAPTCHA_HIDDEN) {
    return;
  }
  const obstacleElts = [...document.getElementsByClassName('penalty')];
  obstacleElts.forEach((obstacleElt) => {
    const x = parseFloat(get(obstacleElt, 'x'));
    const eltWidth = parseFloat(get(obstacleElt, 'width'));
    if (x >= -eltWidth) {
      // if elt is not offscreen, move it left.
      set(obstacleElt, 'x', x - MOVE_DX);
    } else {
      const parentElement = obstacleElt.parentElement;
      parentElement.removeChild(obstacleElt);
    }
  });
};

const moveObstacle = () => {
  if (sessionClosed) {
    return;
  }
  if (captchaStatus != CAPTCHA_HIDDEN) {
    return;
  }
  const obstacleElts = [...document.getElementsByClassName('obstacle')];
  obstacleElts.forEach((obstacleElt) => {
    const x = parseFloat(get(obstacleElt, 'x'));
    const eltWidth = parseFloat(get(obstacleElt, 'width'));
    if (x >= -eltWidth) {
      // if elt is not offscreen, move it left.
      set(obstacleElt, 'x', x - MOVE_DX);
    } else {
      const parentElement = obstacleElt.parentElement;
      parentElement.removeChild(obstacleElt);
    }
  });
};

const moveReward = () => {
  if (sessionClosed) {
    return;
  }
  if (captchaStatus != CAPTCHA_HIDDEN) {
    return;
  }
  const elts = [...document.getElementsByClassName('reward')];
  elts.forEach((elt) => {
    const x = parseFloat(get(elt, 'x'));
    const eltWidth = parseFloat(get(elt, 'width'));
    if (x >= -eltWidth) {
      // if elt is not offscreen, move it left.
      set(elt, 'x', x - MOVE_DX);
    } else {
      const parentElement = elt.parentElement;
      parentElement.removeChild(elt);
    }
  });
};

const moveFlavor = () => {
  if (sessionClosed) {
    return;
  }
  if (captchaStatus != CAPTCHA_HIDDEN) {
    return;
  }
  const elts = [...document.getElementsByClassName('flavor')];
  elts.forEach((elt) => {
    const x = parseFloat(get(elt, 'x'));
    const eltWidth = parseFloat(get(elt, 'width'));
    if (x >= -eltWidth) {
      // if elt is not offscreen, move it left.
      set(elt, 'x', x - MOVE_DX);
    } else {
      const parentElement = elt.parentElement;
      parentElement.removeChild(elt);
    }
  });
};

const moveForegroundDown = async () => {
  if (sessionClosed) {
    return;
  }
  if (captchaStatus != CAPTCHA_HIDDEN) {
    return;
  }

  const obstacleElts = [...document.getElementsByClassName('obstacle')];
  const penaltyElts = [...document.getElementsByClassName('penalty')];
  const foregroundElts = [...document.getElementsByClassName('foreground')];

  for (let foregroundEltIx = 0; foregroundEltIx < foregroundElts.length; foregroundEltIx++) {
    const foregroundElt = foregroundElts[foregroundEltIx];
    const y = parseFloat(get(foregroundElt, 'y'));
    let penaltyJump = false;
    let penlatyJumpElt = undefined;
    let moveDown = true;
    let updateJumpCount = false;
    obstacleElts.forEach((obstacleElt) => {
      if (intersect(obstacleElt, foregroundElt, ASSET_INTERSECT_HEIGHT, ASSET_INTERSECT_HEIGHT, ASSET_SIZE)) {
        moveDown = false;
        updateJumpCount = true;
      }
    });
    for (let penaltyEltIx = 0; penaltyEltIx < penaltyElts.length; penaltyEltIx++) {
      const penaltyElt = penaltyElts[penaltyEltIx];
      if (intersect(penaltyElt, foregroundElt, ASSET_INTERSECT_HEIGHT, ASSET_INTERSECT_HEIGHT, PENALTY_SIZE)) {
        moveDown = false;
        updateJumpCount = true;
        penaltyJump = true;
        penlatyJumpElt = penaltyElt;
      }
    }
    if (updateJumpCount) {
      remainingJumpCount = 2;
      synchJumpCount();
    }

    if (y < FOREGROUND_MAX_Y) {
      if (moveDown) {
        set(foregroundElt, 'y', y + FOREGROUND_DY);
      }
    } else {
      set(foregroundElt, 'y', FOREGROUND_MAX_Y);
    }
    if (penaltyJump) {
      winConfetti();
      moveUp({isTrusted: true});
      if ((!score.startsWith('0')) && (score != LOADING)) {
        score == LOADING;
        await incrementScore(penlatyJumpElt);
      }
    }
  }
};

const intersect = (obstacleElt, foregroundElt, oH, fH, yOffset) => {
  if (oH == undefined) {
    oH = get(obstacleElt, 'height');
  }
  if (fH == undefined) {
    fH = get(foregroundElt, 'height');
  }
  if (yOffset == undefined) {
    yOffset = 0;
  }
  const oX = parseFloat(get(obstacleElt, 'x'));
  const oY = parseFloat(get(obstacleElt, 'y'));
  const oW = parseFloat(get(obstacleElt, 'width'));
  oH = parseFloat(oH);
  const fX = parseFloat(get(foregroundElt, 'x'));
  const fY = parseFloat(get(foregroundElt, 'y')) + parseFloat(yOffset);
  const fW = parseFloat(get(foregroundElt, 'width'));
  fH = parseFloat(fH);
  if (fX > oX + oW) {
    return false;
  }
  if (fX + fW < oX) {
    return false;
  }
  if (fY > oY + oH) {
    return false;
  }
  if (fY + fH < oY) {
    return false;
  }
  return true;
};

const updateScore = async () => {
  if (sessionClosed) {
    return;
  }
  if (captchaStatus != CAPTCHA_HIDDEN) {
    return;
  }
  const scoreElt = document.querySelector('#score');
  const foregroundElts = [...document.getElementsByClassName('foreground')];
  const rewardElts = [...document.getElementsByClassName('reward')];
  const penaltyElts = [...document.getElementsByClassName('penalty')];
  for (let foregroundEltIx = 0; foregroundEltIx < foregroundElts.length; foregroundEltIx++) {
    const foregroundElt = foregroundElts[foregroundEltIx];
    for (let rewardEltIx = 0; rewardEltIx < rewardElts.length; rewardEltIx++) {
      const rewardElt = rewardElts[rewardEltIx];
      if (intersect(rewardElt, foregroundElt)) {
        const parentElement = rewardElt.parentElement;
        if (parentElement != null) {
          parentElement.removeChild(rewardElt);
          await incrementScore(rewardElt);
        }
      }
    }

    for (let penaltyEltIx = 0; penaltyEltIx < penaltyElts.length; penaltyEltIx++) {
      const penaltyElt = penaltyElts[penaltyEltIx];
      if (intersect(penaltyElt, foregroundElt)) {
        await incrementScore(penaltyElt);
      }
    }
  }
  if (score.startsWith('0')) {
    scoreElt.className = 'small bg_pink';
  } else {
    scoreElt.className = 'small bg_white';
  }
  scoreElt.innerText = 'Score:' + score + ' Moves Remaining:' + remaining;
};

const captchaClicked = (response) => {
  // console.log('captchaClicked', response);
  if (!response.success) {
    const actualSelector = '#bm_captcha_image_' + response.actual;
    console.log('showCaptcha', 'actual selector', actualSelector);
    const actualImageElt = document.querySelector(actualSelector);
    if (actualImageElt != null) {
      actualImageElt.setAttribute('class', 'red_striped_background');
    }

    const expectedSelector = '#bm_captcha_image_' + response.expected;
    console.log('showCaptcha', 'expected selector', expectedSelector);
    const expectedImageElt = document.querySelector(expectedSelector);
    if (expectedImageElt != null) {
      expectedImageElt.setAttribute('class', 'green_background');
    }

    captchaStatus = CAPTCHA_RESPONSE;
    displayErrorMessage('captcha failed. (continuing in 5s) ' + response.message);
    setTimeout(() => {
      captchaStatus = CAPTCHA_HIDDEN;
      hideCaptcha();
    }, 5000);
  } else {
    captchaStatus = CAPTCHA_HIDDEN;
    hideCaptcha();
    displayErrorMessage('captcha success. ' + response.message);
  }
  boardLoaded = false;
};

const hideCaptcha = () => {
  bmcaptcha.hideCaptcha();
  const gameElt = document.querySelector('#game');
  set(gameElt, 'style', 'display:block');
};

const showCaptcha = () => {
  captchaStatus = CAPTCHA_VISIBLE;
  const callback = (json) => {
    // const gameElt = document.querySelector('#game');
    // set(gameElt, 'style', 'display:none');
    // bmcaptcha.hideCaptcha();
  };
  bmcaptcha.showCaptcha(callback);
};


const keyDown = (e) => {
  switch (e.keyCode) {
    case 37:
      moveLeft(e);
      break;
    case 32:
    case 38:
      moveUp(e);
      break;
    case 39:
      moveRight(e);
      break;
    default:
      console.log('keyDown', e.keyCode);
  }
};


const winConfetti = () => {
  // console.log('winConfetti', 'continueConfetti', continueConfetti);
  if (continueConfetti) {
    return;
  }
  continueConfetti = true;
  const count = 20;
  const defaults = {
    origin: {y: 0.7},
    shapes: ['square', 'circle', 'emoji:🔥'],
    colors: ['#FFFF00', '#00FF00'],
  };

  /**
  * @param {String} particleRatio the particle ratio
  * @param {String} opts the options
  */
  function fire(particleRatio, opts) {
    confetti(Object.assign({}, defaults, opts, {
      particleCount: Math.floor(count * particleRatio),
    }));
  }

  if (continueConfetti) {
    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
  }
  if (continueConfetti) {
    fire(0.2, {
      spread: 60,
    });
  }
  if (continueConfetti) {
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });
  }
  if (continueConfetti) {
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });
  }
  if (continueConfetti) {
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  }
  continueConfetti = false;
};

const synchJumpCount = () => {
  const jumpCountElt = document.querySelector('#jumpCount');
  jumpCountElt.innerText = remainingJumpCount;
};


window.bmcaptcha = bmcaptcha;
window.onLoad = onLoad;
window.moveUp = moveUp;
window.moveLeft = moveLeft;
window.moveRight = moveRight;
window.updateAccount = updateAccount;
