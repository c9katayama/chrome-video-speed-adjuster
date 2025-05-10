// 設定のデフォルト値
const DEFAULT_SETTINGS = {
  speedStep: 0.1,
  rewindTime: 10,
  advanceTime: 10,
  smallAdvanceTime: 5,
  smallRewindTime: 5,
  resetSpeed: 1.0,
  hideControls: false,
  keyBindings: {
    speedDown: 'S',
    speedUp: 'D',
    resetSpeed: 'R',
    rewind: 'Z',
    advance: 'X',
    toggleControls: 'V'
  }
};

// 現在の設定
let settings = {};

// 現在の再生速度
let currentSpeed = 1.0;

// DOM要素
const currentSpeedElement = document.getElementById('current-speed');
const decreaseSpeedButton = document.getElementById('decrease-speed');
const increaseSpeedButton = document.getElementById('increase-speed');
const resetSpeedButton = document.getElementById('reset-speed');
const openOptionsLink = document.getElementById('open-options');
const advanceTimeInput = document.getElementById('advance-time');
const rewindTimeInput = document.getElementById('rewind-time');

// キーバインディング表示要素
const keySpeedDown = document.getElementById('key-speed-down');
const keySpeedUp = document.getElementById('key-speed-up');
const keyReset = document.getElementById('key-reset');
const keyRewind = document.getElementById('key-rewind');
const keyAdvance = document.getElementById('key-advance');
const keyToggle = document.getElementById('key-toggle');

// 初期化
function init() {
  // 設定を読み込む
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    settings = items;
    
    // キーバインディングを表示
    updateKeyBindingsDisplay();
    
    // スキップ時間の表示を更新
    updateSkipDurationDisplay();
    
    // アクティブなタブから現在の再生速度を取得
    getCurrentTabSpeed();
  });
  
  // イベントリスナーを設定
  decreaseSpeedButton.addEventListener('click', decreaseSpeed);
  increaseSpeedButton.addEventListener('click', increaseSpeed);
  resetSpeedButton.addEventListener('click', resetSpeed);
  openOptionsLink.addEventListener('click', openOptions);
  
  // スキップ時間の変更イベントリスナー
  advanceTimeInput.addEventListener('change', () => {
    updateSkipDuration('advance', parseInt(advanceTimeInput.value));
  });
  
  rewindTimeInput.addEventListener('change', () => {
    updateSkipDuration('rewind', parseInt(rewindTimeInput.value));
  });
}

// キーバインディング表示を更新
function updateKeyBindingsDisplay() {
  keySpeedDown.textContent = settings.keyBindings.speedDown;
  keySpeedUp.textContent = settings.keyBindings.speedUp;
  keyReset.textContent = settings.keyBindings.resetSpeed;
  keyRewind.textContent = settings.keyBindings.rewind;
  keyAdvance.textContent = settings.keyBindings.advance;
  keyToggle.textContent = settings.keyBindings.toggleControls;
}

// スキップ時間の表示を更新
function updateSkipDurationDisplay() {
  advanceTimeInput.value = settings.smallAdvanceTime;
  rewindTimeInput.value = settings.smallRewindTime;
}

// スキップ時間を更新
function updateSkipDuration(type, duration) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateSkipDuration',
        type: type,
        duration: duration
      });
    }
  });
}

// 現在のタブから再生速度を取得
function getCurrentTabSpeed() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getSpeed' }, (response) => {
        if (response && response.speed) {
          currentSpeed = response.speed;
          updateSpeedDisplay();
        }
      });
    }
  });
}

// 再生速度表示を更新
function updateSpeedDisplay() {
  currentSpeedElement.textContent = `${currentSpeed.toFixed(1)}x`;
}

// 再生速度を下げる
function decreaseSpeed() {
  currentSpeed = Math.max(currentSpeed - settings.speedStep, 0.1);
  updateSpeedDisplay();
  sendSpeedToActiveTab();
}

// 再生速度を上げる
function increaseSpeed() {
  currentSpeed = Math.min(currentSpeed + settings.speedStep, 16);
  updateSpeedDisplay();
  sendSpeedToActiveTab();
}

// 再生速度をリセット
function resetSpeed() {
  currentSpeed = settings.resetSpeed;
  updateSpeedDisplay();
  sendSpeedToActiveTab();
}

// アクティブなタブに再生速度を送信
function sendSpeedToActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'setSpeed', 
        speed: currentSpeed 
      });
    }
  });
}

// オプションページを開く
function openOptions() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
}

// 初期化を実行
document.addEventListener('DOMContentLoaded', init); 