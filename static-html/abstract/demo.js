import {bmcaptcha} from '../../js/lib/bm-captcha.js';

window.bmcaptcha = bmcaptcha;

window.onLoad = () => {
  const showCaptcha = () => {
    bmcaptcha.showCaptcha();
  };
  bmcaptcha.init('#demo', captchaClicked, showCaptcha);
};

window.captchaClicked = (response) => {
  // console.log('captchaClicked', response);
  bmcaptcha.showCaptcha();
};
