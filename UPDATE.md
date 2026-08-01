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

第一次要喺 GitHub 開 Pages：

1. 打開 https://github.com/passplusmotorcycle/passplus-website-build/settings/pages
2. Source 選 **GitHub Actions**
3. 儲存

之後每次有 push，網站會自動更新。任何人開個連結就可以睇，唔使登入。
