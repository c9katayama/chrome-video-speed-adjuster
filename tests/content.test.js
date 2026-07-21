const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

function loadContentScript(dom) {
  const context = dom.getInternalVMContext();

  context.chrome = {
    storage: {
      sync: {
        get(defaults, callback) {
          callback(defaults);
        },
        set() {}
      }
    },
    runtime: {
      onMessage: {
        addListener() {}
      }
    }
  };
  context.ResizeObserver = class {
    observe() {}
  };
  context.setInterval = () => 1;
  context.clearInterval = () => {};
  context.console = console;

  const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'content.js' });

  return context;
}

function createDom() {
  return new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://www.primevideo.com/detail/test',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
}

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test('keeps the overlay inside the fullscreen element on Amazon Prime Video', () => {
  const dom = createDom();
  const { document, HTMLMediaElement } = dom.window;

  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get() {
      return false;
    }
  });

  const fullscreenPlayer = document.createElement('div');
  const video = document.createElement('video');
  fullscreenPlayer.appendChild(video);
  document.body.appendChild(fullscreenPlayer);

  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get() {
      return fullscreenPlayer;
    }
  });

  const context = loadContentScript(dom);

  context.forceControllerOnTop();

  const controller = document.querySelector('.speed-controller');
  assert.ok(controller, 'controller should exist');
  assert.strictEqual(controller.parentElement, fullscreenPlayer);
});

test('reapplies desired speed when Amazon player resets playbackRate', () => {
  // Amazon WebPlayer が applyPlaybackRate/onEnterItem で 1.0 に戻すケースを再現し、
  // 拡張の希望速度（currentSpeed）が維持されることを確認する。
  const dom = createDom();
  const { document, Event } = dom.window;

  const video = document.createElement('video');
  document.body.appendChild(video);

  const context = loadContentScript(dom);

  // vm の let 束縛を壊さないよう、コンテキスト内で希望速度を設定する
  vm.runInContext('currentSpeed = 1.5; applySpeedToVideos();', context);
  assert.strictEqual(video.playbackRate, 1.5);

  // Amazon 側の上書きを模擬
  video.playbackRate = 1.0;
  video.dispatchEvent(new Event('ratechange'));

  const desiredSpeed = vm.runInContext('currentSpeed', context);
  assert.strictEqual(desiredSpeed, 1.5, 'desired speed must not sync down to Amazon reset');
  assert.strictEqual(video.playbackRate, 1.5, 'video rate must be reapplied after Amazon reset');
});

test('keeps Amazon overlay on the top-level host instead of buried player chrome', () => {
  // Amazon の .webPlayer 等に入れず、body（または fullscreen host）へ fixed 配置する。
  const dom = createDom();
  const { document, HTMLMediaElement } = dom.window;

  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get() {
      return false;
    }
  });

  const playerChrome = document.createElement('div');
  playerChrome.className = 'webPlayerContainer';
  const overlayLayer = document.createElement('div');
  overlayLayer.className = 'atvwebplayersdk-overlays-container';
  const video = document.createElement('video');
  overlayLayer.appendChild(video);
  playerChrome.appendChild(overlayLayer);
  document.body.appendChild(playerChrome);

  const context = loadContentScript(dom);
  const controller = document.querySelector('.speed-controller');
  assert.ok(controller, 'controller should exist');

  // プレイヤー chrome へ埋もれさせない（reposition 単体でも body 固定）
  context.repositionController(video);
  assert.strictEqual(controller.parentElement, document.body, 'reposition must keep body host');
  assert.strictEqual(controller.style.position, 'fixed');
  assert.strictEqual(controller.style.zIndex, '2147483647');

  context.forceControllerOnTop();
  assert.strictEqual(controller.parentElement, document.body, 'force must keep body host');
  assert.strictEqual(controller.style.position, 'fixed');
});

test('shows Amazon overlay when speed increases even after auto-hide', () => {
  const dom = createDom();
  const { document, HTMLMediaElement } = dom.window;

  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get() {
      return false;
    }
  });

  const video = document.createElement('video');
  document.body.appendChild(video);

  const context = loadContentScript(dom);
  const controller = document.querySelector('.speed-controller');
  assert.ok(controller);

  context.hideController();
  assert.ok(controller.classList.contains('hidden'));

  context.increaseSpeed();

  assert.ok(!controller.classList.contains('hidden'), 'speed-up must reveal overlay');
  assert.strictEqual(controller.parentElement, document.body);
  assert.strictEqual(controller.style.position, 'fixed');
});
