'use strict';
// libraries
const fs = require('fs');
const path = require('path');
const Png = require('png-js');

// modules
const dateUtil = require('./date-util.js');

// constants

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
/* eslint-enable no-unused-vars */

// functions
const init = async (_config, _loggingUtil) => {
  if (_config === undefined) {
    throw Error('config is required.');
  }
  if (_loggingUtil === undefined) {
    throw Error('loggingUtil is required.');
  }
  config = _config;
  loggingUtil = _loggingUtil;
  await loadPngChunks();
};

const decode = (data) => {
  return new Promise((resolve) => {
    const png = new Png(data);
    png.decode((pixels) => {
      resolve({
        width: png.width,
        height: png.height,
        pixels: Uint8Array.from(pixels),
      });
    });
  });
};

const loadPngChunks = async () => {
  if (fs.existsSync(config.pngChunkDir)) {
    // config.chunks.length = 0;
    const files = fs.readdirSync(config.pngChunkDir);
    for (let fileIx = 0; fileIx < files.length; fileIx++) {
      const fileNm = files[fileIx];
      if (fileNm.endsWith('.png')) {
        const file = path.join(config.pngChunkDir, fileNm);
        const data = fs.readFileSync(file);
        const decodedData = await decode(data);
        const pixels = decodedData.pixels;
        const indexes = [];

        // loggingUtil.log(dateUtil.getDate(), 'loadPngChunks', 'file', fileNm, 'decodedData', decodedData, 'pixels', pixels);

        // loggingUtil.log(dateUtil.getDate(), 'loadPngChunks',
        //     'file', fileNm, 'width', decodedData.width, 'height', decodedData.height,
        //     'length', decodedData.pixels.length);

        let ix = 0;
        for (let y = 0; y < decodedData.height; y++) {
          const y1 = decodedData.height - (y + 1);
          for (let x = 0; x < decodedData.width; x++) {
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
            let index = -1;
            switch (pixel) {
              case '00000000':
                index = -1;
                break;
              case 'aa7942ff':
                // ground1
                index = 0;
                break;
              case '0433ffff':
                // water
                index = 1;
                break;
              case 'fffb00ff':
                // reward
                index = 2;
                break;
              case 'ff2600ff':
                // obstacle
                index = 3;
                break;
              case 'ff40ffff':
                // obstacle
                index = 4;
                break;
              case '000000ff':
                // obstacle
                index = 5;
                break;
              case 'ffffffff':
                // obstacle
                index = 6;
                break;
              case '00f900ff':
                // ground2
                index = 7;
                break;
              default:
                loggingUtil.log(dateUtil.getDate(), 'loadPngChunks', 'unknown pixel', 'ix', ix, 'pixel', pixel);
            }

            if (indexes[x] == undefined) {
              indexes[x] = [];
            }

            indexes[x][y1] = index;

            ix += 4;
          }
        }

        const id = parseInt(fileNm.substring(0, fileNm.length - 4), 0);

        // loggingUtil.log(dateUtil.getDate(), 'loadPngChunks', 'file', fileNm, 'id', id, 'indexes', JSON.stringify(indexes));

        config.chunks.push({
          id: id,
          chunk: indexes,
        });
      }
    }
  }
};

const deactivate = () => {
  config = undefined;
  loggingUtil = undefined;
};

exports.init = init;
exports.deactivate = deactivate;
