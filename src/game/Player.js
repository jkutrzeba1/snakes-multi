

var circleArcCollision = require("./circle-arc-collision.js");
var Arc = require("./arc.js");

function getRad(degree){
  degree = degree % 360;
  if(degree<0){
    degree = 360 + degree;
  }
  var radians = degree * (Math.PI / 180);
  return radians;
}


var Player = function(initial_state){

  this.name = initial_state.player_name;
  this.speed = 0;
  this.default_speed = 50;
  this.weight = 10;
  this.r = 30;
  this.paths = [];
  this.breakout = true; // breakout should be used only for rendering purpose, not for determining if path should be saved or not
  this.show_dir_indicator = true;
  this.killed = true;
  this.collision_tm = 0;
  this.collision_timeout = null;
  this.collision_force = false;
  this.collision_before_input = {};
  this.collision_type = null;
  this.collision_participant = null;
  this.id_cnt = 0;
  this.id_cnt_srv = 0;
  this.id_path_before_qc = null;
  this.processed_lag_vector = 0;
  this.unprocessed_lag_vector = 0; //srv
  this.curpath = {
    id: 0,
    after_qc: false,
    dir: "straight",
    tm: 0,
    angle: undefined,
    base_start_angle: undefined,
    start: {
      x: undefined,
      y: undefined
    },
    end: {
      x: undefined,
      y: undefined
    },
    arc_point: {
      x: 0,
      y: 0
    }

  };

  this.reduction_queue = [];
  this.reduction_timeout = null;

  this.color = initial_state.color;

  this.collisions = [];
  this.inputs = [];

}

Player.prototype.draw = function(self){

  this.ctx.strokeStyle = this.color;
  this.ctx.fillStyle = this.color;

  if(this.restart){
    this.speed = 0;
    this.paths = [];
    this.curpath.dir = null;
    this.restart = false;
  }

  if(!this.dir_indicator && self){
    this.dir_indicator = new Image();
    this.dir_indicator.src = "/img/dir_indicators/" + this.color + ".svg";
    this.dir_indicator.onload = ()=>{
      this.dir_indicator_ready = true
    }
  }

  if(this.dir_indicator_ready && this.show_dir_indicator && self){
    this.ctx.save();
    this.ctx.translate(this.curpath.end.x, this.curpath.end.y  )
    this.ctx.rotate((this.curpath.angle + 90) * Math.PI / 180);
    this.ctx.drawImage(this.dir_indicator, -146/2, -70 , 146, 60);
    this.ctx.restore();
  }

  // drawing done paths
  this.ctx.lineCap = "butt";

  for(var i = 0; i<this.paths.length; i++){

    //Paths from consideration phase are not drawed
    if(this.paths[i].body.after_qc == false){
      continue;
    }
    this.ctx.strokeStyle = this.paths[i].body.color;
    this.ctx.lineWidth = this.paths[i].body.weight;
    this.ctx.stroke(this.paths[i]);

  }

  // drawing current path
  this.ctx.lineCap = "butt";

  this.ctx.lineWidth = this.weight;

  //drawing head of curpath
  this.ctx.beginPath();
  this.ctx.arc(this.curpath.end.x, this.curpath.end.y, this.weight/2, 0, 2*Math.PI);
  this.ctx.fill();

  if(this.curpath.dir == "straight" && !this.breakout){
    this.ctx.beginPath();
    this.ctx.moveTo(this.curpath.start.x, this.curpath.start.y);
    this.ctx.lineTo(this.curpath.end.x, this.curpath.end.y);
    this.ctx.stroke();
  }

  var starting_angle;

  if(this.curpath.dir == "left" && !this.breakout){

    if(this.breakout)
      starting_angle = this.curpath.angle + 90;
    else
      starting_angle = this.curpath.starting_angle;

    this.ctx.beginPath();
    this.ctx.arc( this.curpath.arc_point.x, this.curpath.arc_point.y, this.r, getRad(starting_angle), getRad( this.curpath.angle + 90), true);
    this.ctx.stroke();
  }

  if(this.curpath.dir == "right" && !this.breakout){

    if(this.breakout)
      starting_angle = this.curpath.angle - 90;
    else
      starting_angle = this.curpath.starting_angle;

    this.ctx.beginPath();
    this.ctx.arc( this.curpath.arc_point.x, this.curpath.arc_point.y, this.r, getRad(starting_angle), getRad( this.curpath.angle - 90));
    this.ctx.stroke();
  }

}

