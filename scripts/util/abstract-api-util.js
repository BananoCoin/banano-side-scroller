'use strict';
// libraries
const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;
const {createCanvas} = require('canvas');

// modules
const randomUtil = require('./random-util.js');

// constants
const BORDER = 'FFB6AAFF';
const TRANSPARENT = '00000000';
const BLACK = '000000FF';
const WHITE = 'FFFFFFFF';

const COLORS = [
];

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
const abstractSpriteSheets = [];
/* eslint-enable no-unused-vars */

// functions
const init = (_config, _loggingUtil) => {
  if (_config === undefined) {
    throw Error('config is required.');
  }
  if (_loggingUtil === undefined) {
    throw Error('loggingUtil is required.');
  }
  config = _config;
  loggingUtil = _loggingUtil;
  loadColors();
  loadAbstractSpriteSheets();
};

const deactivate = () => {
  config = undefined;
  loggingUtil = undefined;
  abstractSpriteSheets.length = 0;
};

const loadColors = () => {
  // let rSet = new Set();
  // let gSet = new Set();
  // let bSet = new Set();
  for (let r = 16; r < (256-14); r += 32) {
    // rSet.add(r);
    for (let g = 16; g < (256-14); g += 32) {
      // gSet.add(g);
      for (let b = 25; b < (256-25); b += 52) {
        // bSet.add(b);
        COLORS.push(`#${r.toString(16)}${g.toString(16)}${b.toString(16)}`);
      }
    }
  }
  // COLORS.length = 0;
  // COLORS.push('white');
  // console.log('rSet.size', rSet.size);
  // console.log('gSet.size', gSet.size);
  // console.log('bSet.size', bSet.size);
  // console.log('COLORS.length', COLORS.length);
};

const loadAbstractSpriteSheets = () => {
  abstractSpriteSheets.length = 0;

  const spriteSheets = config.abstract.spriteSheets;
  const spriteOffsets = config.abstract.spriteOffsets;
  let maxMonkeyCount;
  for (let spriteSheetIx = 0; spriteSheetIx < spriteSheets.length; spriteSheetIx++) {
    const spriteSheet = spriteSheets[spriteSheetIx];

    const file = path.join(config.abstract.dir, `${spriteSheet.name}.png`);
    const data = fs.readFileSync(file);
    const spriteSheetPng = PNG.sync.read(data);
    spriteSheetPng.name = spriteSheet.name;
    const sprites = parseSpriteSheetPng(spriteSheetPng);
    if (maxMonkeyCount === undefined) {
      maxMonkeyCount = sprites.length;
    } else {
      maxMonkeyCount = Math.min(maxMonkeyCount, sprites.length);
    }

    // console.log('spriteSheet', spriteSheet);
    for (let spriteOffsetIx = 0; spriteOffsetIx < spriteOffsets.length; spriteOffsetIx++) {
      const spriteOffset = spriteOffsets[spriteOffsetIx];
      const abstractSpriteSheet = {};
      abstractSpriteSheet.name = `${spriteSheet.name}_${spriteOffset.name}`;
      abstractSpriteSheet.sprites = [];

      // console.log('spriteOffset', spriteOffset);
      for (let spriteIx = 0; spriteIx < sprites.length; spriteIx++) {
        const sprite = sprites[spriteIx];
        const spriteName = `${abstractSpriteSheet.name}_${spriteIx}`;
        const spriteAtOffset = {};
        spriteAtOffset.name = spriteName;
        spriteAtOffset.dx = (spriteSheet.dx * spriteOffset.scale) + (spriteOffset.dx * 2);
        spriteAtOffset.dy = (spriteSheet.dy * spriteOffset.scale) + (spriteOffset.dy * 2);
        spriteAtOffset.scale = spriteOffset.scale;
        spriteAtOffset.inverseScale = 1/spriteOffset.scale;
        spriteAtOffset.align = spriteSheet.align;
        spriteAtOffset.pixels = sprite.pixels;
        spriteAtOffset.w = sprite.w;
        spriteAtOffset.h = sprite.h;
        spriteAtOffset.hasFillStyle = sprite.hasFillStyle;
        // console.log('sprite', sprite);
        // console.log('spriteSheet', spriteSheet);
        // console.log('spriteOffset', spriteOffset);
        // console.log('spriteAtOffset', spriteAtOffset);

        abstractSpriteSheet.sprites.push(spriteAtOffset);
      }

      abstractSpriteSheets.push(abstractSpriteSheet);

      // console.log('abstractSpriteSheet', abstractSpriteSheet.name, abstractSpriteSheet.sprites.length, abstractSpriteSheet.sprites.length/COLORS.length);
    }
  }
  // must have an odd number of monkeys,
  // so the max monkey count must be odd.
  if (maxMonkeyCount % 2 == 0) {
    maxMonkeyCount--;
  }
  const maxDifficulty = Math.floor(maxMonkeyCount / 2);
  const minMonkeyCount = 3;
  const minDifficulty = 1;

  config.abstract.bounds = {
    numberOfMonkeys: {
      max: maxMonkeyCount,
      min: minMonkeyCount,
    },
    difficulty: {
      max: maxDifficulty,
      min: minDifficulty,
    },
  };
};

