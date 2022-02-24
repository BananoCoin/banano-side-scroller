'use strict';
// libraries
const fs = require('fs');
const path = require('path');
const awaitSemaphore = require('await-semaphore');
const crypto = require('crypto');

// modules
const dateUtil = require('./date-util.js');

// constants
const DEBUG = false;

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
let mutex;
let accountRegExp;
/* eslint-enable no-unused-vars */

// functions
const init = (_config, _loggingUtil, _seed, _entropyList) => {
  /* istanbul ignore if */
  if (_config === undefined) {
    throw Error('config is required.');
  }
  /* istanbul ignore if */
  if (_loggingUtil === undefined) {
    throw Error('loggingUtil is required.');
  }
  config = _config;
  loggingUtil = _loggingUtil;
  mutex = new awaitSemaphore.Mutex();

  accountRegExp = new RegExp(config.accountRegex);

  if (!fs.existsSync(config.bananojsCacheDataDir)) {
    fs.mkdirSync(config.bananojsCacheDataDir, { recursive: true });
  }
};

const deactivate = () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  mutex = undefined;
  accountRegExp = undefined;
  /* eslint-enable no-unused-vars */
};

const getAccountFile = (account, ip) => {
  if (account === undefined) {
    throw Error('account is required.');
  }
  if (ip === undefined) {
    throw Error('ip is required.');
  }

  const hash = crypto.createHash('sha256').update(`${account}-${ip}`).digest('hex');

  return path.join(config.bananojsCacheDataDir, hash);
};

const getScore = async (account, ip) => {
  if (accountRegExp.test(account)) {
    const mutexRelease = await mutex.acquire();
    try {
      const accountData = getAccountData(account, ip);
      return accountData.score;
    } finally {
      mutexRelease();
    }
  } else {
    throw Error(`account '${account}' does not match regex '${config.accountRegex}'`);
  }
};

const incrementScore = async (account, ip, score) => {
  if (accountRegExp.test(account)) {
    const mutexRelease = await mutex.acquire();
    try {
      const accountData = getAccountData(account, ip);
      accountData.score = (BigInt(accountData.score) + BigInt(score)).toString();
      saveAccountData(account, ip, accountData);
    } finally {
      mutexRelease();
    }
  }
};

const saveAccountData = (account, ip, data) => {
  data.account = account;
  const accountFile = getAccountFile(account, ip);
  const accountFilePtr = fs.openSync(accountFile, 'w');
  fs.writeSync(accountFilePtr, JSON.stringify(data));
  fs.closeSync(accountFilePtr);
};

const getAccountData = (account, ip) => {
  const accountFile = getAccountFile(account, ip);
  if (!fs.existsSync(accountFile)) {
    saveAccountData(account, ip, { account: account, score: '0' });
  }
  const data = fs.readFileSync(accountFile, 'UTF-8');
  return JSON.parse(data);
};

const getTotalAccountCount = () => {
  if (fs.existsSync(config.bananojsCacheDataDir)) {
    return fs.readdirSync(config.bananojsCacheDataDir).length;
  } else {
    return 0;
  }
};

const getActiveAccountCount = () => {
  let count = 0;
  if (fs.existsSync(config.bananojsCacheDataDir)) {
    fs.readdirSync(config.bananojsCacheDataDir).forEach((file) => {
      const fileNm = path.join(config.bananojsCacheDataDir, file);
      const { mtimeMs } = fs.statSync(fileNm);
      const activeTimeMs = mtimeMs;
      const activeTimeCutoffMs = Date.now() - config.activeTimeMs;
      /* istanbul ignore if */
      if (DEBUG) {
        loggingUtil.log(
          dateUtil.getDate(),
          'file',
          file,
          'activeTimeMs',
          activeTimeMs,
          'activeTimeCutoffMs',
          activeTimeCutoffMs,
          'diff',
          activeTimeCutoffMs - activeTimeMs
        );
      }
      if (activeTimeMs > activeTimeCutoffMs) {
        count++;
      }
    });
  }
  return count;
};

