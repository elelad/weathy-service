// load enviroment variables from .env file
require('dotenv').config()

const path = require('path')

const express = require('express')
const favicon = require('serve-favicon')
const cors = require('cors')

const DarkSky = require('dark-sky')
const RateLimit = require('express-rate-limit');
//const moment = require('moment');
const request = require('request');

const app = express()

app.use(cors())
app.use(favicon(path.join(process.cwd(), 'favicon.ico')))

app.set('port', process.env.PORT || 3000)

app.enable('trust proxy')

const sleep = 600000; // 10 minutes

// the weather doesn't change too often
const limiter = new RateLimit({
  windowMs: sleep,
  max: 10, // limit each IP to 1 requests per windowMs
  delayMs: 0 // disable delaying - full speed until the max limit is reached
})

// Home
app.get('/', (req, res) => {
  res.send(`<div>Current time is: ${new Date().toLocaleString()}</div>`)
})


// DarkSky API
const forecast = new DarkSky(process.env.API_KEY)

app.get('/api/v1/json', limiter, (req, res) => {
  const { lat, lon, lang } = req.query

  forecast
    .latitude(lat)
    .longitude(lon)
    .units('auto')
    .time(Date.now())
    .language(lang)
    .exclude('minutely,hourly,daily,alerts,flags')
    .get()
    .then(weather => res.status(200).json(weather))
    .catch(error => res.send(error))
})

app.get('/api/v1/delta', limiter, (req, res) => {
  const { lat, lon, lang, tTime, yTime } = req.query;
  console.log(tTime);
  console.log(yTime);
  let today = {};
  let yesterday = {};
  let address = "";
  let geoPrms = reversGeo(lat, lon, lang).then((add) => address = add).catch(e => console.log(e));
  let todayPrms = forecast
    .latitude(lat)
    .longitude(lon)
    .units('auto')//'si'
    .time(+tTime)
    .language(lang)
    .exclude('minutely,currently,hourly')//flags,alerts
    .get()
    .then(weather => today = weather)
  //.catch(error => res.send(error))
  let yesterdayPrms = forecast
    .latitude(lat)
    .longitude(lon)
    .units('auto')//si
    .time(+yTime)
    .language(lang)
    .exclude('minutely,currently,hourly,alerts')//flags
    .get()
    .then(weather => yesterday = weather)



  Promise.all([todayPrms, yesterdayPrms, geoPrms]).then(() => {
    //console.log(today);
    console.log(today.daily.data[0].time);
    console.log(yesterday.daily.data[0].time);
    let t = today.daily.data[0].apparentTemperatureHigh;
    let y = yesterday.daily.data[0].apparentTemperatureHigh;
    let tl = today.daily.data[0].apparentTemperatureLow;
    let yl = yesterday.daily.data[0].apparentTemperatureLow;
    let json = {
      today: t,
      yesterday: y,
      todayL: tl,
      yesterdayL: yl,
      icon: today.daily.data[0].icon,
      delta: (((t + 273.15) / (y + 273.15)) - 1) * 100,
      address: address,
      unit: (today.flags.units === 'us') ? 'f' : 'c',
      alerts: today.alerts
      //delta: Math.round(((25 / 30) - 1 ) * 100)
    }
    //console.log(json);
    res.status(200).json(json)
  }).catch(error => {
    console.log(error);
    res.send(error);
  })

})

app.listen(
  app.get('port'),
  () => console.log(`Server is listening at port ${app.get('port')}`)
)


function reversGeo(lat, lon, lang) {
  if (lang === 'he') lang = 'iw';
  return new Promise((res, rej) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&language=${lang}&key=${process.env.GMAP_API_KEY}`;
    request(url, function (error, response, body) {
      if (error) {
        console.log('error:', error);
        return rej(error);
      }
      if (response && response.statusCode === 200) {
        let json = JSON.parse(body);
        //console.log(json.plus_code);
        let address = "";
        if (json && json.results[0] && json.results[0].formatted_address) address = json.results[0].formatted_address;
        address = address.slice(address.indexOf(', ') + 2);
        console.log(address);
        return res(address);
      }
    });
  })
}