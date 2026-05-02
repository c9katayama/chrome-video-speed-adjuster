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
