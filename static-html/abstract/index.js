import {bmcaptcha} from '../../js/lib/bm-captcha.js';

const abstractApi = '/abstract/api?account=demo';
const abstractReset = '/abstract/reset?account=demo';

window.bmcaptcha = bmcaptcha;

window.onLoad = () => {
  bmcaptcha.captchaClicked = async () => {
    const answer = event.target.getAttribute('data_answer');
    if (answer !== window.answer) {
      loadCaptcha(abstractReset);
    } else {
      loadCaptcha(abstractApi);
    }
  };
  loadCaptcha(abstractApi);
};

window.loadCaptcha = async (url) => {
  const id = '#demo';
  const apiResponse = await fetch(url);
  if (apiResponse.status == 200) {
    const apiJson = await apiResponse.json();
    // console.log('apiJson', apiJson);
    window.answer = apiJson.answer;

    document.getElementById('numberOfMonkeys').innerText = apiJson.numberOfMonkeys;
    document.getElementById('difficulty').innerText = apiJson.difficulty;
    document.getElementById('maxDifficulty').innerText = apiJson.maxDifficulty;
    document.getElementById('maxNumberOfMonkeys').innerText = apiJson.maxNumberOfMonkeys;
    document.getElementById('keySpriteSheetName').innerText = apiJson.keySpriteSheetName;
    document.getElementById('answer').innerText = apiJson.answer;
    document.getElementById('weakestSpriteSheetName').innerText = apiJson.weakestSpriteSheetName;

    bmcaptcha.showMonkeys(id, {images: apiJson});
  } else {
    console.log(`${apiResponse.status} ${apiResponse.statusText}`);
  }
};
