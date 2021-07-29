// ==UserScript==
// @name         MIQ Search
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  MIQ allocation helper
// @author       Jonathan Briden
// @match        https://allocation.miq.govt.nz/portal/organisation/*/event/MIQ-DEFAULT-EVENT/accommodation/arrival-date
// @icon         https://www.google.com/s2/favicons?domain=govt.nz
// @grant        GM_notification
// ==/UserScript==

unsafeWindow.quit = false;

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

      // General variables
  var pref, outer, elLog, elStop, wantDates;
  const ev = new MouseEvent("mousedown", {bubbles: true, cancelable: true, which: 1});
  const availDates = new Map();
  const dateFKey = {day: "2-digit", month: "short"};
  const minMonth = 7;
  const Y = 2021;

  // Logging
  function createLog() {
    elLog = document.createElement("div");
    elLog.style.cssText = 'position: fixed; top: 4px; right: 4px; width: 480px; height: 80px; background: rgba(255, 255, 240, 0.9); border: 1px solid gray; overflow-y: auto; font-size: 10pt; box-shadow: 0 0 8px 0 lime';
    elStop = document.createElement("span");
    elStop.setAttribute("onclick", "window.quit = true;");
    elStop.style.cssText = 'position: absolute; display: block; top: 2px; right: 2px; font-size: 12pt; cursor: pointer; z-index: 999;';
    elStop.innerHTML = "&#x23F9;";
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
      if (unsafeWindow.quit) {
        worker.terminate();
        log("stopped! Refresh to continue.");
      } else {
        const reload = e.data;
        if (reload <= 0) {
          location.reload();
        } else {
          log(reload + "... ");
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
    oscillator.type = "sine";
    oscillator.connect(audio_ctx.destination);
    oscillator.start(audio_ctx.currentTime);
    oscillator.stop(audio_ctx.currentTime + 0.8);
  }

  function getAvailDates() {
    const days = document.querySelectorAll("." + pref + "__d__item div");
    for (let i = 0;i < days.length; i++) {
      const day = days[i];
      const cls = day.getAttribute("class");
      const dateS = day.getAttribute("aria-label");
      if (dateS && cls && cls.trim().toLowerCase() !== "no") {
        const dt = new Date(dateS + " " + Y);
        const month = dt.getMonth() + 1;
        if (month < minMonth) {
          dt.setFullYear(dt.getFullYear() + 1)
        }
        availDates.set(dateFmt(dt, dateFKey), day);
      }
    }
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
    // Check dates (if used)
    if (!ANY_DATE) {
      checkDates();
    }

    outer[0].scrollIntoView();

    // Any dates?
    if (availDates.size > 0) {
      const match = ANY_DATE ? [...availDates.keys()] : wantDates.filter(d => availDates.has(d));
      if (match && match.length > 0) {
        const sAvail = match.join(", ");
        log("DATES AVAILABLE!<br>" + sAvail);
        beep();
        GM_notification({
          "title": "Dates available!",
          "text": sAvail,
          "highlight": true,
          "silent": false
        });

        const firstDate = availDates.get(match[0]);
        firstDate.dispatchEvent(ev);
        return;
      } else {
        log("NO MATCHING DATES.<br>" + availDates.join(", ") + "<br>");
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

  function getPref() {
    const buttons = document.getElementsByTagName("button");
    for (var i = 0; i < buttons.length; i++){
      const cls = buttons[i].getAttribute("class");
      const pos = cls.indexOf("__p");
      if (pos > -1) {
        return cls.substring(0, pos);
      }
    }
    return false;
  }

  function main() {
    // Find the prefix
    pref = getPref();
    // Outer div of calendar
    outer = document.getElementsByClassName(pref);
    if (!pref || outer.length === 0) {
      log("<b>MIQ SYSTEM HAS BEEN UPDATED: Check for new version of script</b>");
      return;
    }

    // Get the dates and then handle them
    getAvailDates();
    console.log(availDates);

    handleDates();
  }

  // If we're on the right page, and start our process
  if (window.location.hash === "#step-2") {
    window.addEventListener("load", main, false);
  }
})();
