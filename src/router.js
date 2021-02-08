import VueRouter from 'vue-router';
import Vue from 'vue';

const Stats = require("./Stats.vue").default;
const Ranking = require("./Ranking.vue").default;
const LoginForm = require("./LoginForm.vue").default;
const RegisterForm = require("./RegisterForm.vue").default;

Vue.use(VueRouter);

const routes = [
  {
    path: "/",
    components: {
      credentials: LoginForm,
      tabs: Ranking
    }
  },
  {
    path: "/login",
    name: "login",
    components: {
      credentials: LoginForm
    },
    meta: {
      keepAsActiveSibling: true
    }
  },
  {
    path: "/register",
    name: "register",
    components: {
      credentials: RegisterForm
    },
    meta: {
      keepAsActiveSibling: true
    }
  },
  {
    path: "/ranking",
    name: "ranking",
    components: {
      tabs: Ranking
    },
    meta: {
      keepAsActiveSibling: true
    }
  },
  {
    path: "/stats",
    name: "stats",
    components: {
      tabs: Stats
    },
    meta: {
      keepAsActiveSibling: true
    }
  }
];

const Router = new VueRouter({
  routes
})

Router.beforeEach((to, from, next)=>{

  let activeRouteRecords = {};

  for(let route of routes){
    if(route.name){
      activeRouteRecords[route.name] = false;
    }
  }

  // first navigation
  if(!from.matched[0]){
    //activeSiblings = { ...to.matched[0].components }
    return next();
  }

  /*
    to: Route Object
    matched[0]: Route Record at depth 0
  */

  for(let viewName in from.matched[0].components){
    if(!from.matched[0].meta.keepAsActiveSibling){
      break;
    }
    if(!to.matched[0].components[viewName]){
      to.matched[0].components[viewName] = from.matched[0].components[viewName]
    }
  }

  /*
    Active siblings
    activeRouteRecords
     name is name of route
  */

  // iteration over named routes
  for(let route of routes){
    if(!route.name){
      continue;
    }

    // iteration over view names
    for(let viewName in route.components){
      if(route.components[viewName] === to.matched[0].components[viewName] ){
        activeRouteRecords[route.name] = true;
      }
      else{
        activeRouteRecords[route.name] = false;
      }
    }

  }

  next();
})


export default Router;