Player.prototype.createPath2 = function(path_state){

  // path_state is path with body


  var path = new Path2D();

  if(path_state.body.type == "line"){
    path.moveTo(path_state.body.line[0][0], path_state.body.line[0][1]);
    path.lineTo(path_state.body.line[1][0], path_state.body.line[1][1]);
  }

  if( path_state.body.type == "arc" ){
    path.arc( path_state.body.arc.x, path_state.body.arc.y, path_state.body.arc.r, path_state.body.arc.start, path_state.body.arc.end, path_state.body.arc.counterclockwise);
  }

  return path;

}

// used for reduction
Player.prototype.overwritePath = function(path_state_new, index){

  var path = {};
  if(this.srv!=true){
    path = this.createPath2(path_state_new);
  }
  path.body = path_state_new.body;

  this.paths[index] = path;

}

Player.prototype.splicePath = function(path_state_new, index){

  var path = {};
  if(this.srv!=true){
    path = this.createPath2(path_state_new);
  }

  path.body = path_state_new.body;

  this.paths.splice(index, 0, path);
}

Player.prototype.savePath = function(path_state, server_side, reconciled_path) {

  // path_state is path with body

  if(!path_state || !path_state.body)
    return;

  var path = {}; // Path2D

  if(!server_side){

    path = this.createPath2(path_state);

  }

  path.body = path_state.body;

  // Path is reconciled for self
  if(reconciled_path){

    var saved = false;

    for(var i = this.paths.length-1; i>=0; i--){
      if(this.paths[i].body.tm == path_state.body.tm){
        console.log("path reconciled");
        saved = true;
        this.paths[i] = path;
      }
    }
    // if(!saved){
    //   console.log("path not reconciled");
    //   this.paths.push(path);
    // }

  }
  else {
    this.paths.push(path);
  }

}

Player.prototype.getVerticesFromLinePath = function(curpath){

  if(!curpath){
    curpath = this.curpath;
  }

  var vertices = [];

  var left_side_sin = Math.sin( getRad(curpath.angle-90) ) * this.weight * 0.5;
  var left_side_cos = Math.cos( getRad(curpath.angle-90) ) * this.weight * 0.5;
  var right_side_sin = Math.sin( getRad(curpath.angle+90) ) * this.weight * 0.5;
  var right_side_cos = Math.cos( getRad(curpath.angle+90) ) * this.weight * 0.5;

  vertices.push( [
    curpath.start.x + left_side_cos,
    curpath.start.y + left_side_sin
  ] );

  vertices.push( [
    curpath.end.x + left_side_cos,
    curpath.end.y + left_side_sin
  ]);

  vertices.push( [
    curpath.end.x + right_side_cos,
    curpath.end.y + right_side_sin
  ]);

  vertices.push( [
    curpath.start.x + right_side_cos,
    curpath.start.y + right_side_sin
  ]);

  return vertices;

}

