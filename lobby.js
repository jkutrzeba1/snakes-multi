
const gameloop = require('node-gameloop');

var Player = require("./src/game/PlayerSrv.js");
var GameState = require("./src/game/GameState.js");
var random = require("random-js")();

var Users = require("./DB/users.db.js")
var Stats = require("./DB/stats.db.js")

var stubber = require("./cypress/stubber.js");

var io = null;

var games = [];
var sample_game = null;

function Game(cnt_players, players, name, bet){

  this.max_players = 6;
  this.cnt_players = cnt_players;
  this.players = players;
  this.name = name;
  this.bet = bet;
  this.round_points = 0;

  this.first_to_reach = 50;

  this.gameloop_id = null

}

if(process.TEST_MODE == true){
  stubber.stubGamePrototype(Game);
}


Game.prototype.getPlayersName = function(){

  var arr = [];
  for(var p of this.players){
    arr.push( p.playername);
  }
  return arr;
}

Game.prototype.collisionDetected = function(player_state, collision_tm){

  player_state.collision_tm = collision_tm;

  if(player_state.name=="user6")
    console.log("collision detected " + collision_tm);

  // Why some collisions are detected twice?
  // if(player_state.collision_tm != 0){
  //   return;
  // }


  var path_at_collision = player_state.getCurpath()

  player_state.collision_timeout = setTimeout( ()=>{


    // collision detected but player can move in last time, we should wait for input beacuse of lag
    // dead reckoning phase may be wrong, we will wait some time for new input
    // if new input arrived it will delete all events from dead reckoning phase

    if(player_state.collision_tm != 0){
      player_state.collision_timeout = null;
      player_state.recomputeCurpath(player_state.collision_tm);
      player_state.speed = 0;
      player_state.collision_tm = 0;
      player_state.killed = true;
      this.emitKilled(player_state.name, collision_tm, path_at_collision);
    }
    else{
      player_state.collision_timeout = null;
      player_state.speed = player_state.default_speed;
      player_state.collision_tm = 0;
      if(player_state.name=="user6")
        console.log("collision rejected "+collision_tm);
    }

  }, 250);
}

Game.prototype.emitKilled = function(playername, collision_tm, path_at_collision){

  io.to(this.name).emit("killed", playername, collision_tm, path_at_collision);

  for( var player of this.players){

    if(player.playername == playername && player.live){
      player.points += this.round_points++;
      player.live = false;
      player.socket.player_state.clearBreakout();
    }

  }
  if(this.round_points == this.max_players-1){ // Only one stay alive - end of round condition

    // apply 5 points to winner

    for( var player of this.players){

      if(player.live == true){
        player.points += this.round_points;
        player.live = false;
        player.socket.player_state.clearBreakout();
        player.inputs = [];
        this.round_points = 0;
      }

    }


    // sort players

    this.players.sort( (a,b)=>{
      if(a.points>b.points)
        return -1;
      else if(a.points<b.points)
        return 1
      else {
        return 1;
      }
    });

    var max = 0;
    var game_winner = null;

    if(this.players[0].points>=this.first_to_reach){
      max = this.players[0].points;
    }

    for(var i = 1; i<this.players.length; i++){
      if(this.players[i].points+1 >= max){
        this.players[i].tie_break = true;
      }
      else{
        this.players[i].tie_break = false
      }
    }

    if(this.players[1].tie_break == true){
      this.players[0].tie_break = true;
    }
    else {
      this.players[0].tie_break = false;
      game_winner = this.players[0];
    }

    if(game_winner){

      Users.incrementBalanceForWinner(game_winner.playername, Math.floor(this.bet * this.cnt_players * 0.75) )
      Stats.updateFromMatchPlayed( Math.floor(this.bet * this.cnt_players * 0.25) );

      io.to(this.name).emit("end_of_game", game_winner.playername, Math.floor(this.bet*this.max_players*0.75));
      this.detachMyselfFromList();
      this.game_state.end_of_game = true;

    }
    else{
      this.startNewRound();
    }
  }

}

