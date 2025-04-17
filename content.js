// 設定のデフォルト値
const DEFAULT_SETTINGS = {
  speedStep: 0.1,
  rewindTime: 10,
  advanceTime: 10,
  smallAdvanceTime: 5, // Gキーで進む秒数
  smallRewindTime: 5,  // Eキーで戻る秒数
  resetSpeed: 1.0,
  hideControls: false,
  autoHideDelay: 2000, // コントローラー非表示までの時間（ミリ秒）
  keyBindings: {
    speedDown: 'S',
    speedUp: 'D',
    resetSpeed: 'R',
    rewind: 'Z',
    advance: 'X',
    smallAdvance: 'G',
    smallRewind: 'E',
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
    
    // サイト固有の監視設定
    setupSiteSpecificObservers();
  });
}

// ビデオ要素を監視する
function observeVideoElements() {
  // 既存のビデオ要素を処理
  document.querySelectorAll('video').forEach(attachControllerToVideo);
  
  // 新しく追加されるビデオ要素を監視
  const observer = new MutationObserver((mutations) => {
    let videoFound = false;
    
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === 'VIDEO') {
          attachControllerToVideo(node);
          videoFound = true;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const videos = node.querySelectorAll('video');
          if (videos.length > 0) {
            videos.forEach(attachControllerToVideo);
            videoFound = true;
          }
        }
      });
    });
    
    // YouTubeなどの特定のサイトでは、ビデオ要素が見つからない場合でも
    // DOM構造が変更された可能性があるため、すべてのビデオ要素を再チェック
    if (!videoFound && isVideoSite()) {
      document.querySelectorAll('video').forEach(video => {
        if (!video.hasAttribute('data-speed-controller')) {
          attachControllerToVideo(video);
        } else if (isAmazonSite()) {
          // Amazon Primeの場合は毎回位置を再調整
          repositionController(video);
        }
      });
    }
  });
  
  // より広範囲の変更を監視するための設定
  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'style', 'class']
  });
  
  // YouTubeなどの動的サイトでは、定期的にビデオ要素をチェック
  if (isVideoSite()) {
    setInterval(() => {
      document.querySelectorAll('video').forEach(video => {
        if (!video.hasAttribute('data-speed-controller')) {
          attachControllerToVideo(video);
        } else if (isAmazonSite()) {
          // Amazon Primeの場合は毎回位置を再調整
          repositionController(video);
        }
      });
    }, 2000); // 2秒ごとにチェック
  }
}

// 動画サイトかどうかを判定
function isVideoSite() {
  const hostname = window.location.hostname;
  return hostname.includes('youtube.com') || 
         hostname.includes('netflix.com') || 
         hostname.includes('amazon.com') || 
         hostname.includes('primevideo.com') || 
         hostname.includes('hulu.com') || 
         hostname.includes('disneyplus.com') ||
         hostname.includes('vimeo.com') ||
         hostname.includes('dailymotion.com');
}

// Amazonサイトかどうかを判定
function isAmazonSite() {
  const hostname = window.location.hostname;
  return hostname.includes('amazon.com') || hostname.includes('primevideo.com');
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
  // YouTubeなど特定のサイトでは親要素の構造が複雑なため、より適切なコンテナを探す
  let videoContainer = findSuitableContainer(video);
  
  // コンテナが見つからない場合は、ビデオの親要素を使用
  if (!videoContainer) {
    videoContainer = video.parentElement;
  }
  
  // コンテナのスタイルを設定
  if (videoContainer) {
    // 既に position が設定されていない場合のみ設定
    const containerPosition = window.getComputedStyle(videoContainer).position;
    if (containerPosition === 'static') {
      videoContainer.style.position = 'relative';
    }
    
    videoContainer.appendChild(controller);
  } else {
    // 適切なコンテナが見つからない場合は、ドキュメントのbodyに追加
    // この場合、ビデオの位置に合わせて絶対位置を設定
    document.body.appendChild(controller);
    
    // ビデオの位置に合わせてコントローラーの位置を設定
    const videoRect = video.getBoundingClientRect();
    controller.style.position = 'fixed';
    controller.style.top = `${videoRect.top + 10}px`;
    controller.style.left = `${videoRect.left + 10}px`;
    
    // ビデオのサイズ変更を監視
    const resizeObserver = new ResizeObserver(() => {
      const newRect = video.getBoundingClientRect();
      controller.style.top = `${newRect.top + 10}px`;
      controller.style.left = `${newRect.left + 10}px`;
    });
    
    resizeObserver.observe(video);
  }
  
  // 初期表示設定
  if (settings.hideControls) {
    hideController();
  }
}

