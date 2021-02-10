
<template>
  <div class="form-box">

    <p v-if="after_logout" class="form-msg-valid">
      You have been logged out
    </p>
    <p v-else-if="msg!=null" class="form-msg-err">
      {{msg}}
    </p>

    <div class="form-input">
      <input class="input" placeholder="Username" type="text" v-model="username" />
    </div>
    <div class="form-input">
      <input class="input" placeholder="Password" type="password" v-model="password" />
    </div>
    <div class="form-input">
      <checkbox v-model="rememberMe">
          Remember me
      </checkbox>
    </div>
    <button class="btn btn-main" v-on:click="login">LOGIN</button>
  </div>
</template>

<script>

  module.exports = {
    name: "login-form",
    data: () => ({
      username: "",
      password: "",
      rememberMe: true,
      msg: null,
      after_logout: false
    }),

    mounted: function(){

      this.$bus.$on("logout", ()=>{
        this.after_logout = true;
      })

    },

    methods: {

      login: function(){

        this.after_logout = false;

        if(this.username == "" || this.password == ""){
          this.msg = "Both fields are required";
          return;
        }

        this.$axios.post("/login", {
          username: this.username,
          password: this.password,
          rememberMe: this.rememberMe
        }, {
          validateStatus: function (status) { // handle 401 status what is not default behaviour
            return (status >= 200 && status < 300) || status == 401;
          }
        })
        .then( (response)=>{

          if(response.status == 401){
            this.msg = "Invalid username or password";
          }

          if(response.data.success == true){
            this.$emit("successfull-login", response.data.username, response.data.balance);
            this.$estabilishSocketConnection();

          }

        })


      }

    }


  }

</script>

<style scoped src="./css/Form.css">


</style>