Game.prototype.startNewRound = function(){

  var new_round_awaiting = 10;

  io.to(this.name).emit("newround_countdown", new_round_awaiting);

  setTimeout( ()=> {

    var new_round_positions = [];

    this.round_points = 0;

    for( var player of this.players){

      player.live = true;

    }

    for(var player of this.player_states){

      player.speed = 0;
      player.paths = [];
      player.dir = "straight";
      player.collision_tm = 0;

      var new_pos =  this.makeInitPositions(player);
      new_pos.for = player.name;

      new_round_positions.push(new_pos);

    }

    io.to(this.name).emit("new_positions_generated", new_round_positions);

    setTimeout(()=>{

      if(!this.game_state)
        return;

      var dn = Date.now();
      io.to(this.name).emit("round_start", dn);
      for(var player of this.player_states){
        player.curpath.tm = dn;
        this.game_state.player_consideration = true;
        player.speed = player.default_speed;
        player.killed = false;
        player.breakout = true;
      }
    }, 3000);

  }, (new_round_awaiting+2)*1000 );

}


Game.prototype.makeInitPositions = function(player){

  var pos = {
    x: random.integer(100,700),
    y: random.integer(100,700)
  }

  var angle = random.integer(1,360);

  if(player){
    player.curpath.start.x = pos.x;
    player.curpath.start.y = pos.y;
    player.curpath.end.x = pos.x;
    player.curpath.end.y = pos.y;
    player.angle = angle;
    player.base_start_angle = angle;
    player.dir = "straight";
  }

  return {
    pos: pos,
    angle: angle
  }

}

Game.prototype.start = function(){

  Users.reduceBalances( this.getPlayersName(), -this.bet );

  this.player_states = [];
  var initial_states = [];
  var colors = ["orange", "cyan", "blue", "red", "pink", "yellow"];

  this.game_state = new GameState();

  this.players.forEach((player_item)=>{

    var color = random.pick(colors);
    var index = colors.findIndex( function(color_item){
      if(color_item == color){
        return true;
      }
    })
    colors.splice(index, 1);

    var angle_pos = this.makeInitPositions(null, player_item.playername); // angle & pos: returned and setted

    var initial_state = {
      player_name: player_item.playername,
      color: color,
      angle: angle_pos.angle,
      pos: angle_pos.pos
    };

    Player.prototype.io = io;

    var p = new Player(initial_state);

    p.curpath.start.x = angle_pos.pos.x;
    p.curpath.start.y = angle_pos.pos.y;
    p.curpath.end.x = angle_pos.pos.x;
    p.curpath.end.y = angle_pos.pos.y;
    p.color = color;
    p.angle = angle_pos.angle;
    p.gamename = this.name;
    p.socket = player_item.socket;

    p.inputs = [];
    p.events = [];

    this.player_states.push(p);

    player_item.socket.player_state = p;


    initial_states.push(initial_state);

  })

  io.to(this.name).emit("gamestart", initial_states, this.first_to_reach, this.bet);


  this.gameloop_id = gameloop.setGameLoop( (delta)=>{

    let tm = Date.now();

    this.player_states.forEach( (player_state_item)=>{

      while(player_state_item.inputs.length>0){

        var input = player_state_item.inputs.shift();

        if(input.type == "quit_consideration"){
          player_state_item.quitConsideation(input.pos);
        }
        else {
          player_state_item.recomputeCurpath( input.tm );
          var state_of_curpath = player_state_item.getCurpath();
          var done_path = player_state_item.changeDir(input.dir, input.tm);
          player_state_item.savePath(done_path, true);
          io.to(this.name).emit("dirchanged", player_state_item.socket.playername, input.dir, input.tm, state_of_curpath, done_path  );
        }
      }
      if(player_state_item.speed>0){
        tm = Date.now();
        player_state_item.recomputeCurpath(tm);
      }

    })

    this.game_state.detectCollision(this.player_states, this, tm );

    if(this.game_state.end_of_game){
      this.game_state = null;
      gameloop.clearGameLoop(this.gameloop_id);
      for(var player of this.players){
        player.socket.currentRoom = null;
        player.socket.leave(this.name);
      }
    }

  }, 1000/66); // update gamestate every 33ms

  setTimeout(()=>{

    let tm = Date.now();

    io.to(this.name).emit("round_start", tm);

    for(var player of this.player_states){
      player.curpath.tm = tm;
      this.game_state.player_consideration = true;
      player.speed = player.default_speed;
      player.killed = player.true;
      player.breakout = true;
    }

  }, 4000 );

  setTimeout(()=>{

    let tm = Date.now();

    this.game_state.player_consideration = false;

    var positions = [];

    for(var player of this.player_states){

      var pos = player.getPos();
      pos.tm = tm;
      pos.for = player.name;

      positions.push(pos);

      player.inputs.push({
        type: "quit_consideration",
        pos: pos
      })
      // player.setupBreakout();
    }

    io.to(this.name).emit("quit_consideration", positions);

  }, 8000);

  var curpaths = [];

}

