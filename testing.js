
const axios = require('axios');



var quokka = true

quokka; 


var ids = [
    '17a1f35836b89686', '17a1a162cab643ac', '17a14e82f9b1f556', '17a0fc48c00465a8',
    '17a0ab92892ce6bb', '179fb2994944494e', '179f6216464d6a5e', '179f0d938b003943',
    '179ebcbf30d36c06', '179e6987a5238003', '179d71c6f758b397', '179d20eb19954062'
]

var hrefs = []

let promises = [];


async function promisesNews(){

    for (let index = 0; index < ids.length; index++) {
        const id = ids[index];
        promises.push(ObtenerUnaNoticia(id))
    }
    Promise.all(promises)
    .then((responses)=>{
        console.log(hrefs);
        metadataFunction()
    })
    .catch((err)=>{
        throw err;
    });

}
promisesNews()


async function metadataFunction(responses){
    console.log('linea 31: ', responses)
    console.log(hrefs);

}
async function ObtenerUnaNoticia(correoId){
    await axios.get("https://dog.ceo/api/breeds/image/random").then(()=>{hrefs.push(correoId)})
}
async function ObtenerMedaDataNoticia(){
    let link = ""
    for  (const noticiaLink of hrefs){
        link = noticiaLink[0]
        await MetaDataLink(link)
    }
  }

async function MetaDataLink(link){

    setTimeout(() => {
        console.log('linea 68: ', link)
    }, 100);
    
}