Player.prototype.getPathBodyFromCurpath = function(curpath){

  var path = {};

  path.body = {};
  path.body.tm = curpath.tm;
  path.body.id = curpath.id;
  path.body.weight = this.weight;
  path.body.color = this.color;
  path.body.angle = curpath.angle;
  path.body.base_start_angle = curpath.base_start_angle;

  path.body.after_qc = curpath.after_qc;

  if(curpath.dir == "straight"){
    path.body.dir = "straight";
    path.body.type = "line";
    path.body.vertices = this.getVerticesFromLinePath(curpath);
    path.body.line = [ [curpath.start.x, curpath.start.y], [curpath.end.x, curpath.end.y] ];
  }

  if(curpath.dir == "left" || curpath.dir == "right"){

    var angle_90 = 0;
    var counterclockwise = false;

    path.body.type = "arc";

    if(curpath.dir == "left"){
      path.body.dir = "left";
      counterclockwise = true;
      angle_90 = 90;
    }
    if(curpath.dir =="right"){
      path.body.dir = "right";
      angle_90 = -90;
    }

    var arc = new Arc(curpath.arc_point.x, curpath.arc_point.y, this.r, getRad(curpath.starting_angle), getRad(curpath.angle + angle_90), this.weight, counterclockwise  );
    path.body.arc = arc;

  }

  return path;

}

Player.prototype.setInitPositionForCurpath = function(new_dir, tm, working_curpath, id){

  if(!working_curpath){
    working_curpath = this.curpath;
  }

  //cause setInitPositionForCurpath can operate on working_curpath we need proper id
  if(id){
    working_curpath.id = id;
  }

  working_curpath.tm = tm;

  if(tm>=this.game_state.tm_quit_consideration){
    working_curpath.after_qc = true
  }
  else{
    working_curpath.after_qc = false
  }

  if(new_dir == "straight"){

    working_curpath.start.x = working_curpath.end.x;
    working_curpath.start.y = working_curpath.end.y;

    working_curpath.base_start_angle = working_curpath.angle;

    working_curpath.dir = "straight";

  }

  if(new_dir == "left"){

    working_curpath.start.x = working_curpath.end.x;
    working_curpath.start.y = working_curpath.end.y;

    working_curpath.arc_point.x= working_curpath.end.x + Math.cos(getRad(working_curpath.angle-90)) * this.r;
    working_curpath.arc_point.y  = working_curpath.end.y + Math.sin(getRad(working_curpath.angle-90)) * this.r;
    working_curpath.starting_angle = working_curpath.angle + 90;

    working_curpath.base_start_angle = working_curpath.angle;

    working_curpath.dir = "left";

  }

  if(new_dir == "right"){

    working_curpath.start.x = working_curpath.end.x;
    working_curpath.start.x = working_curpath.end.y;

    working_curpath.arc_point.x = working_curpath.end.x + Math.cos(getRad(working_curpath.angle+90)) * this.r;
    working_curpath.arc_point.y = working_curpath.end.y + Math.sin(getRad(working_curpath.angle+90)) * this.r;
    working_curpath.starting_angle = working_curpath.angle -90;

    working_curpath.base_start_angle = working_curpath.angle;

    working_curpath.dir = "right";

  }

}

Player.prototype.changeDir = function(new_dir, tm){

  // All paths are saved in paths history (also these before qc)
  var path = this.getPathBodyFromCurpath(this.curpath);

  if(tm=="qc"){
    this.curpath.id = "qc";
    tm = this.game_state.tm_quit_consideration;
  }
  else{
    this.id_cnt++;
    this.curpath.id = this.id_cnt;
  }
  this.setInitPositionForCurpath(new_dir, tm );
  return path;
}

Player.prototype.go = function(delta, curpath ) {

  if(curpath.dir == "straight"){
    this.goStraight(delta, curpath);
  }
  if(curpath.dir == "right"){
    this.goRight(delta, curpath);
  }
  if(curpath.dir == "left"){
    this.goLeft(delta, curpath);
  }

  // if(this.breakout){
  //   this.curpath.start.x = this.curpath.end.x;
  //   this.curpath.start.y = this.curpath.end.y;
  // }

}


Player.prototype.goStraight = function(delta, curpath){

  curpath.end.x += Math.cos(getRad(curpath.angle)) * this.speed * delta;
  curpath.end.y += Math.sin(getRad(curpath.angle)) * this.speed * delta;

},

