'use strict';
// libraries
const fs = require('fs');
const path = require('path');
const awaitSemaphore = require('await-semaphore');
const bananojs = require('@bananocoin/bananojs');

// modules
const dateUtil = require('./date-util.js');
const bananojsCacheUtil = require('./bananojs-cache-util.js');

// constants
const ZERO = BigInt(0);
const ONE_HUNDRED = BigInt(100);
const VERSION = require('../../package.json').version;

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
let mutex;
let walletAccountBalanceDescription;
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
  mutex = new awaitSemaphore.Mutex();

  bananojs.setBananodeApiUrl(config.bananodeApiUrl);

  walletAccountBalanceDescription = 'loading...';

  if (!fs.existsSync(config.sessionPayoutDataDir)) {
    fs.mkdirSync(config.sessionPayoutDataDir, { recursive: true });
  }

  if (!fs.existsSync(config.highScoreDataDir)) {
    fs.mkdirSync(config.highScoreDataDir, { recursive: true });
  }

  if (!fs.existsSync(config.accountHighScoreDataDir)) {
    fs.mkdirSync(config.accountHighScoreDataDir, { recursive: true });
  }
};

const deactivate = () => {
  config = undefined;
  loggingUtil = undefined;
  mutex = undefined;
};

const getBigIntMax = (...args) => {
  return args.reduce((m, e) => (e > m ? e : m));
};

const msToTime = (duration) => {
  duration = Number(duration);
  const milliseconds = Math.floor((duration % 1000) / 100);
  let seconds = Math.floor((duration / 1000) % 60);
  let minutes = Math.floor((duration / (1000 * 60)) % 60);
  let hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  // prettier-ignore
  const trailingZeroFn = () => {
    hours = (hours < 10) ? '0' + hours : hours;
    minutes = (minutes < 10) ? '0' + minutes : minutes;
    seconds = (seconds < 10) ? '0' + seconds : seconds;
  };
  trailingZeroFn();

  return hours + ':' + minutes + ':' + seconds + '.' + milliseconds;
};

const getSessionStartTimeFile = () => {
  return path.join(config.sessionPayoutDataDir, 'sessionStartTime.txt');
};

const getSessionStatusFile = () => {
  return path.join(config.sessionPayoutDataDir, 'sessionStatus.txt');
};

const setSessionStatus = (text) => {
  // loggingUtil.log(dateUtil.getDate(), 'setSessionStatus', text);
  const file = getSessionStatusFile();
  const filePtr = fs.openSync(file, 'w');
  fs.writeSync(filePtr, text);
  fs.closeSync(filePtr);
};

const getSessionStatus = () => {
  const file = getSessionStatusFile();
  if (!fs.existsSync(file)) {
    setSessionStartTime();
  }
  const data = fs.readFileSync(file, 'UTF-8');
  return data;
};

const setSessionStartTime = () => {
  const file = getSessionStartTimeFile();
  const filePtr = fs.openSync(file, 'w');
  fs.writeSync(filePtr, Date.now().toString());
  fs.closeSync(filePtr);
};

const getSessionStartTime = () => {
  const file = getSessionStartTimeFile();
  if (!fs.existsSync(file)) {
    setSessionStartTime();
  }
  const data = fs.readFileSync(file, 'UTF-8');
  return BigInt(data);
};

const isSessionClosed = async () => {
  const sessionInfo = await getSessionInfo();
  return sessionInfo.closed;
};

const getSessionInfo = async () => {
  const mutexRelease = await mutex.acquire();
  const sessionInfo = {};
  try {
    const sessionStartTime = getSessionStartTime();
    sessionInfo.start = sessionStartTime.toString();
    sessionInfo.balance_description = walletAccountBalanceDescription;
    if (config.sessionAutomaticPaymentFlag) {
      const sessionDuration = BigInt(config.sessionDurationMs);
      const currentTime = BigInt(Date.now());
      const currentDuration = currentTime - sessionStartTime;
      const remainingDuration = getBigIntMax(ZERO, sessionDuration - currentDuration);
      if (remainingDuration <= ZERO) {
        sessionInfo.closed = true;
      }
      sessionInfo.duration = sessionDuration.toString();
      sessionInfo.remaining = remainingDuration.toString();
      sessionInfo.remaining_description = msToTime(remainingDuration);
    } else {
      sessionInfo.duration = 'infinite';
      sessionInfo.remaining = 'infinite';
      sessionInfo.remaining_description = 'infinite';
    }
    sessionInfo.description = `Session prize:${sessionInfo.balance_description} time left:${sessionInfo.remaining_description}`;
  } finally {
    mutexRelease();
  }
  return sessionInfo;
};

