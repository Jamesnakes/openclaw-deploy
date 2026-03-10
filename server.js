const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 检查 OpenClaw 安装和配置状态
app.get('/api/check-env', (req, res) => {
  const homeDir = os.homedir();
  const configPath = path.join(homeDir, '.openclaw', 'openclaw.json');

  // 1. 检查 OpenClaw CLI 是否安装
  exec('which openclaw', (err, whichPath) => {
    const installed = !err && whichPath && whichPath.trim();

    // 2. 检查是否已配置（配置文件存在且有内容）
    let configured = false;
    if (installed) {
      try {
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          // 检查是否有有效的 gateway 配置
          configured = config && (config.gateway || config.apiKey || config.channels);
        }
      } catch (e) {
        configured = false;
      }
    }

    // 3. 检查 Node.js 版本
    exec('node --version', (err, nodeVersion) => {
      const nodeOk = !err && nodeVersion && nodeVersion.trim().match(/^v(18|20|22)/);

      // 4. 检查 Gateway 状态
      const http = require('http');
      const req2 = http.get('http://127.0.0.1:18789/health', (response) => {
        const gatewayRunning = response.statusCode === 200;
        response.resume();

        res.json({
          installed: installed,
          configured: configured,
          nodeOk: nodeOk,
          nodeVersion: nodeOk ? nodeVersion.trim() : null,
          gatewayRunning: gatewayRunning,
          configPath: configPath,
          installCommand: 'npm install -g openclaw',
          setupCommand: 'openclaw configure'
        });
      });
      req2.on('error', () => {
        res.json({
          installed: installed,
          configured: configured,
          nodeOk: nodeOk,
          nodeVersion: nodeOk ? nodeVersion.trim() : null,
          gatewayRunning: false,
          configPath: configPath,
          installCommand: 'npm install -g openclaw',
          setupCommand: 'openclaw configure'
        });
      });
      req2.setTimeout(3000, () => {
        req2.destroy();
        res.json({
          installed: installed,
          configured: configured,
          nodeOk: nodeOk,
          nodeVersion: null,
          gatewayRunning: false,
          configPath: configPath,
          installCommand: 'npm install -g openclaw',
          setupCommand: 'openclaw configure'
        });
      });
    });
  });
});

// 安装 OpenClaw
app.post('/api/install', (req, res) => {
  console.log('开始安装 OpenClaw...');
  exec('npm install -g openclaw', (error, stdout, stderr) => {
    if (error) {
      console.error('安装失败:', error);
      return res.json({ success: false, message: error.message });
    }
    console.log('安装完成:', stdout);
    res.json({ success: true, message: 'OpenClaw 安装成功' });
  });
});

// 配置 OpenClaw（交互式）
app.post('/api/setup', (req, res) => {
  console.log('开始配置 OpenClaw...');
  exec('openclaw configure', (error, stdout, stderr) => {
    if (error) {
      console.error('配置失败:', error);
      return res.json({ success: false, message: error.message });
    }
    console.log('配置完成');
    res.json({ success: true, message: 'OpenClaw 配置完成' });
  });
});

// 卸载 OpenClaw
app.post('/api/uninstall', (req, res) => {
  console.log('开始卸载 OpenClaw...');

  // 1. 先停止 Gateway 服务
  exec('launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist 2>/dev/null; pkill -f "openclaw.*gateway" 2>/dev/null; true', (err1) => {
    // 2. 卸载 npm 包
    exec('npm uninstall -g openclaw', (err2, stdout, stderr) => {
      if (err2) {
        console.error('卸载失败:', err2);
        return res.json({ success: false, message: err2.message });
      }
      console.log('卸载完成');
      res.json({ success: true, message: 'OpenClaw 已卸载' });
    });
  });
});