Player.prototype.goLeft = function(delta, curpath){

  var degree_speed = 360 / (2*Math.PI*this.r) * this.speed * delta;

  curpath.angle-=degree_speed;
  if(this.breakout){
    this.curpath.starting_angle = this.curpath.angle + 90;
  }

  curpath.end.x = curpath.arc_point.x + Math.cos( getRad(curpath.angle+90) ) * this.r;
  curpath.end.y = curpath.arc_point.y + Math.sin( getRad(curpath.angle+90) ) * this.r;

},

Player.prototype.goRight = function(delta, curpath){

  var degree_speed = 360 / (2*Math.PI*this.r) * this.speed * delta;

  curpath.angle+=degree_speed;
  if(this.breakout){
    this.curpath.starting_angle = this.curpath.angle - 90;
  }

  curpath.end.x = curpath.arc_point.x + Math.cos( getRad(curpath.angle-90) ) * this.r;
  curpath.end.y = curpath.arc_point.y + Math.sin( getRad(curpath.angle-90) ) * this.r;

}

Player.prototype.setupPos = function(pos){

  this.curpath.start.x = pos.pos.x;
  this.curpath.start.y = pos.pos.y;
  this.curpath.end.x = pos.pos.x;
  this.curpath.end.y = pos.pos.y;
  this.curpath.angle = pos.angle;
  this.curpath.base_start_angle = pos.angle;
  this.curpath.dir = "straight";
}

Player.prototype.recomputeCurpath = function(tm_to_timestep, curpath){

    /*
      when there is no curpath suppiled, we use player's actual curpath
    */
    if(!curpath){
      curpath = this.curpath;
    }

    curpath.tm_to = tm_to_timestep;

    /*
     set end to start before recomputing
    */
    curpath.angle = curpath.base_start_angle;

    if(curpath.dir == "left")
      curpath.starting_angle = curpath.angle + 90;
    if(curpath.dir == "right")
      curpath.starting_angle = curpath.angle - 90;

    curpath.end.x = curpath.start.x;
    curpath.end.y = curpath.start.y;


    // Go by time since curpath was started (on last changeDir) to time when client changed dir
    /*
      curpath start time: this.curpath.tm
      new dir time: tm_to_timestep (past time because of lag)
    */

    this.go((tm_to_timestep - curpath.tm)/1000,  curpath);

}

Player.prototype.getCurpathFromPathBody = function(path){

  var path_body = path.body;

  var new_curpath = {
    dir: path_body.dir,
    tm: path_body.tm,
    id: path_body.id,
    angle: path_body.angle,
    base_start_angle: path_body.base_start_angle,
    after_qc: path.body.after_qc,
    start: {
      x: undefined,
      y: undefined
    },
    end: {
      x: undefined,
      y: undefined
    },
    arc_point: {
      x: 0,
      y: 0
    }

  };

  // set starting angle to its base value
  if(new_curpath.dir == "left")
    new_curpath.starting_angle = new_curpath.angle + 90;
  if(new_curpath.dir == "right")
    new_curpath.starting_angle = new_curpath.angle - 90;


  if(path_body.type == "line"){
    new_curpath.start.x = path_body.line[0][0];
    new_curpath.start.y = path_body.line[0][1];
    new_curpath.end.x = path_body.line[1][0];
    new_curpath.end.y = path_body.line[1][1];
  }

  if(path_body.type == "arc"){
    new_curpath.arc_point.x = path_body.arc.x;
    new_curpath.arc_point.y = path_body.arc.y;
  }

  return new_curpath;

}

Player.prototype.getCurpath = function(){

  var obj = {};

  obj.start_x = this.curpath.start.x;
  obj.start_y = this.curpath.start.y;
  obj.end_x = this.curpath.end.x;
  obj.end_y = this.curpath.end.y;
  obj.angle = this.curpath.angle;
  obj.starting_angle = this.curpath.starting_angle;
  obj.base_start_angle = this.curpath.base_start_angle;
  obj.arc_point_x = this.curpath.arc_point.x;
  obj.arc_point_y = this.curpath.arc_point.y;
  obj.dir = this.curpath.dir;
  obj.tm = this.curpath.tm;
  obj.id = this.curpath.id;
  obj.after_qc = this.curpath.after_qc;
  return obj;


}

