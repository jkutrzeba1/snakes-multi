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
    },
    meta: {
      keepViews: []
    }
  },
  {
    path: "/login",
    name: "login",
    components: {
      credentials: LoginForm
    },
    meta: {
      keepViews: []
    }
  },
  {
    path: "/register",
    name: "register",
    components: {
      credentials: RegisterForm
    },
    meta: {
      keepViews: []
    }
  },
  {
    path: "/ranking",
    name: "ranking",
    components: {
      tabs: Ranking
    },
    meta: {
      keepViews: []
    }
  },
  {
    path: "/stats",
    name: "stats",
    components: {
      tabs: Stats
    },
    meta: {
      keepViews: []
    }
  }
];

const Router = new VueRouter({
  routes
})

const defaultActiveRecords = ["login", "ranking"];
let activeRouteRecords = {};

for(let route of routes){
  if(route.name){
    if(defaultActiveRecords.includes(route.name)){
      activeRouteRecords[route.name] = true;
    }
    else{
      activeRouteRecords[route.name] = false;
    }
  }
}

Router.activeRouteRecords = activeRouteRecords;

Router.beforeEach((to, from, next)=>{

  // first navigation
  if(!from.matched[0]){
    return next();
  }

  for(let viewName in from.matched[0].components){

    // if target route has not specified viewName or view is included in keepViews array it can be reassigned
    const isViewIncluded = to.matched[0].meta.keepViews.includes(viewName);
    if(!to.matched[0].components[viewName] || isViewIncluded ){

      // assign/reassign component to view
      to.matched[0].components[viewName] = from.matched[0].components[viewName];

      // set view name in keep views array
      if(!isViewIncluded){
        to.matched[0].meta.keepViews.push(viewName);
      }
    }
  }

  // iteration over named routes
  for(let route of routes){
    if(!route.name){
      continue;
    }

    // iteration over view names
    for(let viewName in route.components){
      if(route.meta.keepViews.includes(viewName)){
        continue;
      }
      if(route.components[viewName] === to.matched[0].components[viewName] ){
        activeRouteRecords[route.name] = true;
      }
      else{
        activeRouteRecords[route.name] = false;
      }
    }

  }

  Router.activeRouteRecords = activeRouteRecords;

  next();
})


export default Router;
