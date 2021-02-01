const anime = require('animejs');

module.exports = {
  methods: {
    fadeIn: function(el, done, duration = 200){
      anime({
        targets: el,
        opacity: [ 0, 1],
        duration: duration,
        easing: "linear",
        complete: done
      })
    },
    fadeOut: function(el, done, duration = 200){
      anime({
        targets: el,
        opacity: [ 1, 0],
        duration: duration,
        easing: "linear",
        complete: done
      })
    }
  }
}
