function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.startTiles     = 2;
  this.moveCount      = 0;
  this.currentAnswers = [''];

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
  this.inputManager.on("submitAnswer", this.processAnswer.bind(this));
  this.inputManager.on("rangeChange", this.dealWithRange.bind(this));
  this.inputManager.on("selectChange", this.dealWithSelect.bind(this));
  this.inputManager.on("quizletURLSubmit", this.dealWithQuizletURL.bind(this));
  this.inputManager.on("updateVisitHREF", this.updateVisitHREF.bind(this));

  this.dealWithRange();
  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  if (this.noNewGameBtn) return;

  document.querySelector(".game-message.question").style.display = 'none';
  document.getElementById("answer-to-question").value = '';
  document.getElementById('which-set').disabled = false; //enable it again
  document.getElementById('quizlet-url').disabled = false;
  document.getElementById('quizlet-btn').disabled = false;
  this.isPaused = false; //unpause
  
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present
  if (previousState) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells); // Reload grid
    this.score          = previousState.score;
    this.over           = previousState.over;
    this.won            = previousState.won;
    this.keepPlaying    = previousState.keepPlaying;
	this.moveCount      = previousState.moveCount;
	this.currentAnswers = [];
	this.isPaused       = false;
	this.qFreq          = previousState.qFreq;
		document.getElementById('question-freq').value = this.qFreq;
		this.dealWithRange();
	this.quizletQuandas = [];
	this.noNewGameBtn   = false;
  } else {
    this.grid           = new Grid(this.size);
    this.score          = 0;
    this.over           = false;
    this.won            = false;
    this.keepPlaying    = false;
	this.moveCount      = 0;
	this.currentAnswers = [];
	this.isPaused       = false;
	this.qFreq          = 30; //out of 300
		document.getElementById('question-freq').value = this.qFreq;
		this.dealWithRange();
	this.quizletQuandas = this.quizletQuandas || [];
	this.noNewGameBtn   = false;

    // Add the initial tiles
    this.addStartTiles();
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    //300 was chosen so the max ? freq would be 33.3_%
    var decimalFrequency = this.qFreq/300;
		decimalFrequency = Math.min(Math.max(0, decimalFrequency), 1);
    var value = Math.random() < decimalFrequency ? 0 : 2; //0 means it's a study question
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    score:          this.score,
    over:           this.over,
    won:            this.won,
    bestScore:      this.storageManager.getBestScore(),
    terminated:     this.isGameTerminated(),
	moveCount:      this.moveCount,
	currentAnswers: this.currentAnswers,
	isPaused:       this.isPaused,
	qFreq:          this.qFreq,
	quizletQuandas: this.quizletQuandas,
	noNewGameBtn:   this.noNewGameBtn
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:           this.grid.serialize(),
    score:          this.score,
    over:           this.over,
    won:            this.won,
    keepPlaying:    this.keepPlaying,
	moveCount:      this.moveCount,
	currentAnswers: this.currentAnswers,
	isPaused:       this.isPaused,
	qFreq:          this.qFreq,
	quizletQuandas: this.quizletQuandas,
	noNewGameBtn:   this.noNewGameBtn
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated() || this.isPaused) {
	return; // Don't do anything if the game's over
  }

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && self.valuesCanMerge(next.value, tile.value) && !next.mergedFrom) {
          var merged = new Tile(positions.next, self.mergeTiles(next.value, tile.value));
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);
		  
		  if (next.value === 0 || tile.value === 0) { //special tile
			self.isPaused = true; //pause the game
			//100ms delay for the CSS animation
			setTimeout(function() {
				self.actuator.askStudyQuestion(self);
			}, 100);
		  }

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
	this.moveCount++;
    this.addRandomTile();

    if (!this.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && self.valuesCanMerge(other.value, tile.value)) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};

GameManager.prototype.valuesCanMerge = function(a, b) {
	return a === b || a === 0 || b === 0; //one of them is zero
};

GameManager.prototype.mergeTiles = function(a, b) {
	return a+b;
};

GameManager.prototype.processAnswer = function () {
	var attempt = document.getElementById("answer-to-question").value;
	if (this.answerIsCorrect(attempt, this.currentAnswers)) {
		//remove the overlay
		document.querySelector(".game-message.question").style.display = 'none';
		document.getElementById("answer-to-question").value = ''; //remove the ?
		document.getElementById('which-set').disabled = false; //enable it again
		document.getElementById('quizlet-url').disabled = false;
		document.getElementById('quizlet-btn').disabled = false;
		this.isPaused = false; //unpause
	} else {
		document.getElementById("answer-to-question").value = ''; //try again
	}
};

GameManager.prototype.answerIsCorrect = function(guess, acceptables) {
	guess = guess.toLowerCase().replace(/\W/g, ''); //remove non-alphanum chars
	for (var ai = 0; ai < acceptables.length; ai++) {
		if (guess === acceptables[ai].toLowerCase().replace(/\W/g, '')) {
			return true; //return true if any match up
		}
	}
	return false; //if none do, then return false
};

