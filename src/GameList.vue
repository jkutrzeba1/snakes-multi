<template>

  <div class="main-box">

    <div v-if="socket_connected">
      <transition mode="out-in" @enter="fadeIn(...arguments, 600)" @leave="fadeOut(...arguments, 600)">
        <div v-if="menu_active" class="game-list-menu" key="m_a1" >
          <a  v-on:click.prevent="menu_active = false" class="href" href=""><b>New game >></b></a>
        </div>

        <div v-else class="game-list-menu" key="m_a2">
          <span v-tooltip.left.notrigger="{ content: new_game_form.gamename.err_msg, class: 'tooltip-custom', visible: new_game_form.gamename.err}"><input class="input" type="text" placeholder="Game name" v-model="new_game_form.gamename.val" /></span>
          <span v-tooltip.left.notrigger="{ content: new_game_form.max_players.err_msg, class: 'tooltip-custom', visible: new_game_form.max_players.err }"><input min="2" max="6" class="input" type="number" placeholder="Max Players" v-model="new_game_form.max_players.val"/></span>

          <button class="btn-small btn" v-on:click="roomCreation" v-tooltip.left.notrigger="{ content: new_game_form.confirm.err_msg, class:'tooltip-custom', visible: new_game_form.confirm.err}" style="margin-right: 20px; background-color: #00afec;"><b>CONFIRM</b></button>
          <button class="btn-small btn" v-on:click="menu_active = true" style="background-color: #b22222;"><b>NEVERMIND</b></button>
        </div>
      </transition>

      <animate-group animation-in="zoomIn" animation-out="zoomOut">
        <div v-for="game in games" style="display: flex; align-items: center;" class="room" v-bind:class="{ current_room: currentRoom == game.name }" :key="game.name">
          <img v-for="n in game.cnt_players" v-bind:title="n" src="img/circle-24-on.svg" :key="n+'a'" />
          <img v-for="n in game.max_players-game.cnt_players" v-bind:title="n" src="img/circle-24-off.svg" :key="n+'b'" />
          <img v-for="n in 6-game.max_players" v-bind:title="n" src="img/circle-24-off.svg" style="visibility: hidden" :key="n+'c'" />
          <span class="game-name">{{game.name}}</span>

          <transition @enter="fadeIn(...arguments, 200)" @leave="fadeOut(...arguments, 200)">
            <button v-if="isJoinButtonActive(game)" class="btn padding-2 green" v-on:click="joinToGame( game.name )" style="margin-left: 50px;" key="join-btn">
              <b>JOIN</b>
            </button>
            <button v-else-if="isLeaveButtonActive(game)" class="btn padding-2 red" v-on:click="leaveRoom" style="margin-left: 50px;" key="leave-btn">
              <b>LEAVE</b>
            </button>
          </transition>
        </div>
    </animate-group>
    </div>
    <div v-else>
      <div v-if="socket_connection_err=='already connected'">
        Already connected
      </div>
      <div v-if="socket_connection_err=='already in game'">
        Already in game
      </div>
    </div>

  </div>

</template>