Game.prototype.detachMyselfFromList = function(){

  var idx = games.findIndex((game_item)=>{

    if(game_item.name == this.name){
      return true;
    }

  })

  games.splice(idx,1);

  var arr = games.getGameList();
  io.emit("updategamelist", arr);


}

Game.prototype.delistPlayer = function(playername){

    this.cnt_players--;

    var index = this.players.findIndex((player_item)=>{
      if(player_item.playername == playername){
        return true;
      }
    });
    this.players.splice(index, 1);

    if(this.cnt_players==0){
      this.detachMyselfFromList();
    }


}


sample_game = new Game(0,  [], "Empty", 500 );


games.push(sample_game);

games.getRoomWithName = function(gamename){

  var room = this.find( function(game){

    if(game.name == gamename)
      return true;

  });

  return room;

}

games.getGameList = function(){

  var arr = [];

  games.forEach( (game_item)=>{

    var p_names = [];

    game_item.players.forEach( (player_item)=>{
      p_names.push(player_item.playername);
    })

    arr.push({
      cnt_players: game_item.cnt_players,
      bet: game_item.bet,
      name: game_item.name,
      players: p_names
    });


  });



  return arr;

}


/*
  socket.currentRoom
*/

module.exports = function( io_, socket ){

  io = io_;


  socket.on("left", function(tm){

    setTimeout( ()=>{
      socket.player_state.changeDirSrv("left", tm);
    }, 150)

  })


  socket.on("right", function(tm){

    setTimeout( ()=>{
      socket.player_state.changeDirSrv("right", tm);
    }, 150)

  })

  socket.on("straight", function(tm){

    setTimeout( ()=>{
      socket.player_state.changeDirSrv("straight", tm);
    }, 150)

  })

  socket.on("quit_consideration", function(pos){

    setTimeout( ()=>{
      socket.player_state.inputs.push({
        type: "quit_consideration",
        pos: pos
      });

      socket.to(socket.currentRoom).emit("quit_consideration", pos );

    }, 150);

  })

  socket.on("getgamelist", function(){


    var arr = games.getGameList();
    socket.emit("updategamelist", arr);

  })

  socket.on("join", function(playername, newroom){

    var previousroom = socket.currentRoom;

    // Check if there is space for new player in room
    var room = games.getRoomWithName(newroom);
    if(!room || room.cnt_players==6){
      return; // TODO: room is full
    }

    // update previous game
    if(previousroom){
      var previous_game = games.getRoomWithName(previousroom);
      previous_game.delistPlayer(playername);
      socket.leave(previousroom);
    }


    // update new game
    var new_game = games.find( (game)=>{

      if(game.name == newroom){
        game.cnt_players++;

        // edit
        game.players.push({
          playername: playername,
          socket: socket,
          points: 0,
          live: true
        });

        socket.join(newroom);
        socket.currentRoom = newroom;
        socket.playername = playername;

        socket.broadcast.emit("roomchanged", playername, previousroom, newroom);

        return true;
      }

    })

    if(new_game.cnt_players==6){

      new_game.start();

    }

  })

  socket.on("newgame", (gamename, bet, playername, fn)=>{

    if(socket.currentRoom){
      fn({
        for: "confirm",
        err_msg: "Please leave current room before creating another one"
      });
      return;
    }

    if(games.getRoomWithName(gamename)){
      fn({
        for: "gamename",
        err_msg: "Game with given name already exist"
      })
      return;
    }

    if(bet<100){
      fn({
        for: "bet",
        err_msg: "Minimum bet value is 100 Satoshi"
      });
      return;
    }

    socket.join(gamename);
    socket.currentRoom = gamename;
    socket.playername = playername;

    var p = {
      playername: playername,
      socket: socket,
      points: 0,
      live: true
    };

    var ng = new Game(1, [p], gamename, bet);
    games.push(ng);


    var arr = games.getGameList();

    io.emit("updategamelist", arr);

    fn({
      success: true
    });

  })

  socket.on("leave", ()=>{

    if(!socket.currentRoom){
      return;
    }

    var prev_game = games.getRoomWithName(socket.currentRoom);
    prev_game.delistPlayer(socket.playername);

    socket.broadcast.emit("roomchanged", socket.playername, socket.currentRoom, null);

    socket.leave(socket.currentRoom);
    socket.currentRoom = null;

  })

}
