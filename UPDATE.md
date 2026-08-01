# 以後點樣更新網站（唔使每次重新下載 ZIP）

第一次設定（只做一次）：

```powershell
cd $HOME\Desktop
git clone -b cursor/passplus-motorcycle-website-b70f https://github.com/passplusmotorcycle/passplus-website-build.git
cd passplus-website-build
npm install
```

之後每次想睇最新改動，只需：

```powershell
cd $HOME\Desktop\passplus-website-build
git pull origin cursor/passplus-motorcycle-website-b70f
npm run dev
```

然後開 http://localhost:5173/ ，按 `Ctrl + Shift + R`。