const getValueAndNormalize = (tempData, id, makeOdd, max) => {
  let value = parseInt(tempData[id], 10);
  const min = parseInt(config.abstract.bounds[id].min, 10);
  if (max === undefined) {
    max = parseInt(config.abstract.bounds[id].max, 10);
  }
  // console.log('getValueAndNormalize>',id,makeOdd,value,min,max);

  if (makeOdd) {
    const isEven = (value % 2) == 0;
    if (isEven) {
      value--;
    }
  }
  if (value < min) {
    value = min;
  }
  if (value > max) {
    value = max;
  }
  tempData[id] = value;
  // console.log('getValueAndNormalize<',id,value);
  return value;
};

const getPixel = (png, x, y) => {
  if (x < 0) {
    return BORDER;
  }
  if (x >= png.width) {
    return BORDER;
  }
  if (y < 0) {
    return BORDER;
  }
  if (y >= png.height) {
    return BORDER;
  }
  const pixels = png.data;
  const ix = ((y * png.width)+x)*4;
  // console.log('getPixel', 'x', x, 'y', y, 'ix', ix, 'pixels.length', pixels.length);
  let r = pixels[ix + 0].toString(16);
  if (r.length == 1) {
    r = '0' + r;
  }
  let g = pixels[ix + 1].toString(16);
  if (g.length == 1) {
    g = '0' + g;
  }
  let b = pixels[ix + 2].toString(16);
  if (b.length == 1) {
    b = '0' + b;
  }
  let a = pixels[ix + 3].toString(16);
  if (a.length == 1) {
    a = '0' + a;
  }
  const pixel = r + g + b + a;
  return pixel.toUpperCase();
};

const UPPER_LEFT_CORNER = [
  [[BORDER], [BORDER]],
  [[BORDER], [TRANSPARENT, BLACK, WHITE]],
];

const UPPER_RIGHT_CORNER = [
  [[BORDER], [BORDER]],
  [[TRANSPARENT, BLACK, WHITE], [BORDER]],
];

const LOWER_LEFT_CORNER = [
  [[BORDER], [TRANSPARENT, BLACK, WHITE]],
  [[BORDER], [BORDER]],
];

const LOWER_RIGHT_CORNER = [
  [[TRANSPARENT, BLACK, WHITE], [BORDER]],
  [[BORDER], [BORDER]],
];

