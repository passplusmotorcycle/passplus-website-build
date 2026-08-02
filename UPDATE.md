# 以後點樣更新／公開網站

## 本機預覽

第一次設定（只做一次）：

```powershell
cd $HOME\Desktop
git clone https://github.com/passplusmotorcycle/passplus-website-build.git
cd passplus-website-build
npm install
```

之後每次想睇最新改動：

```powershell
cd $HOME\Desktop\passplus-website-build
git pull origin main
npm run dev
```

開 http://localhost:5173/ ，按 `Ctrl + Shift + R`。

## 公開網址

**https://passplusmotorcyclehk.com**  
（備用：https://www.passplusmotorcyclehk.com）

網站改動要合併入 `main` 先會自動上線。

## 自訂域名（Namecheap）— 第一次設定

域名：`passplusmotorcyclehk.com`

### 1. 喺 Namecheap 加 DNS

1. 登入 [Namecheap](https://www.namecheap.com/) → **Domain List** → `passplusmotorcyclehk.com` → **Manage**
2. 開 **Advanced DNS**
3. 刪除 Namecheap 預設嘅 **Parking / Redirect / URL Redirect** 記錄（如果有）
4. 加入以下記錄：

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | `@` | `185.199.108.153` | Automatic |
| A Record | `@` | `185.199.109.153` | Automatic |
| A Record | `@` | `185.199.110.153` | Automatic |
| A Record | `@` | `185.199.111.153` | Automatic |
| CNAME Record | `www` | `passplusmotorcycle.github.io.` | Automatic |

注意：`www` 嗰行 Value 要係 `passplusmotorcycle.github.io.`（結尾有無 `.` 都得，唔好寫成自己域名）。

### 2. 喺 GitHub 設定 Custom domain

1. 打開 https://github.com/passplusmotorcycle/passplus-website-build/settings/pages
2. **Custom domain** 填：`passplusmotorcyclehk.com` → **Save**
3. 等 DNS check 通過（可能要幾分鐘至幾小時）
4. 剔選 **Enforce HTTPS**（DNS 通過後先會得）

完成後用 https://passplusmotorcyclehk.com 開網站。