<script>
  const AnimateGroup = require('animate-group').default;
  const animeMixin = require('./mixins/anims.js');

  module.exports = {
    mixins: [animeMixin],
    components: {
      AnimateGroup
    },
    data: ()=>({
      games: [],
      socket_connected: false,
      socket_connection_err: null,
      currentRoom: null,
      menu_active: true,
      new_game_form: {
        confirm: {
          err: false,
          err_msg: null,
          err_timeout: null,
        },
        gamename: {
          val: null,
          err: false,
          err_msg: null,
          err_timeout: null
        },
        max_players: {
          val: 6,
          err: false,
          err_msg: null,
          err_timeout: null
        }
      }
    }),

    mounted: function(){

      this.refreshGameList();

      this.$io.on("updategamelist", this.recreateGameList );

      this.$io.on("roomchanged", this.updateGamelist );

      this.$io.on("gamestart", this.gameStart);

    },

    beforeDestroy: function(){

      this.$io.removeListener("updategamelist", this.recreateGameList );

      this.$io.removeListener("roomchanged", this.updateGamelist );

      this.$io.removeListener("gamestart", this.gameStart);

    },

    props: ["loggedAs"],

    methods: {

      gameStart: function(initial_states, first_to_reach){

        this.currentRoom = "";
        this.$emit("gamestart", initial_states, first_to_reach);

      },

      refreshGameList: function(){

        this.$bus.connection_promise.then((res)=>{

          if(res=="already connected"){
            this.socket_connected = false;
            this.socket_connection_err = "already connected";
          }
          if(res=="already in game"){
            this.socket_connected = false;
            this.socket_connection_err = "already in game";
          }
          if(res=="connected"){
            this.socket_connected = true;
            this.socket_connection_err = null;
            this.$io.emit("getgamelist");
          }

        })

      },

      recreateGameList: function(games, currentRoom){

        this.games = games;

        if(currentRoom){
          this.currentRoom = currentRoom;
        }

      },

      updateGamelist: function(player, previousroom, nextroom){

        // update previous game
        this.games.findIndex( (game)=>{

          if(game.name == previousroom){

            // remove player from list
            var index = game.players.findIndex((player_item)=>{

              if(player_item == player){
                game.cnt_players--;
                return true;
              }

            });
            game.players.splice(index, 1);
            return true;
          }

        })

        // update new game
        this.games.findIndex( (game)=>{

          if(game.name == nextroom){
            game.cnt_players++;
            game.players.push(player);
            return true;
          }

        })

        return false;

      },

      getRoomWithName: function(gamename){

        var room = this.games.find( function(game){

          if(game.name == gamename)
            return true;

        });

        return room;

      },

      joinToGame: function( gamename ) {

        var room = this.getRoomWithName(gamename);
        if(!room || room.cnt_players>=room.max_players){
          return; // TODO: room is full
        }

        this.$io.emit("join", gamename, (success)=>{

          if(success){

            this.updateGamelist(this.loggedAs, this.currentRoom, gamename);
            this.currentRoom = gamename;
          }
          else{
            return; // TODO: room is full
          }

        });

      },

      roomCreation: function(){

        this.new_game_form.confirm.err = false;
        this.new_game_form.confirm.err_msg = "";
        this.new_game_form.gamename.err = false;
        this.new_game_form.gamename.err_msg = "";
        this.new_game_form.max_players.err = false;
        this.new_game_form.max_players.err_msg = "";

        if(this.currentRoom){

          clearTimeout(this.new_game_form.confirm.err_timeout);

          this.new_game_form.confirm.err_msg = "Please leave current room before creating another one";
          this.new_game_form.confirm.err = true;

          this.new_game_form.confirm.err_timeout = setTimeout(()=>{
            this.new_game_form.confirm.err = false;
          }, 3000)

        }

        var room_name = this.new_game_form.gamename.val;
        this.currentRoom = room_name;

        this.$io.emit("newgame", this.new_game_form.gamename.val, this.new_game_form.max_players.val,
          (res)=>{

            if(res.for == "confirm"){

              clearTimeout(this.new_game_form.confirm.err_timeout);

              this.new_game_form.confirm.err_msg = res.err_msg;
              this.new_game_form.confirm.err = true;

              this.new_game_form.confirm.err_timeout = setTimeout(()=>{
                this.new_game_form.confirm.err = false;
              }, 3000)

            }

            if(res.for == "gamename"){

              clearTimeout(this.new_game_form.gamename.err_timeout);

              this.new_game_form.gamename.err_msg = res.err_msg;
              this.new_game_form.gamename.err = true;

              this.new_game_form.gamename.err_timeout = setTimeout(()=>{
                this.new_game_form.gamename.err = false;
              }, 3000)

            }

            if(res.for == "max_players"){

              clearTimeout(this.new_game_form.max_players.err_timeout);

              this.new_game_form.max_players.err_msg = res.err_msg;
              this.new_game_form.max_players.err = true;

              this.new_game_form.max_players.err_timeout = setTimeout(()=>{
                this.new_game_form.max_players.err = false;
              }, 3000)

            }

            if(res.success !== true){
              this.currentRoom = "";
            }

          });


      },

      leaveRoom: function(){

        this.$io.emit("leave")
        this.updateGamelist(this.loggedAs, this.currentRoom, null);
        this.currentRoom = "";

      },

      isJoinButtonActive: function(game){
        return game.name !== this.currentRoom && game.cnt_players>0;
      },

      isLeaveButtonActive: function(game){
        return game.name === this.currentRoom;
      }

    }
  }

