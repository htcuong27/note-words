export const POPUP_I18N = {
  vi: {
    subtitle: 'Lưu & ôn tập từ vựng thông minh',
    wordsHeading: 'Từ cần học',
    dueCountAria: (n) => `${n} từ đang cần học`,
    showMeaning: 'Hiện nghĩa',
    hideMeaning: 'Ẩn nghĩa',
    refreshAria: 'Làm mới danh sách từ cần học',
    openSettingsAria: 'Mở cài đặt liên kết',
    backToWords: 'Quay lại từ cần học',
    langGroupAria: 'Chọn ngôn ngữ giao diện',
    unconfiguredTitle: 'Chưa kết nối Google Sheets',
    unconfiguredDesc:
      'Hãy điền đường dẫn Web App trong phần Cài đặt để đồng bộ và xem các từ cần học hôm nay.',
    goToSettings: 'Mở Cài đặt liên kết',
    loadingWords: 'Đang tải danh sách từ cần học…',
    retry: 'Thử lại',
    allCaughtUpTitle: 'Tuyệt vời! Đã học hết từ hôm nay',
    allCaughtUpDesc:
      'Hiện không còn từ nào đến hạn ôn tập. Hãy bôi đen từ mới khi đọc web để lưu thêm.',
    newBadge: 'Mới',
    repBadge: (r) => `Lần ${r}`,
    tapToReveal: 'Chạm để xem nghĩa',
    noMeaning: 'Chưa có nghĩa',
    openWebApp: 'Mở Web App ôn tập',
    openWebAppWithCount: (n) => `Ôn tập ngay (${n} từ)`,
    settingsTitle: 'Cài đặt kết nối',
    statusReady: 'Đã kết nối',
    statusMissing: 'Chưa cấu hình',
    gasLabel: 'Link Google Apps Script (API)',
    gasHint: 'URL Web App đã deploy từ Google Apps Script',
    gasError: 'Vui lòng nhập URL hợp lệ bắt đầu bằng https://',
    gasRequired: 'Vui lòng nhập đường dẫn Google Apps Script.',
    uiLangLabel: 'Ngôn ngữ hiển thị',
    saveBtn: 'Lưu cài đặt',
    savedSuccess: 'Đã lưu cài đặt thành công!',
    loadSettingsErr: (m) => `Không thể đọc cài đặt: ${m}`,
    saveSettingsErr: (m) => `Lỗi lưu cài đặt: ${m}`,
    fetchErr: (m) => `Không thể tải từ cần học: ${m}`,
    fetch404Hint:
      'HTTP 404 — Kiểm tra lại Link Google Apps Script trong Cài đặt (phải có dạng https://script.google.com/macros/s/.../exec và bản deploy vẫn đang hoạt động).',
    pronounceAria: (w) => `Phát âm từ ${w}`,
    stressBadge: (n) => `Trọng âm ${n}`,
    cachedJustNow: 'Vừa cập nhật',
    cachedMinutesAgo: (m) => `Cập nhật ${m} phút trước`,
  },
  en: {
    subtitle: 'Smart vocabulary capture & SRS',
    wordsHeading: 'Words to Learn',
    dueCountAria: (n) => `${n} words due for review`,
    showMeaning: 'Show meaning',
    hideMeaning: 'Hide meaning',
    refreshAria: 'Refresh due words list',
    openSettingsAria: 'Open link settings',
    backToWords: 'Back to words',
    langGroupAria: 'Select interface language',
    unconfiguredTitle: 'Google Sheets Not Connected',
    unconfiguredDesc:
      'Add your Web App link in Settings to sync and view words due for review today.',
    goToSettings: 'Open Link Settings',
    loadingWords: 'Loading words to learn…',
    retry: 'Retry',
    allCaughtUpTitle: 'All caught up for today!',
    allCaughtUpDesc:
      'No words are currently due for review. Highlight new words while browsing to save them.',
    newBadge: 'New',
    repBadge: (r) => `Rep ${r}`,
    tapToReveal: 'Tap to reveal meaning',
    noMeaning: 'No meaning yet',
    openWebApp: 'Open Review Web App',
    openWebAppWithCount: (n) => `Start Review (${n} due)`,
    settingsTitle: 'Connection Settings',
    statusReady: 'Connected',
    statusMissing: 'Not set',
    gasLabel: 'Google Apps Script Link (API)',
    gasHint: 'Deployed Web App URL from Google Apps Script',
    gasError: 'Please enter a valid URL starting with https://',
    gasRequired: 'Please enter your Google Apps Script URL.',
    uiLangLabel: 'Display Language',
    saveBtn: 'Save Settings',
    savedSuccess: 'Settings saved successfully!',
    loadSettingsErr: (m) => `Could not load settings: ${m}`,
    saveSettingsErr: (m) => `Failed to save settings: ${m}`,
    fetchErr: (m) => `Could not load due words: ${m}`,
    fetch404Hint:
      'HTTP 404 — Check your Google Apps Script URL in Settings (must look like https://script.google.com/macros/s/.../exec and be an active deployment).',
    pronounceAria: (w) => `Pronounce ${w}`,
    stressBadge: (n) => `Stress ${n}`,
    cachedJustNow: 'Updated just now',
    cachedMinutesAgo: (m) => `Updated ${m}m ago`,
  },
};

export function getPopupTranslations(uiLang = 'vi') {
  return POPUP_I18N[uiLang] || POPUP_I18N.vi;
}

export function formatCacheTime(updatedAt, copy) {
  if (!updatedAt) return '';
  const diffMin = Math.floor((Date.now() - Number(updatedAt)) / 60000);
  if (diffMin < 1) return copy.cachedJustNow;
  return copy.cachedMinutesAgo(diffMin);
}