const receivePending = async (representative, seed, seedIx) => {
  const account = await bananojs.getBananoAccountFromSeed(seed, seedIx);
  const pendingList = [];
  let noPending = false;
  while (!noPending) {
    const pending = await bananojs.getAccountsPending([account], config.maxPendingBananos, true);
    if (pending !== undefined) {
      // loggingUtil.log(dateUtil.getDate(), 'account', account, 'pending', pending);
      if (pending.error) {
        noPending = true;
      } else {
        const pendingBlocks = pending.blocks[account];
        const hashes = [...Object.keys(pendingBlocks)];
        if (hashes.length !== 0) {
          const hash = hashes[0];
          const response = await bananojs.receiveBananoDepositsForSeed(seed, seedIx, representative, hash);
          pendingList.push(response);
        } else {
          noPending = true;
        }
      }
    }
  }
  if (pendingList.length > 0) {
    loggingUtil.log(dateUtil.getDate(), 'account', account, 'pendingList.length', pendingList.length);
  }
  return pendingList;
};

const receiveWalletPending = async () => {
  try {
    walletAccountBalanceDescription = 'checking pending...';
    setSessionStatus('before receive pending.');
    await receivePending(config.walletRepresentative, config.walletSeed, config.walletSeedIx);
    setSessionStatus('after receive pending, before get account balance description.');
    walletAccountBalanceDescription = await getAccountBalanceDescription(config.walletSeed, config.walletSeedIx);
    setSessionStatus('after get account balance description.');
  } catch (error) {
    setSessionStatus(`error '${error.message}' at ${dateUtil.getDate()}`);
  }
};

const getAccountBalanceDescription = async (seed, seedIx) => {
  const account = await bananojs.getBananoAccountFromSeed(seed, seedIx);
  const accountInfo = await bananojs.getAccountInfo(account, true);
  if (accountInfo == undefined) {
    return '';
  }
  if (accountInfo.balance == undefined) {
    return JSON.stringify(accountInfo);
  }
  const payoutBalance = getPayoutBalance(accountInfo);
  const balanceParts = await bananojs.getBananoPartsFromRaw(payoutBalance);
  const description = await bananojs.getBananoPartsDescription(balanceParts);
  return description;
};

const getPayoutBalance = (accountInfo) => {
  const balance = BigInt(accountInfo.balance);
  const sessionPayoutRatio = BigInt(parseFloat(config.sessionPayoutRatio) * 100);
  const payoutBalance = (balance * sessionPayoutRatio) / ONE_HUNDRED;
  return payoutBalance;
};

const getAccountHighScores = async () => {
  const highScores = [];
  const mutexRelease = await mutex.acquire();
  try {
    if (fs.existsSync(config.accountHighScoreDataDir)) {
      fs.readdirSync(config.accountHighScoreDataDir).forEach((fileNm) => {
        const file = path.join(config.accountHighScoreDataDir, fileNm);
        const data = fs.readFileSync(file, 'UTF-8');
        const json = JSON.parse(data);
        const score = parseInt(json.score, 10);
        const account = json.account;
        const version = json.version;
        highScores.push({ date: fileNm, score: score, account: account, version: version });
      });
    }
  } finally {
    mutexRelease();
  }
  return highScores;
};

const setAccountHighScore = async (account, version, score) => {
  score = parseInt(score, 10);
  const mutexRelease = await mutex.acquire();
  try {
    const date = dateUtil.getDate().substring(0, 10);
    const file = path.join(config.accountHighScoreDataDir, date);
    let isHighScore = false;
    if (!fs.existsSync(file)) {
      isHighScore = true;
    } else {
      const data = fs.readFileSync(file, 'UTF-8');
      const json = JSON.parse(data);
      const highScore = parseInt(json.score, 10);

      loggingUtil.log(dateUtil.getDate(), 'setAccountHighScore', 'score', score, 'highScore', highScore);

      if (score > highScore) {
        isHighScore = true;
      }
    }

    if (isHighScore) {
      const filePtr = fs.openSync(file, 'w');
      const json = {};
      json.account = account;
      json.version = version;
      json.score = score.toString();
      const data = JSON.stringify(json);
      fs.writeSync(filePtr, data);
      fs.closeSync(filePtr);
    }
  } finally {
    mutexRelease();
  }
};

const getHighScores = async () => {
  const highScores = [];
  const mutexRelease = await mutex.acquire();
  try {
    if (fs.existsSync(config.highScoreDataDir)) {
      fs.readdirSync(config.highScoreDataDir).forEach((fileNm) => {
        const file = path.join(config.highScoreDataDir, fileNm);
        const data = fs.readFileSync(file, 'UTF-8');
        const highScore = parseInt(data, 10);
        highScores.push({ date: fileNm, score: highScore });
      });
    }
  } finally {
    mutexRelease();
  }
  return highScores;
};

