import {clear, addText, addChildElement, displayErrorMessage} from '../lib/util.js';

const ZERO = BigInt(0);

const ONE = BigInt(1);

const onLoad = async () => {
  loadAdminKey();
  loadPayouts();
};

const loadAdminKey = () => {
  const adminKeyElt = document.querySelector('#adminKey');
  if (adminKeyElt !== null) {
    if (window.localStorage.adminKey !== undefined) {
      adminKeyElt.value = window.localStorage.adminKey;
    }
  }
};

const saveAdminKey = () => {
  const adminKeyElt = document.querySelector('#adminKey');
  window.localStorage.adminKey = adminKeyElt.value;
};

const updateAdminKey = () => {
  saveAdminKey();
  setAdminKey(window.localStorage.adminKey);
};

const clearAdminKey = () => {
  setAdminKey('');
};

const setAdminKey = async (adminKey) => {
  const response = await fetch('/admin_key', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: `{"admin_key":"${adminKey}"}`,
  });
  const responseJson = await response.json();
  // console.log('data_pack', responseJson);
  if (responseJson.success) {
    location.reload();
  } else {
    displayErrorMessage(responseJson.message);
  }
};

const clearScore = async (account) => {
  const response = await fetch('/clear_score', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: `{"admin_key":"${window.localStorage.adminKey}", "account": "${account}"}`,
  });
  const responseJson = await response.json();
  // console.log('data_pack', responseJson);
  if (responseJson.success) {
    location.reload();
  } else {
    displayErrorMessage(responseJson.message);
  }
};

