
const MongoClient = require('mongodb').MongoClient;
let { mongohost, mongousername, mongopassword, dbName } = require("./config.json");

mongousername = encodeURIComponent(mongousername);
mongopassword = encodeURIComponent(mongopassword);

const db = {
  promise: null,
  dbName: dbName,
  clientInstancePromise: null
}

const mongouri = `mongodb://${mongousername}:${mongopassword}@${mongohost}/${dbName}`;

db.clientInstancePromise = MongoClient.connect(mongouri);

db.promise = db.clientInstancePromise.then( function(clientInstance){

  return clientInstance.db(dbName);
})

module.exports = db;
