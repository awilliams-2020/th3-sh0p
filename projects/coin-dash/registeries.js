var timer;
var countDown;

Date.prototype.addMins = function(m) {
  this.setTime(this.getTime() + (m*60*1000));
  return this;
}

var moveSound = new Howl({
  src: ['game-sounds/whoosh.mp3']
});

var awardSound = new Howl({
  src: ['game-sounds/award.mp3']
});

function getRndBoxSize(min, max) {
  return (Math.random() * (max - min) + min).toFixed(4);
}

function getRndPosNegInt(num) {
  return Math.floor(Math.random() * ((num * 2) + 1) ) - num;
}

function getRndInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) ) + min;
}

function showScore() {
  var time = document.querySelector('#time');
  var score = document.querySelector('#score');
  var coins = document.querySelector('#coins');
  var ray = document.querySelector('#ray');

  score.object3D.visible = true;
  coins.object3D.visible = false;
  time.object3D.visible = false;
  ray.object3D.visible = false;

  var value = coins.getAttribute('text').value;
  var values = value.split(':');
  var numCoins = values[1];
  numCoins = numCoins.trim();

  score.setAttribute('text', 'value', 'Coins:'+numCoins);
}

function resCoinCnt() {
  var coins = document.querySelector('#coins');
  coins.setAttribute('text', 'value', 'Coins:0');
}

function incCoinCnt() {
  var coins = document.querySelector('#coins');
  var value = coins.getAttribute('text').value;
  var values = value.split(':');
  var numCoins = parseInt(values[1]);
  numCoins += 1
  values[1] = numCoins.toString();
  coins.setAttribute('text', 'value', values[0]+':'+values[1]);
}

function removeElements() {
  var sceneEl = document.querySelector('#scene');
  var elements = document.getElementsByClassName('collidable');
  while(elements.length != 0) {
    var element = elements[0];
    sceneEl.removeChild(element);
    element.destroy();
  }
}

function createBlocks(sceneEl) {
  for (var i =0; i < 15; i++) {
    var entityEl = document.createElement('a-entity');
    entityEl.classList.add('collidable');
    entityEl.setAttribute('move-player','')
    var scale = {
      x: 0.25,
      y: 0.03,
      z: 0.25
    };
    entityEl.setAttribute('gltf-model','#box')
    entityEl.setAttribute('scale', scale)
    var pos = {
      x: getRndPosNegInt(75),
      z: getRndPosNegInt(75),
      y: getRndInt(1, 15)
    };
    entityEl.setAttribute('position', pos);
    sceneEl.appendChild(entityEl);
  }
}

function createCoins(sceneEl) {
  for (var i =0; i < 15; i++) {
    var entityEl = document.createElement('a-entity');
    entityEl.classList.add('collidable');
    entityEl.setAttribute('capture-coin','')
    entityEl.setAttribute('gltf-model','#coin')
    entityEl.setAttribute('animation-mixer','')
    entityEl.setAttribute('scale','.035 .035 .035')
    var pos = {
      x: getRndPosNegInt(75),
      z: getRndPosNegInt(75),
      y: getRndInt(2, 15)
    };
    entityEl.setAttribute('position', pos);
    sceneEl.appendChild(entityEl);
  }
}

function startTimer() {
  timer = setInterval(function() {
    var now = new Date();
    var distance = countDown - now;
    var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((distance % (1000 * 60)) / 1000);

    var time = document.querySelector('#time');
    time.setAttribute('text', 'value', 'Time:'+minutes+':'+seconds);

    if (seconds <= 0 && minutes <= 0) {
      clearInterval(timer);
      var createScene = document.querySelector('#scene').components['create-scene'];
      removeElements();
      showScore();
      //createScene.init();
    }
  }, 1000);
}

function removeStartPrompt() {
  var start = document.querySelector('#start');
  if (start !== null) {
    countDown = new Date();
    countDown.addMins(1);
    startTimer();
    start.parentNode.removeChild(start);
    start.destroy();
  }
}

AFRAME.registerComponent('create-scene', {
  init: function() {
    var sceneEl = document.querySelector('a-scene');
    var score = document.querySelector('#score');
    score.object3D.postion = new THREE.Vector3("0.0, 0.0, -1.0")
    score.object3D.visible = false;
    resCoinCnt();
    createCoins(sceneEl);
    createBlocks(sceneEl);
  }
});

AFRAME.registerComponent('capture-coin', {
  init: function () {
    this.el.addEventListener('click', function (evt) {
      awardSound.play();
      this.parentNode.removeChild(this);
      this.destroy();
      incCoinCnt();
      removeStartPrompt();
    });
  }
});

AFRAME.registerComponent('move-player', {
  init: function () {
    this.eventHandlerFn = function (event) {
      removeStartPrompt();
      let location = this.object3D.position;
      let camera = document.querySelector('#camera');
      cameraPos = camera.object3D.position;
      if (cameraPos.x !== location.x && (cameraPos.y-1.6) !== location.y && cameraPos.z !== location.z) {
        event.target.removeAttribute('move-player')
        moveSound.play();
        camera.setAttribute('animation', 'property:position; to:'+location.x+' '+(location.y+1.6)+' '+location.z);
      }
    }
    this.el.addEventListener('mousedown', this.eventHandlerFn);
  },
  remove: function() {
    this.el.removeEventListener('mousedown',this.eventHandlerFn)
    setTimeout(() => {
      this.el.addEventListener('mousedown', this.eventHandlerFn)
    }, 1000);
  }
});