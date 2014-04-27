// Wait till the browser is ready to render the game (avoids glitches)
var global_GM = null;
window.requestAnimationFrame(function () {
  global_GM = new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);
});