GameManager.prototype.dealWithRange = function() {
	var range = document.getElementById('question-freq');
	var freqComment = document.getElementById('freq-description');
	var newFreq = parseInt(range.value); //newFreq in [0,100]
	if (newFreq === 0) {
		freqComment.innerHTML = 'that\'s not even studying';
	} else {
		var msgs = [
			'noob casual',
			'one in ten tiles',
			'uh-oh gettin\' serious',
			'one in four tiles',
			'CRAM LEVEL 9000',
		];
		var idx = Math.min(Math.floor((newFreq/100)*msgs.length), msgs.length-1);
		freqComment.innerHTML = msgs[idx];
	}
	this.qFreq = newFreq;
};

GameManager.prototype.dealWithSelect = function() {
	var select = document.getElementById('which-set');
	if (select.value === 'quizlet') {
		document.getElementById('quizlet-form').style.display = 'inline';
		if (this.quizletQuandas.length === 0) {
			//pause the game so they don't mess anything up
			this.isPaused = true;
			this.noNewGameBtn = true;
			document.querySelector(".game-message.overlay").style.display = 'block';
			document.querySelector(".restart-button").style.color = 'rgba(238, 228, 218, 0.35)';
		}
	} else if (select.value.match(/\-q(\d+)/)) { //predefined quizlet URL
		var urls = ['http://quizlet.com/17302457/us-presidents-to-learn-flash-cards/',
					'http://quizlet.com/2429383/basic-physics-final-review-flash-cards/',
					'http://quizlet.com/2661789/ap-lit-literary-terms-flash-cards/',
					'http://quizlet.com/8689691/learn-you-a-haskell-for-the-great-good-functions-to-remember-flash-cards/',
					];
		var idx = parseInt(select.value.match(/\-q(\d+)/)[1]); //idx in the array
		ga('send', 'event', 'button', 'click', 'quizlet go', 1000+idx); //1xxx means preloaded quizlet URL
		document.getElementById('quizlet-form').style.display = 'inline'; //show the form
		document.getElementById('quizlet-url').value = urls[idx];
		document.getElementById('qz-visit-btn').href = urls[idx];
		document.getElementById('qz-visit-btn').target = '_blank';
		this.dealWithQuizletURL(urls[idx]);
	} else {
		//could be abused to escape questioning, but it's cool
		//because keyboard inputs are frozen on question screens anyway
		this.isPaused = false;
		this.noNewGameBtn = false;
		document.getElementById('quizlet-form').style.display = 'none';
		document.querySelector(".game-message.overlay").style.display = 'none';
		document.querySelector(".restart-button").style.color = '#f9f6f2';
	}
};

GameManager.prototype.dealWithQuizletURL = function(presetURL) {
	//pause the game so they don't mess anything up
	this.isPaused = true;
	this.noNewGameBtn = true;
	document.querySelector(".game-message.overlay").style.display = 'block';
	document.querySelector(".restart-button").style.color = 'rgba(238, 228, 218, 0.35)';
	
	var url = presetURL || document.getElementById('quizlet-url').value;
	var apiPrefix = 'https://api.quizlet.com/2.0/sets/';
	var id = url.match(/quizlet\.com\/([\d]+)\//);
		if (!id || id.length < 2) {
			document.getElementById('quizlet-url').value = 'Wrong format! See example.';
			ga('send', 'event', 'button', 'click', 'quizlet go', 0); //0 means parse error
			document.getElementById('qz-visit-btn').href = '#';
			document.getElementById('qz-visit-btn').target = '';
			return;
		}
		id = id[1];
	var apiSuffix = '?client_id=TkzaAdKbZ2&callback=global_GM.receiveCORSRequest';
	var requestURL = apiPrefix+id+apiSuffix;

	var self = this;
	AJAXHelper.sendCORSRequest(requestURL);
};

GameManager.prototype.receiveCORSRequest = function(obj) {
	//false if obj is totally bogus or if Quizlet returned an improper flashcard obj
	if (!obj || obj.hasOwnProperty('error') || !obj.hasOwnProperty('terms')) {
		document.getElementById('quizlet-url').value = 'Error loading page.';
		ga('send', 'event', 'button', 'click', 'quizlet go', 1); //1 means load error
		document.getElementById('qz-visit-btn').href = '#';
		document.getElementById('qz-visit-btn').target = '';
	} else {
		//put the good bits of obj in this.quizletQuandas
		var flashcards = obj['terms'];		
		this.quizletQuandas = [];
		for (var ai = 0; ai < flashcards.length; ai++) {
			var card = flashcards[ai];
			this.quizletQuandas.push([
				card['definition'],
				card['term'].split('; ')
			]);
		}
		
		//unpause the game
		this.isPaused = false;
		this.noNewGameBtn = false;
		document.querySelector(".game-message.overlay").style.display = 'none';
		document.querySelector(".restart-button").style.color = '#f9f6f2';
		
		//remove the script element used to carry out the request
		var scr = document.getElementById('jsonp-cors');
		var parent = scr.parentNode;
		parent.removeChild(scr);
		
		var select = document.getElementById('which-set');
		if (select.value === 'quizlet') { //inputting their own, not a pre-set one
			ga('send', 'event', 'button', 'click', 'quizlet go', obj['id']); //send the id
		}
	}
};

GameManager.prototype.updateVisitHREF = function() {
	var url = document.getElementById('quizlet-url').value;
	var a = document.getElementById('qz-visit-btn');
	
	if (!/^http/.test(url)) url = 'http://' + url;
	
	if (url.length > 10) {
		a.href = url;
		a.target = '_blank';
	} else {
		a.href = '#';
		a.target = '';
	}
};