const clearScore = async (account, ip) => {
  const allScores = [];
  const mutexRelease = await mutex.acquire();
  try {
    const accountFile = getAccountFile(account, ip);
    if (fs.existsSync(accountFile)) {
      fs.unlinkSync(accountFile);
    }
  } finally {
    mutexRelease();
  }
  return allScores;
};

const getAndClearAllScores = async () => {
  const maxScoreByAccount = {};
  const mutexRelease = await mutex.acquire();
  try {
    if (fs.existsSync(config.bananojsCacheDataDir)) {
      fs.readdirSync(config.bananojsCacheDataDir).forEach((file) => {
        const accountFile = path.join(config.bananojsCacheDataDir, file);
        const data = fs.readFileSync(accountFile, 'UTF-8');
        const json = JSON.parse(data);
        const score = parseInt(json.score, 10);
        if (maxScoreByAccount[json.account] === undefined) {
          maxScoreByAccount[json.account] = score;
        } else {
          const oldScore = maxScoreByAccount[json.account];
          maxScoreByAccount[json.account] = Math.min(score, oldScore);
        }
        fs.unlinkSync(accountFile);
      });
    }
  } finally {
    mutexRelease();
  }
  const allScores = [];
  const accounts = [...Object.keys(maxScoreByAccount)];
  accounts.forEach((account) => {
    const score = maxScoreByAccount[account];
    allScores.push({
      account: account,
      score: score,
    });
  });
  return allScores;
};

const getAccountBalances = async () => {
  const accounts = [];
  const mutexRelease = await mutex.acquire();
  try {
    if (fs.existsSync(config.bananojsCacheDataDir)) {
      fs.readdirSync(config.bananojsCacheDataDir).forEach((file) => {
        const accountFile = path.join(config.bananojsCacheDataDir, file);
        const data = fs.readFileSync(accountFile, 'UTF-8');
        const json = JSON.parse(data);
        const score = json.score;
        const account = json.account;
        if (parseInt(score, 10) !== 0) {
          accounts.push({ account: account, score: score });
        }
      });
    }
  } finally {
    mutexRelease();
  }
  return accounts;
};

const getHistogram = async () => {
  const histogramMap = new Map();
  const mutexRelease = await mutex.acquire();
  try {
    if (fs.existsSync(config.bananojsCacheDataDir)) {
      fs.readdirSync(config.bananojsCacheDataDir).forEach((file) => {
        const accountFile = path.join(config.bananojsCacheDataDir, file);
        const data = fs.readFileSync(accountFile, 'UTF-8');
        const score = JSON.parse(data).score;
        if (parseInt(score, 10) > 0) {
          const scoreBucket = Math.max(1, Number(score).toString().length);
          const bucket = `Score 1${'0'.repeat(scoreBucket - 1)} to 1${'0'.repeat(scoreBucket)}`;

          // loggingUtil.log(dateUtil.getDate(), 'histogram', 'score', score, 'bucket', bucket);

          if (histogramMap.has(bucket)) {
            const old = histogramMap.get(bucket);
            histogramMap.set(bucket, old + 2);
          } else {
            histogramMap.set(bucket, 1);
          }
        }
      });
    }
  } finally {
    mutexRelease();
  }
  const histogram = [];
  for (const [bucket, count] of histogramMap) {
    histogram.push({
      bucket: bucket,
      count: count,
    });
  }

  // loggingUtil.log(dateUtil.getDate(), 'histogramMap', histogramMap);
  // loggingUtil.log(dateUtil.getDate(), 'histogram', JSON.stringify(histogram));

  return histogram;
};

exports.init = init;
exports.deactivate = deactivate;
exports.incrementScore = incrementScore;
exports.getScore = getScore;
exports.getTotalAccountCount = getTotalAccountCount;
exports.getActiveAccountCount = getActiveAccountCount;
exports.getAndClearAllScores = getAndClearAllScores;
exports.getAccountBalances = getAccountBalances;
exports.clearScore = clearScore;
exports.getHistogram = getHistogram;
