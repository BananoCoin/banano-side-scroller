'use strict';

const randomUtil = require('./util/random-util.js');
const config = require('./config.json');

const newConfig = {};
newConfig.bananodeApiUrl = 'https://kaliumapi.appditto.com/api';
newConfig.cookieSecret = randomUtil.getRandomHex32();
newConfig.walletSeed = randomUtil.getRandomHex32();
newConfig.walletRepresentative = 'ban_3pa1m3g79i1h7uijugndjeytpmqbsg6hc19zm8m7foqygwos1mmcqmab91hh';
newConfig.blackMonkeyDataUrl = `http://localhost:${config.web.port}/abstract/api`;
console.log('STARTED new config');
console.log(JSON.stringify(newConfig, undefined, '\t'));
console.log('SUCCESS new config');