// 適切なビデオコンテナを探す関数
function findSuitableContainer(video) {
  const hostname = window.location.hostname;
  
  // Amazon Primeビデオの場合
  if (isAmazonSite()) {
    // 優先度順に複数の候補をチェック
    const amazonPlayerContainers = [
      document.querySelector('.webPlayerContainer'),
      document.querySelector('.webPlayer'),
      document.querySelector('.atvwebplayersdk-overlays-container'),
      document.querySelector('.webPlayerUIContainer'),
      document.querySelector('.cascadesContainer'),
      document.querySelector('.rendererContainer'),
      document.querySelector('.dv-player-fullscreen'),
      document.querySelector('.dv-player-container'),
      document.querySelector('.atvwebplayersdk-hideabletopbar-container'),
      document.querySelector('.av-control-panel-container'),
      document.querySelector('[class*="player"]'), // playerを含むすべてのクラス
      document.querySelector('[class*="Player"]'),
      document.querySelector('[class*="PLAYER"]'),
      document.querySelector('[class*="video"]'),
      document.querySelector('[class*="Video"]')
    ];
    
    // 最初に見つかった有効なコンテナを返す
    for (const container of amazonPlayerContainers) {
      if (container) {
        // position:relativeを確認して設定
        const containerPosition = window.getComputedStyle(container).position;
        if (containerPosition === 'static') {
          container.style.position = 'relative';
        }
        return container;
      }
    }
    
    // ビデオの近くの祖先要素を探す
    let parent = video.parentElement;
    const maxLevels = 7; // 最大7階層まで遡る
    let level = 0;
    
    while (parent && level < maxLevels) {
      // position:relativeを確認して設定
      const parentPosition = window.getComputedStyle(parent).position;
      if (parentPosition === 'static') {
        parent.style.position = 'relative';
      }
      return parent;
      
      parent = parent.parentElement;
      level++;
    }
    
    // 再生中のビデオであれば、とりあえずビデオの親要素を使用
    if (!video.paused && video.parentElement) {
      const parent = video.parentElement;
      // position:relativeを確認して設定
      const parentPosition = window.getComputedStyle(parent).position;
      if (parentPosition === 'static') {
        parent.style.position = 'relative';
      }
      return parent;
    }
    
    // それでも見つからない場合はbodyを使用
    document.body.style.position = 'relative';
    return document.body;
  }
  
  // YouTubeの場合
  if (hostname.includes('youtube.com')) {
    // YouTubeのプレーヤーコンテナを探す
    const playerContainer = document.querySelector('#movie_player');
    if (playerContainer) {
      return playerContainer;
    }
    
    // 別の方法でYouTubeのコンテナを探す
    const ytContainer = video.closest('.html5-video-container');
    if (ytContainer) {
      return ytContainer;
    }
  }
  
  // 一般的なビデオプレーヤーのコンテナを探す
  const playerContainer = video.closest('.video-container, .player-container, .video-player');
  if (playerContainer) {
    return playerContainer;
  }
  
  // ビデオの親要素が適切なコンテナかどうかを判断
  const parent = video.parentElement;
  if (parent && parent !== document.body) {
    // 親要素のサイズがビデオとほぼ同じであれば適切なコンテナと判断
    const videoRect = video.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    
    const widthDiff = Math.abs(videoRect.width - parentRect.width);
    const heightDiff = Math.abs(videoRect.height - parentRect.height);
    
    if (widthDiff < 50 && heightDiff < 50) {
      return parent;
    }
  }
  
  return null;
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

// ビデオを小刻みに巻き戻し（デフォルト5秒）
function smallRewindVideo(video) {
  video.currentTime = Math.max(video.currentTime - settings.smallRewindTime, 0);
  showController();
  resetAutoHideTimer();
}

// ビデオを早送り
function advanceVideo(video) {
  video.currentTime = Math.min(video.currentTime + settings.advanceTime, video.duration);
  showController();
  resetAutoHideTimer();
}

// ビデオを小刻みに早送り（デフォルト5秒）
function smallAdvanceVideo(video) {
  video.currentTime = Math.min(video.currentTime + settings.smallAdvanceTime, video.duration);
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
  } else if (key === settings.keyBindings.smallAdvance.toUpperCase()) {
    const video = getCurrentVideo();
    if (video) smallAdvanceVideo(video);
    event.preventDefault();
  } else if (key === settings.keyBindings.smallRewind.toUpperCase()) {
    const video = getCurrentVideo();
    if (video) smallRewindVideo(video);
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

// サイト固有の監視設定を追加する関数
function setupSiteSpecificObservers() {
  const hostname = window.location.hostname;
  
  // Amazon Primeビデオの場合
  if (hostname.includes('amazon.com') || hostname.includes('primevideo.com')) {
    setupAmazonPrimeObserver();
  }
}

// Amazon Primeビデオ用の特別な監視設定
function setupAmazonPrimeObserver() {
  console.debug('Setting up Amazon Prime Video observer');
  
  // プレイヤーの状態変化を監視（全画面切り替えや再生/一時停止など）
  const playerObserver = new MutationObserver((mutations) => {
    // 変更があった場合、既存のビデオ要素を再チェック
    document.querySelectorAll('video').forEach(video => {
      if (!video.hasAttribute('data-speed-controller')) {
        attachControllerToVideo(video);
      } else {
        // コントローラーが既に付いているが、非表示になっている可能性があるので位置を再調整
        repositionController(video);
      }
    });
  });
  
  // プレイヤーコンテナを監視（クラス名のバリエーションを増やす）
  const playerContainerSelectors = [
    '.webPlayerContainer', 
    '.webPlayer', 
    '.atvwebplayersdk-overlays-container', 
    '.webPlayerSDKContainer',
    '.dv-player-fullscreen',
    '.dv-player-container',
    '.atvwebplayersdk-hideabletopbar-container',
    '.av-control-panel-container',
    '[class*="player"]',
    '[class*="Player"]',
    '[class*="video"]',
    '[class*="Video"]'
  ];
  
  playerContainerSelectors.forEach(selector => {
    const containers = document.querySelectorAll(selector);
    containers.forEach(container => {
      if (container) {
        playerObserver.observe(container, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ['class', 'style', 'data-automation-id', 'data-focus-id', 'aria-hidden']
        });
      }
    });
  });
  
  // ドキュメント全体の変更も監視
  playerObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true
  });
  
  // ウィンドウのリサイズイベント監視
  window.addEventListener('resize', () => {
    const videos = document.querySelectorAll('video');
    if (videos.length > 0) {
      videos.forEach(video => {
        if (video.hasAttribute('data-speed-controller')) {
          repositionController(video);
        }
      });
    }
  });
  
  // フルスクリーン変更イベント監視
  document.addEventListener('fullscreenchange', () => {
    setTimeout(() => {
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        if (video.hasAttribute('data-speed-controller')) {
          repositionController(video);
        } else {
          attachControllerToVideo(video);
        }
      });
    }, 500); // フルスクリーン切替後に少し遅延を入れる
  });
  
  // ビデオ要素の存在確認と再接続をより頻繁に行う
  const checkInterval = setInterval(() => {
    try {
      const videos = document.querySelectorAll('video');
      
      if (videos.length > 0) {
        videos.forEach(video => {
          if (!video.hasAttribute('data-speed-controller')) {
            attachControllerToVideo(video);
          } else {
            // 既存のコントローラーの位置を毎回再調整
            repositionController(video);
          }
        });
      } else {
        // ビデオが見つからない場合の対策
        playerContainerSelectors.forEach(selector => {
          const containers = document.querySelectorAll(selector);
          containers.forEach(container => {
            if (container) {
              const hiddenVideos = container.querySelectorAll('video');
              hiddenVideos.forEach(video => {
                if (!video.hasAttribute('data-speed-controller')) {
                  attachControllerToVideo(video);
                }
              });
            }
          });
        });
        
        // shadowDOMの内部もチェック
        checkShadowRootsForVideos(document.body);
      }
      
      // コントローラーの状態チェック
      checkControllerState();
      
    } catch (e) {
      console.debug('Amazon Prime Video controller check error:', e);
    }
  }, 500); // 0.5秒ごとにチェック(より頻繁に)
  
  // ページを離れるときにインターバルをクリア
  window.addEventListener('beforeunload', () => {
    clearInterval(checkInterval);
  });
}

