# 🦞 OpenClaw 一键部署

一个简单的 Web 项目，可以一键部署和管理 OpenClaw Gateway 服务。

## 功能特性

- ✅ 一键启动/重启 OpenClaw Gateway
- ✅ 实时查看服务状态
- ✅ 停止 Gateway 服务
- ✅ 控制面板快捷链接
- ✅ 美观的 Web 管理界面

## 快速开始

### 1. 安装依赖

```bash
cd /Users/gaoyucheng/启迪万众/demo/openclaw-deploy
npm install
```

### 2. 启动部署服务

```bash
npm start
```

### 3. 访问 Web 面板

打开浏览器访问: **http://localhost:3000**

## 使用说明

1. **启动服务**: 点击 "🚀 一键启动 / 重启" 按钮
2. **查看状态**: 页面会自动显示 Gateway 运行状态
3. **打开控制面板**: 点击底部链接或直接访问 http://127.0.0.1:18789/
4. **停止服务**: 点击 "⬛ 停止服务" 按钮

## 端口说明

| 服务 | 端口 |
|------|------|
| 部署面板 | 3000 |
| Gateway WS | 18789 |
| Gateway HTTP | 18789 |

## 项目结构

```
openclaw-deploy/
├── index.html      # Web 管理界面
├── server.js       # Node.js 后端服务
├── package.json    # 项目配置
└── README.md       # 说明文档
```

## 技术栈

- **前端**: 原生 HTML + CSS + JavaScript
- **后端**: Node.js + Express

## 注意事项

- 需要先安装 OpenClaw CLI
- Gateway 默认端口为 18789
- 服务状态每 5 秒自动刷新
