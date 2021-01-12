const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const {Base64} = require('js-base64');
const cheerio = require('cheerio');
const axios = require('axios');
var CronJob = require('cron').CronJob;

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Gmail API.
  authorize(JSON.parse(content), listLabels);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listLabels(auth) {
  var hrefs = []
  const gmail = google.gmail({version: 'v1', auth});
  gmail.users.messages.get({
    userId: 'me',
    id:'176d4539e39633c1'
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    // El dia de cuando se entregan las noticias
    //console.log(res.data.payload.headers[32].value)
    const resultado = Base64.decode(res.data.payload.parts[0].parts[1].body.data)
    const $ = cheerio.load(resultado,null,false);
    //console.log($('a'))
    const algo = $('a')
    for (const anchor of algo) {
      hrefs.push(anchor.attribs.href)
      //console.log(anchor.attribs.href)
    }
    axios.get('http://portal.nexnews.cl/showN?valor=MjEwNzFVNTEyTDEwMDkwMTYxMzgxNjczNDE2NTQ2MTY5MzA5MTAwMTA3MTI5NzA4MTAzMTQxMDQ5MDE2OTY0MTM3NjBLNTU1NTU1NDU0NTU1NQ==')
    .then(function (response) {
      // handle success
      const $ = cheerio.load(response.data,null,false);
      //console.log($('div[class=titulo]').html())
      //console.log($('div[class=cuerpo]').html())
      // Editorial de donde se saco la noticia
      //console.log($('div[class="col-xs-12 col-sm-12 col-md-12 col-lg-12 medio-bar"]').text().trim().replace(/\n/g, ''))
      var publisher = $('div[class="col-xs-12 col-sm-12 col-md-12 col-lg-12 medio-bar"]').text().trim().replace(/\n/g, '')
      var publisherIndex;
      var counter = 0
      for (let index = 0; index < publisher.length; index++) {
        const element = publisher[index];
        if(element === ' '){
          counter++
        }        
        publisherIndex = index
        if(counter == 2){
          break
        }
      }
      var actualPublisher = publisher.substring(0,publisherIndex)
      console.log(actualPublisher)

      //Usa notacion cron https://github.com/kelektiv/node-cron
      /*
       var job = new CronJob(''+ getJob.schedule_time.toString()+' * * * * *', function(){
        getData(getJob)       
       }, true, 'America/Santiago');
      
      */

    })
    .catch(function (error) {
      // handle error
      console.log(error);
    })
    .then(function () {
      // always executed
    });

  });
  
}