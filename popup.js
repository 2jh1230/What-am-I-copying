// DOM 요소
const currentDiv = document.getElementById('current');
const historyDiv = document.getElementById('history');
const clearBtn = document.getElementById('clearBtn');
const refreshBtn = document.getElementById('refreshBtn');
const toast = document.getElementById('toast');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');
const confirmDialog = document.getElementById('confirmDialog');
const confirmCancel = document.getElementById('confirmCancel');
const confirmOk = document.getElementById('confirmOk');

// 현재 클립보드 데이터 저장
let currentClipboardData = null;

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentClipboard();
  await loadHistory();
  
  // 이벤트 리스너 등록
  clearBtn.addEventListener('click', handleClearAll);
  refreshBtn.addEventListener('click', handleRefresh);
  modalClose.addEventListener('click', closeModal);
  confirmCancel.addEventListener('click', closeConfirmDialog);
  confirmOk.addEventListener('click', confirmClearAll);
  
  // 현재 클립보드 클릭 시 확대
  currentDiv.addEventListener('click', (e) => {
    // 확대 버튼 클릭이 아니고, 비어있지 않은 경우에만
    if (!e.target.classList.contains('current-expand-btn') && 
        !currentDiv.classList.contains('empty') && 
        currentClipboardData) {
      expandCurrentClipboard();
    }
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  confirmDialog.addEventListener('click', (e) => {
    if (e.target === confirmDialog) closeConfirmDialog();
  });
  
  // Ctrl+A 이벤트 리스너
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'a') {
      const target = e.target;
      
      // 현재 클립보드 영역
      if (target.id === 'current' && !currentDiv.classList.contains('empty')) {
        e.preventDefault();
        selectElementText(currentDiv);
      }
      // 히스토리 아이템의 텍스트 영역
      else if (target.classList.contains('history-content')) {
        e.preventDefault();
        selectElementText(target);
      }
      // 모달 텍스트
      else if (target.classList.contains('modal-text')) {
        e.preventDefault();
        selectElementText(target);
      }
    }
  });
  
  // Storage 변경 감지 리스너
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes.history) {
        console.log('📋 히스토리 변경 감지 - 자동 업데이트');
        loadHistory();
      }
      
      // 클립보드 변경 시 즉시 업데이트
      if (changes.lastContent || changes.lastImageData) {
        console.log('📋 클립보드 변경 감지 - 즉시 업데이트');
        updateFromStorage();
      }
    }
  });
  
  // 1초마다 클립보드 확인 (폴링)
  setInterval(() => {
    loadCurrentClipboard();
  }, 1000);
});

// Storage에서 현재 클립보드 업데이트
function updateFromStorage() {
  chrome.storage.local.get({ history: [] }, (result) => {
    const history = result.history;
    if (history.length > 0) {
      const latestItem = history[0];
      updateCurrentDisplay(latestItem);
    }
  });
}

// 텍스트 전체 선택 함수
function selectElementText(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

// 모달 닫기
function closeModal() {
  modal.classList.remove('show');
  modalBody.innerHTML = '';
}

// 현재 클립보드 확대 보기
function expandCurrentClipboard() {
  if (!currentClipboardData) return;
  
  modalBody.innerHTML = '';
  
  if (currentClipboardData.type === 'text') {
    const textDiv = document.createElement('div');
    textDiv.className = 'modal-text';
    textDiv.textContent = currentClipboardData.text;
    textDiv.tabIndex = 0;
    
    modalBody.appendChild(textDiv);
    
    // 포커스 설정 (Ctrl+A를 위해)
    setTimeout(() => textDiv.focus(), 100);
    
  } else if (currentClipboardData.type === 'image') {
    const img = document.createElement('img');
    img.src = currentClipboardData.imageData;
    img.className = 'modal-image';
    img.alt = 'Expanded Image';
    modalBody.appendChild(img);
  }
  
  modal.classList.add('show');
}

// 현재 클립보드 표시 업데이트
function updateCurrentDisplay(item) {
  currentDiv.innerHTML = '';
  
  if (!item) {
    currentDiv.textContent = '클립보드가 비어있습니다';
    currentDiv.classList.add('empty');
    currentClipboardData = null;
    // 탭 인덱스 제거
    currentDiv.removeAttribute('tabindex');
    return;
  }
  
  currentDiv.classList.remove('empty');
  currentClipboardData = item;
  // 탭 인덱스 추가 (Ctrl+A를 위해)
  currentDiv.setAttribute('tabindex', '0');
  
  if (item.type === 'text') {
    // 텍스트 내용 표시
    const textSpan = document.createElement('span');
    textSpan.textContent = item.text;
    currentDiv.appendChild(textSpan);
    
    // 확대 버튼 추가
    const expandBtn = document.createElement('button');
    expandBtn.className = 'current-expand-btn';
    expandBtn.innerHTML = '⤢';
    expandBtn.title = '확대 보기';
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      expandCurrentClipboard();
    });
    currentDiv.appendChild(expandBtn);
    
  } else if (item.type === 'image') {
    const img = document.createElement('img');
    img.src = item.imageData;
    img.alt = 'Clipboard Image';
    currentDiv.appendChild(img);
    
    // 이미지용 확대 버튼 추가
    const expandBtn = document.createElement('button');
    expandBtn.className = 'current-expand-btn';
    expandBtn.innerHTML = '⤢';
    expandBtn.title = '확대 보기';
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      expandCurrentClipboard();
    });
    currentDiv.appendChild(expandBtn);
  }
}

