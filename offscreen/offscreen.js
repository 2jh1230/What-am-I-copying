console.log('🚀 Offscreen Document 로드됨');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 메시지 수신:', message);
  
  if (message.type === 'readClipboard') {
    console.log('📋 클립보드 읽기 시작...');
    
    handleClipboardRead()
      .then(result => {
        console.log('✅ 클립보드 읽기 성공');
        sendResponse(result);
      })
      .catch(error => {
        console.error('❌ 클립보드 읽기 오류:', error);
        sendResponse({ text: null, imageData: null, error: error.message });
      });
    
    return true;
  }
  
  console.log('⚠️ 알 수 없는 메시지 타입:', message.type);
  return false;
});

// 클립보드 읽기 함수 (텍스트 + 이미지)
async function handleClipboardRead() {
  const result = {
    text: null,
    imageData: null
  };
  
  try {
    // Clipboard API로 클립보드 항목 가져오기
    const clipboardItems = await navigator.clipboard.read();
    
    for (const item of clipboardItems) {
      // 이미지 확인
      const imageTypes = item.types.filter(type => type.startsWith('image/'));
      if (imageTypes.length > 0) {
        const blob = await item.getType(imageTypes[0]);
        const reader = new FileReader();
        
        result.imageData = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        
        console.log('🖼️ 이미지 감지됨');
      }
      
      // 텍스트 확인
      if (item.types.includes('text/plain')) {
        const blob = await item.getType('text/plain');
        result.text = await blob.text();
        console.log('📝 텍스트 감지됨');
      }
    }
    
    // 둘 다 없으면 텍스트 읽기 시도
    if (!result.text && !result.imageData) {
      result.text = await navigator.clipboard.readText();
    }
    
  } catch (error) {
    console.log('⚠️ Clipboard API 실패, execCommand 시도:', error);
    
    // Fallback: execCommand 방식으로 텍스트 읽기
    try {
      const textarea = document.createElement('textarea');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      
      textarea.focus();
      document.execCommand('paste');
      result.text = textarea.value;
      
      document.body.removeChild(textarea);
    } catch (err) {
      console.error('❌ execCommand도 실패:', err);
    }
  }
  
  return result;
}

// 주기적으로 연결 확인 (30초마다)
setInterval(() => {
  console.log('💓 Offscreen Document 살아있음');
}, 30000);

console.log('✅ Offscreen Document 준비 완료 - 메시지 대기 중');