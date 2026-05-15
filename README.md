# 🌟 Lou Language Converter — ภาษาลู

แปลงภาษาไทยเป็น **ภาษาลู** อัตโนมัติ — ทำให้ทุก 1 พยางค์กลายเป็น 2 พยางค์

**[▶ ลองใช้งาน Live Demo](https://your-username.github.io/lou-language/)**

---

## ✨ Features

- ⚡ แปลงทันที — ไม่ใช้ AI ไม่ใช้ API ทำงานใน Browser ล้วน
- 📖 แสดงการแบ่งพยางค์ (debug mode)
- 🔄 Real-time mode — แปลงขณะพิมพ์
- 📋 คัดลอกผลลัพธ์ได้ทันที
- 📱 Responsive — ใช้งานได้บนมือถือ

---

## 📐 กฎภาษาลู

| กฎ | เงื่อนไข | วิธีแปลง | ตัวอย่าง |
|---|---|---|---|
| 1 | คำทั่วไป | ใช้ ล นำหน้า | มาก → ลากมูก |
| 2 | ขึ้นต้น ร/ล | ใช้ ซ นำหน้า | รัก → ซักรุก |
| 3 | สระ อุ/อู | ใช้ หล นำหน้า + เปลี่ยน อู→อี | ดู → ลูดู |
| 4 | ร/ล + อุ/อู | ใช้ ซ นำหน้า + เปลี่ยน อู→อี | รู้ → ซู้รี้ |

---

## 🚀 Deploy บน GitHub Pages

### วิธีที่ 1 — GitHub Actions (อัตโนมัติ)

1. Fork หรือ push repo นี้ขึ้น GitHub
2. ไปที่ **Settings → Pages**
3. เลือก Source: **GitHub Actions**
4. Push ไปที่ branch `main` — GitHub จะ deploy ให้อัตโนมัติ

### วิธีที่ 2 — Manual

1. Push repo ขึ้น GitHub
2. ไปที่ **Settings → Pages**
3. เลือก Source: **Deploy from a branch**
4. เลือก branch `main` / folder `/ (root)`
5. Save — รอสักครู่แล้วเข้า `https://your-username.github.io/repo-name/`

---

## 📁 โครงสร้างไฟล์

```
lou-language/
├── index.html              # หน้าหลัก
├── css/
│   └── style.css           # Neon Thai street aesthetic
├── js/
│   ├── lou-engine.js       # ตัว Engine แปลงภาษาลู (pure logic)
│   └── app.js              # UI controller
└── .github/
    └── workflows/
        └── deploy.yml      # Auto-deploy to GitHub Pages
```

---

## 🛠️ Run Locally

ไม่ต้องติดตั้งอะไรเพิ่ม — เปิดไฟล์ `index.html` ใน browser ได้เลย

หรือใช้ local server:

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

---

## 📝 License

MIT — ใช้ ดัดแปลง แจกจ่ายได้อิสระ