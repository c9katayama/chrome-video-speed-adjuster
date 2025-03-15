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

// ユーザー設定
let settings = Object.assign({}, DEFAULT_SETTINGS);

// 現在の再生速度
let currentSpeed = 1.0;

// コントローラー要素
let controller = null;
let speedIndicator = null;
let controlsVisible = true;

// 自動非表示用タイマー
let autoHideTimer = null;
// const AUTO_HIDE_DELAY = 2000; // 2秒後に非表示

// 初期化
function init() {
  // ストレージから設定を読み込む
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    settings = items;
    
    // ビデオ要素を監視
    observeVideoElements();
    
    // キーボードイベントリスナーを追加
    document.addEventListener('keydown', handleKeyDown);
  });
}

// ビデオ要素を監視する
function observeVideoElements() {
  // 既存のビデオ要素を処理
  document.querySelectorAll('video').forEach(attachControllerToVideo);
  
  // 新しく追加されるビデオ要素を監視
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === 'VIDEO') {
          attachControllerToVideo(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          node.querySelectorAll('video').forEach(attachControllerToVideo);
        }
      });
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

// ビデオ要素にコントローラーを追加
function attachControllerToVideo(video) {
  // 既にコントローラーが付いている場合はスキップ
  if (video.hasAttribute('data-speed-controller')) {
    return;
  }
  
  // ビデオにマークを付ける
  video.setAttribute('data-speed-controller', 'true');
  
  // コントローラーを作成
  createController(video);
  
  // ビデオの再生速度を設定
  video.playbackRate = currentSpeed;
  
  // ビデオのイベントリスナーを追加
  video.addEventListener('ratechange', () => {
    // 外部から再生速度が変更された場合に同期
    if (video.playbackRate !== currentSpeed) {
      currentSpeed = video.playbackRate;
      updateSpeedIndicator();
    }
  });
  
  // 初期表示後に自動非表示タイマーを開始
  resetAutoHideTimer();
  
  // 再生開始時にコントローラーを表示して自動非表示タイマーを開始
  video.addEventListener('play', () => {
    showController();
    resetAutoHideTimer();
  });
  
  // 一時停止時にコントローラーを表示して自動非表示タイマーを開始
  video.addEventListener('pause', () => {
    showController();
    resetAutoHideTimer();
  });
  
  // シーク操作時にコントローラーを表示して自動非表示タイマーを開始
  video.addEventListener('seeking', () => {
    showController();
    resetAutoHideTimer();
  });
}

// コントローラーを作成
function createController(video) {
  // 既存のコントローラーを削除
  if (controller) {
    controller.remove();
  }
  
  // コントローラー要素を作成
  controller = document.createElement('div');
  controller.className = 'speed-controller';
  
  // 速度表示要素
  speedIndicator = document.createElement('div');
  speedIndicator.className = 'speed-indicator';
  updateSpeedIndicator();
  controller.appendChild(speedIndicator);
  
  // コントロールパネル
  const controlPanel = document.createElement('div');
  controlPanel.className = 'control-panel';
  
  // 速度ダウンボタン
  const speedDownBtn = document.createElement('button');
  speedDownBtn.textContent = '-';
  speedDownBtn.addEventListener('click', () => {
    decreaseSpeed();
    resetAutoHideTimer();
  });
  controlPanel.appendChild(speedDownBtn);
  
  // 速度リセットボタン
  const resetBtn = document.createElement('button');
  resetBtn.textContent = '1x';
  resetBtn.addEventListener('click', () => {
    resetSpeedToDefault();
    resetAutoHideTimer();
  });
  controlPanel.appendChild(resetBtn);
  
  // 速度アップボタン
  const speedUpBtn = document.createElement('button');
  speedUpBtn.textContent = '+';
  speedUpBtn.addEventListener('click', () => {
    increaseSpeed();
    resetAutoHideTimer();
  });
  controlPanel.appendChild(speedUpBtn);
  
  // 巻き戻しボタン
  const rewindBtn = document.createElement('button');
  rewindBtn.textContent = '<<';
  rewindBtn.addEventListener('click', () => {
    rewindVideo(video);
    resetAutoHideTimer();
  });
  controlPanel.appendChild(rewindBtn);
  
  // 早送りボタン
  const advanceBtn = document.createElement('button');
  advanceBtn.textContent = '>>';
  advanceBtn.addEventListener('click', () => {
    advanceVideo(video);
    resetAutoHideTimer();
  });
  controlPanel.appendChild(advanceBtn);
  
  controller.appendChild(controlPanel);
  
  // マウスオーバー時に自動非表示タイマーをリセット
  controller.addEventListener('mouseenter', () => {
    clearAutoHideTimer();
  });
  
  // マウスアウト時に自動非表示タイマーを開始
  controller.addEventListener('mouseleave', () => {
    resetAutoHideTimer();
  });
  
  // ビデオコンテナに追加
  const videoContainer = video.parentElement;
  videoContainer.style.position = 'relative';
  videoContainer.appendChild(controller);
  
  // 初期表示設定
  if (settings.hideControls) {
    hideController();
  }
}