Player.prototype.applyCurpathState = function(state_of_curpath){

  this.curpath.start.x = state_of_curpath.start_x ;
  this.curpath.start.y = state_of_curpath.start_y  ;
  this.curpath.end.x = state_of_curpath.end_x ;
  this.curpath.end.y = state_of_curpath.end_y  ;
  this.curpath.angle = state_of_curpath.angle  ;
  this.curpath.starting_angle = state_of_curpath.starting_angle  ;
  this.curpath.base_start_angle = state_of_curpath.base_start_angle  ;
  this.curpath.arc_point.x = state_of_curpath.arc_point_x  ;
  this.curpath.arc_point.y = state_of_curpath.arc_point_y  ;
  this.curpath.dir = state_of_curpath.dir;
  this.curpath.tm = state_of_curpath.tm;
  this.curpath.id = state_of_curpath.id;
  this.curpath.after_qc = state_of_curpath.after_qc;

}

Player.prototype.applyStartPoitOfCurpathState = function(state_of_curpath){

  this.curpath.start.x = state_of_curpath.start_x ;
  this.curpath.start.y = state_of_curpath.start_y  ;
  this.curpath.end.x = state_of_curpath.start_x ;
  this.curpath.end.y = state_of_curpath.start_y  ;
  this.curpath.angle = state_of_curpath.starting_angle  ;
  this.curpath.starting_angle = state_of_curpath.starting_angle  ;
  this.curpath.base_start_angle = state_of_curpath.base_start_angle  ;
  this.curpath.arc_point.x = state_of_curpath.arc_point_x  ;
  this.curpath.arc_point.y = state_of_curpath.arc_point_y  ;
  this.curpath.dir = state_of_curpath.dir;
  this.curpath.tm = state_of_curpath.tm;
  this.curpath.id = state_of_curpath.id;
  this.curpath.after_qc = state_of_curpath.after_qc;

}

Player.prototype.getPos = function(){

  var pos = {};

  pos.x = this.curpath.end.x;
  pos.y = this.curpath.end.y;
  pos.angle = this.curpath.angle;

  return pos;

}

Player.prototype.injectPathBeforeQc = function(tm_to, dir){

  var tm_qc = this.game_state.tm_quit_consideration;

  var working_curpath = this.extendPath(this.id_path_before_qc, tm_to);

  this.setInitPositionForCurpath(dir, tm_to, working_curpath, this.id_path_before_qc+1);
  this.recomputeCurpath(tm_qc, working_curpath );
  var injected_path = this.getPathBodyFromCurpath(working_curpath);
  this.splicePath(injected_path, this.id_path_before_qc+1);

  this.id_path_before_qc = this.id_path_before_qc+1;
  this.path_before_qc = working_curpath;

  this.setInitPositionForCurpath(dir, tm_qc, working_curpath, "qc" );
  this.recomputeCurpath(Date.now(), working_curpath);
  this.assignCurpath(this.curpath, working_curpath);

}

Player.prototype.quitConsideation = function(tm, server){

  // Save curpath for case when new input that occured before quit consideration arrive.

  this.recomputeCurpath(tm);

  this.id_path_before_qc = this.curpath.id;
  this.path_before_qc = this.getCurpath();

  tm = "qc";

  var path = this.changeDir(this.curpath.dir, tm);
  this.savePath(path, server, false);

  this.breakout = false;

  this.game_state.player_consideration = false;

}

Player.prototype.clearFurtherPaths = function(tm, include, pop_last){

  if(this.paths.length == 0)
    return;

  if(!include){
    for(var i = this.paths.length-1; i>=0; i--){
      if(this.paths[i].body.tm > tm )
      {
        this.paths.splice(i,1);
      }
    }
  }
  else{
    for(var i = this.paths.length-1; i>=0; i--){
      if(this.paths[i].body.tm >= tm )
      {
        this.paths.splice(i,1);
      }
    }
  }

  if(pop_last){
    this.paths.pop();
  }

}

