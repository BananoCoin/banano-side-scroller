import {set} from '../lib/util.js';

const bmcaptcha = {};
bmcaptcha.MAX_IMAGES = 6;
bmcaptcha.captchaClickedCallback = () => {};
bmcaptcha.secretKey = '';
bmcaptcha.postJSON = (path, json, success, error) => {
  const xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (xhr.status === 200) {
        if (success) {
          success(JSON.parse(xhr.responseText));
        }
      } else {
        if (error) {
          error(xhr);
        }
      }
    }
  };
  xhr.open('POST', path, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify(json));
};

bmcaptcha.init = (id, captchaClickedCallback, registerCallbackCallback) => {
  const registerCallback = (json) => {
    // console.log('registerCallback', json);
    bmcaptcha.secretKey = json.secretKey;
    bmcaptcha.id = id;
    if (registerCallbackCallback !== undefined) {
      registerCallbackCallback();
    }
  };
  bmcaptcha.captchaClickedCallback = captchaClickedCallback;
  bmcaptcha.postJSON('/bm-captcha-register', {}, registerCallback);
};

bmcaptcha.captchaClicked = (event) => {
  // console.log('captchaClicked', event);
  if (!event.isTrusted) {
    return;
  }
  const request = {};
  request.account = window.localStorage.account;
  request.secretKey = bmcaptcha.secretKey;
  request.answer = event.target.getAttribute('data_answer');

  const callbackWrapper = (response) => {
    // console.log('captchaClicked', 'response', response);
    bmcaptcha.captchaClickedCallback(response);
  };

  bmcaptcha.postJSON('/bm-captcha-verify', request, callbackWrapper);
};

bmcaptcha.hideCaptcha = () => {
  const captchaElt = document.querySelector('#bm_captcha');
  captchaElt.setAttribute('style', 'display:none');
};

bmcaptcha.showCaptcha = (callback) => {
  const callbackWrapper = (json) => {
    // console.log('showCaptcha', json);
    const keys = [...Object.keys(json.images.monkeys)];

    const addText = (parent, childText) => {
      parent.appendChild(document.createTextNode(childText));
    };
    const addAttributes = (child, attributes) => {
      if (attributes) {
        Object.keys(attributes).forEach((attibute) => {
          const value = attributes[attibute];
          set(child, attibute, value);
        });
      }
    };
    const addChildElement = (parent, childType, attributes) => {
      const child = document.createElement(childType);
      parent.appendChild(child);
      addAttributes(child, attributes);
      return child;
    };

    const mainElt = document.querySelector(bmcaptcha.id);
    mainElt.innerHTML = '';
    const captchaElt = addChildElement(mainElt, 'div', {
      style: 'display:none',
      id: 'bm_captcha',
    });
    addText(captchaElt, 'Captcha');
    addChildElement(captchaElt, 'br');
    const captchaAnchorElt = addChildElement(captchaElt, 'a', {
      onclick: 'bmcaptcha.captchaClicked(event)',
    });
    for (let imageIx = 1; imageIx <= keys.length; imageIx++) {
      const id = 'bm_captcha_image_' + imageIx;
      // console.log('init id', id);
      addChildElement(captchaAnchorElt, 'img', {
        id: id,
        data_answer: imageIx,
        ismap: 'ismap',
        style: 'width:150px;',
      });
      if (imageIx == 3) {
        addChildElement(captchaAnchorElt, 'br');
      }
    }
    captchaElt.setAttribute('style', 'display:block');
    // console.log('showCaptcha', 'keys', keys);
    keys.forEach((imageIx) => {
      const selector = '#bm_captcha_image_' + imageIx;
      // console.log('showCaptcha', 'selector', selector);
      const captchaImageElt = document.querySelector(selector);
      // console.log('showCaptcha', 'captchaImageElt', captchaImageElt);
      const data = json.images.monkeys[imageIx];
      // console.log('showCaptcha', 'data', data);
      captchaImageElt.setAttribute('src', data);
      captchaImageElt.setAttribute('class', 'white_background');
    });
    if (callback !== undefined) {
      callback(json);
    }
  };
  const request = {};
  request.secretKey = bmcaptcha.secretKey;
  request.account = window.localStorage.account;
  // console.log('showCaptcha', 'request', request);
  bmcaptcha.postJSON('/bm-captcha-request', request, callbackWrapper);
};

export {bmcaptcha};