// 현재 클립보드 내용 로드
async function loadCurrentClipboard() {
  try {
    const clipboardItems = await navigator.clipboard.read();
    let foundContent = false;
    
    for (const item of clipboardItems) {
      // 텍스트 먼저 확인 (우선순위 변경)
      if (item.types.includes('text/plain')) {
        const blob = await item.getType('text/plain');
        const text = await blob.text();
        
        if (text && text.trim()) {
          updateCurrentDisplay({ type: 'text', text });
          await saveToHistory(text, 'text');
          foundContent = true;
          return;
        }
      }
      
      // 텍스트가 없으면 이미지 확인
      const imageTypes = item.types.filter(type => type.startsWith('image/'));
      if (imageTypes.length > 0) {
        const blob = await item.getType(imageTypes[0]);
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          const imageData = reader.result;
          updateCurrentDisplay({ type: 'image', imageData });
          await saveToHistory(imageData, 'image');
        };
        
        reader.readAsDataURL(blob);
        foundContent = true;
        return;
      }
    }
    
    // 아무것도 없으면
    if (!foundContent) {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        updateCurrentDisplay({ type: 'text', text });
        await saveToHistory(text, 'text');
      } else {
        updateCurrentDisplay(null);
      }
    }
    
  } catch (err) {
    console.error('클립보드 읽기 오류:', err);
    updateCurrentDisplay(null);
  }
}

// 히스토리에 저장 (중복 체크)
async function saveToHistory(content, type) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ history: [] }, (result) => {
      let history = result.history;
      
      // 마지막 항목과 같으면 저장 안 함
      if (history.length > 0) {
        const lastItem = history[0];
        if (type === 'text' && lastItem.type === 'text' && lastItem.text === content) {
          resolve();
          return;
        }
        if (type === 'image' && lastItem.type === 'image' && lastItem.imageData === content) {
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
      
      if (history.length > 100) {
        history = history.slice(0, 100);
      }
      
      const storageData = { history: history };
      if (type === 'text') {
        storageData.lastContent = content;
      } else if (type === 'image') {
        storageData.lastImageData = content;
      }
      
      chrome.storage.local.set(storageData, () => {
        resolve();
      });
    });
  });
}

// 히스토리 로드
async function loadHistory() {
  chrome.storage.local.get({ history: [] }, (result) => {
    const history = result.history;
    displayHistory(history);
  });
}