const isPatternMatch = (png, x, y, pattern) => {
  let allPixelsMatch = true;
  for (let py = 0; py < pattern.length; py++) {
    const row = pattern[py];
    for (let px = 0; px < row.length; px++) {
      const pixelList = row[px];
      // take any pixel in the pixelList in the pattern, and compare it to the
      // pixel in the png.
      // if none of the pixels in the pixelList matches the pixel in the pattern
      // then the pattern does not match.
      let anyPixelMatches = false;
      for (let pixelIx = 0; pixelIx < pixelList.length; pixelIx++) {
        const patternPixel = pixelList[pixelIx];
        const pngPixel = getPixel(png, x+px, y+py);
        if (patternPixel == pngPixel) {
          anyPixelMatches = true;
        }
      }
      if (!anyPixelMatches) {
        allPixelsMatch = false;
      }
    }
  }
  return allPixelsMatch;
};

const isUpperLeftCorner = (png, x, y) => {
  return isPatternMatch(png, x, y, UPPER_LEFT_CORNER);
};

const isLowerLeftCorner = (png, x, y) => {
  return isPatternMatch(png, x, y, LOWER_LEFT_CORNER);
};

const isUpperRightCorner = (png, x, y) => {
  return isPatternMatch(png, x, y, UPPER_RIGHT_CORNER);
};

const isLowerRightCorner = (png, x, y) => {
  return isPatternMatch(png, x, y, LOWER_RIGHT_CORNER);
};

const getLowerRightCorner = (png, x0, y0) => {
  // console.log('getLowerRightCorner', 'png.url', png.url, 'x0', x0, 'y0', y0);
  let x1;
  let y1;
  for (let x = x0; ((x <= png.width) && (x1 === undefined)); x++) {
    if (isUpperRightCorner(png, x, y0)) {
      x1 = x;
    }
  }
  for (let y = y0; ((y <= png.height) && (y1 === undefined)); y++) {
    if (isLowerLeftCorner(png, x0, y)) {
      y1 = y;
    }
  }
  if (isLowerRightCorner(png, x1, y1)) {
    return {x: x1, y: y1};
  }
};

const getSpriteData = (png, border, color) => {
  const x0 = border.x0;
  const y0 = border.y0;
  const x1 = border.x1;
  const y1 = border.y1;
  const spriteData = {
    hasFillStyle: false,
    pixels: [],
    w: (x1-x0)+1,
    h: (y1-y0)+1,
  };
  const scale = 1/Math.max(spriteData.w, spriteData.h);
  const tenthScale = 0.02 * scale;
  const twentiethScale = 0.01 * scale;
  spriteData.w *= scale;
  spriteData.h *= scale;
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const pixel = getPixel(png, x, y);
      const spriteDataElt = {
        x: ((x-x0)*scale) - twentiethScale,
        y: ((y-y0)*scale) - twentiethScale,
        w: scale + tenthScale,
        h: scale + tenthScale,
        fillStyle: `#${pixel}`,
      };
      if (pixel == WHITE) {
        spriteData.hasFillStyle = true;
        spriteDataElt.fillStyle = color;
      }

      spriteData.pixels.push(spriteDataElt);
    }
  }
  return spriteData;
};

const parseSpriteSheetPng = (png) => {
  // console.log('parseSpriteSheetPng', 'png', png);
  const spriteSheet = [];
  for (let x = -1; x <= png.width; x++) {
    for (let y = -1; y <= png.height; y++) {
      if (isUpperLeftCorner(png, x, y)) {
        const lrc = getLowerRightCorner(png, x, y);
        // console.log('parseSpriteSheetPng', png.name, 'x', x, 'y', y,
        // 'lowerRightCorner', lrc);
        if (lrc !== undefined) {
          const border = {
            x0: x+1, y0: y+1, x1: lrc.x, y1: lrc.y,
          };
          const blackSpriteData = getSpriteData(png, border, 'black');
          if (blackSpriteData.hasFillStyle) {
            for (let colorIx = 0; colorIx < COLORS.length; colorIx++) {
              const color = COLORS[colorIx];
              const spriteData = getSpriteData(png, border, color);
              spriteSheet.push(spriteData);
            }
          } else {
            spriteSheet.push(blackSpriteData);
          }
        }
      }
    }
  }
  for (let spriteSheetIx = 0; spriteSheetIx < spriteSheet.length; spriteSheetIx++) {
    const spriteData = spriteSheet[spriteSheetIx];
    spriteData.ix = spriteSheetIx;
  }
  return spriteSheet;
};

