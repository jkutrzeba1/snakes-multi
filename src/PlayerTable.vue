
<template>
  <div style="display: inline-block; vertical-align: top;">
    <div class="ftr" v-bind:style="{'border-color': may_color}">
      FIRST TO REACH: {{first_to_reach}}
    </div>
    <div class="top-box">
      <transition-group name="player-table-list" tag="div">
        <div v-for="player in player_table" v-bind:key="player.playername">
          <div v-bind:class="{dead: !player.live}" v-bind:style="{backgroundColor: player.color}" class="flag"></div>
          <span v-bind:class="{dead: !player.live}" class="player">{{player.playername}}</span>
          <span v-bind:class="{dead: !player.live}" class="points">{{player.points}}</span>
          <span style="width: 30px; display: inline-block">
            <transition @enter="fadeIn(...arguments, 2000)" @leave="fadeOut(...arguments, 2000)">
              <span style="display: inline-blockl width: 30px;" v-if="!player.live || player.winner">+{{player.round_points}}</span>
            </transition>
          </span>
          <transition>
            <span style="display: inline-block" class="tie-break" v-if="player.tie_break">tie break</span>

          </transition>
        </div>
      </transition-group>
    </div>
  </div>

</template>

<script>

  const animeMixin = require('./mixins/anims.js');

  module.exports = {
    mixins: [animeMixin],
    props: ["player_table", "first_to_reach", "may_color", "max_players"],
    data: ()=>({
      cnt_killed: 0,
      round_ended: false,
      game_winner: null
    }),
    methods: {
      endRound: function() {

        this.round_ended = true;

        for( var player_item of this.player_table){

          if(player_item.live){
            player_item.winner = true;
            player_item.round_points = this.max_players-1;
          }

        }

        setTimeout( this.incrementByRoundPoints, 2000 );

      },

      incrementByRoundPoints: function(){

        for( var player_item of this.player_table){

          //player_item.points += player_item.round_points;
          player_item.live = true;
          player_item.winner = false;

          var p = this.$anime(
            {targets: player_item, points: "+="+player_item.round_points, round: true, duration: 500, easing: "linear"}
          ).finished;

        }
        p.then(()=>{

          this.player_table = this.player_table.sort( (a,b)=>{
            if(a.points>b.points)
              return -1;
            else if(a.points<b.points)
              return 1
            else {
              return 1;
            }
          })

          //var max = 0;

          if(this.player_table[0].points>=this.first_to_reach){
            this.game_winner = this.player_table[0].points;
          }
          /*
          for(var i = 1; i<this.player_table.length; i++){
            if(this.player_table[i].points+1 >= max){
              this.player_table[i].tie_break = true;
            }
            else{
              this.player_table[i].tie_break = false
            }
          }

          if(this.player_table[1].tie_break == true){
            this.player_table[0].tie_break = true;
          }
          else {
            this.player_table[0].tie_break = false;
            this.game_winner = this.player_table[0];
          }
          */

        })
      }

    },

    mounted: function(){


      this.$io.on("killed", (playername)=>{

        if(this.round_ended)
          return;

        for( var player_item of this.player_table){

          if(player_item.playername == playername){
            player_item.live = false;
            player_item.round_points = this.cnt_killed;
            this.cnt_killed++;
          }

        }

        if(this.cnt_killed == this.max_players-1){
          this.endRound();
        }

      })

      this.$io.on("round_start", ()=>{

        this.cnt_killed = 0;
        this.round_ended = false;

      })

    }


  }

</script>

<style scoped>

@import url('https://fonts.googleapis.com/css?family=Jua');

  .tie-break.tie-break {
    font-size: 17px;
  }

  .ftr {
    font-family: 'Jua', sans-serif;
    font-size: 22px;;
    color: white;
    margin-left: 15px;
    margin-top: 15px;
    text-align: center;
    vertical-align: middle;
    border-bottom: 1px solid;
  }

  .top-box {
    vertical-align: top;
    background-color: #446088;
    padding: 20px;
    width: 350px;
    margin-left: 15px;
    margin-top: 15px;
    font-family: 'Jua', sans-serif;
    font-size: 22px;;
    color: white;
  }

  .player {
    width: 150px;
    display: inline-block;
    margin-right: 10px;
    transition: opacity 2s;
  }

  .points{
    width: 30px;
    display: inline-block;
    transition: opacity 2s;
  }

  .dead{
    transition: opacity 2s;
    opacity: 0.2;
  }

  .flag {
    display: inline-block;
    height: 22px;
    width: 12px;
    background-color: pink;
    transition: opacity 2s;
  }

  .player-table-list-move{
    transition: transform 2s;
  }


</style>
