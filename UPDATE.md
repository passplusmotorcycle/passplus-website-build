# 以後點樣更新／公開網站

## 本機預覽（唔使每次重新下載 ZIP）

第一次設定（只做一次）：

```powershell
cd $HOME\Desktop
git clone -b cursor/passplus-motorcycle-website-b70f https://github.com/passplusmotorcycle/passplus-website-build.git
cd passplus-website-build
npm install
```

之後每次想睇最新改動：

```powershell
cd $HOME\Desktop\passplus-website-build
git pull origin cursor/passplus-motorcycle-website-b70f
npm run dev
```

開 http://localhost:5173/ ，按 `Ctrl + Shift + R`。

## 公開網址（其他人都可以開）

上線後網址：

**https://passplusmotorcycle.github.io/passplus-website-build/**

### 第一次上線（你要�址：

**https://passplusmotorcycle.github.io/passplus-website-build/**

### 第一次上線（你要喺 GitHub 做兩步）

而家網站程式已經準備好，但公開上線需要你用 **repo 擁有者帳號** 開一次設定（我冇權限代你開）：

**A. 將倉庫改為 Public（免費帳號要公開，外人才睇到）**

1. 打開 https://github.com/passplusmotorcycle/passplus-website-build/settings
2. 拉到最底 **Danger Zone**
3. 撳 **Change repository visibility** → 選 **Make public** → 確認

**B. 開啟 GitHub Pages**

1. 打開 https://github.com/passplusmotorcycle/passplus-website-build/settings/pages
2. **Build and deployment → Source** 選 **GitHub Actions**
3. 儲存

**C. 重新跑部署**

1. 打開 https://github.com/passplusmotorcycle/passplus-website-build/actions
2. 撳最新一次 **Deploy to GitHub Pages**
3. 撳 **Re-run failed jobs**（或 **Re-run all jobs**）
4. 等變成綠色 ✓ 之後，開上面個公開網址

完成後任何人開個連結就可以睇，唔使登入。之後每次有 push，網站會自動更新。