</script>

<style>

.vue-tooltip.tooltip-custom {
    border: 1px solid white;
    background-color: #b22222;
    text-align: center;
    color: #ffd4be;
}

.vue-tooltip.tooltip-custom .tooltip-arrow {
    border-left-color: white !important;
}
</style>

<style scoped>

.input {
  width: 120px;
}

.game-list-menu {
  background-color: #3e5382;
  padding: 6px;
  border-bottom: 1px solid black;
  box-shadow: 0px 10px 36px -13px rgba(0,0,0,0.75);
  margin-bottom: 8px;
}

.room {
  padding: 5px 20px;
}

.current_room {
  background-color: #31659a;
}

.game-name {
  display: inline-block;
  width: 150px;
  margin-right: 20px;
  margin-left: 20px;
  color: white;
  font-size: 20px;
  font-family: 'Titillium Web', sans-serif;
}

img {
  width: 18px;
  height: 18px;
  margin-right: 5px;
  position: relative;
}

</style>

<style>

.vue-tooltip{
   background-color:#000;
   box-sizing:border-box;
   color:#fff;
   max-width:320px;
   padding:6px 10px;
   border-radius:3px;
   z-index:100;
   box-shadow:2px 2px 3px rgba(0,0,0,0.4)
}
.vue-tooltip .vue-tooltip-content{
   text-align:center
}
.vue-tooltip .tooltip-arrow{
   content:'';
   width:0;
   height:0;
   border-style:solid;
   position:absolute;
   margin:5px
}
.vue-tooltip[x-placement^="top"]{
   margin-bottom:5px
}
.vue-tooltip[x-placement^="top"] .tooltip-arrow{
   border-width:5px 5px 0 5px;
   border-top-color:#000;
   border-bottom-color:transparent !important;
   border-left-color:transparent !important;
   border-right-color:transparent !important;
   bottom:-5px;
   margin-top:0;
   margin-bottom:0
}
.vue-tooltip[x-placement^="bottom"]{
   margin-top:5px
}
.vue-tooltip[x-placement^="bottom"] .tooltip-arrow{
   border-width:0 5px 5px 5px;
   border-bottom-color:white;
   border-top-color:transparent !important;
   border-left-color:transparent !important;
   border-right-color:transparent !important;
   top:-5px;
   margin-top:0;
   margin-bottom:0
}
.vue-tooltip[x-placement^="right"]{
   margin-left:5px
}
.vue-tooltip[x-placement^="right"] .tooltip-arrow{
   border-width:5px 5px 5px 0;
   border-right-color:#000;
   border-top-color:transparent !important;
   border-left-color:transparent !important;
   border-bottom-color:transparent !important;
   left:-5px;
   margin-left:0;
   margin-right:0
}
.vue-tooltip[x-placement^="left"]{
   margin-right:5px
}
.vue-tooltip[x-placement^="left"] .tooltip-arrow{
   border-width:5px 0 5px 5px;
   border-left-color:#000;
   border-top-color:transparent !important;
   border-right-color:transparent !important;
   border-bottom-color:transparent !important;
   right:-5px;
   margin-left:0;
   margin-right:0
}

</style>
