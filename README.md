# NITE

随机 1v1 视频 Demo。接通的是 AI 女性角色，不是真人。她会调情，但有温度阶梯：一上来就索取，会被嘲讽。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:5173`。

- API Key 只放在服务端 `.env`，不会进浏览器。
- 视频由 [PopVid Realtime API](https://popvid.ai/openapi/doc) 经 WebRTC 下发。
- 会话最长约 5 分钟，额度耗尽会自动结束。
- 请先确认自己已年满 18 岁。

## 产品逻辑

1. 大厅选心情或直接匹配。
2. 随机接通一个角色。
3. 文字或按住说话（浏览器语音识别）。
4. 温度从「试探」到「放开」，靠耐心和对话质量往上走。
5. `Next` 换人，`挂断` 结束。

## 线上 Demo

这个项目是 **Express 托管前端 + 服务端保管 API Key**。浏览器只跟你们自己的域名说话，再由服务端去换 PopVid 的短期凭证，所以不能用纯静态托管（GitHub Pages / 普通 CDN）。

### 立刻分享（Cloudflare 隧道）

本机先起生产服务，再打一条临时公网链接。关掉终端后链接会失效。

```bash
npm run start:demo
# 另开一个终端
cloudflared tunnel --url http://127.0.0.1:8790
```

### 固定上线（Render / Railway / Fly）

仓库里已经有 `Dockerfile`。任选一个能跑 Docker 的平台，设置环境变量：

- `POPVID_API_KEY`（必填，只放在平台后台，不要写进 Git）
- `POPVID_BASE_URL=https://popvid.ai/api/public/v1`
- `NODE_ENV=production`

Render 可直接用 `render.yaml`。公开后记得看额度：线上默认每 IP 15 分钟最多 8 次匹配，全站最多 3 路同时通话。
