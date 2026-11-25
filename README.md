# NoteWords — Personal Vocabulary & Spaced Repetition (SRS)

Hệ thống thu thập từ vựng cá nhân khi đọc web và ôn tập ngắt quãng (Spaced Repetition — thuật toán **SM-2**), sử dụng **Google Sheets** làm cơ sở dữ liệu miễn phí qua **Google Apps Script**.

---

## Kiến trúc dự án

```text
note-word/
├── backend-gas/       # Google Apps Script (Serverless REST API đọc/ghi Google Sheets)
│   └── Code.gs
├── extension/         # Chrome Extension (Manifest V3, React + Vite + Tailwind CSS)
│   ├── manifest.json
│   └── src/
└── web-app/           # Web App ôn tập Flashcard & quản lý từ vựng (React + Vite + Tailwind CSS)
    └── src/
```

1. **`extension/`**: Bôi đen từ tiếng Anh trên bất kỳ trang web nào để lưu nhanh từ vựng kèm câu ngữ cảnh (context), URL nguồn và tự động dịch nghĩa.
2. **`backend-gas/`**: Triển khai dưới dạng Web App trên Google Apps Script gắn với Google Sheet cá nhân (mặc định lưu vào tab `English`, hỗ trợ mở rộng đa ngôn ngữ).
3. **`web-app/`**: Ứng dụng SPA giúp ôn tập từ đến hạn bằng Flashcard theo thuật toán **SM-2** và quản lý/chỉnh sửa danh sách từ đã lưu.

---

## Hướng dẫn cài đặt & Khởi chạy

### Yêu cầu hệ thống
- **Node.js** >= 18 và **npm**
- Tài khoản Google (Google Sheets + Apps Script)
- Trình duyệt Google Chrome / Chromium (cho Extension)

---

### Bước 1: Thiết lập Backend (`backend-gas/`)

1. Tạo một **Google Sheet** mới trên Google Drive.
2. Trên thanh menu của Google Sheet, chọn **Extensions (Tiện ích mở rộng)** → **Apps Script**.
3. Xóa nội dung mặc định trong file `Code.gs` và dán toàn bộ mã nguồn từ [`backend-gas/Code.gs`](./backend-gas/Code.gs) vào, sau đó nhấn **Save**.
4. Nhấn **Deploy** → **New deployment**:
   - **Select type**: chọn **Web app**
   - **Execute as**: `Me` (Chính tôi)
   - **Who has access**: `Anyone` (Bất kỳ ai — cần thiết để Extension & Web App gọi API không bị chặn CORS/OAuth)
5. Nhấn **Deploy**, cấp quyền truy cập Google Sheet + dịch tự động (`LanguageApp`), và sao chép đường dẫn **Web App URL** (`https://script.google.com/macros/s/.../exec`).

> Tab `English` cùng dòng tiêu đề cột sẽ được tự động khởi tạo ngay trong lần thêm/đọc từ đầu tiên.

---

### Bước 2: Chạy & Deploy Web App (`web-app/`)

```bash
cd web-app
npm install

# Chạy môi trường phát triển (http://localhost:5173)
npm run dev

# Build bản production (xuất ra thư mục web-app/dist)
npm run build
```

- Mở Web App trên trình duyệt → vào trang **Cài đặt (Settings)** → dán **GAS Web App URL** ở Bước 1 và lưu lại.
- **Deploy lên Cloudflare Pages** (tùy chọn):
  ```bash
  cd web-app
  npm run deploy
  ```

---

### Bước 3: Build & Cài đặt Chrome Extension (`extension/`)

```bash
cd extension
npm install
npm run build
```

1. Mở Chrome và truy cập `chrome://extensions/`.
2. Bật chế độ **Developer mode** (Chế độ dành cho nhà phát triển) ở góc trên bên phải.
3. Nhấn **Load unpacked** (Tải tiện ích đã giải nén) và chọn thư mục **`extension/dist`**.
4. Nhấn vào biểu tượng **NoteWords** trên thanh công cụ trình duyệt:
   - Nhập **GAS Web App URL** (`https://script.google.com/macros/s/.../exec`).
   - Nhập **Web App URL** (ví dụ `http://localhost:5173` hoặc domain Cloudflare Pages của bạn).
   - Nhấn **Lưu cài đặt**.

---

## Bảo mật & Quyền riêng tư

- Không có API URL hay thông tin tài khoản nào được hardcode trong mã nguồn.
- Đường dẫn `GAS_WEB_APP_URL` chỉ lưu cục bộ trên trình duyệt của bạn (`localStorage` trên Web App và `chrome.storage.sync` trên Extension).
