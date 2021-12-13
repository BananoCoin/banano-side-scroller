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

bmcaptcha.init = (id, captchaClickedCallback) => {
  const registerCallback = (json) => {
    bmcaptcha.secretKey = json.secretKey;
  };
  bmcaptcha.postJSON('bm-captcha-register', {}, registerCallback);

  bmcaptcha.captchaClickedCallback = captchaClickedCallback;
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

  const mainElt = document.querySelector('#side_scroller');
  const captchaElt = addChildElement(mainElt, 'div', {
    'style': 'display:none',
    'id': 'bm_captcha',
  });
  addText(captchaElt, 'Captcha');
  addChildElement(captchaElt, 'br');
  const captchaAnchorElt = addChildElement(captchaElt, 'a', {
    'onclick': 'bmcaptcha.captchaClicked(event)',
  });
  for (let imageIx = 1; imageIx <= bmcaptcha.MAX_IMAGES; imageIx++) {
    addChildElement(captchaAnchorElt, 'img', {
      'id': 'bm_captcha_image_' + imageIx,
      'data_answer': imageIx,
      'ismap': 'ismap',
      'style': 'width:150px;',
    });
    if (imageIx == 3) {
      addChildElement(captchaAnchorElt, 'br');
    }
  }
};

bmcaptcha.captchaClicked = (event) => {
  // console.log('captchaClicked', event.target);
  const request = {};
  request.account = window.localStorage.account;
  request.secretKey = bmcaptcha.secretKey;
  request.answer = event.target.getAttribute('data_answer');

  const callbackWrapper = (response) => {
    console.log('captchaClicked', 'response', response);
    bmcaptcha.captchaClickedCallback(response);
  };

  bmcaptcha.postJSON('bm-captcha-verify', request, callbackWrapper);
};

bmcaptcha.hideCaptcha = () => {
  const captchaElt = document.querySelector('#bm_captcha');
  captchaElt.setAttribute('style', 'display:none');
};

bmcaptcha.showCaptcha = (callback) => {
  const callbackWrapper = (json) => {
    console.log('showCaptcha', json);
    const captchaElt = document.querySelector('#bm_captcha');
    captchaElt.setAttribute('style', 'display:block');
    const keys = [...Object.keys(json.images.monkeys)];
    console.log('showCaptcha', 'keys', keys);
    keys.forEach((imageIx) => {
      const selector = '#bm_captcha_image_' + imageIx;
      console.log('showCaptcha', 'selector', selector);
      const captchaImageElt = document.querySelector(selector);
      console.log('showCaptcha', 'captchaImageElt', captchaImageElt);
      const data = json.images.monkeys[imageIx];
      // console.log('showCaptcha', 'data', data);
      captchaImageElt.setAttribute('src', data);
      captchaImageElt.setAttribute('className', '');
    });
    callback(json);
  };
  const request = {};
  request.secretKey = bmcaptcha.secretKey;
  bmcaptcha.postJSON('bm-captcha-request', request, callbackWrapper);
};

export {bmcaptcha};
