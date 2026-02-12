# OpenCode-Mem 使用指南

本文档提供 OpenCode-Mem 插件的完整安装和使用说明。

## 目录

1. [前置要求](#1-前置要求)
2. [安装](#2-安装)
3. [配置](#3-配置)
4. [基本使用](#4-基本使用)
5. [MCP 工具](#5-mcp-工具)
6. [HTTP API](#6-http-api)
7. [Viewer UI](#7-viewer-ui)
8. [环境变量](#8-环境变量)
9. [故障排除](#9-故障排除)

---

## 1. 前置要求

### 必需

- **Bun** >= 1.0.0
- **OpenCode** - [安装 OpenCode](https://github.com/anomalyco/opencode)

### 可选

- **ChromaDB** - 用于向量语义搜索（可选功能）

检查 Bun 是否已安装：

```bash
bun --version
```

如果未安装，运行：

```bash
curl -fsSL https://bun.sh/install | bash
```

---

## 2. 安装

### 方式一：从源码安装

```bash
# 克隆仓库
git clone https://github.com/thedotmack/claude-mem.git
cd claude-mem/opencode-mem

# 安装依赖
bun install

# 构建
bun run build
```

### 方式二：npm 安装（发布后）

```bash
npm install opencode-mem
```

---

## 3. 配置

### 3.1 添加到 OpenCode

编辑 OpenCode 配置文件：

**macOS/Linux**: `~/.config/opencode/opencode.json`

```json
{
  "plugins": [
    "/path/to/claude-mem/opencode-mem"
  ]
}
```

### 3.2 验证安装

重启 OpenCode 后，插件会自动加载。检查日志确认：

```bash
# 查看数据库是否创建
ls ~/.local/share/opencode/opencode-mem/
# 应该看到: opencode-mem.db
```

---

## 4. 基本使用

### 4.1 自动记忆

插件会自动捕获：

- **工具调用** - Read, Write, Bash, Edit 等操作
- **代码变更** - 文件修改记录
- **对话内容** - 用户提示和 AI 回复

所有内容会被压缩并存储到 SQLite 数据库。

### 4.2 隐私控制

使用 `<private>` 标签防止敏感内容被存储：

```
API密钥是 <private>sk-abc123xyz</private> 请保密
```

`<private>` 标签内的内容会被自动移除，不会存入数据库。

### 4.3 上下文注入

当开始新会话时，插件会自动注入相关历史上下文，帮助 AI 记住之前的工作。

---

## 5. MCP 工具

OpenCode-Mem 提供 5 个 MCP 工具用于搜索记忆。

### 5.1 `search` - 搜索记忆索引

```
search(query="authentication", limit=20, project="my-project")
```

**参数：**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| query | string | ✅ | - | 搜索关键词 |
| limit | number | ❌ | 20 | 最大结果数 |
| project | string | ❌ | - | 按项目过滤 |
| sessionId | string | ❌ | - | 按会话过滤 |
| dateFrom | string | ❌ | - | 起始日期 (ISO) |
| dateTo | string | ❌ | - | 结束日期 (ISO) |

**返回：**

```json
{
  "query": "authentication",
  "total": 5,
  "results": [
    {
      "id": 123,
      "session_id": "sess_abc",
      "project": "my-project",
      "title": "Added JWT authentication",
      "created_at": 1707654321
    }
  ]
}
```

### 5.2 `timeline` - 获取时间线上下文

```
timeline(sessionId="sess_abc")
timeline(anchor=123, depthBefore=3, depthAfter=3)
timeline(query="authentication")  # 自动查找锚点
```

**参数：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| sessionId | string | ❌ | 会话 ID |
| anchor | number | ❌ | 锚点观察 ID |
| query | string | ❌ | 自动查找锚点的查询 |
| depthBefore | number | ❌ | 锚点前条目数 (默认 5) |
| depthAfter | number | ❌ | 锚点后条目数 (默认 5) |

### 5.3 `get_observations` - 获取完整内容

```
get_observations(ids=[123, 124, 125])
get_observations(ids=[123], type="summary")
```

**参数：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| ids | number[] | ✅ | 观察/摘要 ID 数组 |
| type | string | ❌ | "observation" 或 "summary" |

### 5.4 `save_memory` - 手动保存记忆

```
save_memory(
  text="重要发现：生产环境API密钥存储在 AWS Secrets Manager",
  title="生产环境密钥位置",
  project="my-project"
)
```

**参数：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| text | string | ✅ | 要记住的内容 |
| title | string | ❌ | 标题（自动生成） |
| project | string | ❌ | 项目名（默认 opencode-mem） |

### 5.5 `__IMPORTANT` - 工作流说明

```
__IMPORTANT()
```

返回 3 层搜索工作流的完整说明。

---

## 6. HTTP API

HTTP 服务器默认运行在端口 **37778**。

### 6.1 端点列表

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/stats` | GET | 数据库统计 |
| `/api/projects` | GET | 项目列表 |
| `/api/sessions` | GET | 会话列表 |
| `/api/timeline/:sessionId` | GET | 会话时间线 |
| `/api/search` | GET | 搜索记忆 |
| `/api/observations` | GET | 获取观察详情 |

### 6.2 示例请求

```bash
# 健康检查
curl http://localhost:37778/api/health

# 获取统计
curl http://localhost:37778/api/stats

# 搜索
curl "http://localhost:37778/api/search?q=authentication&limit=10"

# 获取会话列表
curl "http://localhost:37778/api/sessions?limit=20&project=my-project"

# 获取时间线
curl http://localhost:37778/api/timeline/sess_abc123

# 获取观察详情
curl "http://localhost:37778/api/observations?ids=123,124,125"
```

---

## 7. Viewer UI

### 7.1 访问 UI

打开浏览器访问：

```
http://localhost:37778
```

### 7.2 UI 功能

- **会话列表** - 浏览所有会话
- **时间线视图** - 查看会话中的观察序列
- **搜索功能** - 全文搜索记忆
- **项目统计** - 查看项目和观察数量

### 7.3 禁用 UI

如果不需要 UI，可以通过环境变量禁用：

```bash
export OPENCODE_MEM_VIEWER_ENABLED=false
```

---

## 8. 环境变量

所有配置都可以通过环境变量覆盖：

### 压缩设置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENCODE_MEM_COMPRESSION_ENABLED` | `true` | 启用 AI 压缩 |
| `OPENCODE_MEM_COMPRESSION_MIN_LENGTH` | `100` | 最小输出长度 |
| `OPENCODE_MEM_COMPRESSION_MAX_TOKENS` | `4000` | 最大 token 数 |

### 上下文设置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENCODE_MEM_CONTEXT_ENABLED` | `true` | 启用上下文注入 |
| `OPENCODE_MEM_CONTEXT_MAX_TOKENS` | `4000` | 最大上下文 token |
| `OPENCODE_MEM_CONTEXT_OBSERVATION_COUNT` | `50` | 最大观察数 |

### Viewer 设置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENCODE_MEM_VIEWER_ENABLED` | `true` | 启用 HTTP 服务器 |
| `OPENCODE_MEM_VIEWER_PORT` | `37778` | HTTP 端口 |

### Chroma 设置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENCODE_MEM_CHROMA_ENABLED` | `false` | 启用 Chroma 向量搜索 |
| `OPENCODE_MEM_CHROMA_HOST` | `localhost:8000` | Chroma 服务器地址 |

### 其他

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENCODE_MEM_LOG_LEVEL` | `INFO` | 日志级别 (DEBUG/INFO/WARN/ERROR) |
| `OPENCODE_MEM_PRIVACY_STRIP_TAGS` | `true` | 移除 `<private>` 标签 |

---

## 9. 故障排除

### 9.1 插件未加载

**检查：**
```bash
ls ~/.local/share/opencode/opencode-mem/
```

**解决：**
1. 确认 `opencode.json` 中的路径正确
2. 确认已运行 `bun run build`
3. 重启 OpenCode

### 9.2 数据库错误

**检查：**
```bash
sqlite3 ~/.local/share/opencode/opencode-mem/opencode-mem.db ".tables"
```

**解决：**
```bash
# 备份并重建
mv ~/.local/share/opencode/opencode-mem/opencode-mem.db{,.bak}
# 重启 OpenCode，数据库会自动重建
```

### 9.3 HTTP 服务器端口被占用

**错误信息：**
```
[HTTP] Server failed to start: EADDRINUSE
```

**解决：**
```bash
# 查找占用进程
lsof -i :37778

# 更改端口
export OPENCODE_MEM_VIEWER_PORT=37779
```

### 9.4 Chroma 连接失败

**检查：**
```bash
curl http://localhost:8000/api/v1/heartbeat
```

**解决：**
1. 确认 Chroma 已启动
2. 检查 `OPENCODE_MEM_CHROMA_HOST` 设置
3. 如果不需要向量搜索，禁用 Chroma

### 9.5 Windows 控制台弹窗

Chroma 在 Windows 上默认禁用以防止 Python 子进程弹窗。

如果需要向量搜索，可以：
1. 使用 WSL2 运行 OpenCode
2. 或手动启动 Chroma 并通过 HTTP API 访问

---

## 10. 3 层搜索工作流

为了最大化效率，推荐使用以下工作流：

### Step 1: 搜索索引

```
search(query="JWT", limit=20)
```

返回轻量级结果（~50-100 tokens/条）

### Step 2: 获取上下文

```
timeline(anchor=123, depthBefore=3, depthAfter=3)
```

理解观察的上下文环境

### Step 3: 获取详情

```
get_observations(ids=[123, 124])
```

**只在确定需要时**获取完整内容（~500-1000 tokens/条）

### 为什么这样？

- 直接获取所有详情 = 大量 token 消耗
- 先搜索再获取 = **10x token 节省**

---

## 更多资源

- [GitHub 仓库](https://github.com/thedotmack/claude-mem)
- [问题反馈](https://github.com/thedotmack/claude-mem/issues)
- [原始 claude-mem 文档](https://docs.claude-mem.ai)