Player.prototype.mergePathOnQc = function(){

  //precisely merged are id_path_before_qc and qc path

  //remove qc path
  this.paths.splice(this.id_path_before_qc+1, 1);
  //extend path before qc to take place of previously removed path
  this.extendPath(this.id_path_before_qc, "next");

}

Player.prototype.splitPathForQc = function(ix, working_curpath, to){

  var working_curpath;
  var tm_qc = this.game_state.tm_quit_consideration;
  if(!working_curpath){

    //working_curpath = ...
  }

  this.recomputeCurpath(tm_qc, working_curpath );
  var path = this.getPathBodyFromCurpath(working_curpath);
  this.overwritePath(path, ix);

  working_curpath.id = "qc";
  this.id_path_before_qc = ix;

  this.setInitPositionForCurpath(working_curpath.dir, tm_qc, working_curpath  );
  this.recomputeCurpath(to, working_curpath );
  path = this.getPathBodyFromCurpath(working_curpath);
  this.splicePath(path, ix+1);

}

Player.prototype.extendPath = function(ix, to, vector){

  if(to=="next"){
    to = this.paths[ix+1].body.tm;
    if(vector){
      to+=vector;
    }
  }

  var path = this.paths[ix];
  var curpath_for_extension = this.getCurpathFromPathBody(path);
  this.recomputeCurpath(to, curpath_for_extension );
  var new_extended = this.getPathBodyFromCurpath(curpath_for_extension);
  this.overwritePath(new_extended, ix);

  return curpath_for_extension;

}

// id = id of shortended aka first shifted
Player.prototype.reduction = function(from, to, id){

  console.log("REDUCTION; from: " + from + " to: " + to + " id: " + id );

  this.outPathsTmBefore();

  var working_curpath;

  var lag_vector = to - from;

  var path_extended = null;
  var index_of_extended = -1;

  // search paths, case when path_shortened is curpath
  if(this.curpath.id == id){
    path_extended = this.paths[this.paths.length-1];
    index_of_extended = this.paths.length-1;
  }

  //search paths, case when path_shortened is in paths history
  else{
    for(var i = this.paths.length-1; i>=0; i--){
      var path = this.paths[i];
      if(path.body.id == id){
        path_extended = this.paths[i-1];
        index_of_extended = i-1;
        break;
      }
    }
  }

  if(path_extended == null){
    console.log("pe");
    console.log(id);
    console.log(this.paths);
  }

  var tm_qc = this.game_state.tm_quit_consideration;
  var new_extended;
  // Extension and swap of path designed to extension

  if(from<tm_qc && to>tm_qc){

    //merge previous qc path and path before qc
    if(this.id_path_before_qc != null){
      this.mergePathOnQc();
    }

    working_curpath = this.extendPath(index_of_extended, tm_qc);

    working_curpath.id = "qc";
    this.id_path_before_qc = index_of_extended;

    this.setInitPositionForCurpath(working_curpath.dir, tm_qc, working_curpath  );
    this.recomputeCurpath(to, working_curpath );
    new_extended = this.getPathBodyFromCurpath(working_curpath);
    this.splicePath(new_extended, index_of_extended+1);
    index_of_extended++;
  }
  else{
    working_curpath = this.extendPath(index_of_extended, to);
  }

  //shift following paths
  var new_tm = to;

  var index_before = 0;

  for(var i = index_of_extended+1; i<this.paths.length; i++){

    console.log("SHIFTING");
    console.log("shifting " + i + " to " + (this.paths.length-1));

    if(i>this.id_path_before_qc){
      index_before = -1;
    }

    if(i-1 == this.id_path_before_qc){
      // only extend, this path is qc path
      working_curpath = this.extendPath(i, "next", lag_vector);
      new_tm = working_curpath.tm_to;
      continue;
    }

    var new_shortended;

    // we get tm of following path as to (tm)
    if(i+1 == this.paths.length){ // this case is unreachable but test needed
      to = this.curpath.tm + lag_vector;
    }
    else{
      to = this.paths[i+1].body.tm + lag_vector;
    }

    var path_body = this.paths[i].body;
    from = new_tm;

    if(from<tm_qc && to>tm_qc){

      //merge previous qc path and path before qc
      if(this.id_path_before_qc != null){
        this.mergePathOnQc();
      }
      this.setInitPositionForCurpath(path_body.dir, new_tm, working_curpath, path_body.id );
      this.splitPathForQc(i, working_curpath, to);
      new_tm = to;
    }
    else{
      this.setInitPositionForCurpath(path_body.dir, new_tm, working_curpath, path_body.id );
      this.recomputeCurpath(to, working_curpath );
      new_shortended = this.getPathBodyFromCurpath(working_curpath);
      this.overwritePath(new_shortended, i);
      new_tm = to;
  }

  }

  //shift actual curpath
  this.setInitPositionForCurpath(this.curpath.dir, new_tm, working_curpath, this.curpath.id );
  this.recomputeCurpath(Date.now(), working_curpath);
  this.assignCurpath(this.curpath, working_curpath);

  console.log("_________________________");

  /* TESTING FUNCTIONS */
  //this.outPathsTmAfter();
  //this.compareArrsTm(lag_vector);

  this.processed_lag_vector += lag_vector;


}