const alignSprite = (sprite, scale) => {
  // return center, until we figure it out.
  return ((sprite.h - scale) / 2) - (scale * sprite.dy);

  switch (sprite.align) {
    case 'top':
      return 0;
    case 'center':
      return (sprite.h - scale) / 2;
    case 'bottom':
      return sprite.h - scale;
  }
  return 0;
};

const api = async (req, res, tempData) => {
  const numberOfMonkeys = getValueAndNormalize(tempData, 'numberOfMonkeys', true);
  const maxDifficulty = Math.floor((numberOfMonkeys-1)/2);
  const difficulty = getValueAndNormalize(tempData, 'difficulty', false, maxDifficulty);
  const spriteSheets = abstractSpriteSheets;
  const keySpriteSheetName = randomUtil.getRandomArrayElt(spriteSheets).name;

  // for a single monkey, for the key sprite sheet, the monkey will
  // have a unique sprite.
  // for all other monkeys, for the key sprite sheet, the monkey will
  // share a sprite with at least one other monkey.
  // for all other sprite sheets, each monkey will share a sprite with
  // at least one other monkey.

  // for the key sprite sheet, select (('numberOfMonkeys'+1)/2) random sprites.
  // so the key sprite sheet will have a different sprite for each monkey.
  const keySpriteCount = Math.floor((numberOfMonkeys+1)/2);
  // console.log('keySpriteCount',keySpriteCount);

  // for the non key sprite sheets, select 'difficulty' random sprites.
  // difficulty is at most (numberOfMonkeys-1)/2), so there will always be at least two monkeys with the same sprite, for the non key sprite sheets.
  const nonKeySpriteCount = difficulty;
  // console.log('nonKeySpriteCount',nonKeySpriteCount);


  let maxNumberOfMonkeys;
  let weakestSpriteSheetName;

  const spriteSheetsSubset = [];
  for (let spriteSheetIx = 0; spriteSheetIx < spriteSheets.length; spriteSheetIx++) {
    const spriteSheet = spriteSheets[spriteSheetIx];

    if (maxNumberOfMonkeys === undefined) {
      maxNumberOfMonkeys = spriteSheet.sprites.length;
      weakestSpriteSheetName = spriteSheet.name;
    } else {
      if (spriteSheet.sprites.length < maxNumberOfMonkeys) {
        weakestSpriteSheetName = spriteSheet.name;
        maxNumberOfMonkeys = spriteSheet.sprites.length;
      }
    }

    const spriteSheetSubset = {};
    const keys = [...Object.keys(spriteSheet)];
    for (let keyIx = 0; keyIx < keys.length; keyIx++) {
      const key = keys[keyIx];
      spriteSheetSubset[key] = spriteSheet[key];
    }
    spriteSheetSubset.sprites = randomUtil.shuffle([...spriteSheet.sprites]);
    if (spriteSheetSubset.name == keySpriteSheetName) {
      spriteSheetSubset.sprites = spriteSheetSubset.sprites.slice(-keySpriteCount);
    } else {
      spriteSheetSubset.sprites = spriteSheetSubset.sprites.slice(-nonKeySpriteCount);
    }
    // console.log('spriteSheetSubset', spriteSheetIx, spriteSheetSubset);
    spriteSheetsSubset.push(spriteSheetSubset);
  }

  const rightMonkeyIx = ((numberOfMonkeys-1)/2);

  const monkeyArray = [];

  for (let monkeyIx = 0; monkeyIx < numberOfMonkeys; monkeyIx++) {
    const sprites = [];
    let maxW = 0;
    let maxH = 0;

    for (let spriteSheetIx = 0; spriteSheetIx < spriteSheetsSubset.length; spriteSheetIx++) {
      const spriteSheet = spriteSheetsSubset[spriteSheetIx];
      const spriteIx = (monkeyIx + spriteSheetIx) % spriteSheet.sprites.length;
      const sprite = spriteSheet.sprites[spriteIx];
      // console.log('sprite', sprite);
      maxW = Math.max(maxW, sprite.w);
      maxH = Math.max(maxH, sprite.h);
      sprites.push(sprite);
    }
    sprites.reverse();

    const canvasSize = config.abstract.pictureSize*2;
    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');
    const scale = Math.max(maxW, maxH);
    const contextScale = config.abstract.pictureSize/scale;
    ctx.scale(contextScale, contextScale);
    // console.log('scale', scale, maxW, maxH);

    for (let spriteIx = 0; spriteIx < sprites.length; spriteIx++) {
      const sprite = sprites[spriteIx];
      const dx = ((sprite.w - scale) / 2) - (scale * sprite.dx);
      // const dy = ((sprite.h - scale) / 2) - (scale * sprite.dy);
      const dy = alignSprite(sprite, scale);
      // console.log('spriteIx', spriteIx, dx, dy, scale, sprite.dx, sprite.dy);
      // console.log('sprite', sprite, dx, dy);
      ctx.translate(-dx, -dy);
      addSprite(ctx, sprite);
      ctx.translate(+dx, +dy);
    }
    const buffer = canvas.toBuffer('image/png', {compressionLevel: 3, filters: canvas.PNG_FILTER_NONE}).toString('base64');

    const rightMonkey = rightMonkeyIx == monkeyIx;
    monkeyArray[monkeyIx] = {
      rightMonkey: rightMonkey,
      data: `data:image/png;charset=utf-8;base64,${buffer}`,
    };
  }

  // set up for next call.
  if (difficulty < maxDifficulty) {
    tempData.difficulty = difficulty + 1;
  } else {
    if (numberOfMonkeys + 2 <= maxNumberOfMonkeys) {
      tempData.difficulty = 1;
      tempData.numberOfMonkeys = numberOfMonkeys + 2;
    } else {
      tempData.difficulty = 1;
      tempData.numberOfMonkeys = numberOfMonkeys;
    }
  }

  randomUtil.shuffle(monkeyArray);

  const monkeys = {};
  let answer;
  for (let monkeyIx = 0; monkeyIx < monkeyArray.length; monkeyIx++) {
    const monkeyElt = monkeyArray[monkeyIx];
    const monkeyId = (monkeyIx+1).toString();
    monkeys[monkeyId] = monkeyElt.data;
    if (monkeyElt.rightMonkey) {
      answer = monkeyId;
    }
  }


  const response = {
    monkeys: monkeys,
    answer: answer,
    difficulty: difficulty,
    numberOfMonkeys: numberOfMonkeys,
    maxDifficulty: maxDifficulty,
    maxNumberOfMonkeys: maxNumberOfMonkeys,
    keySpriteSheetName: keySpriteSheetName,
    weakestSpriteSheetName: weakestSpriteSheetName,
  };
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(response));
};

const addSprite = (ctx, sprite) => {
  ctx.scale(sprite.scale, sprite.scale);
  for (let pixelIx = 0; pixelIx < sprite.pixels.length; pixelIx++) {
    const pixel = sprite.pixels[pixelIx];
    // console.log('pixel', pixel);
    ctx.fillStyle = pixel.fillStyle;
    ctx.fillRect(pixel.x, pixel.y, pixel.w, pixel.h);
  }
  ctx.scale(sprite.inverseScale, sprite.inverseScale);
};

const resetApi = (tempData) => {
  tempData.difficulty = 0;
  tempData.numberOfMonkeys = 0;
};

exports.init = init;
exports.deactivate = deactivate;
exports.api = api;
exports.resetApi = resetApi;