// コントローラーの状態をチェックする関数
function checkControllerState() {
  if (!controller) return;
  
  // DOMから切り離されている場合
  if (!controller.isConnected) {
    const currentVideo = getCurrentVideo();
    if (currentVideo) {
      console.debug('Controller disconnected, recreating...');
      createController(currentVideo);
    }
    return;
  }
  
  // 表示されていない場合
  if (controlsVisible === false && !settings.hideControls) {
    console.debug('Controller hidden, showing...');
    showController();
    return;
  }
  
  // スタイルが上書きされている場合
  const computedStyle = window.getComputedStyle(controller);
  if (computedStyle.display === 'none' || 
      computedStyle.visibility === 'hidden' || 
      computedStyle.opacity === '0') {
    console.debug('Controller style overridden, fixing...');
    controller.style.display = 'inline-block';
    controller.style.visibility = 'visible';
    controller.style.opacity = '1';
    return;
  }
  
  // z-indexが低すぎる場合
  if (parseInt(computedStyle.zIndex) < 9999999) {
    console.debug('Controller z-index too low, fixing...');
    controller.style.zIndex = '9999999';
  }
  
  // コントローラーのサイズや位置がおかしい場合（見えない、画面外など）のフォールバック
  const rect = controller.getBoundingClientRect();
  const outOfView = rect.width === 0 || rect.height === 0 ||
                    rect.bottom < 0 || rect.top > window.innerHeight ||
                    rect.right < 0 || rect.left > window.innerWidth;

  if (outOfView) {
    console.debug('Controller out of view, reattaching to body');
    const currentVideo = getCurrentVideo();
    if (controller.parentElement !== document.body) {
      document.body.appendChild(controller);
    }
    // body 固定位置に再配置
    controller.style.position = 'fixed';
    controller.style.top = '10px';
    controller.style.left = '10px';
    controller.style.transform = 'none';
    controller.style.zIndex = '9999999';
    // もし currentVideo が存在すれば、body の position を relative に
    if (currentVideo) {
      document.body.style.position = 'relative';
    }
  }
}

