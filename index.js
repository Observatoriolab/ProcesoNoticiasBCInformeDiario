// RECORDAR QUE EXISTE EL R10 BOOT, ENTONCES HAY QUE ESCALAR EL DYNOS 
// EJECUTAR EN CONSOLA : heroku ps:scale worker=1 -a informe-noticias-bc
// EJECUTAR EN CONSOLA : heroku ps:scale web=0 -a informe-noticias-bc
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const {Base64} = require('js-base64');
const cheerio = require('cheerio');
const axios = require('axios');


var correosSacadosAPI = []
var correosIdsCache = ""
var correosNuevos = []
var hrefs = []
const API_ENDPOINT_TO_POST = "https://satelite-noticias-api.herokuapp.com/create_news"

let client = require('redis').createClient(process.env.REDIS_URL);
client.on("error", function(err) {
  console.log("Bonk. The worker framework cannot connect to redis, which might be ok on a dev server!");
  console.log("Resque error : "+err);
  client.quit();
});


const delay = ms => new Promise(res => {    
  setTimeout(res, ms)}
);

/// FUNCIONES GMAIL INGRESANDO 
// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

let oAuth2Client = null

loadClientSecret()
// Load client secrets from a local file.
async function loadClientSecret(){
  fs.readFile('credentials.json', async (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Gmail API.
    await authorize(JSON.parse(content),getMailLoop);   
  });
}


async function conseguirCorreosPromesa(auth){
  return await new Promise(resolve => setTimeout(async() => {
    await ConseguirCorreos(auth,resolve)
  })) 
}

