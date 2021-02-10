<template>
  <div class="stats_box">
    <table>
      <tr>
        <td>Registered users:</td><td>{{registered_users}}</td>
      <tr/>
      <tr>
        <td>Matches played:</td><td>{{matches_played}}</td>
      </tr>
      <tr>
        <td>Total winnings:</td><td>{{winners_earn}}</td>
      </tr>
    </table>
  </div>
</template>

<script>

  module.exports = {
    name: "stats",
    data: ()=>({
      registered_users: 0,
      matches_played: 0,
      winners_earn: 0
    }),

    mounted: function(){

      this.$axios.get("/login/stats")
      .then((response)=>{
        console.log("get stats");
        console.log(response);

        this.registered_users = response.data.registered_users;
        this.matches_played = response.data.matches_played;
        this.winners_earn = response.data.winners_earn;

      })

    }

  }

</script>

<style>

.stats_box{
  color: white;
}
.stats_box td{
  padding: 4px;
  border-bottom: 1px solid #476fa9;
}

.stats_box td:nth-child(1){
  width: 200px;
}

.stats_box table{
  border-collapse: collapse;
  margin: 10px auto;
}

</style>