// 速度表示を更新
function updateSpeedIndicator() {
  if (speedIndicator) {
    speedIndicator.textContent = `${currentSpeed.toFixed(1)}x`;
  }
}

// 再生速度を上げる
function increaseSpeed() {
  currentSpeed = Math.min(currentSpeed + settings.speedStep, 16);
  applySpeedToVideos();
  showController();
  resetAutoHideTimer();
}

// 再生速度を下げる
function decreaseSpeed() {
  currentSpeed = Math.max(currentSpeed - settings.speedStep, 0.1);
  applySpeedToVideos();
  showController();
  resetAutoHideTimer();
}

// 再生速度をリセット
function resetSpeedToDefault() {
  currentSpeed = settings.resetSpeed;
  applySpeedToVideos();
  showController();
  resetAutoHideTimer();
}

// 全てのビデオに再生速度を適用
function applySpeedToVideos() {
  document.querySelectorAll('video').forEach(video => {
    video.playbackRate = currentSpeed;
  });
  updateSpeedIndicator();
}

// ビデオを巻き戻し
function rewindVideo(video) {
  video.currentTime = Math.max(video.currentTime - settings.rewindTime, 0);
  showController();
  resetAutoHideTimer();
}

// ビデオを早送り
function advanceVideo(video) {
  video.currentTime = Math.min(video.currentTime + settings.advanceTime, video.duration);
  showController();
  resetAutoHideTimer();
}

// コントローラーを表示/非表示
function toggleController() {
  controlsVisible = !controlsVisible;
  if (controlsVisible) {
    showController();
    resetAutoHideTimer();
  } else {
    hideController();
  }
}

// コントローラーを表示
function showController() {
  if (controller) {
    controller.classList.remove('hidden');
    controlsVisible = true;
  }
}

// コントローラーを非表示
function hideController() {
  if (controller) {
    controller.classList.add('hidden');
    controlsVisible = false;
  }
}

// 自動非表示タイマーをリセット
function resetAutoHideTimer() {
  clearAutoHideTimer();
  
  // 新しいタイマーを設定
  autoHideTimer = setTimeout(() => {
    hideController();
  }, settings.autoHideDelay);
}

// 自動非表示タイマーをクリア
function clearAutoHideTimer() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}

// キーボードイベントを処理
function handleKeyDown(event) {
  // フォーム要素にフォーカスがある場合は無視
  if (isFormElement(document.activeElement)) {
    return;
  }
  
  const key = event.key.toUpperCase();
  
  // 大文字小文字を区別せずにキーバインディングをチェック
  if (key === settings.keyBindings.speedDown.toUpperCase()) {
    decreaseSpeed();
    event.preventDefault();
  } else if (key === settings.keyBindings.speedUp.toUpperCase()) {
    increaseSpeed();
    event.preventDefault();
  } else if (key === settings.keyBindings.resetSpeed.toUpperCase()) {
    resetSpeedToDefault();
    event.preventDefault();
  } else if (key === settings.keyBindings.rewind.toUpperCase()) {
    const video = getCurrentVideo();
    if (video) rewindVideo(video);
    event.preventDefault();
  } else if (key === settings.keyBindings.advance.toUpperCase()) {
    const video = getCurrentVideo();
    if (video) advanceVideo(video);
    event.preventDefault();
  } else if (key === settings.keyBindings.toggleControls.toUpperCase()) {
    toggleController();
    event.preventDefault();
  }
}

// 現在再生中のビデオを取得
function getCurrentVideo() {
  const videos = Array.from(document.querySelectorAll('video'));
  return videos.find(video => !video.paused) || videos[0];
}

// フォーム要素かどうかをチェック
function isFormElement(element) {
  if (!element) return false;
  
  const tagName = element.tagName.toLowerCase();
  return tagName === 'input' || 
         tagName === 'textarea' || 
         tagName === 'select' || 
         tagName === 'button' ||
         element.isContentEditable;
}

// ポップアップからのメッセージを処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSpeed') {
    sendResponse({ speed: currentSpeed });
  } else if (message.action === 'setSpeed') {
    currentSpeed = message.speed;
    applySpeedToVideos();
    showController();
    resetAutoHideTimer();
    sendResponse({ success: true });
  }
  return true;
});

// 初期化を実行
init(); 