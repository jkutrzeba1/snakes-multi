


<template>
  <div class="form-box">

    <p v-if="success==true" class="form-msg-valid">
      {{msg}}
    </p>

    <div class="form-input">
      <input class="input" placeholder="Username" type="text" v-model="username.val" />
      <div class="form-input-err" v-if="username.err">{{username.err}}</div>
    </div>
    <div class="form-input">
      <input class="input" placeholder="Password" type="password" v-model="password.val" />
      <div class="form-input-err" v-if="password.err">{{password.err}}</div>
    </div>
    <div class="form-input">
      <input class="input" placeholder="e-mail" type="text" v-model="email.val" />
      <div class="form-input-err" v-if="email.err">{{email.err}}</div>
    </div>
    <div class="form-input">
      <input v-if="cookie_lock" class="input" type="text" :value="referrer.val" v-bind:readonly="cookie_lock" />
      <input v-else class="input" type="text" placeholder="Referrer (optional)"  v-model="referrer.val" v-bind:readonly="cookie_lock" />
      <div class="form-input-err" v-if="referrer.err">{{referrer.err}}</div>
    </div>

    <button class="btn btn-main" v-on:click="register">REGISTER</button>

  </div>


</template>

<script>

  module.exports = {
    name: "register-form",
    data: () => ({

      username: {
        val: "",
        err: null
      },
      password: {
        val: "",
        err: null
      },
      email: {
        val: "",
        err: null
      },
      referrer: {
        val: "",
        err: null
      },
      cookie_lock: false,

      success: null,
      msg: "Thank you for your registration! Your account is now ready to use."

    }),

    mounted: function(){

      var cval = this.getCookie("referrer");

      if(cval!=""){

        this.referrer.val = cval;
        this.cookie_lock = true;

      }

    },

    methods: {

      register: function(){

        //reset errors

        this.success = null;

        this.username.err = null;
        this.password.err = null;
        this.email.err = null;
        this.referrer.err = null;

        this.$axios.post("/register", {
          username: this.username.val,
          password: this.password.val,
          email: this.email.val,
          referrer: this.referrer.val
        })
        .then( (response)=> {

          if(!response.data.success){
            response.data.errs.forEach( (err)=> {
              this[err.for].err = err.msg;
            });

          }
          else {
            this.success = true;
          }
        } )

      },

      getCookie: function(cname) {
        var name = cname + "=";
        var decodedCookie = decodeURIComponent(document.cookie);
        var ca = decodedCookie.split(';');
        for(var i = 0; i <ca.length; i++) {
          var c = ca[i];
          while (c.charAt(0) == ' ') {
            c = c.substring(1);
          }
          if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
          }
        }
        return "";
      }

    }


  }

</script>

<style scoped src="./css/Form.css"/>
