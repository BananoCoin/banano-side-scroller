'use strict';
// libraries

// modules
const bananojsCacheUtil = require('./util/bananojs-cache-util.js');
const ipUtil = require('./util/ip-util.js');
const dateUtil = require('./util/date-util.js');
const bmCaptchaUtil = require('./util/bm-captcha-util.js');
const recaptchav3Util = require('./util/recaptchav3-util.js');
const httpsUtil = require('./util/https-util.js');
const webServerUtil = require('./web/server-util.js');
const paymentUtil = require('./util/payment-util.js');
const chunkUtil = require('./util/chunk-util.js');
const abstractApiUtil = require('./util/abstract-api-util.js');
const rateLimitUtil = require('./util/rate-limit-util.js');

// constants
const config = require('./config.json');
const configOverride = require('../config.json');

const modules = [];

const loggingUtil = {};
loggingUtil.log = console.log;
loggingUtil.isDebugEnabled = () => {
  return false;
};
loggingUtil.debug = () => {};
// loggingUtil.debug = console.log;
loggingUtil.trace = console.trace;

const init = async () => {
  loggingUtil.log(dateUtil.getDate(), 'STARTED init');

  overrideConfig();

  modules.push(ipUtil);
  modules.push(dateUtil);
  modules.push(chunkUtil);
  modules.push(bananojsCacheUtil);
  modules.push(bmCaptchaUtil);
  modules.push(recaptchav3Util);
  modules.push(httpsUtil);
  modules.push(webServerUtil);
  modules.push(paymentUtil);
  modules.push(abstractApiUtil);
  modules.push(rateLimitUtil);

  for (let moduleIx = 0; moduleIx < modules.length; moduleIx++) {
    const item = modules[moduleIx];
    await item.init(config, loggingUtil);
  }

  webServerUtil.setCloseProgramFunction(closeProgram);

  process.on('SIGINT', closeProgram);
  process.on('Uncaught Exception', (err) => {
    console.trace(err);
    console.log(`Uncaught Exception: ${err.message}`);
    process.exitCode = 1;
  });
  process.on('Unhandled Rejection', (reason, promise) => {
    console.trace(reason);
    console.log('Unhandled Rejection at ', promise, `reason: ${reason.message}`);
    process.exit(1);
  });

  setTimeout(paymentFn, 0);
  setInterval(paymentFn, config.sessionStatusPollTimeMs);

  loggingUtil.log(dateUtil.getDate(), 'SUCCESS init');
};

const paymentFn = async () => {
  if (config.sessionAutomaticPaymentFlag) {
    try {
      paymentUtil.setSessionStatus(`before check closed flag at ${dateUtil.getDate()}`);
      const sessionClosedFlag = await paymentUtil.isSessionClosed();
      paymentUtil.setSessionStatus(`after check closed flag, before check pending at ${dateUtil.getDate()}`);
      await paymentUtil.receiveWalletPending();
      paymentUtil.setSessionStatus(`after check pending at ${dateUtil.getDate()}`);
      if (sessionClosedFlag) {
        paymentUtil.setSessionStatus(`before reopening session at ${dateUtil.getDate()}`);
        await paymentUtil.payEverybodyAndReopenSession();
        paymentUtil.setSessionStatus(`after reopening session at ${dateUtil.getDate()}`);
        await webServerUtil.clearTempData();
        paymentUtil.setSessionStatus(`after temp data clear at ${dateUtil.getDate()}`);
      } else {
        paymentUtil.setSessionStatus(`session still open at ${dateUtil.getDate()}`);
      }
    } catch (error) {
      paymentUtil.setSessionStatus(`error '${error.message}' at ${dateUtil.getDate()}`);
      loggingUtil.log(dateUtil.getDate(), 'paymentFn', 'error', error.message);
    } finally {
      paymentUtil.setSessionStatus(`waiting for next poll, ${config.sessionStatusPollTimeMs} ms from ${dateUtil.getDate()}`);
    }
  } else {
    paymentUtil.setSessionStatus('auto payment disabled');
  }
};

const deactivate = async () => {
  loggingUtil.log(dateUtil.getDate(), 'STARTED deactivate');
  const reverseModules = modules.slice().reverse();
  for (let moduleIx = 0; moduleIx < reverseModules.length; moduleIx++) {
    const item = reverseModules[moduleIx];
    await item.deactivate(config, loggingUtil);
  }
  loggingUtil.log(dateUtil.getDate(), 'SUCCESS deactivate');
};

const closeProgram = async () => {
  console.log('STARTED closing program.');
  await deactivate();
  console.log('SUCCESS closing program.');
  process.exit(0);
};

// prettier-ignore
const isObject = function(obj) {
  return (!!obj) && (obj.constructor === Object);
};

const overrideValues = (src, dest) => {
  Object.keys(src).forEach((key) => {
    const srcValue = src[key];
    const destValue = dest[key];
    if (isObject(destValue)) {
      overrideValues(srcValue, destValue);
    } else {
      dest[key] = srcValue;
    }
  });
};

const overrideConfig = () => {
  loggingUtil.debug('STARTED overrideConfig', config);
  overrideValues(configOverride, config);
  loggingUtil.debug('SUCCESS overrideConfig', config);
};

init().catch((e) => {
  console.log('FAILURE init.', e.message);
  console.trace('FAILURE init.', e);
});
