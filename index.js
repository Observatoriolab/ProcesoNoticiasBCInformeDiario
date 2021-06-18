const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const {Base64} = require('js-base64');
const cheerio = require('cheerio');
const axios = require('axios');
var CronJob = require('cron').CronJob;
var correosIniciales = []
var ultimoCorreoCapturado = ""
var correosNuevos = []
var hrefs = []

/// FUNCIONES GMAIL INGRESANDO 
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
  authorize(JSON.parse(content), ConseguirCorreos);
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

function ConseguirCorreos(auth){
  const gmail = google.gmail({version: 'v1', auth});
  // Funcion adquiere todo los id de los correos existentes
  // Guardar ids en CorreosIniciales
  console.log("91")


  // Si es que UltimoCorreoCapturado es un string vacio -> UltimoCorreoCapturado es igual a ultimo id de CorreosIniciales
  // llamar funcion capturar noticias pasandole la variable CorreosIniciales
  if (ultimoCorreoCapturado == ""){
    console.log("97")
    ultimoCorreoCapturado = correosIniciales[0]
    CapturarNoticias(gmail, correosIniciales)
  }
  // Si no, realizar comparacion de CorreosIniciales con el id de UltimoCorreoCapturado y guardar los ids en una variable llamada CorreosNuevos
  else{
    for (const correo of correosIniciales){
      if(correo !== ultimoCorreoCapturado){
        correosNuevos.push(correo)
      }
      else{
        break
      }
    }
    CapturarNoticias(gmail, correosNuevos)
  }
  //llamar funcion campurar noticas pasandole la variable CorreosNuevos
  



}

function CapturarNoticias(gmail,correosID){
  //noticasAguardar es un arreglo que contine los ids de las noticias a guardar en la base de datos
  for (const id of correosID){
      ObtenerUnaNoticia(gmail,id)
      ObtenerMedaDataNoticia()
      hrefs=[]
      console.log(hrefs)

  }
  // recorrer noticasAguardar y ocupar la funcion 

}

function ObtenerMedaDataNoticia(){
  let link =""
  let topico = ""
  for (const noticiaLink of hrefs){
      link= noticiaLink[1]
      topico= noticiaLink[0]
      MetaDataLink(link, topico)
  }
}

function ObtenerUnaNoticia(gmail, idNoticia){
  
  gmail.users.messages.get({
    userId: 'me',
    //id:idNoticia
    id:'176f68499ebb2502'
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    // El dia de cuando se entregan las noticias
    const fechaCorreo = res.data.payload.headers[23].value
    const htmlCorreo = Base64.decode(res.data.payload.parts[1].body.data)
    //console.log(resultado)
    const $ = cheerio.load(htmlCorreo,null,false);

    const cabeceraNoticias = $('td')
    var auxcabecera = ""
    for (const cabecera of cabeceraNoticias) {
      var title;
      //Si la cabecera tiene el estilo de un topico de tema hay que guardarlo
     // console.log("linea 134 lo que contiene la cabecera")
     // console.log(cabecera.children[0])
     // console.log("---------------------------------------------------------------------")
      if(cabecera.attribs.style === 'color: rgb(255, 255, 255); font-size: 17px; border-bottom-color: currentColor; border-bottom-width: medium; border-bottom-style: ridge; background-color: rgb(15, 29, 52);'){
        //Topico del tema (Banco Central de Chile, Columnas y Editoriales, Economía, Banca y Finanzas, Economía Internacional )
        console.log(cabecera.children[0].data)
        auxcabecera = cabecera.children[0].data
      }
      else if (cabecera.children[0] !== undefined && cabecera.children[0].name === 'a')  {
        //EL primer elemento del arreglo es el topico y el segundo es el id
        hrefs.push([auxcabecera, cabecera.children[0].attribs.href])
        console.log([auxcabecera, cabecera.children[0].attribs.href])
      }
    }
  })
}

