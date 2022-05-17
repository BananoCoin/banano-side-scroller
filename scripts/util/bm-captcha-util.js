'use strict';
// libraries

// modules
const randomUtil = require('./random-util.js');
const dateUtil = require('./date-util.js');
const httpsUtil = require('./https-util.js');

// constants
const registeredSites = new Map();

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
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

  // setImmediate(updateAnswers);
  // setInterval(updateAnswers, 60000);
};

const deactivate = () => {
  config = undefined;
  loggingUtil = undefined;
  registeredSites.clear();
};

const register = async (req, res) => {
  const secretKey = randomUtil.getRandomHex32();
  const response = {};
  response.secretKey = secretKey;
  const site = {};
  site.lastMs = Date.now();
  registeredSites.set(secretKey, site);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(response));
};

const verify = async (req, res, callback) => {
  const secretKey = req.body.secretKey;
  const account = req.body.account;
  const actualAnswer = parseInt(req.body.answer, 10);
  const response = {};
  response.success = false;
  response.challenge_ts = dateUtil.getDate();
  if (registeredSites.has(secretKey)) {
    const site = registeredSites.get(secretKey);
    if (site.answer) {
      const expectedAnswer = parseInt(site.answer.answer, 10);
      response.actual = actualAnswer;
      response.expected = expectedAnswer;
      response.success = expectedAnswer == actualAnswer;
      response.message = site.answer.answerDetail;
    }
    delete site.answer;
  }
  callback(account, response.success);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(response));
};

const captcha = async (req, res) => {
  const secretKey = req.body.secretKey;
  const account = req.body.account;
  const response = {};
  response.success = false;
  response.images = [];
  // console.log('secretKey', secretKey);
  // console.log('account', account);
  if (registeredSites.has(secretKey)) {
    const site = registeredSites.get(secretKey);
    const url = config.blackMonkeyDataUrl + `?account=${account}`;
    const answer = await httpsUtil.sendRequest(url, 'GET');
    site.answer = answer;
    // console.log('answer', answer);

    if (site.answer) {
      response.success = true;
      response.images = {};
      response.images.monkeys = site.answer.monkeys;
      // response.images = site.answer;
    } else {
      response.success = false;
    }
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(response));
};

exports.init = init;
exports.deactivate = deactivate;
exports.register = register;
exports.verify = verify;
exports.captcha = captcha;
