import Vue from 'vue';
import App from './App.vue';
import router from './router.js';

import CheckboxRadio from 'vue-checkbox-radio';
import anime from 'animejs'
import Tooltip from 'vue-directive-tooltip';
import vSelect from 'vue-select'
import Dropd from 'vue-dropd'
import CountryFlag  from 'vue-country-flag';

Vue.component('dropd', Dropd);
Vue.component('v-select', vSelect);
Vue.component('country-flag', CountryFlag);


var axios = require("axios");
axios.defaults.baseURL = "/api";

Vue.use(CheckboxRadio);
Vue.use(Tooltip);

Vue.prototype.$anime = anime;
Vue.prototype.$axios = axios;
Vue.prototype.$bus = new Vue({});
Vue.prototype.$bus.p_socket_connection = null;

Vue.prototype.$syncTime = function(connection_resolve){

  var p1,p2,p3,p4,p5;

  p1 = Vue.prototype.$syncTimePing();

  p1.then(()=>{
    p2 = Vue.prototype.$syncTimePing();
    return p2;
  })
  .then(()=>{
    p3 = Vue.prototype.$syncTimePing();
    return p3;
  })
  .then(()=>{
    p4 = Vue.prototype.$syncTimePing();
    return p4;
  })
  .then(()=>{
    p5 = Vue.prototype.$syncTimePing();
    return p5;
  })
  .then(()=>{

    return Promise.all([p1,p2,p3,p4,p5])
    .then((offsets)=>{

      console.log(offsets);

      offsets.sort((a,b)=>{

        return Math.abs(a)-Math.abs(b);

      })

      console.log(offsets);

      var average_offset = Math.floor( (offsets[0] + offsets[1] + offsets[2])/3 );

      return average_offset;

    })

  })
  .then((average_offset)=>{

    if(!Date.nowPure){
      Date.nowPure = Date.now;
    }

    Date.now = function(){
      return Date.nowPure() + average_offset;
    }
    console.log("average_offset: " + average_offset);
    connection_resolve("connected");

  })

}

Vue.prototype.$syncTimePing = function(){

  var promise = new Promise((resolve)=>{

    var tm_before_emit = Date.now();

    Vue.prototype.$io.emit("sync_time", ((tm_before_emit, tm_server_time)=>{

      var tm_now = Date.now();

      var lag2v = tm_now - tm_before_emit;

      var tm_desired_client = tm_before_emit + Math.floor(lag2v); // to compare with tm_server_time

      var offset = tm_server_time - tm_desired_client;

      console.log("Server tm: " + tm_server_time);
      console.log("tm_before_emit : " + tm_before_emit);

      /*
        positive offset -> server is further ahead
        negative offset -> client is further ahead
      */

      console.log("OFFSET: " + offset);

      setTimeout(()=>{
        resolve(offset);
      }, 250);



    }).bind(undefined, tm_before_emit));


  });

  return promise;

}


Vue.prototype.$estabilishSocketConnection = function(){

  Vue.prototype.$io = require("socket.io-client")();

  Vue.prototype.$io.on("disconnect", ()=>{
    console.log("disconnect");
  })

  Vue.prototype.$io.on("error", (err)=>{
    console.log("s error " + err);
    if(err=="already connected"){
      connection_resolve("already connected");
    }
    if(err=="already in game"){
      connection_resolve("already in game");
    }
  })

  var connection_resolve;

  Vue.prototype.$bus.connection_promise = new Promise((resolve_)=>{
    connection_resolve = resolve_;
  })

  if(Vue.prototype.$io.connected){
    Vue.prototype.$syncTime(connection_resolve);
  }
  else{
    Vue.prototype.$io.on("connect", ()=>{
      Vue.prototype.$syncTime(connection_resolve);
    })
  }
}



window.lag = 0;

new Vue({
  router,
  render: h => h(App),
    mounted: function(){

     Vue.prototype.$estabilishSocketConnection();

    }
}).$mount('#app')
