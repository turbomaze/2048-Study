function KeyboardInputManager() {
  this.events = {};

  if (window.navigator.msPointerEnabled) {
    //Internet Explorer 10 style
    this.eventTouchstart    = "MSPointerDown";
    this.eventTouchmove     = "MSPointerMove";
    this.eventTouchend      = "MSPointerUp";
  } else {
    this.eventTouchstart    = "touchstart";
    this.eventTouchmove     = "touchmove";
    this.eventTouchend      = "touchend";
  }

  this.listen();
}

KeyboardInputManager.prototype.on = function (event, callback) {
  if (!this.events[event]) {
    this.events[event] = [];
  }
  this.events[event].push(callback);
};

KeyboardInputManager.prototype.emit = function (event, data) {
  var callbacks = this.events[event];
  if (callbacks) {
    callbacks.forEach(function (callback) {
      callback(data);
    });
  }
};

KeyboardInputManager.prototype.listen = function () {
  var self = this;

  var map = {
    38: 0, // Up
    39: 1, // Right
    40: 2, // Down
    37: 3, // Left
    75: 0, // Vim up
    76: 1, // Vim right
    74: 2, // Vim down
    72: 3, // Vim left
    87: 0, // W
    68: 1, // D
    83: 2, // S
    65: 3  // A
  };

  // Respond to direction keys
  document.addEventListener("keydown", function (event) {
    var modifiers = event.altKey || event.ctrlKey || event.metaKey ||
                    event.shiftKey;
    var mapped    = map[event.which];
	var questionOverlay = document.querySelector(".game-message.question");
	var pauseOverlay = document.querySelector(".game-message.overlay");

    if (!modifiers) {
	  //wasd, hjkl, and <^v> and the game isn't paused
      if (mapped !== undefined && 
		  questionOverlay.style.display !== 'block' &&
		  pauseOverlay.style.display !== 'block' &&
		  document.activeElement.id !== 'quizlet-url' //not typing in a url
		  ) {
        event.preventDefault();
        self.emit("move", mapped);
      }
    }

	// [enter] key submits the user's answer when...
    if (!modifiers && event.which === 13 &&
	    questionOverlay.style.display === 'block' && //they're 'question' paused
		document.activeElement.id === 'answer-to-question') { //and focused on the text input
      self.submitAnswer();
    }
	
	// any keypress focuses the text input if the game is paused
	if (questionOverlay.style.display === 'block') {
      document.getElementById('answer-to-question').focus(true);
    }
  });

  // Respond to button presses
  this.bindButtonPress(".retry-button", this.restart);
  this.bindButtonPress(".restart-button", this.restart);
  this.bindButtonPress(".keep-playing-button", this.keepPlaying);
  this.bindButtonPress(".answer-btn", this.submitAnswer);
  this.bindButtonPress("#quizlet-btn", this.handleQuizletURL);
  
  // Respond to the range input
  this.bindRangeSlide('#question-freq', this.updateRangeMessage);
  
  // Deal with a changing flashcard set
  this.bindSelectChange('#which-set', this.updateSelect);
  
  // Update the "open quizlet url: visit" link href
  this.bindKeyup('#quizlet-url', this.updateVisitHREF);

  // Respond to swipe events
  var touchStartClientX, touchStartClientY;
  var gameContainer = document.getElementsByClassName("game-container")[0];

  gameContainer.addEventListener(this.eventTouchstart, function (event) {
    if ((!window.navigator.msPointerEnabled && event.touches.length > 1) ||
        event.targetTouches > 1) {
      return; // Ignore if touching with more than 1 finger
    }

    if (window.navigator.msPointerEnabled) {
      touchStartClientX = event.pageX;
      touchStartClientY = event.pageY;
    } else {
      touchStartClientX = event.touches[0].clientX;
      touchStartClientY = event.touches[0].clientY;
    }

	/* not sure what the point of canceling the default behavior is, but
	   it's impossible for mobile phones to focus on the "answer" text input
	   if this following line is executed
	*/
	//event.preventDefault();
  });

  gameContainer.addEventListener(this.eventTouchmove, function (event) {
	event.preventDefault();
  });

  gameContainer.addEventListener(this.eventTouchend, function (event) {
	if ((!window.navigator.msPointerEnabled && event.touches.length > 0) ||
        event.targetTouches > 0) {
      return; // Ignore if still touching with one or more fingers
    }

    var touchEndClientX, touchEndClientY;

    if (window.navigator.msPointerEnabled) {
      touchEndClientX = event.pageX;
      touchEndClientY = event.pageY;
    } else {
      touchEndClientX = event.changedTouches[0].clientX;
      touchEndClientY = event.changedTouches[0].clientY;
    }

    var dx = touchEndClientX - touchStartClientX;
    var absDx = Math.abs(dx);

    var dy = touchEndClientY - touchStartClientY;
    var absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 10) {
      // (right : left) : (down : up)
      self.emit("move", absDx > absDy ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    }
  });
};

KeyboardInputManager.prototype.restart = function (event) {
  event.preventDefault();
  this.emit("restart");
};

KeyboardInputManager.prototype.keepPlaying = function (event) {
  event.preventDefault();
  this.emit("keepPlaying");
};

KeyboardInputManager.prototype.submitAnswer = function (event) {
  this.emit("submitAnswer");
};

KeyboardInputManager.prototype.updateRangeMessage = function (event) {
  this.emit("rangeChange");
};

KeyboardInputManager.prototype.updateSelect = function (event) {
  this.emit("selectChange");
};

KeyboardInputManager.prototype.handleQuizletURL = function (event) {
  this.emit("quizletURLSubmit");
};

KeyboardInputManager.prototype.updateVisitHREF = function (event) {
  this.emit("updateVisitHREF");
};

KeyboardInputManager.prototype.bindButtonPress = function (selector, fn) {
  var button = document.querySelector(selector);
  button.addEventListener("click", fn.bind(this));
  button.addEventListener(this.eventTouchend, fn.bind(this));
};

KeyboardInputManager.prototype.bindRangeSlide = function (selector, fn) {
  var range = document.querySelector(selector);
  range.addEventListener("input", fn.bind(this));
};

KeyboardInputManager.prototype.bindSelectChange = function (selector, fn) {
  var select = document.querySelector(selector);
  select.addEventListener("change", fn.bind(this));
};

KeyboardInputManager.prototype.bindKeyup = function (selector, fn) {
  var a = document.querySelector(selector);
  a.addEventListener("keyup", fn.bind(this));
}
