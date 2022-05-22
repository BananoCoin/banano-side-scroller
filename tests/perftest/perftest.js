'use strict';

const {performance, PerformanceObserver} = require('perf_hooks');

const abstractApiUtil = require('../../scripts/util/abstract-api-util.js');

const config = require('../../scripts/config.json');
const loggingUtil = {};

const perfObserver = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log(entry);
  });
});

perfObserver.observe({entryTypes: ['measure'], buffer: true});

const run = async () => {
  const req = {};
  const res = {
    setHeader: ()=>{},
    end: () => {},
  };
  const tempData = {
    numberOfMonkeys: 0,
  };
  await abstractApiUtil.init(config, loggingUtil);

  for (let ix = 0; ix < 1000; ix++) {
    performance.mark('api-start');
    await abstractApiUtil.api(req, res, tempData);
    performance.mark('api-end');
  }
  performance.measure('api', 'api-start', 'api-end');
};
run();
