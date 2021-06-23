require('dotenv').config()

const fs = require('fs');
if(process.argv[2] == "TEST_MODE"){
  process.TEST_MODE = true;
  console.log("running in test mode");
}

var express = require("express");
var bodyparser = require("body-parser");
var session = require("express-session");
//TODO: install cookie-parser
var cookieParser = require('cookie-parser');
const MongoStore = require('connect-mongo')(session);
var passport = require("passport");
require("./API/passport_conf.js");

var passportSocketIo = require("passport.socketio");

var app = express();
app.set('trust proxy',true);

var http = require("http").Server(app);

var login = require("./API/login.api.js");
var register = require("./API/register.api.js");
var referrer = require("./API/referrer.api.js");
var gamereplays = require("./API/gamereplays.api.js");

var db = require("./db.js");
db.promise.then( function(){
	http.listen(3006, function(){
		console.log("App listen");
	});
})

var secret = "u7ga782";
console.log(db.clientPromise)
var session_store = new MongoStore(
  {
    clientPromise: db.clientInstancePromise.promise,
    dbName: db.dbName
  }
);

var session_middleware = session({
   secret: secret,
   store: session_store,
   cookie: {
     maxAge: 1000 * 60 * 60 * 24 * 30 // one month
   },
   resave: false,
   saveUninitialized: false
});

app.use(express.static("dist"));
app.use(cookieParser());
app.use(session_middleware);
app.use(bodyparser.json());
app.use(bodyparser.urlencoded());
app.use(passport.initialize());
app.use(passport.session());

const ApiRouter = express.Router();

ApiRouter.use("/login", login);
ApiRouter.use("/register", register);
ApiRouter.use("/referrer", referrer);
ApiRouter.use("/gamereplays", gamereplays);

app.use('/api', ApiRouter);


// Mount io server
var io = require("socket.io")(http);

io.set('origins', '*:*');
io.use(passportSocketIo.authorize({
  key:          'connect.sid',       // the name of the cookie where express/connect stores its session_id
  secret:       secret,    // the session_secret to parse the cookie
  store:        session_store,        // we NEED to use a sessionstore. no memorystore please
  success:      onAuthorizeSuccess,  // *optional* callback on success - read more below
  fail:         onAuthorizeFail,     // *optional* callback on fail/error - read more below
}));

function onAuthorizeSuccess(data, accept){

  // console.log("Authorized socket io connection");
  accept();

}

function onAuthorizeFail(data, message, error, accept){

  // console.log("Non-Authorized socket io connection");
  // console.log(message);

  // error indicates whether the fail is due to an error or just a unauthorized client
  if(error)  throw new Error(message);
  // send the (not-fatal) error-message to the client and deny the connection
  return accept(new Error(message));

}

var games = require("./games.js");

io.use( (socket, next)=>{

  socket.playername = socket.request.user.username;

  //FIXME after refrehing page already connected is emitted
  // for(var key in socket.nsp.connected){
  //
  //   if(socket.playername == socket.nsp.connected[key].playername){
  //     next(new Error("already connected"));
  //     return;
  //   }
  // }

  next();

})

io.use( (socket,next)=>{

  var isPlayerInGame = games.isPlayerInGame(socket.playername);
  if(isPlayerInGame){
    var game_name = isPlayerInGame;
    next( new Error("already in game") );
  }
  else{
    next();
  }

})


io.on("connection", function(socket){

  for(var key in socket.nsp.connected){
    console.log(socket.nsp.connected[key].playername);
  }

    var lobby = require("./lobby.js")(io, socket);
})