const loadPayouts = async () => {
  const bananodeApiUrl = 'https://kaliumapi.appditto.com/api';

  const walletAccountElt = document.querySelector('#walletAccount');
  const walletAccount = walletAccountElt.innerText;

  const response = await fetch(bananodeApiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: `{"action": "account_history", "account":"${walletAccount}", "count":-1, "reverse":false}`,
  });
  const history = await response.json();
  // console.log('loadPayouts', history);
  if (history.history !== undefined) {
    const bananojs = window.bananocoinBananojs;

    const totalSendAmount = {};
    const totalSendCount = {};
    const sendByDateAndAmount = {};
    const sendByDateAndCount = {};
    const allAccountsSet = new Set();
    const accountMinDate = {};

    history.history.forEach((historyElt) => {
      if (historyElt.type == 'send') {
        const date = new Date(historyElt.local_timestamp * 1000).toISOString().substring(0, 10);
        // console.log('date', date);

        if (sendByDateAndAmount[date] === undefined) {
          sendByDateAndAmount[date] = {};
        }

        if (sendByDateAndCount[date] === undefined) {
          sendByDateAndCount[date] = {};
        }

        accountMinDate[historyElt.account] = date;

        allAccountsSet.add(historyElt.account);

        const sendByAmount = sendByDateAndAmount[date];

        const sendByCount = sendByDateAndCount[date];

        if (sendByCount[historyElt.account] === undefined) {
          sendByCount[historyElt.account] = ZERO;
        }

        if (sendByAmount[historyElt.account] === undefined) {
          sendByAmount[historyElt.account] = ZERO;
        }
        if (totalSendAmount[historyElt.account] === undefined) {
          totalSendAmount[historyElt.account] = ZERO;
        }

        if (totalSendCount[historyElt.account] === undefined) {
          totalSendCount[historyElt.account] = ZERO;
        }

        sendByAmount[historyElt.account] += BigInt(historyElt.amount);

        sendByCount[historyElt.account] += BigInt(ONE);

        totalSendAmount[historyElt.account] += BigInt(historyElt.amount);

        totalSendCount[historyElt.account] += BigInt(ONE);
      }
    });

    const payoutsElt = document.querySelector('#payouts');
    clear(payoutsElt);

    const payoutAccountsElt = document.querySelector('#payoutAccounts');
    clear(payoutAccountsElt);

    const allListAccounts = [...allAccountsSet];

    const allHistogramAccounts = [...allAccountsSet];

    const dates = [...Object.keys(sendByDateAndAmount)];
    // console.log('loadPayouts', dates);
    dates.sort((a, b) => {
      return b.localeCompare(a);
    });

    // account list
    allListAccounts.sort((a, b) => {
      const aTotalSend = totalSendAmount[a];
      const bTotalSend = totalSendAmount[b];
      const cTotalSend = bTotalSend - aTotalSend;
      if (cTotalSend > ZERO) {
        return 1;
      } else if (cTotalSend < ZERO) {
        return -1;
      }

      // account name
      const cab = a.localeCompare(b);
      if (cab != 0) {
        return cab;
      }
      return 0;
    });

    const addPaymentAccountHeader = () => {
      const trElt = addChildElement(payoutAccountsElt, 'tr');
      const accountElt = addChildElement(trElt, 'td', {
        class: 'align_top whitespace_no_wrap',
      });
      addText(accountElt, 'Account');
      const amountElt = addChildElement(trElt, 'td');
      addText(amountElt, 'Amount');
      const countElt = addChildElement(trElt, 'td');
      addText(countElt, 'Count');
    };

    addPaymentAccountHeader();

    allListAccounts.forEach((account) => {
      const trElt = addChildElement(payoutAccountsElt, 'tr', {
        id: 'payout-' + account,
      });
      const raw = totalSendAmount[account];
      const balanceParts = bananojs.getBananoPartsFromRaw(raw);
      const banano = balanceParts.banano;

      const count = totalSendCount[account];
      const accountElt = addChildElement(trElt, 'td');
      addText(accountElt, account);
      const amountElt = addChildElement(trElt, 'td');
      addText(amountElt, banano);
      const countElt = addChildElement(trElt, 'td');
      addText(countElt, count);
    });

    // histogram
    allHistogramAccounts.sort((a, b) => {
      const aMinDate = accountMinDate[a];
      const bMinDate = accountMinDate[b];
      const cMinDate = bMinDate.localeCompare(aMinDate);
      if (cMinDate != 0) {
        return cMinDate;
      }

      const aTotalSend = totalSendAmount[a];
      const bTotalSend = totalSendAmount[b];
      const cTotalSend = bTotalSend - aTotalSend;
      if (cTotalSend > ZERO) {
        return 1;
      } else if (cTotalSend < ZERO) {
        return -1;
      }

      // account name
      const cab = a.localeCompare(b);
      if (cab != 0) {
        return cab;
      }
      return 0;
    });

    const addHistogamHeader = () => {
      const trElt = addChildElement(payoutsElt, 'tr');
      const dateElt = addChildElement(trElt, 'td', {
        class: 'align_top whitespace_no_wrap',
      });
      addText(dateElt, 'Date');

      allHistogramAccounts.forEach((account, accountIx) => {
        const accountElt = addChildElement(trElt, 'td', {
          class: 'align_top small',
        });
        addText(accountElt, accountIx + 1, {
          title: account,
        });
      });
    };
    addHistogamHeader();

    dates.forEach((date) => {
      const sendByAmount = sendByDateAndAmount[date];

      const sendByCount = sendByDateAndCount[date];

      allHistogramAccounts.forEach((account) => {
        if (sendByAmount[account] === undefined) {
          sendByAmount[account] = 0;
        }
        if (sendByCount[account] === undefined) {
          sendByCount[account] = 0;
        }
      });

      const trElt = addChildElement(payoutsElt, 'tr');
      const dateElt = addChildElement(trElt, 'td', {
        class: 'align_top whitespace_no_wrap',
      });
      addText(dateElt, date);

      allHistogramAccounts.forEach((account) => {
        const accountStart = account.substring(4, 8);
        const count = sendByCount[account];
        const raw = sendByAmount[account];
        const accountElt = addChildElement(trElt, 'td', {
          class: 'align_top small',
        });
        if (raw > ZERO) {
          const balanceParts = bananojs.getBananoPartsFromRaw(raw);
          const banano = balanceParts.banano;

          // console.log('date', date, 'account', account, 'amount', raw, 'banano', banano);

          const squareElt = addChildElement(accountElt, 'div', {
            class: 'black_background white_foreground',
            title: account,
          });
          const anchorElt = addChildElement(squareElt, 'a', {
            href: '#payout-' + account,
          });
          addText(anchorElt, 'ban');
          addChildElement(anchorElt, 'br');
          addText(anchorElt, accountStart);
          addChildElement(anchorElt, 'br');
          addText(anchorElt, banano);
          addChildElement(anchorElt, 'br');
          addText(anchorElt, 'nbr');
          addChildElement(anchorElt, 'br');
          addText(anchorElt, count);
        }
      });
    });
  }
};

window.onLoad = onLoad;
window.updateAdminKey = updateAdminKey;
window.clearAdminKey = clearAdminKey;
window.clearScore = clearScore;