// shadow DOM内のビデオ要素をチェックする関数
function checkShadowRootsForVideos(root) {
  // shadow rootを持つ要素を検索
  const elementsWithShadow = root.querySelectorAll('*');
  
  elementsWithShadow.forEach(element => {
    try {
      // shadow rootをチェック
      if (element.shadowRoot) {
        // shadow root内のビデオ要素を検索
        const shadowVideos = element.shadowRoot.querySelectorAll('video');
        shadowVideos.forEach(video => {
          if (!video.hasAttribute('data-speed-controller')) {
            attachControllerToVideo(video);
          }
        });
        
        // さらに深いshadow rootも再帰的にチェック
        checkShadowRootsForVideos(element.shadowRoot);
      }
    } catch (e) {
      // セキュリティの制限でエラーが発生する可能性がある
      console.debug('Shadow DOM access error:', e);
    }
  });
}

// コントローラーの位置を再調整する関数
function repositionController(video) {
  // コントローラー要素を取得
  if (!controller) return;

  // 適切なコンテナを探す
  const container = findSuitableContainer(video);
  
  if (container) {
    // コントローラーの親要素とコンテナが異なる場合、再配置
    if (controller.parentElement !== container) {
      container.appendChild(controller);
    }
    
    // コントローラーがAmazonのプレーヤーUI上に表示されるよう、z-indexを最大に
    controller.style.zIndex = '2147483647';
    
    // Amazon特有の設定（一部のビデオでは左上が隠れることがあるため、位置を中央上部に変更）
    const hostname = window.location.hostname;
    if (hostname.includes('amazon.com') || hostname.includes('primevideo.com')) {
      controller.style.top = '10px';
      controller.style.left = '10px';
      controller.style.transform = 'none';
    }
  } else {
    // コンテナが見つからない場合は、ビデオの位置に合わせて絶対位置を設定
    if (controller.parentElement !== document.body) {
      document.body.appendChild(controller);
    }
    
    const videoRect = video.getBoundingClientRect();
    controller.style.position = 'fixed';
    controller.style.top = `${videoRect.top + 10}px`;
    controller.style.left = `${videoRect.left + 10}px`;
    controller.style.transform = 'none';
  }
  
  // コントローラーが非表示の場合は表示する
  if (controller.classList.contains('hidden') && !settings.hideControls) {
    controller.classList.remove('hidden');
    controlsVisible = true;
  }
}

// 初期化を実行
init(); 