function MetaDataLink(link,topico){
  axios.get(link)
    .then(function (response) {
      // handle success
      // Se carga el DOM en la variable $
      const $ = cheerio.load(response.data,null,false);
      //console.log($('div[class=titulo]').html())
      //console.log($('div[class=cuerpo]').html())
      
      //console.log($('div[class="col-xs-12 col-sm-12 col-md-12 col-lg-12 medio-bar"]').text().trim().replace(/\n/g, ''))
      // Editorial de donde se saco la noticia
      var publisher = $('div[class="col-xs-12 col-sm-12 col-md-12 col-lg-12 medio-bar"]').text().trim().replace(/\n/g, '')
      var publisherIndex;
      var counter = 0
      for (let index = 0; index < publisher.length; index++) {
        const element = publisher[index];
        publisherIndex = index
        if(element === ' ' && publisher[index+1] === ' '){
          break
        }
      }
      var actualPublisher = publisher.substring(0,publisherIndex)
      console.log(actualPublisher)
      // sacar el pais y la fecha de la noticia y el cuerpo y titulo de la pagina de la noticia
      // Obtener el titulo
      // Obtener fecha
      //guadar en la base de datos los datos de la noticia
    })
    .catch(function (error) {
      // handle error
      console.log(error);
    })
    .then(function () {
      // always executed
    });
}

function GurdarNoticiasDB(data){

}

function listLabels(auth) {
  var hrefs = []
  const gmail = google.gmail({version: 'v1', auth});
  gmail.users.messages.get({
    userId: 'me',
    id:'176f68499ebb2502'
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    // El dia de cuando se entregan las noticias
    console.log(res.data.payload.headers[23].value)
    /*color:rgb(255,255,255);font-size:17px;border-bottom-color:currentColor;border-bottom-width:medium;border-bottom-style:ridge;background-color:rgb(15,29,52) */
    //const resultado = Base64.decode(res.data.payload.parts[0].parts[1].body.data)    
    const resultado = Base64.decode(res.data.payload.parts[1].body.data)
    //console.log(resultado)
    const $ = cheerio.load(resultado,null,false);
    //console.log($('a'))
    const algo = $('a')
    for (const anchor of algo) {
      //Guardar los links de las noticias
      hrefs.push(anchor.attribs.href)
      console.log(anchor.attribs.href)
    }
    const algo2 = $('td')
    for (const td of algo2) {
      var title;
      if(td.attribs.style === 'color: rgb(255, 255, 255); font-size: 17px; border-bottom-color: currentColor; border-bottom-width: medium; border-bottom-style: ridge; background-color: rgb(15, 29, 52);'){
        //Topico del tema (Banco Central de Chile, Columnas y Editoriales, Economía, Banca y Finanzas, Economía Internacional )
        console.log(td.children[0].data)
      }
    }
    //axios.get('http://portal.nexnews.cl/showN?valor=NVEyNjI4MDc0RjI1MjI1NDAzNDU0MTgzNTQxMzY1NDIzMjUyMjc1MDI2NzgwMjc3NzAyODc2MDI4MjI1NDI0MTAzNDQwMFQ1NTU1NTU1NTU1NTU1')
    axios.get('http://portal.nexnews.cl/showN?valor=MjEwNzE1MVcyVDEwMDkwMTYxNDYxNTc2ODEzOTY0MTU3MzgxNjg5MDEwMTEwMTE0OTYxMTMxMDEwNTEwOTE2ODE2NTM2MTYwUTU1NTU1NTU1NTU1NDUz')
    .then(function (response) {
      // handle success
      const $ = cheerio.load(response.data,null,false);
      //console.log($('div[class=titulo]').html())
      //console.log($('div[class=cuerpo]').html())
      // Editorial de donde se saco la noticia
      //console.log($('div[class="col-xs-12 col-sm-12 col-md-12 col-lg-12 medio-bar"]').text().trim().replace(/\n/g, ''))
      // el .text() es para pasar a string el codigo div css etc
      var publisher = $('div[class="col-xs-12 col-sm-12 col-md-12 col-lg-12 medio-bar"]').text().trim().replace(/\n/g, '')
      var publisherIndex;
      var counter = 0
      for (let index = 0; index < publisher.length; index++) {
        const element = publisher[index];
        publisherIndex = index
        if(element === ' ' && publisher[index+1] === ' '){
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