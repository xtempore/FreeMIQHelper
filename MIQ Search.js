// ==UserScript==
// @name         MIQ Search
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Look for MIQ allocation
// @author       anonymous
// @match        https://allocation.miq.govt.nz/portal/organisation/*/event/MIQ-DEFAULT-EVENT/accommodation/arrival-date
// @icon         https://www.google.com/s2/favicons?domain=govt.nz
// @grant        GM_notification
// ==/UserScript==

(function() {
  'use strict';

  /*** USER EDITABLE SECTION ***/

      // To alert on ANY date, set this to true; To look for specific dates, set this to false and set the DATES constant (below).
  const ANY_DATE = true;

  // List your desired dates here in YYYY-MM-DD format. This is ONLY USED if ANY_DATE = false.
  // The sample script includes every day in October 2021.
  const DATES = [
    "2021-10-01",
    "2021-10-02",
    "2021-10-03",
    "2021-10-04",
    "2021-10-05",
    "2021-10-06",
    "2021-10-07",
    "2021-10-08",
    "2021-10-09",
    "2021-10-10",
    "2021-10-11",
    "2021-10-12",
    "2021-10-13",
    "2021-10-14",
    "2021-10-15",
    "2021-10-16",
    "2021-10-17",
    "2021-10-18",
    "2021-10-19",
    "2021-10-20",
    "2021-10-21",
    "2021-10-22",
    "2021-10-23",
    "2021-10-24",
    "2021-10-25",
    "2021-10-26",
    "2021-10-27",
    "2021-10-28",
    "2021-10-29",
    "2021-10-30",
    "2021-10-31"
  ];

  // These values control how often the script refreshes. Having a range helps the script look more "human". A low value will result in a 403 error happening more often.
  // A higher value will mean less chance of getting a date quickly. The defaults 7 and 12 strike a good balance.
  const WAIT_MIN = 7;
  const WAIT_MAX = 12;

  /*** END of USER EDITABLE SECTION ***/

  const elLog = document.createElement('div');
  elLog.style.cssText = 'position: fixed; top: 4px; right: 4px; width: 480px; height: 80px; background: rgba(255, 255, 240, 0.9); border: 1px solid gray; overflow-y: auto; font-size: 10pt; box-shadow: 0 0 8px 0 lime';

  function el(id) {
    return document.getElementById(id);
  }

  function log(text) {
    elLog.innerHTML += text;
  }

  // Reload timer uses a worker so continues in background
  function reloadSoon(n) {
    const script = `function(e) {
    var reload = e.data;
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
    const worker = new Worker(window.URL.createObjectURL(new Blob(["onmessage = " + script])));
    worker.onmessage = function(e) {
      const reload = e.data;
      if (reload <= 0) {
        location.reload();
      } else {
        log(reload + "... ");
      }
    };
    worker.postMessage(n);
  }

  function checkDateData() {
    const rx = new RegExp("202\\d-\\d\\d-\\d\\d");
    let check = [];
    DATES.forEach(s => {
      const d = new Date(s);
      if (!rx.test(s)) {
        check.push(s + " wrong format");
      }
      if (isNaN(d)) {
        check.push(s + " invalid date");
      }
    });
    if (check.length > 0) {
      log("<b>Date errors: " + check.join(", ") + "</b><br>");
    }
  }

  // Beeper
  function beep(){
    const audio_ctx = new AudioContext();
    const oscillator = audio_ctx.createOscillator();
    oscillator.frequency.value = 660;
    oscillator.type = "sine";
    oscillator.connect(audio_ctx.destination);
    oscillator.start(audio_ctx.currentTime);
    oscillator.stop(audio_ctx.currentTime + 0.8);
  }

  // Function to decode MIQ dates
  function getAvailableDates(dates) {
    const t = [58501527, 28741588, 61219430, 20294527, 57613046, 20913046, 23093500, 40765602];
    const e = [];
    const n = dates.split('_');
    for (let a = 0; a < n.length; a++) {
      n[a] = n[a].split('').reverse().join('');
      n[a] = '' + (Number(n[a]) - t[a % t.length]);
      var i = n[a].substring(0, 4) + '-' + n[a].substring(4, 6) + '-' + n[a].substring(6, 8);
      e.includes(i) || e.push(i);
    }
    return e;
  }

  // Main function to check for matching dates
  function lookForDates() {
    document.body.appendChild(elLog);

    // This element has an attribute which lists the current available dates to display in the calendar.
    const calendar = el("accommodation-calendar");
    if (!calendar) {
      log("<b>MIQ SYSTEM HAS BEEN UPDATED: Check for new version of script</b>");
      return;
    }

    // Check the attribute for dates
    const dates = calendar.getAttribute("data-arrival-dates");
    if (dates === null) {
      log("<b>MIQ SYSTEM HAS BEEN UPDATED: Check for new version of script</b>");
      return;
    }

    const cl = calendar.getAttribute("class");
    const pref = cl.substring(0, cl.length - 6);
    const nxMon = document.getElementsByClassName(pref + "-next-month")[0];
    if (!nxMon) {
      log("<b>WARNING:</b> Cannot autoselect month.<br>");
    }

    // Check the date data entry for valid dates (if used)
    if (!ANY_DATE) {
      checkDateData();
    }

    log("Checking dates: ");
    if (dates) {
      const dateArray = getAvailableDates(dates);
      const match = ANY_DATE ? dateArray : DATES.filter(value => dateArray.includes(value));
      if (match && match.length > 0) {
        if (nxMon) {
          const thisMon = new Date().getMonth() + 1;
          const avMon = parseInt(match[0].substr(5, 2));
          var d = avMon - thisMon;
          if (d < 0) d += 12;
          const ev = new MouseEvent("mousedown", {bubbles: true, cancelable: true, which: 1});
          for (var i = 0; i < d; i++) {
            nxMon.dispatchEvent(ev);
          }
        }
        log("DATES AVAILABLE!<br>" + match.join(", "));
        calendar.scrollIntoView();
        beep();
        GM_notification({
          "title": "Dates available!",
          "text": match.join(", "),
          "highlight": true,
          "silent": false
        });
        return;
      } else {
        log("NO MATCHING DATES.<br>" + dateArray.join(", ") + "<br>");
        // Remove the slashes at the start of the next line to make the script STOP on any match
        // return;
      }
    } else {
      log("NO DATES AVAILABLE<br>");
    }

    // If not found reload in random seconds
    log("reloading in: ");
    reloadSoon(WAIT_MIN + Math.floor(Math.random() * (WAIT_MAX - WAIT_MIN + 1)));
  }

  // Check to make sure we're on the right page
  if (window.location.hash === "#step-2") {
    window.addEventListener("load", lookForDates, false);
  }
})();
