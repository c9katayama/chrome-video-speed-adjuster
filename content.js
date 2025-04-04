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
        }
      });
    }, 3000); // 3秒ごとにチェック
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
  if (hostname.includes('amazon.com') || hostname.includes('primevideo.com')) {
    // 優先度順に複数の候補をチェック
    const amazonPlayerContainers = [
      document.querySelector('.webPlayerContainer'),
      document.querySelector('.webPlayer'),
      document.querySelector('.atvwebplayersdk-overlays-container'),
      document.querySelector('.webPlayerUIContainer'),
      document.querySelector('.cascadesContainer'),
      document.querySelector('.rendererContainer'),
      document.querySelector('.dv-player-fullscreen')
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
    const maxLevels = 5; // 最大5階層まで遡る
    let level = 0;
    
    while (parent && level < maxLevels) {
      // Amazon特有のクラス名を持つ要素をチェック
      if (parent.classList && 
          (parent.classList.contains('webPlayer') || 
           parent.classList.contains('webPlayerContainer') || 
           parent.classList.contains('atvwebplayersdk-overlays-container') ||
           parent.classList.contains('webPlayerUIContainer') ||
           parent.classList.contains('dv-player-fullscreen'))) {
        // position:relativeを確認して設定
        const parentPosition = window.getComputedStyle(parent).position;
        if (parentPosition === 'static') {
          parent.style.position = 'relative';
        }
        return parent;
      }
      
      parent = parent.parentElement;
      level++;
    }
    
    // ビデオが十分大きければ、そのビデオの直上の要素を選択
    if (video.videoWidth > 400 && video.videoHeight > 200) {
      const parent = video.parentElement;
      if (parent) {
        // position:relativeを確認して設定
        const parentPosition = window.getComputedStyle(parent).position;
        if (parentPosition === 'static') {
          parent.style.position = 'relative';
        }
        return parent;
      }
    }
    
    // 再生中のビデオであれば、document.bodyに追加するが位置を調整
    if (!video.paused) {
      const videoRect = video.getBoundingClientRect();
      
      // ビデオが画面に表示されている場合、bodyに対して絶対位置で表示
      if (videoRect.width > 0 && videoRect.height > 0 && 
          videoRect.top < window.innerHeight && videoRect.left < window.innerWidth) {
        document.body.style.position = 'relative';
        return document.body;
      }
    }
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
  
  // プレイヤーコンテナを監視
  const playerContainers = document.querySelectorAll('.webPlayerContainer, .webPlayer, .atvwebplayersdk-overlays-container, .webPlayerSDKContainer');
  playerContainers.forEach(container => {
    if (container) {
      playerObserver.observe(container, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['class', 'style', 'data-automation-id', 'data-focus-id']
      });
    }
  });
  
  // ドキュメント全体の変更も監視（特にAmazonではフルスクリーン切り替え時に構造が大きく変わる）
  playerObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: false
  });
  
  // ビデオ要素の存在確認と再接続を定期的に行う
  // Amazonではビデオ切り替え時やシーン変更時にDOM構造が変わることがある
  setInterval(() => {
    try {
      const videos = document.querySelectorAll('video');
      
      if (videos.length > 0) {
        videos.forEach(video => {
          if (!video.hasAttribute('data-speed-controller')) {
            attachControllerToVideo(video);
          } else {
            // コントローラーが既に付いているが、見えなくなっている可能性があるので位置を再調整
            repositionController(video);
          }
        });
      } else {
        // ビデオが見つからない場合、特定のAmazonのコンテナ内を深く探す
        const containers = document.querySelectorAll('.webPlayerContainer, .webPlayer, .atvwebplayersdk-overlays-container, .webPlayerSDKContainer');
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
        
        // shadowDOMの内部もチェック（一部のAmazonビデオ再生プレーヤーはshadow DOMを使用）
        checkShadowRootsForVideos(document.body);
      }
      
      // コントローラーが存在する場合は表示状態を確認
      if (controller && !controller.isConnected) {
        // DOMから切り離されている場合は、現在のビデオに再接続を試みる
        const currentVideo = getCurrentVideo();
        if (currentVideo) {
          createController(currentVideo);
        }
      } else if (controller && !controlsVisible && !settings.hideControls) {
        // 表示されていない場合は表示する
        showController();
      }
    } catch (e) {
      console.debug('Amazon Prime Video controller check error:', e);
    }
  }, 1000); // 1秒ごとにチェック
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