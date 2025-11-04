// 마지막으로 확인한 클립보드 내용 (중복 방지)
let lastClipboardContent = '';
let lastClipboardImage = null;
let isOffscreenCreated = false;

// Service Worker 설치 시 초기화
chrome.runtime.onInstalled.addListener(async () => {
  console.log('What_am_I_copying 확장 프로그램이 설치되었습니다.');
  
  // Offscreen Document 생성
  await setupOffscreenDocument();
  
  // 1초마다 클립보드 체크하는 알람 생성
  chrome.alarms.create('checkClipboard', {
    periodInMinutes: 1/60  // 1초 (1/60분)
  });
  
  console.log('⏰ 알람 생성 완료 - 1초마다 체크 시작');
});

// Service Worker 시작 시
chrome.runtime.onStartup.addListener(async () => {
  // 저장된 마지막 내용 복원
  const result = await chrome.storage.local.get({ lastContent: '', lastImageData: null });
  lastClipboardContent = result.lastContent;
  lastClipboardImage = result.lastImageData;
  
  // Offscreen Document 생성
  await setupOffscreenDocument();
  
  // 알람 재생성
  chrome.alarms.create('checkClipboard', {
    periodInMinutes: 1/60
  });
  
  console.log('🔄 Service Worker 재시작 - 클립보드 모니터링 재개');
});

// Offscreen Document 생성 함수
async function setupOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen/offscreen.html')]
  });

  if (existingContexts.length > 0) {
    isOffscreenCreated = true;
    console.log('✅ Offscreen Document 이미 존재함');
    return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['CLIPBOARD'],
      justification: '클립보드 내용을 실시간으로 모니터링하기 위해'
    });
    isOffscreenCreated = true;
    console.log('✅ Offscreen Document 생성 완료');
  } catch (error) {
    console.error('❌ Offscreen Document 생성 오류:', error);
  }
}

// 알람 이벤트 리스너
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkClipboard') {
    await checkClipboard();
  }
});

// 클립보드 체크 함수 (이미지 지원 추가)
async function checkClipboard() {
  if (!isOffscreenCreated) {
    console.log('⚠️ Offscreen 미생성 상태 - 재생성 시도');
    await setupOffscreenDocument();
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'readClipboard'
    }).catch(err => {
      console.log('⚠️ 메시지 전송 실패 - Offscreen 재생성 필요');
      return null;
    });

    if (response) {
      // 텍스트 처리
      if (response.text !== undefined && response.text !== null) {
        const clipboardText = response.text;
        
        if (clipboardText !== lastClipboardContent) {
          console.log('📋 새 텍스트 감지:', clipboardText ? clipboardText.substring(0, 30) + '...' : '(비어있음)');
          lastClipboardContent = clipboardText;
          
          if (clipboardText) {
            await saveToHistory(clipboardText, 'text');
          }
        }
      }
      
      // 이미지 처리
      if (response.imageData) {
        // 이미지 데이터가 변경되었는지 확인
        if (response.imageData !== lastClipboardImage) {
          console.log('🖼️ 새 이미지 감지');
          lastClipboardImage = response.imageData;
          await saveToHistory(response.imageData, 'image');
        }
      }
    } else {
      console.log('⚠️ Offscreen 응답 없음 - 재생성');
      isOffscreenCreated = false;
    }
  } catch (err) {
    console.error('❌ 클립보드 체크 오류:', err);
    isOffscreenCreated = false;
  }
}

// 히스토리에 저장 (텍스트 및 이미지 지원)
async function saveToHistory(content, type) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ history: [] }, (result) => {
      let history = result.history;
      
      // 마지막 항목과 같으면 저장 안 함
      if (history.length > 0) {
        const lastItem = history[0];
        if (type === 'text' && lastItem.type === 'text' && lastItem.text === content) {
          console.log('⏭️ 중복 텍스트 - 저장 건너뜀');
          resolve();
          return;
        }
        if (type === 'image' && lastItem.type === 'image' && lastItem.imageData === content) {
          console.log('⏭️ 중복 이미지 - 저장 건너뜀');
          resolve();
          return;
        }
      }
      
      const id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      
      const newItem = {
        id: id,
        type: type,
        time: new Date().toLocaleString('ko-KR'),
        timestamp: Date.now()
      };
      
      if (type === 'text') {
        newItem.text = content;
      } else if (type === 'image') {
        newItem.imageData = content;
      }
      
      history.unshift(newItem);
      
      // 최대 100개로 제한
      if (history.length > 100) {
        history = history.slice(0, 100);
      }
      
      // 저장
      const storageData = { history: history };
      if (type === 'text') {
        storageData.lastContent = content;
      } else if (type === 'image') {
        storageData.lastImageData = content;
      }
      
      chrome.storage.local.set(storageData, () => {
        console.log('✅ 히스토리 저장 완료:', type);
        resolve();
      });
    });
  });
}