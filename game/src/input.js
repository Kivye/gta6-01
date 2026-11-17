// Keyboard + mouse state. Pointer lock is requested on canvas click while playing.
export class Input {
  constructor(canvas, onPause) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.locked = false;
    this.onPause = onPause;
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'Escape' || e.code === 'KeyP') this.onPause();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('click', () => {
      if (this.playing && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.()?.catch?.(() => {});
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    this.playing = false;
  }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); this.mouseDX = 0; this.mouseDY = 0; }
  moveAxis() {
    const x = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    const z = (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0) - (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0);
    return { x, z };
  }
}
