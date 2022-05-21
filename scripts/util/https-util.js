'use strict';
// libraries
const https = require('https');
const http = require('http');

// modules

// constants

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
};

const deactivate = () => {
  config = undefined;
  loggingUtil = undefined;
};

const sendRequest = async (url, method, formData, formDataType) => {
  if (url == undefined) {
    throw Error(`'url' is a required parameter.`);
  }
  if (method == undefined) {
    throw Error(`'method' is a required parameter.`);
  }
  return new Promise((resolve) => {
    const apiUrl = new URL(url);

    let body = '';
    let contentType = '';
    switch (formDataType) {
      case undefined:
      case 'json':
        body = JSON.stringify(formData);
        contentType = 'application/json';
        break;
      case 'form':
        Object.keys(formData).forEach((key) => {
          const value = formData[key];
          if (body.length > 0) {
            body += '&';
          }
          body += `${key}=${value}`;
        });
        contentType = 'application/x-www-form-urlencoded';
        break;
      default:
    }
    // loggingUtil.log('sendRequest url', url);

    let protocol;
    switch (apiUrl.protocol) {
      case 'http:':
        protocol = http;
        break;
      case 'https:':
        protocol = https;
        break;
      default:
        throw Error(`unknown protocol:'${apiUrl.protocol}' in url '${apiUrl.protocol}'`);
    }

    const options = {
      method: method,
      timeout: 30000,
    };

    if (formData !== undefined) {
      options.headers = {
        'Content-Length': body.length,
        'Content-Type': contentType,
      };
    }

    const req = protocol.request(apiUrl, options, (res) => {
      // loggingUtil.log(`apiUrl: ${apiUrl}`);
      // loggingUtil.log(`statusCode: ${res.statusCode}`);
      let chunks = '';
      res.on('data', (chunk) => {
        chunks += chunk;
      });

      res.on('end', () => {
        if (chunks.length == 0) {
          resolve(undefined);
        } else {
          if (res.statusCode != 200) {
            loggingUtil.log('protocol.request statusCode', res.statusCode, chunks);
            resolve({});
          }
          try {
            const json = JSON.parse(chunks);
            resolve(json);
          } catch (error) {
            loggingUtil.log('protocol.request error', error, chunks);
            resolve({});
          }
        }
      });
    });

    req.on('error', (error) => {
      loggingUtil.log('sendRequest error', error, body);
    });

    if (formData !== undefined) {
      req.write(body);
    }
    req.end();
  });
};
exports.init = init;
exports.deactivate = deactivate;
exports.sendRequest = sendRequest;