async function getMailLoop(auth) {
  const keepGoing = true;
  while (keepGoing) {
    console.log("Iniciando cuenta regresiva")
    await delay(20000)
    await conseguirCorreosPromesa(auth)
    console.log('-----------------------------------------------------------------------------------------')
    console.log('-----------------------------------------------------------------------------------------')
    console.log('-----------------------------------------------------------------------------------------')
    console.log('-----------------------------------------------------------------------------------------')
    console.log('-----------------------------------------------------------------------------------------')
    console.log('-----------------------------------------------------------------------------------------')
    console.log('-----------------------------------------------------------------------------------------')
    console.log('-----------------------------------------------------------------------------------------')
    console.log('-----------------------------------------------------------------------------------------')
    console.log('-----------------------------------------------------------------------------------------')

    await delay(64800); 
  }
}


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials,callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client,callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client)
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client,callback) {
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

async function gmailListCall(gmail, result,callback,resolve){
  console.log("Linea 88: ", result.nextPageToken)
  if(result.nextPageToken === undefined){
    console.log('Los ids de los correos son: ', correosSacadosAPI)
    callback(gmail, resolve)
    return
  }
  else{
    gmail.users.messages.list({
      userId: 'me',
      pageToken: result.nextPageToken,
      q:'from:informeprensa@bcentral.cl'
    }, (err, res) => {
      if (err) return console.log('The API returned an error: 120' + err);
      console.log("Linea 100: ",res.data)
  
      console.log("Linea 102: ",res.data.nextPageToken)
  
      for (const idCorreo of res.data.messages) {
          correosSacadosAPI.push(idCorreo.id)
      }
      
      return gmailListCall(gmail, res.data,callback, resolve) 
    
    })

  }


}
async function gmailGetCall(gmail, correoIdList,callback,counter,resolve){
  console.log('Linea 137')
  if(correoIdList[counter].length === 0){
    console.log('Los ids de los correos son: ', correoIdList)
    callback(resolve)
    return
  }
  else{    
    gmail.users.messages.get({
      userId: 'me',
      id:correoIdList[counter]
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        // El dia de cuando se entregan las noticias
        const fechaCorreo = res.data.payload.headers[23].value
        const htmlCorreo = Base64.decode(res.data.payload.parts[1].body.data)
        //console.log(resultado)
        const $ = cheerio.load(htmlCorreo,null,false);
        
        const cabeceraNoticias = $('td')
        var auxcabecera = ""
        console.log('Linea 224 estoy en el correo y sacando cabecera/link',correoIdList[counter])
        //console.log('Fecha del correo: ', fechaCorreo)
        //console.log("------------------------------------------------------------------------------------------")
        //console.log('cabecera y links: \n ')
        for (const cabecera of cabeceraNoticias) {
          var title;
          //Si la cabecera tiene el estilo de un topico de tema hay que guardarlo
          // console.log("linea 134 lo que contiene la cabecera")
          // console.log(cabecera.children[0])
          //console.log("---------------------------------------------------------------------")
          if(cabecera.attribs.style === 'color: rgb(255, 255, 255); font-size: 17px; border-bottom-color: currentColor; border-bottom-width: medium; border-bottom-style: ridge; background-color: rgb(15, 29, 52);'
            || cabecera.attribs.style === 'color: rgb(255, 255, 255); font-size: 17px; border-bottom-color: currentColor; border-bottom-width: medium; border-bottom-style: ridge; background-color: rgb(15, 29, 52);'.trim()
            || cabecera.attribs.style === 'color:rgb(51,51,51);font-size:21px;border-bottom-color:rgb(63,106,161);border-bottom-width:3px;border-bottom-style:ridge;background-color:rgb(255,255,255)'){
            //Topico del tema (Banco Central de Chile, Columnas y Editoriales, Economía, Banca y Finanzas, Economía Internacional )
            //console.log('Cabecera: ',cabecera.children[0].data)
            auxcabecera = cabecera.children[0].data
          }
          else if (cabecera.children[0] !== undefined && cabecera.children[0].name === 'a')  {
            //EL primer elemento del arreglo es el topico y el segundo es el id
            hrefs.push([auxcabecera.trim().replace(/\n/g, ''), cabecera.children[0].attribs.href])
            //console.log([auxcabecera.trim().replace(/\n/g, ''), cabecera.children[0].attribs.href])
          }
        }
        console.log("------------------------------------------------------------------------------------------")
        counter+=1
        return gmailGetCall(gmail,correoIdList,callback,counter,resolve) 

      })
  }
}

async function guardarIdsCorreos(gmail, callback, resolve){
  // Funcion adquiere todo los id de los correos existentes
  // Guardar ids en CorreosIniciales
  var initialRes = {nextPageToken:''}
  console.log("ejecutando ...")
  await gmailListCall(gmail,initialRes,callback, resolve)
  
  
  
}

async function guardarInfoCorreos(gmail,resolve){
// Si es que UltimoCorreoCapturado es un string vacio -> UltimoCorreoCapturado es igual a ultimo id de CorreosIniciales
  // llamar funcion capturar noticias pasandole la variable CorreosIniciales
 
  // Si es que UltimoCorreoCapturado es un string vacio -> UltimoCorreoCapturado es igual a ultimo id de CorreosIniciales
  // llamar funcion capturar noticias pasandole la variable CorreosIniciales
  console.log('sali de la recursion')
  console.log('correosIdsCache', correosIdsCache)
  // HASTA ACA ESTA BUENO
  var cacheLength = 0
  client.llen('correosIdsCache', (error, reply)=> { 
    if(error){
      console.log('Tuve este error sacando el largo del arreglo: ', error)
      return;
    }
    cacheLength = reply
  })
  console.log('Este es el largo del arreglo que esta en el cache: ', cacheLength)
  console.log('es del tipo: ',typeof(cacheLength) )
  client.lrange(['correosIdsCache',0,cacheLength],(error, rep)=> { 
    console.log('este es el rep')
    console.log(rep)       
    if(error){                                                 
        console.log('nope', error)                      
        return;                
    }
    if(rep !== undefined && rep !== null){      
      for (const correo of correosSacadosAPI){
        for (const correoCache of rep) {
          if(correo !== correoCache){
            correosNuevos.push(correo)
          }
          else{
            break
          }         
        }
      }
      if(correosNuevos.length !== 0){
        client.ltrim('correosIdsCache', 1,0,(error, result)=> { 
          if(error){                                                
            console.log('nope', error)                           
          }
          else{
            console.log('correosIdCache deberia ser nulo')
            client.lpush('correosIdsCache', correosSacadosAPI,(error, result)=> { 
              if(error){                                                
                console.log('nope', error)                           
              }
              else{
                console.log('after client.set result is', result);
                console.log('He guardado en el cache lo siguiente ', 'correosIdsCache', correosSacadosAPI );
                CapturarNoticias(gmail, correosNuevos,resolve)
               
              }
            })
         
           
          }
        })
        
      }
      else{
        if(rep.length === 0){
          guardarArregloCorreosIdsCache(gmail, resolve)
        }
        else{
          console.log('\n \n \n \n \n \n \n \n \n \n \n \n \n \n \n \n \n \n ')
          console.log('\n \n \n \n \n \n \n \n \n \n \n \n \n \n \n \n \n \n ')
  
          console.log('no hay correos nuevos, esperar...')
          console.log('no hay correos nuevos, esperar...')
          console.log('no hay correos nuevos, esperar...')
          console.log('no hay correos nuevos, esperar...')
          console.log('no hay correos nuevos, esperar...')
          console.log('no hay correos nuevos, esperar...')
          console.log('no hay correos nuevos, esperar...')
          console.log('no hay correos nuevos, esperar...')
          console.log('\n \n \n \n \n \n \n \n \n \n \n \n \n \n \n \n \n \n ')
          resolve()
        }
   
      }
    }
    else{
      guardarArregloCorreosIdsCache(gmail, resolve)
      //Si no se encuentra entonces almacenar en la cache usando su identificador
      
    }
  })
}
async function guardarArregloCorreosIdsCache(gmail,resolve){
  client.lpush('correosIdsCache',correosSacadosAPI,(error, result)=> { 
    if(error){                     
      console.log('Error en la linea 296')                           
      console.log('nope', error)                           
    }
    else{
      console.log('after client.set result is', result);
      console.log('He guardado en el cache lo siguiente (largo de la lista)', result );
      CapturarNoticias(gmail, correosSacadosAPI,resolve)
      
    }
  })
}

async function ConseguirCorreos(auth, resolve){
  
  console.log('el auth',auth)
  const gmail = google.gmail({version: 'v1', auth});
  guardarIdsCorreos(gmail,guardarInfoCorreos,resolve)
  



}

async function obtenerUnaNoticiaLoop(gmail,correosSacadosAPI,resolve){

  await ObtenerUnaNoticia(gmail, correosSacadosAPI, ObtenerMedaDataNoticia,resolve)
  
 
 
}

async function CapturarNoticias(gmail, correosSacadosAPI,resolve){
  //noticasAguardar es un arreglo que contine los ids de las noticias a guardar en la base de datos
  console.log('Linea 169: ',correosSacadosAPI)
  obtenerUnaNoticiaLoop(gmail,correosSacadosAPI,resolve)
  
  // recorrer noticasAguardar y ocupar la funcion 

}

async function ObtenerMedaDataNoticia(resolve){
  let link =""
  let topico = ""
  for  (const noticiaLink of hrefs){
      link= noticiaLink[1]
      topico= noticiaLink[0]
      await MetaDataLink(link, topico)
      await delay(1000)
  }
  hrefs = []
  correosNuevos = []
  correosSacadosAPI = []
  resolve()

}


async function ObtenerUnaNoticia(gmail,correoIdList,ObtenerMedaDataNoticia,resolve){
  console.log('Linea 199 correoId: ',correoIdList)
  let counter = 0
  correoIdList.push('')
  await gmailGetCall(gmail,correoIdList,ObtenerMedaDataNoticia,counter,resolve)
}
async function MetaDataLinkCall(link,topico){

  await axios.get(link)
  .then(function (response) {
    console.log('-----------------------------------------------------------------------------------------')

    console.log('estoy sacando la data de la noticia')
    console.log(link)

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
    console.log("---------------------------------------------------------------------------------------------")
    //console.log('Informacion de la noticia: \n')
    var actualPublisher = publisher.substring(0,publisherIndex)
    //console.log('\n' + actualPublisher)
    var country = $('td[style="border-top: 0;"]').text().trim().replace(/\n/g, '').toLowerCase()
    
    country = country.match(/[a-z]+$/g)
    
    country = country[0][0].toUpperCase() + country[0].substring(1,country[0].length)
    
    var date = $('td[style="border-top: 1px solid #eaeaea;"]')
    //console.log('\n' + date[0].children[2].data.trim().replace(/\n/g, '').replace(/-/g,'/'))
    date = date[0].children[2].data.trim().replace(/\n/g, '').replace(/-/g,'/')

    var content_summary = $('div[class="bajada"]').text()
    //console.log('\n' +content_summary)
    
    var title = $('div[class="titulo"]')[0].children[0].data
    //console.log('\n' + title)
    //console.log("---------------------------------------------------------------------------------------------")
    //guadar en la base de datos los datos de la noticia
  
    var data = {}

    data.title = title
    data.content_summary = content_summary
    data.link = link
    data.type = "Informe Diario BC"
    data.tags = null
    data.source = actualPublisher
    data.country = country
    data.axis_primary = topico
    data.axis_secondary = ''
    data.date = date


    

    GuardarNoticiaDB(data)
  })
  .catch(function (error) {
    // handle errore

    console.log('error del axios');
  })
  .then(function () {
    // always executed
    console.log('Se ejecuta esto')

  });

}
async function MetaDataLink(link,topico){
  await MetaDataLinkCall(link,topico);
}

async function GuardarNoticiaDB(data){
  console.log("viendo que se va a enviar -->>>>>>>   ", data)
  let reply = await axios.post(API_ENDPOINT_TO_POST, data) 
  console.log('347 reply of axios DB:', reply)
}

function singleNews(auth){
  const gmail = google.gmail({version: 'v1', auth});

  gmail.users.messages.get({
    userId: 'me',
    id:'17a33eeb9f10a176'
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const fechaCorreo = res.data.payload.headers[23].value
    console.log(res.data)
    const htmlCorreo = Base64.decode(res.data.payload.parts[1].body.data)
    //console.log(resultado)
    const $ = cheerio.load(htmlCorreo,null,false);

    const cabeceraNoticias = $('td')
    var auxcabecera = ""
    //console.log("------------------------------------------------------------------------------------------")
    //console.log('cabecera y links: \n ')
    for (const cabecera of cabeceraNoticias) {
      var title;
      //Si la cabecera tiene el estilo de un topico de tema hay que guardarlo
      //console.log("linea 134 lo que contiene la cabecera")
      //console.log(cabecera.children[0])
      //console.log("---------------------------------------------------------------------")
      if(cabecera.attribs.style === 'color: rgb(255, 255, 255); font-size: 17px; border-bottom-color: currentColor; border-bottom-width: medium; border-bottom-style: ridge; background-color: rgb(15, 29, 52);'){
        //Topico del tema (Banco Central de Chile, Columnas y Editoriales, Economía, Banca y Finanzas, Economía Internacional )
        //console.log('Cabecera: ',cabecera.children[0].data)
        auxcabecera = cabecera.children[0].data
      }
      else if (cabecera.children[0] !== undefined && cabecera.children[0].name === 'a')  {
        //EL primer elemento del arreglo es el topico y el segundo es el id
        //hrefs.push([auxcabecera.trim().replace(/\n/g, ''), cabecera.children[0].attribs.href])
        //console.log([auxcabecera.trim().replace(/\n/g, ''), cabecera.children[0].attribs.href])
      }
    }
    //console.log("------------------------------------------------------------------------------------------")
  })
  
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