const setHighScore = async (score) => {
  score = parseInt(score, 10);
  const mutexRelease = await mutex.acquire();
  try {
    const date = dateUtil.getDate().substring(0, 10);
    const file = path.join(config.highScoreDataDir, date);
    let isHighScore = false;
    if (!fs.existsSync(file)) {
      isHighScore = true;
    } else {
      const data = fs.readFileSync(file, 'UTF-8');
      const highScore = parseInt(data, 10);

      loggingUtil.log(dateUtil.getDate(), 'setHighScore', 'score', score, 'highScore', highScore);

      if (score > highScore) {
        isHighScore = true;
      }
    }

    if (isHighScore) {
      const filePtr = fs.openSync(file, 'w');
      fs.writeSync(filePtr, score.toString());
      fs.closeSync(filePtr);
    }
  } finally {
    mutexRelease();
  }
};

const payEverybodyAndReopenSession = async () => {
  try {
    const scores = await bananojsCacheUtil.getAndClearAllScores();
    let maxScore = ZERO;
    let highScore = ZERO;
    let highScoreAccount = '';
    for (let scoreIx = 0; scoreIx < scores.length; scoreIx++) {
      const scoreElt = scores[scoreIx];
      const score = BigInt(scoreElt.score);
      if (score < 0) {
        console.log('negative scoreElt', scoreElt);
        scoreElt.score = ZERO.toString();
      }
    }

    for (let scoreIx = 0; scoreIx < scores.length; scoreIx++) {
      const scoreElt = scores[scoreIx];
      console.log('scoreElt', scoreElt);
      const score = BigInt(scoreElt.score);
      maxScore += score;
      if (score > highScore) {
        highScore = score;
        highScoreAccount = scoreElt.account;
      }
    }

    await setHighScore(highScore);
    await setAccountHighScore(highScoreAccount, VERSION, highScore);

    loggingUtil.log(dateUtil.getDate(), 'payment', 'scores.length', scores.length, 'maxScore', maxScore);

    if (maxScore > ZERO) {
      const account = await bananojs.getBananoAccountFromSeed(config.walletSeed, config.walletSeedIx);
      const accountInfo = await bananojs.getAccountInfo(account, true);
      if (accountInfo.balance !== undefined) {
        const payoutBalance = getPayoutBalance(accountInfo);
        const rawPerScore = payoutBalance / maxScore;

        loggingUtil.log(dateUtil.getDate(), 'payment', 'rawPerScore', rawPerScore, 'payoutBalance', payoutBalance);
        let previous = undefined;
        for (let scoreIx = 0; scoreIx < scores.length; scoreIx++) {
          try {
            const representative = config.walletRepresentative;
            const scoreElt = scores[scoreIx];
            const account = scoreElt.account;
            const score = scoreElt.score;
            const bananoRaw = BigInt(score) * rawPerScore;
            const balanceParts = await bananojs.getBananoPartsFromRaw(bananoRaw);
            const bananoDecimal = await bananojs.getBananoPartsAsDecimal(balanceParts);
            const seed = config.walletSeed;
            const seedIx = config.walletSeedIx;
            if (bananoRaw > ZERO) {
              const result = await bananojs.sendBananoWithdrawalFromSeed(seed, seedIx, account, bananoDecimal, representative, previous);
              // add wait so you don't fork block yourself.
              loggingUtil.log(
                dateUtil.getDate(),
                'payment',
                scoreIx,
                'of',
                scores.length,
                'account',
                account,
                'score',
                score,
                'bananoDecimal',
                bananoDecimal,
                'bananoRaw',
                bananoRaw,
                'result',
                result
              );
              previous = result;
            }
          } catch (error) {
            loggingUtil.log(dateUtil.getDate(), 'payment', 'error', error.message);
          }
        }
      }
    }
  } catch (error) {
    loggingUtil.log(dateUtil.getDate(), 'payment', 'error', error.message);
  } finally {
    setSessionStartTime();
  }
};

const getWalletAccount = async () => {
  const account = await bananojs.getBananoAccountFromSeed(config.walletSeed, config.walletSeedIx);
  return account;
};

exports.init = init;
exports.deactivate = deactivate;
exports.isSessionClosed = isSessionClosed;
exports.getSessionInfo = getSessionInfo;
exports.getSessionStartTime = getSessionStartTime;
exports.setSessionStartTime = setSessionStartTime;
exports.payEverybodyAndReopenSession = payEverybodyAndReopenSession;
exports.receiveWalletPending = receiveWalletPending;
exports.getWalletAccount = getWalletAccount;
exports.getHighScores = getHighScores;
exports.getSessionStatus = getSessionStatus;
exports.setSessionStatus = setSessionStatus;
exports.getAccountHighScores = getAccountHighScores;
