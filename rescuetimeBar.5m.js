#!/usr/bin/env /usr/local/bin/node
// Based on https://github.com/jckyeh/bitbar-rescuetime-plugin
// Thank you so much for the code and inspiration

"use strict";

const https = require('https');
const fs = require('fs');
// Set your target score
const goal = 70;

// Enable filtering based on working schedule
// The productivity date is filterd using a filter provided by
// Rescue time to filter on 'During working hours' 
// (it's not well documented yet). You need a premium acount for it.
var restrict_to_working_hours = false;

// Rescue time API key. Need to manually create an api.key file
const PATH = `${process.env.HOME}/Library/RescueTime.com/api.key`;
const API_KEY = fs.readFileSync(PATH, 'utf8').trim();

const ENDPOINT_FEED = 'https://www.rescuetime.com/anapi/daily_summary_feed.json';
const ENDPOINT_ACTIVITIES = 'https://www.rescuetime.com/anapi/data.json';

const URL_DASH_DAY = 'https://www.rescuetime.com/dashboard/for/the/day/of/';

let endpoint_week = `${ENDPOINT_FEED}?key=${API_KEY}`;

let endpoint_today = `${ENDPOINT_ACTIVITIES}?key=${API_KEY}&perspective=interval&restrict_kind=productivity&restrict_kind=productivity`
if (restrict_to_working_hours) {
  lendpoint_today = `${ENDPOINT_ACTIVITIES}?key=${API_KEY}&perspective=interval&restrict_kind=productivity&restrict_kind=productivity&restrict_schedule_id=7304874`;
}

function request(endpoint) {
  return new Promise((resolve, reject) => {
    https.get(endpoint, (res) => {
      const body = [];
      res.on('data', (data) => body.push(data));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body.join()));
        } catch(error) {
          reject(error);
        }
      });
      res.on('error', (error) => {
        reject(error);
      });
    });
  });
}

function calcTarget(goal, step) {
  return goal / 100 * step;
}

function range(start, end) {
  var ans = [];
  for (let i = start; i <= end; i++) {
      ans.push(i);
  }
  return ans;
}

function getProgressBar(score) {
  var bar = "○○○";
  // circles close based on your goal
  if(score < calcTarget(goal, 15)) { bar = "○○○"}
  else if (score <= calcTarget(goal, 30)) { bar = "◐○○"}
  else if (score <= calcTarget(goal, 45)) { bar = "●○○"}
  else if (score <= calcTarget(goal, 60)) { bar = "●◐○"}
  else if (score <= calcTarget(goal, 75)) { bar = "●●○"} 
  else if (score <= calcTarget(goal, 90)) { bar = "●●◐"} 
  else if (score >= calcTarget(goal, 90)) { bar = "●●●"}
  return bar;
}

function hoursToString(hoursDecimal) {
  const hours = Math.floor(hoursDecimal);
  let minutes = Math.round((hoursDecimal - hours) * 60);

  if (minutes < 10) {minutes = "0"+minutes;}
  return `${hours.toString()}:${minutes.toString()}`;
}

function filterRowsByProductivity(rows, index) {
  // Index 3 correspondes to productivity
  // 2: v productive; 1: productive; 0: neutral; -1: distracting; -2: v distracting
  return rows.filter((row => row[3] == index))
}

function sumHoursinRows(rows) {
  // Index 1 corresponds to time in seconds
  return rows.reduce((acc, row) => (acc + row[1] / 60 / 60), 0);
}


//Get rows of activity data from anapi/data
request(endpoint_today).then((json) => {
  // Sum time logged today (in hours)
  const today_hours = sumHoursinRows(json.rows);

  const vpRows = filterRowsByProductivity(json.rows, 2);
  const vpHours = sumHoursinRows(vpRows);

  const pRows = filterRowsByProductivity(json.rows, 1);
  const pHours = sumHoursinRows(pRows);

  const nRows = filterRowsByProductivity(json.rows, 0);
  const nHours = sumHoursinRows(nRows);
  
  const dRows = filterRowsByProductivity(json.rows, -1);
  const dHours = sumHoursinRows(dRows);
  
  const vdRows = filterRowsByProductivity(json.rows, -2);
  const vdHours = sumHoursinRows(vdRows);

  let score = 0;
  if (today_hours !== 0) {
    score = Math.floor((1*vpHours + .75*pHours + .5*nHours + .25*dHours + 0*vdHours)/today_hours*100);
  }

  let todays_message = "Today's score: ";
  if (restrict_to_working_hours) {
    todays_message = "Today's score during working hours: "
  }
  console.log(`${getProgressBar(score)}`);
  console.log(`---`);
  console.log(`${todays_message} ${score} Click for more info ⇪ | href=https://www.rescuetime.com/dashboard`);
  console.log(`Target score 🎯 ${goal}`);
  console.log(`${hoursToString(today_hours)} - Time Logged Today`);
  console.log(`${hoursToString(vpHours)} - Verry Productive Today`);
  console.log(`${hoursToString(pHours)} - Productive Today`);
  console.log(`${hoursToString(nHours)} - Neutral Today`);
  console.log(`${hoursToString(dHours)} - Distracting Today`);
  console.log(`${hoursToString(vdHours)} - Verry Distracting Today`);
  console.log(`---`);
}).catch((error) => {
  console.log(error);
})