// 히스토리 화면에 표시
function displayHistory(history) {
  historyDiv.innerHTML = '';
  
  if (history.length === 0) {
    historyDiv.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">아직 복사 기록이 없습니다</div>
      </div>
    `;
    return;
  }
  
  history.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'history-item';
    itemDiv.dataset.id = item.id;
    
    let contentHtml = '';
    let saveButton = '';
    
    if (item.type === 'text') {
      const previewText = item.text.length > 150 
        ? item.text.substring(0, 150) + '...' 
        : item.text;
      
      contentHtml = `
        <div class="content-wrapper">
          <div class="history-content" data-id="${item.id}" data-type="text" tabindex="0">${escapeHtml(previewText)}</div>
          <button class="expand-icon" data-id="${item.id}" data-type="text" title="확대 보기"></button>
        </div>
      `;
      saveButton = `<button class="btn-small btn-save" data-id="${item.id}" data-type="text">💾 .txt</button>`;
      
    } else if (item.type === 'image') {
      contentHtml = `
        <div class="content-wrapper">
          <div class="history-content image-content" data-id="${item.id}" data-type="image">
            <img src="${item.imageData}" alt="Clipboard Image">
          </div>
          <button class="expand-icon" data-id="${item.id}" data-type="image" title="확대 보기"></button>
        </div>
      `;
      saveButton = `<button class="btn-small btn-save" data-id="${item.id}" data-type="image">💾 .png</button>`;
    }
    
    itemDiv.innerHTML = `
      ${contentHtml}
      <div class="history-footer">
        <span class="history-time">${item.time}</span>
        <div class="history-actions">
          <button class="btn-small btn-copy" data-id="${item.id}">📋 복사</button>
          ${saveButton}
          <button class="btn-small btn-delete" data-id="${item.id}">🗑️ 삭제</button>
        </div>
      </div>
    `;
    
    historyDiv.appendChild(itemDiv);
  });
  
  // 확대 버튼 이벤트
  document.querySelectorAll('.expand-icon').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = e.target.dataset.id;
      const type = e.target.dataset.type;
      handleExpand(id, type);
    });
  });
  
  // 복사 버튼 이벤트
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      handleCopy(id);
    });
  });
  
  // 저장 버튼 이벤트
  document.querySelectorAll('.btn-save').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const type = e.target.dataset.type;
      handleSave(id, type);
    });
  });
  
  // 삭제 버튼 이벤트
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      handleDelete(id);
    });
  });
}

// 확대 보기
function handleExpand(id, type) {
  chrome.storage.local.get({ history: [] }, (result) => {
    const history = result.history;
    const item = history.find(h => h.id === id);
    
    if (item) {
      modalBody.innerHTML = '';
      
      if (type === 'text') {
        const textDiv = document.createElement('div');
        textDiv.className = 'modal-text';
        textDiv.textContent = item.text;
        textDiv.tabIndex = 0;
        
        modalBody.appendChild(textDiv);
        
        // 포커스 설정 (Ctrl+A를 위해)
        setTimeout(() => textDiv.focus(), 100);
        
      } else if (type === 'image') {
        const img = document.createElement('img');
        img.src = item.imageData;
        img.className = 'modal-image';
        img.alt = 'Expanded Image';
        modalBody.appendChild(img);
      }
      
      modal.classList.add('show');
    }
  });
}

// 특정 항목 클립보드에 복사
async function handleCopy(id) {
  chrome.storage.local.get({ history: [] }, async (result) => {
    const history = result.history;
    const item = history.find(h => h.id === id);
    
    if (item) {
      try {
        if (item.type === 'text') {
          await navigator.clipboard.writeText(item.text);
          showToast('✅ 텍스트가 클립보드에 복사되었습니다!');
          updateCurrentDisplay(item);
          
        } else if (item.type === 'image') {
          // base64를 blob으로 변환
          const response = await fetch(item.imageData);
          const blob = await response.blob();
          
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob })
          ]);
          
          showToast('✅ 이미지가 클립보드에 복사되었습니다!');
          updateCurrentDisplay(item);
        }
        
      } catch (err) {
        showToast('❌ 복사 실패', 'error');
        console.error('복사 오류:', err);
      }
    }
  });
}

// 파일로 저장
function handleSave(id, type) {
  chrome.storage.local.get({ history: [] }, (result) => {
    const history = result.history;
    const item = history.find(h => h.id === id);
    
    if (item) {
      if (type === 'text') {
        // 텍스트 파일로 저장
        const blob = new Blob([item.text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clipboard_${item.timestamp}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('💾 텍스트 파일이 저장되었습니다!');
        
      } else if (type === 'image') {
        // 이미지 파일로 저장
        const a = document.createElement('a');
        a.href = item.imageData;
        a.download = `clipboard_${item.timestamp}.png`;
        a.click();
        showToast('💾 이미지 파일이 저장되었습니다!');
      }
    }
  });
}

// 특정 항목 삭제
function handleDelete(id) {
  chrome.storage.local.get({ history: [] }, (result) => {
    let history = result.history;
    history = history.filter(h => h.id !== id);
    
    chrome.storage.local.set({ history: history }, () => {
      showToast('🗑️ 삭제되었습니다');
    });
  });
}

// 확인 대화상자 닫기
function closeConfirmDialog() {
  confirmDialog.classList.remove('show');
}

// 전체 삭제 (대화상자 표시)
function handleClearAll() {
  confirmDialog.classList.add('show');
}

// 전체 삭제 확인
function confirmClearAll() {
  chrome.storage.local.set({ history: [] }, () => {
    showToast('🗑️ 모든 히스토리가 삭제되었습니다');
    closeConfirmDialog();
  });
}

// 새로고침
async function handleRefresh() {
  await loadCurrentClipboard();
  await loadHistory();
  showToast('🔄 새로고침 완료');
}

// 토스트 메시지 표시
function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.style.background = type === 'error' ? '#dc3545' : '#28a745';
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// HTML 이스케이프 (XSS 방지)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}