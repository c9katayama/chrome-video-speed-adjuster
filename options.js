// 設定のデフォルト値
const DEFAULT_SETTINGS = {
  speedStep: 0.1,
  rewindTime: 10,
  advanceTime: 10,
  resetSpeed: 1.0,
  hideControls: false,
  autoHideDelay: 2000, // コントローラー非表示までの時間（ミリ秒）
  keyBindings: {
    speedDown: 'S',
    speedUp: 'D',
    resetSpeed: 'R',
    rewind: 'Z',
    advance: 'X',
    toggleControls: 'V'
  }
};

// DOM要素
const speedStepInput = document.getElementById('speed-step');
const resetSpeedInput = document.getElementById('reset-speed');
const rewindTimeInput = document.getElementById('rewind-time');
const advanceTimeInput = document.getElementById('advance-time');
const hideControlsCheckbox = document.getElementById('hide-controls');
const autoHideDelayInput = document.getElementById('auto-hide-delay');
const keySpeedDownInput = document.getElementById('key-speed-down');
const keySpeedUpInput = document.getElementById('key-speed-up');
const keyResetInput = document.getElementById('key-reset');
const keyRewindInput = document.getElementById('key-rewind');
const keyAdvanceInput = document.getElementById('key-advance');
const keyToggleInput = document.getElementById('key-toggle');
const saveButton = document.getElementById('save-button');
const resetButton = document.getElementById('reset-button');
const statusElement = document.getElementById('status');

// 初期化
function init() {
  // 設定を読み込む
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    // フォームに値を設定
    speedStepInput.value = items.speedStep;
    resetSpeedInput.value = items.resetSpeed;
    rewindTimeInput.value = items.rewindTime;
    advanceTimeInput.value = items.advanceTime;
    hideControlsCheckbox.checked = items.hideControls;
    autoHideDelayInput.value = items.autoHideDelay / 1000; // ミリ秒から秒に変換
    keySpeedDownInput.value = items.keyBindings.speedDown;
    keySpeedUpInput.value = items.keyBindings.speedUp;
    keyResetInput.value = items.keyBindings.resetSpeed;
    keyRewindInput.value = items.keyBindings.rewind;
    keyAdvanceInput.value = items.keyBindings.advance;
    keyToggleInput.value = items.keyBindings.toggleControls;
  });
  
  // イベントリスナーを設定
  saveButton.addEventListener('click', saveOptions);
  resetButton.addEventListener('click', resetOptions);
}

// オプションを保存
function saveOptions() {
  // フォームから値を取得
  const settings = {
    speedStep: parseFloat(speedStepInput.value),
    rewindTime: parseInt(rewindTimeInput.value),
    advanceTime: parseInt(advanceTimeInput.value),
    resetSpeed: parseFloat(resetSpeedInput.value),
    hideControls: hideControlsCheckbox.checked,
    autoHideDelay: parseFloat(autoHideDelayInput.value) * 1000, // 秒からミリ秒に変換
    keyBindings: {
      speedDown: keySpeedDownInput.value.toUpperCase(),
      speedUp: keySpeedUpInput.value.toUpperCase(),
      resetSpeed: keyResetInput.value.toUpperCase(),
      rewind: keyRewindInput.value.toUpperCase(),
      advance: keyAdvanceInput.value.toUpperCase(),
      toggleControls: keyToggleInput.value.toUpperCase()
    }
  };
  
  // 入力値の検証
  if (!validateSettings(settings)) {
    return;
  }
  
  // 設定を保存
  chrome.storage.sync.set(settings, () => {
    // 保存成功メッセージを表示
    showStatus('設定が保存されました。', 'success');
  });
}

// 設定値を検証
function validateSettings(settings) {
  // 数値の範囲チェック
  if (settings.speedStep < 0.1 || settings.speedStep > 1) {
    showStatus('速度変更ステップは0.1から1の間で設定してください。', 'error');
    return false;
  }
  
  if (settings.resetSpeed < 0.1 || settings.resetSpeed > 16) {
    showStatus('リセット時の速度は0.1から16の間で設定してください。', 'error');
    return false;
  }
  
  if (settings.rewindTime < 1 || settings.rewindTime > 60) {
    showStatus('巻き戻し時間は1から60の間で設定してください。', 'error');
    return false;
  }
  
  if (settings.advanceTime < 1 || settings.advanceTime > 60) {
    showStatus('早送り時間は1から60の間で設定してください。', 'error');
    return false;
  }
  
  if (settings.autoHideDelay < 500 || settings.autoHideDelay > 10000) {
    showStatus('コントローラー非表示までの時間は0.5から10の間で設定してください。', 'error');
    return false;
  }
  
  // キーバインディングの重複チェック
  const keys = Object.values(settings.keyBindings);
  const uniqueKeys = new Set(keys);
  if (keys.length !== uniqueKeys.size) {
    showStatus('キーバインディングが重複しています。それぞれ異なるキーを設定してください。', 'error');
    return false;
  }
  
  return true;
}

// オプションをデフォルトにリセット
function resetOptions() {
  // デフォルト値をフォームに設定
  speedStepInput.value = DEFAULT_SETTINGS.speedStep;
  resetSpeedInput.value = DEFAULT_SETTINGS.resetSpeed;
  rewindTimeInput.value = DEFAULT_SETTINGS.rewindTime;
  advanceTimeInput.value = DEFAULT_SETTINGS.advanceTime;
  hideControlsCheckbox.checked = DEFAULT_SETTINGS.hideControls;
  autoHideDelayInput.value = DEFAULT_SETTINGS.autoHideDelay / 1000; // ミリ秒から秒に変換
  keySpeedDownInput.value = DEFAULT_SETTINGS.keyBindings.speedDown;
  keySpeedUpInput.value = DEFAULT_SETTINGS.keyBindings.speedUp;
  keyResetInput.value = DEFAULT_SETTINGS.keyBindings.resetSpeed;
  keyRewindInput.value = DEFAULT_SETTINGS.keyBindings.rewind;
  keyAdvanceInput.value = DEFAULT_SETTINGS.keyBindings.advance;
  keyToggleInput.value = DEFAULT_SETTINGS.keyBindings.toggleControls;
  
  // リセットメッセージを表示
  showStatus('設定がデフォルト値にリセットされました。保存するには「保存」ボタンをクリックしてください。', 'success');
}

// ステータスメッセージを表示
function showStatus(message, type) {
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
  statusElement.style.display = 'block';
  
  // 3秒後にメッセージを非表示
  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}

// 初期化を実行
document.addEventListener('DOMContentLoaded', init); 