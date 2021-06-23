
const gameloop = require('node-gameloop');

var Player = require("./src/game/PlayerSrv.js");
var GameState = require("./src/game/GameState.js");
var GameReplay = require("./src/game/GameReplay.js")
var GameReplayPlayer = require("./src/game/GameReplayPlayer.js")
var GapController = require("./src/game/breakdown.js");

var random = require("random-js")();

var Users = require("./DB/users.db.js")
var Stats = require("./DB/stats.db.js")
var GameReplayDB = require("./DB/gamereplays.db.js");

var stubber = require("./cypress/stubber.js");

var io = null;

var games = require("./games.js");
var sample_game = null;

function Game( player_creator, name, max_players, replay_mode = false){

  this.max_players = max_players;
  this.cnt_players = 1;
  this.players = [];
  this.name = name;
  this.round_points = 0;

  this.game_replay = null; //GameReplay
  this.game_replay_player = null; //GameReplayPlayer
  this.replay_mode = replay_mode;
  // if game is runned in replay_mode replay_id will be set
  this.replay_id = null;
  this.cur_round_ix = -1;

  this.first_to_reach = (max_players-1)*5;

  this.players.push(player_creator);

  this.gameloop_id = null

  this.gap_controller_ref = null;

  this.started = false;

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


Game.prototype.collisionDetected = function(player_state, collision_tm, type, participant){

  console.log("collision detected: " + collision_tm);

  player_state.collision_tm = collision_tm;

  player_state.path_at_collision = player_state.getCurpath();

  if(type=="curpath-curpath"){
    player_state.collision_type = type;
    player_state.collision_participant = participant;
  }

  if(player_state.collision_force){
    player_state.collision_timeout = null;
    player_state.rebuildPathsAfterKilled(player_state.collision_before_input.collision_tm);
    console.log("CURPATH after killed (repeated): ");
    console.log(player_state.curpath);
    player_state.speed = 0;
    player_state.collision_tm = 0;
    player_state.killed = true;
    this.emitKilled(player_state, player_state.collision_before_input.collision_tm);
    return;
  }

  player_state.collision_timeout = setTimeout( ()=>{

    var lag_tolerance = 1000 / (player_state.speed/(player_state.weight*2)) ;

    if(player_state.collision_tm != 0){
      player_state.collision_timeout = null;
      player_state.recomputeCurpath(player_state.collision_tm);
      player_state.speed = 0;
      player_state.collision_tm = 0;
      player_state.killed = true;
      this.emitKilled(player_state, collision_tm);
    }
    else{
      player_state.collision_timeout = null;
      player_state.speed = player_state.default_speed;
      player_state.collision_tm = 0;
      console.log("collision rejected: "+collision_tm);
    }

  }, 200);
}

Game.prototype.emitKilled = function(player_state, collision_tm){

  var playername = player_state.name;

  for( var player of this.players){

    if(player.playername == playername && player.live){
      player.points += this.round_points++;
      player.live = false;
      player_state.gap_ref.clearTimeouts();
    }

  }

  var end_of_round = false;
  if(this.round_points == this.max_players-1){ // Only one stay alive - end of round condition
    end_of_round = true;
    io.to(this.name).emit("killed", playername, collision_tm, end_of_round);
  }
  else{
    io.to(this.name).emit("killed", playername, collision_tm);
  }

  if(end_of_round){

    clearTimeout(this.tmout_qc);

    for( var player of this.players){

      if(player.live == true){
        player.points += this.round_points;
        player.live = false;
        this.round_points = 0;
      }

    }

    for(var player of this.player_states){
      player.speed = 0;
      player.gap_ref.clearTimeouts();
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
      game_winner = this.players[0];
    }


/*
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
*/

    if(game_winner){

      let bet_mode = false;

  	  var pool = bet_mode ? this.bet * this.cnt_players : 0;
      var winner_reward = bet_mode ?  Math.floor(pool * 0.75) : 0;
  	  var provision = bet_mode ? Math.floor(pool * 0.25) : 0;
  	  var referrer_reward = 0;

      if(!this.replay_mode)
        this.game_replay.finalizeGameReplay( game_winner.playername, winner_reward);

      if(!this.replay_mode){

  		// if game_winner has referrer split winner_reward by 4%

    		Users.getReferrer(game_winner.playername)
    		.then( (referrer)=>{

    			if(referrer && bet_mode){
    				referrer_reward = Math.floor(winner_reward * 0.08);
    				provision-=referrer_reward;
    				Users.incrementBalanceForReferrer(referrer, referrer_reward);
    			}

          if(bet_mode){
    			     Users.incrementBalanceForWinner(game_winner.playername, winner_reward );
          }

          // points
    			Users.updateRanking(this.players);

    			Stats.updateFromMatchPlayed( provision, referrer_reward, winner_reward );

          this.game_state.end_of_game = true;

    		})

      }
      else{
        this.game_state.end_of_game = true;
      }

      io.to(this.name).emit("end_of_game", game_winner.playername, bet_mode ? Math.floor(this.bet*this.max_players*0.75) : 0 );

    }
    else{
      this.startNewRound();
    }
  }

}

Game.prototype.startNewRound = function(first_round){

  this.cur_round_ix++;

  var initial_states = [];

  if(first_round){

    this.player_states = []; //Player

    var colors = ["orange", "cyan", "blue", "red", "pink", "yellow"];
    random.shuffle(colors);

    for( var player_socket of this.players){

      var initial_state = {
        player_name: player_socket.playername,
        color: colors[0]
      }

      initial_states.push(initial_state);

      colors.splice(0, 1);

      var p = new Player(initial_state, true);
      p.gamename = this.name;
      p.socket = player_socket.socket;
      p.game_state = this.game_state;
      p.server_side = true;

      player_socket.socket.player_state = p;

      this.player_states.push(p);

    }

    io.to(this.name).emit("gamestart", initial_states, this.first_to_reach, this.bet);

    this.gap_controller_ref = new GapController(this.player_states, true, io, this.name);


  } // first round


  if(this.replay_mode)
    this.game_replay_player.populateInputsForRound(this.player_states, this.replay_id, this.cur_round_ix);

  var new_round_awaiting = 2;
  io.to(this.name).emit("newround_countdown", new_round_awaiting);

  // (new_round_awaiting+2)*1000 -- 12 sec await
  // round_start emitted after 15 sec (12+3)
  // quit_consideration emmitted after 19 sec (12+3+4)

  setTimeout( ()=> { // (new_round_awaiting+2)*1000

    this.round_points = 0;

    for( var player of this.players){

      player.live = true;

    }

    for(var player of this.player_states){

      player.speed = 0;
      player.paths = [];
      player.inputs_history = [];
      player.curpath.dir = "straight";
      player.collision_tm = 0;
      player.id_cnt = 1;
      player.curpath.id = 0;
      player.curpath.on_breakout = true;
      player.ignore_input = false;

      var new_round_positions = [];
      var p_arr = []; // promises array for Promise.all
      var p = this.makeInitPositions(player)
      .then((round_pos)=>{
        new_round_positions.push(round_pos);
      });
      p_arr.push(p);
    }
    Promise.all(p_arr)
    .then(()=>{
      io.to(this.name).emit("new_positions_generated", new_round_positions);
    })
    .then(()=>{
      // RUN
      setTimeout(()=>{ // 3sec

        if(!this.game_state)
          return;

        var tm_round_start = Date.now();
        io.to(this.name).emit("round_start", tm_round_start);

        if(this.replay_mode)
          this.game_replay_player.setTmBase(tm_round_start);

        for(var player of this.player_states){
          player.init_pos.tm = tm_round_start;
          player.curpath.tm = tm_round_start;
          this.game_state.player_consideration = true;
          player.speed = player.default_speed;
          player.killed = false;
        }

        this.game_state.tm_quit_consideration = tm_round_start + 4000;

        if(this.game_replay){
          this.game_replay.initNewRound(new_round_positions, tm_round_start, this.game_state.tm_quit_consideration);
        }

        console.log("NEW ROUND STARTED");
        console.log("tm_round_start: " + tm_round_start);
        console.log("tm_quit_consideration: " + parseInt(tm_round_start + 4000));

        // QUIT CONSIDERATION
        this.tmout_qc = setTimeout(()=>{ // 4sec

          //prevent emitting qc because it is read from replay inputs
          if(this.replay_mode)
            return;

          for(var player of this.player_states){
            player.inputs.push({
             type: "quit_consideration"
            })
          }

          this.gap_controller_ref.renewGaps();

        }, 4000); // QUIT CONSIDERATION

      }, 3000); // RUN
    })
  }, (new_round_awaiting+2)*1000 );

}


Game.prototype.makeInitPositions = function(player){

  var pos = {};
  var angle = 0;
  var p_name = player.name;

  return Promise.resolve(true)
  .then(()=>{

    if(!this.replay_mode){

      pos = {
        x: random.integer(100,700),
        y: random.integer(100,700)
      }
      angle = random.integer(1,360);

      var round_pos = {
        pos: pos,
        angle: angle,
        for: p_name
      };
      return round_pos;
    }

  })
  .then((round_pos)=>{
    if(this.replay_mode){
      return GameReplayDB.getNewRoundPositions(this.replay_id, this.cur_round_ix, player.name)
    }
    return round_pos;
  })
  .then((round_pos)=>{

    if(player){
      player.init_pos = round_pos;
      player.curpath.start.x = round_pos.pos.x;
      player.curpath.start.y = round_pos.pos.y;
      player.curpath.end.x = round_pos.pos.x;
      player.curpath.end.y = round_pos.pos.y;
      player.curpath.angle = round_pos.angle;
      player.curpath.base_start_angle = round_pos.angle;
      player.curpath.dir = "straight";
    }

    return round_pos;

  })
}

Game.prototype.start = function(){

  if(!this.replay_mode){
    var player_names = this.getPlayersName();
    for(var player_name of player_names){
      Users.checkBalance(player_name, this.bet)
      .then((reduction_obj)=>{
        Users.reduceBalance( reduction_obj.for, reduction_obj );
      })

    }

  }

  this.game_state = new GameState();

  if(!this.replay_mode)
    this.game_replay = new GameReplay(this.getPlayersName(), this.cnt_players, this.name, this.bet  );

  if(this.replay_mode){
    this.game_replay_player = new GameReplayPlayer();
  }



  Player.prototype.io = io;

  // Start first round
  this.startNewRound(true);

  this.gameloop_id = gameloop.setGameLoop( (delta)=>{

    let tm = Date.now();

    if(this.replay_mode)
      this.game_replay_player.shiftInput(tm);

    this.player_states.forEach( (player_state_item)=>{
      //INPUT QUEUE

      while(player_state_item.inputs.length>0){

        var input = player_state_item.inputs.shift();

        if(player_state_item.speed == 0)
          continue;

        if(input.type == "quit_consideration"){
          player_state_item.quitConsideation(this.game_state.tm_quit_consideration, true);
        }
        else if(input.type == "gap_start"){
          player_state_item.gap_ref.startGap();
        }
        else if(input.type == "gap_end"){
          player_state_item.gap_ref.endGap();
        }
        else { // INPUT TYPE

          var done_path = player_state_item.changeDir(input.dir, input.tm);
          player_state_item.savePath(done_path, true);

          io.to(this.name).emit("dirchanged", player_state_item.name, input.dir, input.tm, done_path  );

        }
        if(this.game_replay){
          this.game_replay.processInput(input, player_state_item.name);
        }
      }

      if(player_state_item.speed>0){
        tm = Date.now();
        player_state_item.recomputeCurpath(tm);
      }

    })

    this.game_state.detectCollision(this.player_states, this, tm );

    for(var player_state_item of this.player_states){
      //collision not detected then we return to normal condition of reseting collisions
     player_state_item.collision_force = false;
    }

    if(this.game_state.end_of_game){

      gameloop.clearGameLoop(this.gameloop_id);

      clearTimeout(this.tmout_qc);

      // clear kill timeouts

      for(var player_state_item of this.player_states ){

        clearTimeout(player_state_item.collision_timeout);

      }

      for(var player of this.players){
        if(!player.socket.id) // replay
          continue;
        player.socket.currentRoom = null;
        if(!this.replay_mode)
          player.socket.leave(this.name);
        player = null;
      }

      for(var player_state_item of this.player_states ){

        player_state_item = null;

      }

      if(!this.replay_mode)
        this.detachMyselfFromList();

      this.player_states = null;
      this.players = null;

      this.game_state = null;
      this.game_replay = null;
      this.game_replay_player = null;

    }

  }, 1000/66); // update gamestate every 33ms

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



/*
  socket.currentRoom
*/

module.exports = function( io_, socket ){

  io = io_;

  socket.on("sync_time", (fn)=>{

    fn(Date.now());

  })

  socket.on("left", function(tm, reduction_sync_complete){
    setTimeout( ()=>{
      socket.player_state.changeDirSrv("left", tm, reduction_sync_complete);
    }, 1);

  })

  socket.on("right", function(tm, reduction_sync_complete){
    setTimeout( ()=>{
      socket.player_state.changeDirSrv("right", tm, reduction_sync_complete);
   }, 1)

  })

  socket.on("straight", function(tm, reduction_sync_complete){
   setTimeout( ()=>{
      socket.player_state.changeDirSrv("straight", tm, reduction_sync_complete);
   }, 1)

 })

 socket.on("disconnect", ()=>{

   if(!socket.currentRoom){
     return;
   }

   var prev_game = games.getRoomWithName(socket.currentRoom);

   if(prev_game.started){
     return; // prevent delisting, user can not be in two games simultaneously;
   }

   //delist only when game has not been started

   prev_game.delistPlayer(socket.playername);

   socket.broadcast.emit("roomchanged", socket.playername, socket.currentRoom, null);

   socket.leave(socket.currentRoom);
   socket.currentRoom = null;

 })

  socket.on("getgamelist", function(){

    var arr = games.getGameList();
    var current_room = null;
    if(socket.currentRoom){
      current_room = socket.currentRoom
    }
    socket.emit("updategamelist", arr, current_room);

  })

  socket.on("join", function( newroom, cb_confirmation){

    var playername = socket.playername;
    var previousroom = socket.currentRoom;

    if(/[^a-zA-Z0-9 ]/.test(newroom)){
      cb_confirmation(false);//failure
      return;
    }

    if(previousroom && previousroom == socket.currentRoom){
      cb_confirmation(false);//failure; user try to join to room already joined
      return;
    }

    var room = games.getRoomWithName(newroom);

    if(!room){
      cb_confirmation(false);//failure; room does not exist
      return;
    }

    if(previousroom){
      var previous_game = games.getRoomWithName(previousroom);
      if(previous_game.started){
        cb_confirmation(false);
        return; // prevent joining, user is in active game already
      }
    }



    // check balance
    Users.checkBalance(socket.playername, room.bet)
    .then((reduction_obj)=>{

      if(!reduction_obj || reduction_obj.success == false){
        cb_confirmation(false);//failure
        throw new Error("balance");
      }

    })
    .then(()=>{
      // Check if there is space for new player in room
      if(!room || room.cnt_players==room.max_players || room.started){
        cb_confirmation(false); //failure
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

          socket.broadcast.emit("roomchanged", playername, previousroom, newroom);

          cb_confirmation(true); //success

          return true;
        }

      })

      if(!new_game){
        return;
      }

      if(new_game.cnt_players==new_game.max_players){

        new_game.start();
        new_game.started = true;

      }

    })
    .catch((err)=>{
      cb_confirmation(false);//failure
    })

  })

  socket.on("newgame", (gamename, max_players, fn)=>{

    var playername = socket.playername;

    //check balance

    Promise.resolve()
    .then(()=>{

      if(socket.currentRoom){
        fn({
          for: "confirm",
          err_msg: "Please leave current room before creating another one"
        });
        return;
      }

      if(!gamename){
        fn({
          for: "gamename",
          err_msg: "Game name is required"
        })
        return;
      }

      if(/[^a-zA-Z0-9 ]/.test(gamename)){
        fn({
          for: "gamename",
          err_msg: "Game name contais not allowed characters. ( allowed: letters,numbers,space )"
        })
        return;
      }

      if(games.getRoomWithName(gamename)){
        fn({
          for: "gamename",
          err_msg: "Game with given name already exist"
        })
        return;
      }

      if(/[^0-9]/.test(max_players)){
        fn({
          for: "max_players",
          err_msg: "Must be a number"
        })
        return;
      }

      if(max_players<2){
        fn({
          for: "max_players",
          err_msg: "Room can be created for at least 2 players"
        });
        return;
      }
      if(max_players>6){
        fn({
          for: "max_players",
          err_msg: "Room can be created for up to 6 players"
        });
        return;
      }

      socket.join(gamename);
      socket.currentRoom = gamename;

      var p = {
        playername: playername,
        socket: socket,
        points: 0,
        live: true
      };

      var ng = new Game( p, gamename, max_players);
      games.push(ng);


      var arr = games.getGameList();

      io.emit("updategamelist", arr);

      fn({
        success: true
      });


    })
    .catch(()=>{

    })


  })

  socket.on("leave", ()=>{

    if(!socket.currentRoom){
      return;
    }


    var prev_game = games.getRoomWithName(socket.currentRoom);
    if(prev_game.started){
      cb_confirmation(false);
      return; // can not leave, user is in active game still
    }

    prev_game.delistPlayer(socket.playername);

    socket.broadcast.emit("roomchanged", socket.playername, socket.currentRoom, null);

    socket.leave(socket.currentRoom);
    socket.currentRoom = null;

  })

  socket.on("playreplay", (replay_id, fn)=>{

    return;

    GameReplayDB.getReplayMeta(replay_id)
    .then((replay_meta)=>{

      if(!replay_meta){
        return;
      }

      var p = {
        playername: replay_meta.players[0],
        socket: socket,
        points: 0,
        live: true
      };

      socket.currentRoom = "replay";
      socket.playername = replay_meta.players[0];

      var game_replay = new Game( p, socket.id, replay_meta.bet, replay_meta.cnt_players, true);
      game_replay.replay_id = replay_id;

      for(var i = 1; i<replay_meta.cnt_players; i++){
        game_replay.players.push({
          playername: replay_meta.players[i],
          socket: {},
          points: 0,
          live: true
        });
      }
      fn(replay_meta.players[0]);
      game_replay.start();

    })
  })
}
