
<template>

  <div class="ranking_box">


    <table>
      <tr v-for="(rank_item, index) of rank_arr" :key="rank_item.username">
        <td><country-flag v-if="rank_item.country_code" v-bind:country="rank_item.country_code" size='big'/></td>
        <td><div>{{cur_page*15+index+1}}</div></td>
        <td><div>{{rank_item.username}}</div></td>
        <td><div>{{rank_item.points}}</div></td>
      </tr>
    </table>

    <div style="margin: 0 auto; text-align: center;">
      <a href="" class="href page-mover" :class="{hidden: cur_page===0}" v-on:click.prevent="previousPage">&lt;&lt;</a>
        {{cur_page+1}}
      <a href="" class="href page-mover" :class="{hidden: isCurPageLast}" v-on:click.prevent="nextPage">&gt;&gt;</a>
    </div>

  </div>

</template>

<script>

  module.exports = {
    name: "ranking",
    data: ()=>({
      rank_arr: [],
      cur_page: 0,
      isCurPageLast: false
    }),

    mounted: function(){

      this.pageRequest(0);

    },

    methods: {

      pageRequest: function(page_dir){

        let page_requested;

        if(page_dir==0){
          page_requested = 0;
        }

        if(page_dir == 1){
          page_requested = this.cur_page+1;
        }
        if(page_dir == -1){
          page_requested = this.cur_page-1;
        }

        this.$axios.post("/login/ranking", {page: page_requested})
        .then((response)=>{

          if(response.data==null){
            return;
          }

          this.rank_arr = response.data.ranking;
          this.isCurPageLast = response.data.isCurPageLast;

          this.cur_page = page_requested;

        })

      },

      previousPage: function(){

        if(this.cur_page == 0){
          return;
        }

        this.pageRequest(-1);


      },

      nextPage: function(){

        this.pageRequest(1);

      }

    }
  }

</script>

<style>

.ranking_box{
  color: white;
}

.ranking_box tr{
  height: 45px;
}

.ranking_box td{
  border-bottom: 1px solid #476fa9;
  line-height: 100%;
  line-height: 16px;
}

.ranking_box td:nth-child(1){
  scale: 0.45;
}
.ranking_box td:nth-child(2){
  padding: 4px 14px 4px 10px;
  width: 10px;
}
.ranking_box td:nth-child(3){
  padding: 4px 10px;
  width: 200px;
}
.ranking_box td:nth-child(4){
  padding: 4px 10px;
}
.ranking_box table{
  border-collapse: collapse;
  margin: 10px auto 10px;
}
.page-mover {
  margin: 18px;
}

</style>
