export const CONTENT_COPY = {
  vi: {
    saveBtn: '+ Lưu từ',
    saving: 'Đang lưu…',
    speakTitle: 'Phát âm từ',
    connErr: (msg) => `Lỗi kết nối Extension: ${msg}`,
    noResp: 'Không nhận được phản hồi từ background.',
    duplicate: (w) => `Từ "${w}" đã tồn tại trong sổ từ.`,
    saved: (w, m) => `Đã lưu "${w}"${m}`,
    missingUrl:
      'Chưa cấu hình GAS_WEB_APP_URL. Hãy mở cài đặt trong popup NoteWords để nhập link.',
    saveFailed: 'Không thể lưu từ. Vui lòng thử lại.',
    sendErr: (msg) => `Lỗi gửi dữ liệu: ${msg}`,
  },
  en: {
    saveBtn: '+ Save word',
    saving: 'Saving…',
    speakTitle: 'Pronounce word',
    connErr: (msg) => `Extension connection error: ${msg}`,
    noResp: 'No response received from background service.',
    duplicate: (w) => `"${w}" is already in your vocabulary list.`,
    saved: (w, m) => `Saved "${w}"${m}`,
    missingUrl:
      'GAS_WEB_APP_URL is not set. Open NoteWords popup settings to add your link.',
    saveFailed: 'Failed to save word. Please try again.',
    sendErr: (msg) => `Failed to send data: ${msg}`,
  },
};

export function getContentCopy(uiLang = 'vi') {
  return CONTENT_COPY[uiLang] || CONTENT_COPY.vi;
}