Player.prototype.assignCurpath = function(lvalue, rvalue){

  lvalue.dir = rvalue.dir;
  lvalue.tm = rvalue.tm;
  lvalue.after_qc = rvalue.after_qc;
  lvalue.id = rvalue.id;
  lvalue.angle = rvalue.angle;
  lvalue.base_start_angle = rvalue.base_start_angle;
  lvalue.start.x = rvalue.start.x;
  lvalue.start.y = rvalue.start.y;
  lvalue.end.x = rvalue.end.x;
  lvalue.end.y = rvalue.end.y;
  lvalue.arc_point.x = rvalue.arc_point.x;
  lvalue.arc_point.y = rvalue.arc_point.y;

}

Player.prototype.processInput = function(_io, dir){

  var tm = Date.now();

  this.inputs.push({
    type: "input",
    dir: dir,
    tm: tm
  })
  if(this.processed_lag_vector!=0){
    _io.emit(dir, tm, this.processed_lag_vector);
    this.processed_lag_vector = 0;
  }
  else{
    _io.emit(dir, tm);
  }

}

/* TESTING FUNCTIONS */

Player.prototype.outPathsTmBefore = function(){

  this.arr_tm_before = [];

  for(var path of this.paths){
    var path_body = path.body;
    this.arr_tm_before.push(path_body.tm);
  }

}

Player.prototype.outPathsTmAfter = function(){

  this.arr_tm_after = [];

  for(var path of this.paths){
    var path_body = path.body;
    this.arr_tm_after.push(path_body.tm);
  }

}

Player.prototype.compareArrsTm = function(lag_vector){

  var tm_qc = this.game_state.tm_quit_consideration;
  var ix_for_after = 0;
  var ix_for_before = 0;

  for(var i = 0; i<this.arr_tm_after.length; i++){

    if(this.arr_tm_after[ix_for_after] == tm_qc){
      ix_for_after++;
      continue;
    }
    if(this.arr_tm_before[ix_for_before] == tm_qc){
      ix_for_before++;
      continue;
    }

    if(this.arr_tm_before[ix_for_before]+lag_vector == this.arr_tm_after[ix_for_after])
    {
      console.log("OK");
    }
    else{
      console.log("BREAK AT " + ix_for_before + " : " + ix_for_after);
    }

    ix_for_before++;
    ix_for_after++;
  }

  console.log(this.arr_tm_after);

}

var random = require("random-js")();


module.exports = Player;
