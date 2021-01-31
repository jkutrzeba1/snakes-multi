<template>

  <div>

    <div>
      <div class="header" v-if="!loggedAs">
        <a href="https://discord.gg/qPxRMFt" target="_blank" >
          <img src="img/discord.svg" class="header-button"/>
        </a>
        <a href="https://www.youtube.com/channel/UCKMHjImuw3gwdz4eFZeiOPQ?view_as=subscriber" target="_blank">
          <img src="img/yt.svg" class="header-button"/>
        </a>
        <a href="https://www.facebook.com/Snakes-Multiwin-100576191845447" target="_blank">
          <img src="img/fb.svg" class="header-button"/>
        </a>
        <a href="https://www.instagram.com/snakes_multi/?hl=pl" target="_blank">
          <img src="img/instagram.svg" class="header-button"/>
        </a>
      </div>
      <div class="main-box" v-if="!loggedAs">

        <form-switcher v-on:successfull-login="(username, balance)=>{ this.loggedAs=username, this.balance=balance}"></form-switcher>

        <div class="switcher-box">
          <router-link class="switcher" to="/ranking">RANKING</router-link>
          <router-link class="switcher" to="/stats">STATS</router-link>
        </div>
        <transition @enter="fadeIn" @leave="fadeOut" mode="out-in">
          <router-view name="tabs"></router-view>
        </transition>

      </div>

      <template v-if="loggedAs">
        <user-panel
          v-bind:username="loggedAs" v-bind:balance="balance"  v-bind:in_game="in_game"
          :dropd_list="comp_list"
          :cur_panel="cur_panel"
          v-on:logout="logout"
          v-on:switch_panel="switchPanel"
          v-on:goToWithdrawalPanel="goToWithdrawalPanel"
        />
        <component v-bind:initial-states="initial_states" v-bind:first_to_reach="first_to_reach" v-bind:is="cur_panel.comp" v-bind:loggedAs="loggedAs"
          v-on:gamestart="gamestart"
          v-on:eog="eog"
          v-on:returnToPreviousPanel="returnToPreviousPanel"
        >
        </component>
      </template>

      <game-replay v-if="!loggedAs && false" v-on:play_replay="playReplay" ></game-replay>
  </div>
  </div>

</template>

<script>

  var FormSwitcher = require("./FormSwitcher.vue").default;
  var UserPanel = require("./UserPanel.vue").default;
  var Game = require("./Game.vue").default;
  var GameList = require("./GameList.vue").default;
  var FaucetList = require("./FaucetList.vue").default;
  var GameReplay = require("./GameReplay.vue").default;
  var WithdrawalPanel = require("./WithdrawalPanel.vue").default;
  var ReferrerPanel = require("./ReferrerPanel.vue").default;
  var SwitcherRankingStats = require("./SwitcherRankingStats.vue").default;

  const animeMixin = require('./mixins/anims.js');

  module.exports = {
    name: 'app',
    mixins: [animeMixin],
    data: () => ({
      loggedAs: null,
      balance: null,
      cur_panel: undefined, // Game ; GameList ; FaucetList
      prev_panel: undefined,
      in_game: false, // block CompSwitcher when user is in game
      initial_states: null,
      first_to_reach: null,
      replayActive: false,
      comp_list: [
        {
          comp: GameList,
          label: "GAME LIST",
          value: "game_list"
        },
        {
          comp: FaucetList,
          label: "TOP-UP BALANCE",
          value: "topup"
        },
        {
          comp: WithdrawalPanel,
          label: "WITHDRAWAL",
          value: "withdrawal"
        },
        {
          comp: ReferrerPanel,
          label: "REFERRERS",
          value: "referrers"
        }
      ],
      game_comp: {
        comp: Game,
        label: "IN GAME",
        value: "game"
      }
    }),

    created: function(){

      this.prev_panel = this.comp_list[0];
      this.cur_panel = this.comp_list[0];

      console.log(animeMixin);

    },

    mounted:  function(){

      this.$axios.get("/login/session")
      .then( (response)=>{

        this.loggedAs = response.data.username;
        this.balance = response.data.balance;

      })

      this.$bus.$on("balance_update", (amount)=>{

        this.balance = this.balance + amount;

      })

    },
    methods: {

      gamestart: function(initial_states, first_to_reach){
        this.in_game = true;
        this.cur_panel = this.game_comp;
        this.initial_states = initial_states;
        this.first_to_reach = first_to_reach;
      },
      eog: function(){
        this.in_game = false;
        this.initial_states = null;
        this.cur_panel = this.comp_list[0];
        this.prev_panel = this.comp_list[0];
      },


      logout: function(){
        this.loggedAs = null;
          setTimeout(()=>{ // hack: calling immediately after comp creation does'n update data on child comp
            this.$bus.$emit("logout");
        },500)
      },
      switchPanel: function(panel){

        if(this.in_game){
          return;
        }

        this.prev_panel = this.cur_panel;

        this.cur_panel = panel;

      },
      goToWithdrawalPanel: function() {
        if(this.in_game){
          return;
        }
        this.prev_panel = this.cur_panel;
        this.cur_panel = this.comp_list[2];
      },
      returnToPreviousPanel: function() {
          this.cur_panel = this.prev_panel
      },
      playReplay: function(play){
        if(play){
          this.replayActive = true;
        }
        else{
          this.replayActive = false;
        }
      }
    },
    components: {
      FormSwitcher, UserPanel, Game, GameList, FaucetList, GameReplay, WithdrawalPanel, SwitcherRankingStats
    }
  }
</script>

<style scoped>

  @import url('https://fonts.googleapis.com/css?family=Titillium+Web');
  @import url('https://fonts.googleapis.com/css?family=Abel');

  * {
    font-family: 'Titillium Web', sans-serif;
  }

  .main-box{
    display: flex;
    flex-direction: column;
    justify-content: top;
  }

  .header {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
  }

  .header > a {
    margin: 0 7px;
  }

  .header-button {
    width: 42px;
    height: 42px;
    display: block;
    margin: 0 auto;
    text-align: center;
    margin: 15px 0 0;
  }

  .switcher {
    display: inline-block;
    margin-right: 20px;
    color: white;
    font-size: 20px;
    font-family: 'Titillium Web', sans-serif;
    cursor: pointer;
    text-decoration: none;
  }

  .router-link-active {
    border-bottom: 2px solid white;
  }

  .switcher-box {
    margin: 0 auto;
    text-align: center;
    margin-top: 35px;
    margin-bottom: 20px;
  }

</style>

<style src="./css/btn.css"/>
<style src="./css/input.css"/>
<style src="./css/href.css"/>
<style src="./css/misc.css"/>
<style src="./css/Form.css"/>

<style>

 body {
   background-color: #284165;
   margin: 0;
 }

</style>
