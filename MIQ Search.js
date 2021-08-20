// ==UserScript==
// @name         MIQ Search
// @namespace    http://tampermonkey.net/
// @version      3.1.1
// @description  MIQ allocation helper
// @author       Jonathan Briden
// @match        https://allocation.miq.govt.nz/portal/organisation/*/event/MIQ-DEFAULT-EVENT/accommodation/arrival-date
// @icon         https://www.google.com/s2/favicons?domain=govt.nz
// @grant        GM_notification
// ==/UserScript==

unsafeWindow.quit = false;

(function() {
  'use strict';

  //=== USER EDITABLE SECTION ===//

  // To alert on ANY date, set this to true; To look for specific dates, set this to false and set the DATES constant (below).
  const ANY_DATE = true;

  // List your desired dates here in YYYY-MM-DD format. This is ONLY USED if ANY_DATE = false.
  // The sample script includes every day in October 2021.
  const DATES = [
    '2021-10-01',
    '2021-10-02',
    '2021-10-03',
    '2021-10-04',
    '2021-10-05',
    '2021-10-06',
    '2021-10-07',
    '2021-10-08',
    '2021-10-09',
    '2021-10-10',
    '2021-10-11',
    '2021-10-12',
    '2021-10-13',
    '2021-10-14',
    '2021-10-15',
    '2021-10-16',
    '2021-10-17',
    '2021-10-18',
    '2021-10-19',
    '2021-10-20',
    '2021-10-21',
    '2021-10-22',
    '2021-10-23',
    '2021-10-24',
    '2021-10-25',
    '2021-10-26',
    '2021-10-27',
    '2021-10-28',
    '2021-10-29',
    '2021-10-30',
    '2021-10-31'
  ];

  // Use for testing (fakes date availability)
  const TEST_DATE = '';

  // These values control how often the script refreshes. Having a range helps the script look more "human". A low value will result in a 403 error happening more often.
  // A higher value will mean less chance of getting a date quickly. The defaults 7 and 12 strike a good balance.
  const WAIT_MIN = 7;
  const WAIT_MAX = 12;

  //=== END of USER EDITABLE SECTION ===//

  // General variables
  let outer, elLog, elStop, wantDates, clDay, clLabel;
  const ev = new MouseEvent('click',
      {bubbles: true, cancelable: true, which: 1});
  const availDates = new Map();
  const dateFKey = {day: '2-digit', month: 'short', year: '2-digit'};
  const minMonth = 8;
  const Y = 2021;

  // Logging
  function createLog() {
    elLog = document.createElement('div');
    elLog.style.cssText = 'position: fixed; top: 4px; right: 4px; width: 480px; height: 80px; background: rgba(255, 255, 240, 0.9); border: 1px solid gray; overflow-y: auto; font-size: 10pt; box-shadow: 0 0 8px 0 lime';
    elStop = document.createElement('span');
    elStop.setAttribute('onclick', 'window.quit = true;');
    elStop.style.cssText = 'position: absolute; display: block; top: 2px; right: 2px; font-size: 12pt; cursor: pointer; z-index: 999;';
    elStop.innerHTML = '&#x23F9;';
    elLog.appendChild(elStop);
    document.body.appendChild(elLog);
  }

  function log(text) {
    if (!elLog) createLog();
    elLog.innerHTML += text;
  }

  // Reload timer uses a worker so continues in background
  function reloadSoon(n) {
    const script = `function(e) {
    let reload = e.data;
    const relMsg = () => {
        self.postMessage(reload);
        reload--;
        if (reload >= 0) {
            setTimeout(relMsg, 1000);
        }
    }
    relMsg();
}
`;
    const worker = new Worker(
        window.URL.createObjectURL(new Blob(['onmessage = ' + script])));
    worker.onmessage = function(e) {
      if (unsafeWindow.quit) {
        worker.terminate();
        log('stopped! Refresh to continue.');
      } else {
        const reload = e.data;
        if (reload <= 0) {
          location.reload();
        } else {
          log(reload + '... ');
        }
      }
    };
    worker.postMessage(n);
  }

  // Date formatting
  function dateFmt(d, fmt) {
    return d.toLocaleDateString('en-NZ', fmt);
  }

  // Beeper
  function beep() {
    const audio_ctx = new AudioContext();
    const oscillator = audio_ctx.createOscillator();
    oscillator.frequency.value = 660;
    oscillator.type = 'sine';
    oscillator.connect(audio_ctx.destination);
    oscillator.start(audio_ctx.currentTime);
    oscillator.stop(audio_ctx.currentTime + 0.8);
  }

  // Adjust style
  function tweakStyle() {
    const style = document.createElement('style');
    style.innerHTML = '.' + clDay + ' :not(.' + clLabel +
        ')[tabIndex]{background:yellow}';
    document.head.prepend(style);
  }

  // Look at calendar to find available dates
  function getAvailDates() {
    const labels = document.querySelectorAll('div[aria-label]');
    const rxNum = /^\d+$/;
    let found = false;
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const labelS = label.getAttribute('aria-label');
      const text = label.textContent;
      const val = rxNum.test(text) ? parseInt(text) : 0;
      if (val >= 1 && val <= 31) {
        found = true;

        const dt = new Date(labelS + ' ' + Y);

        // Fake it for our test date
        if (TEST_DATE && (new Date(TEST_DATE)).toDateString() ===
            dt.toDateString()) {
          label.removeAttribute('class');
        }

        const cls = label.getAttribute('class');
        if (!cls) {
          const month = dt.getMonth() + 1;
          if (month < minMonth) {
            dt.setFullYear(dt.getFullYear() + 1);
          }
          availDates.set(dateFmt(dt, dateFKey), label);
        } else if (!clLabel) {
          clLabel = cls;
          clDay = label.parentElement.getAttribute('class');
          tweakStyle();
        }
      }
    }

    return found;
  }

  function checkDates() {
    const check = [];
    wantDates = [];
    DATES.forEach(d => {
      const date = new Date(d);
      if (isNaN(date)) {
        check.push(d);
      } else {
        wantDates.push(dateFmt(date, dateFKey));
      }
      if (check.length > 0) {
        log('<b>Invalid dates:<b> ' + check.join(', ') + '<br>');
      }
    });
  }

  function handleDates() {
    // Bring the calendar into view
    outer[0].scrollIntoView();

    // Any dates?
    if (availDates.size > 0) {
      const dateVals = [...availDates.keys()];

      // Log these dates in local storage for debugging purposes
      localStorage.setItem((new Date()).toLocaleString('en-NZ'),
          dateVals.join(', '));

      // Find matches (all if ANY_DATE is true)
      const match = ANY_DATE ? dateVals : wantDates.filter(
          d => availDates.has(d));
      if (match && match.length > 0) {
        const sAvail = match.join(', ');
        log('DATES AVAILABLE!<br>' + sAvail);
        beep();
        GM_notification({
          'title': 'Dates available!',
          'text': sAvail,
          'highlight': true,
          'silent': false
        });

        const firstDate = availDates.get(match[0]);
        setTimeout(() => firstDate.dispatchEvent(ev), 100);
        return;
      } else {
        log('NO MATCHING DATES.<br>Found: ' + dateVals.join(', ') + '<br>');
        // Remove the slashes at the start of the next line to make the script STOP on any match
        // return;
      }
    } else {
      log('NO DATES AVAILABLE<br>');
    }

    // If not found reload in random seconds
    log('reloading in: ');
    reloadSoon(
        WAIT_MIN + Math.floor(Math.random() * (WAIT_MAX - WAIT_MIN + 1)));
  }

  function main() {
    // Outer div of calendar
    outer = document.getElementsByClassName('col-12 p-1');

    // Check entered dates (if used)
    if (!ANY_DATE) {
      checkDates();
    }

    // Get the available dates
    if (getAvailDates()) {
      // Handle dates
      handleDates();
    } else {
      log('<b>MIQ SYSTEM HAS BEEN UPDATED: Check for new version of script</b>');
    }
  }

  // If we're on the right page, and start our process
  if (window.location.hash === '#step-2') {
    //window.addEventListener('load', main, false);
    main();
  }
})();