// 获取 Gateway 状态（通过代理避免跨域）
app.get('/api/gateway-status', (req, res) => {
  const http = require('http');
  const req2 = http.get('http://127.0.0.1:18789/health', (response) => {
    if (response.statusCode === 200) {
      response.resume();
      exec('pgrep -f "openclaw.*gateway"', (err, pid) => {
        res.json({
          running: true,
          pid: pid && pid.trim() ? pid.trim() : 'LaunchAgent',
          port: 18789,
          dashboard: 'http://127.0.0.1:18789/'
        });
      });
    } else {
      res.json({ running: false, pid: null, port: 18789 });
    }
  });
  req2.on('error', () => res.json({ running: false, pid: null, port: 18789 }));
  req2.setTimeout(3000, () => {
    req2.destroy();
    res.json({ running: false, pid: null, port: 18789 });
  });
});

// 部署/启动 OpenClaw Gateway
app.post('/api/deploy', (req, res) => {
  console.log('收到部署请求...');

  // 先检查环境
  exec('which openclaw', (err, whichPath) => {
    if (err || !whichPath || !whichPath.trim()) {
      return res.json({
        success: false,
        needInstall: true,
        message: '请先安装 OpenClaw'
      });
    }

    // 检查是否已配置
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, '.openclaw', 'openclaw.json');
    let configured = false;
    try {
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        configured = config && (config.gateway || config.apiKey || config.channels);
      }
    } catch (e) {
      configured = false;
    }

    if (!configured) {
      return res.json({
        success: false,
        needSetup: true,
        message: '请先配置 OpenClaw'
      });
    }

    // 检查 Gateway 是否已运行
    exec('pgrep -f "openclaw.*gateway" | head -1', (err, pid) => {
      if (pid && pid.trim()) {
        console.log(`Gateway 已运行，PID: ${pid.trim()}`);
        exec(`kill ${pid.trim()}`, () => {
          setTimeout(() => startGateway(res), 2000);
        });
      } else {
        startGateway(res);
      }
    });
  });
});

// 启动 Gateway
function startGateway(res) {
  const logFile = '/tmp/openclaw/openclaw-deploy.log';

  exec('mkdir -p /tmp/openclaw', () => {
    const command = `openclaw gateway --port 18789 >> ${logFile} 2>&1 &`;
    console.log('执行命令:', command);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('启动失败:', error);
        return res.json({ success: false, message: error.message });
      }

      console.log('Gateway 启动命令已执行');
      res.json({
        success: true,
        message: 'Gateway 正在启动',
        url: 'http://127.0.0.1:18789/'
      });
    });
  });
}

// 停止 Gateway
app.post('/api/stop', (req, res) => {
  // 先尝试用 launchctl 停止服务（如果是 LaunchAgent 方式启动）
  exec('launchctl list | grep -i openclaw', (err, output) => {
    if (output && output.includes('ai.openclaw.gateway')) {
      // 用 launchctl 停止
      exec('launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist', (err2) => {
        if (err2) {
          console.error('停止失败:', err2);
          return res.json({ success: false, message: err2.message });
        }
        console.log('Gateway 已停止 (LaunchAgent)');
        res.json({ success: true, message: 'Gateway 已停止' });
      });
    } else {
      // 如果不是 LaunchAgent，尝试直接 kill 进程
      exec('pgrep -f "openclaw.*gateway"', (err3, pids) => {
        if (!pids || !pids.trim()) {
          return res.json({ success: true, message: 'Gateway 未运行' });
        }

        const pidList = pids.trim().split('\n');
        pidList.forEach(pid => {
          if (pid) {
            console.log(`停止 Gateway, PID: ${pid}`);
            exec(`kill ${pid}`);
          }
        });
        res.json({ success: true, message: 'Gateway 已停止' });
      });
    }
  });
});

// 获取 Gateway 状态
app.get('/api/status', (req, res) => {
  exec('pgrep -f "openclaw.*gateway" | head -1', (err, pid) => {
    const isRunning = !err && pid && pid.trim();
    res.json({
      running: !!isRunning,
      pid: isRunning ? pid.trim() : null,
      port: 18789,
      dashboard: 'http://127.0.0.1:18789/'
    });
  });
});

// 启动静态服务器
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         🦞 OpenClaw 一键部署服务器                          ║
╠═══════════════════════════════════════════════════════════╣
║  Web 面板:   http://localhost:${PORT}                        ║
║  Gateway:   http://127.0.0.1:18789/                         ║
║  控制面板:   http://127.0.0.1:18789/                         ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
