const anime = require('animejs');

module.exports = {
  methods: {
    fadeIn: function(el, done){
      anime({
        targets: el,
        opacity: [ 0, 1],
        duration: 200,
        easing: "linear",
        complete: done
      })
    },
    fadeOut: function(el, done){
      anime({
        targets: el,
        opacity: [ 1, 0],
        duration: 200,
        easing: "linear",
        complete: done
      })
    }
  }
}
