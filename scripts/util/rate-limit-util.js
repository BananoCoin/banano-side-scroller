'use strict';
// libraries

// modules

// constants

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
const callsPerSecondMap = new Map();
let maxCallsPerMinute;
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

  maxCallsPerMinute = config.rateLimit.maxCallsPerMinute;
};

const deactivate = () => {
  config = undefined;
  loggingUtil = undefined;
};

const getCallCount = () => {
  let count = 0;
  callsPerSecondMap.forEach((callCount, mapSecond) => {
    count += callCount;
  });
  return count;
};

const getMinWaitInSeconds = () => {
  if (callsPerSecondMap.size == 0) {
    return 0;
  }
  const second = Math.floor(Date.now() / 1000);
  loggingUtil.debug('rate-limit', 'getMinWaitInSeconds', 'second', second);
  let minSecond = undefined;
  callsPerSecondMap.forEach((callCount, mapSecond) => {
    if (minSecond === undefined) {
      minSecond = mapSecond;
    } else {
      minSecond = Math.min(minSecond, mapSecond);
    }
    loggingUtil.debug('rate-limit', 'getMinWaitInSeconds', 'mapSecond', mapSecond);
    loggingUtil.debug('rate-limit', 'getMinWaitInSeconds', 'minSecond', minSecond);
  });
  loggingUtil.debug('rate-limit', 'getMinWaitInSeconds', 'minSecond', minSecond);
  const minWait = second-minSecond;
  loggingUtil.debug('rate-limit', 'getMinWaitInSeconds', 'minWait', minWait);
  return minWait;
};

const incrementCallCount = () => {
  const second = Math.floor(Date.now() / 1000);
  loggingUtil.debug('rate-limit', 'incrementCallCount', 'second', second);
  const minSecond = second - 60;
  loggingUtil.debug('rate-limit', 'incrementCallCount', 'minSecond', minSecond);
  const deleteSeconds = [];
  callsPerSecondMap.forEach((callCount, mapSecond) => {
    if (mapSecond < minSecond) {
      deleteSeconds.push(mapSecond);
    }
  });
  loggingUtil.debug('rate-limit', 'incrementCallCount', 'deleteSeconds', deleteSeconds);
  deleteSeconds.forEach((mapSecond) => {
    callsPerSecondMap.delete(mapSecond);
  });
  if (callsPerSecondMap.has(second)) {
    const oldCount = callsPerSecondMap.get(second);
    callsPerSecondMap.set(second, oldCount+1);
  } else {
    callsPerSecondMap.set(second, 1);
  }
  loggingUtil.debug('rate-limit', 'incrementCallCount', 'callsPerSecondMap', callsPerSecondMap);
};

const delay = () => {
  loggingUtil.debug('rate-limit', 'calling', 'delay');
  incrementCallCount();
  const callCount = getCallCount();
  loggingUtil.debug('rate-limit', 'calling', 'callCount', callCount, 'maxCallsPerMinute', maxCallsPerMinute);
  let time = 0;
  if (callCount >= maxCallsPerMinute) {
    const minWaitInSeconds = getMinWaitInSeconds();
    loggingUtil.debug('rate-limit', 'waiting', 'minWaitInSeconds', minWaitInSeconds);
    time = minWaitInSeconds;
  }
  return new Promise((resolve) => {
    const fn = () => {
      loggingUtil.debug('rate-limit', 'done waiting', 'time', time);
      resolve();
    };
    setTimeout(fn, time);
  });
};

const wrap = (module) => {
  const proxyHttps = {};
  proxyHttps.request = (options, response) => {
    const req = module.request(options, response);
    // loggingUtil.debug('rate-limit', 'return', 'req', req);
    const proxyReq = {};
    proxyReq.on = function(a, b) {
      req.on(a, b);
    };
    proxyReq.write = function(a) {
      req.write(a);
    };
    proxyReq.end = function() {
      delay().then(() => {
        req.end();
      });
    };
    return proxyReq;
  };
  // loggingUtil.debug('rate-limit', 'return', 'proxyHttps', proxyHttps);
  return proxyHttps;
};

exports.init = init;
exports.deactivate = deactivate;
exports.wrap = wrap;
