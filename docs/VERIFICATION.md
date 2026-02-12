# OpenCode-Mem 验证测试计划

本文档定义了验证迁移是否成功的标准和测试方法。

## 验证层级

```
┌─────────────────────────────────────────────────────────┐
│  L4: 真实环境验证 (OpenCode 中实际使用)                    │
├─────────────────────────────────────────────────────────┤
│  L3: E2E 集成测试 (完整流程)                              │
├─────────────────────────────────────────────────────────┤
│  L2: 单元测试 (各模块独立)                                │
├─────────────────────────────────────────────────────────┤
│  L1: 构建验证 (编译通过)                                  │
└─────────────────────────────────────────────────────────┘
```

---

## L1: 构建验证

### 验证命令

```bash
cd opencode-mem

# 1. 依赖安装
bun install
echo $?  # 应该输出 0

# 2. 构建
bun run build
echo $?  # 应该输出 0

# 3. 检查产物
ls -la dist/
# 应该看到: plugin.js, mcp/server.js, ui/viewer.html
```

### 通过标准

- [ ] `bun install` 无错误退出
- [ ] `bun run build` 生成 `dist/plugin.js`
- [ ] `bun run build` 生成 `dist/mcp/server.js`
- [ ] `bun run build` 生成 `dist/ui/viewer.html`

---

## L2: 单元测试验证

### 验证命令

```bash
cd opencode-mem

# 运行所有测试
bun test

# 运行特定模块测试
bun test src/db/__tests__/
bun test src/compression/__tests__/
bun test src/mcp/__tests__/
bun test src/hooks/__tests__/
bun test src/vector/__tests__/
```

### 通过标准

- [ ] 所有测试通过 (`178 pass, 0 fail`)
- [ ] 数据库模块测试通过
- [ ] 压缩模块测试通过
- [ ] MCP 工具测试通过
- [ ] Hooks 测试通过
- [ ] Chroma 测试通过

### 关键测试用例

| 模块 | 测试文件 | 验证内容 |
|------|----------|----------|
| Database | `database.test.ts` | SQLite 连接、迁移执行 |
| Queries | `queries.test.ts` | CRUD 操作、FTS5 搜索 |
| Search | `search.test.ts` | 全文搜索、时间线 |
| Prompts | `prompts.test.ts` | Prompt 生成、XML 格式 |
| Parser | `parser.test.ts` | XML 解析、错误处理 |
| MCP Tools | `server.test.ts` | 5 个工具的正确性 |
| Hooks | `tool-capture.test.ts` | 事件捕获逻辑 |

---

## L3: E2E 集成测试验证

### 3.1 数据库流程验证

```bash
cd opencode-mem

# 运行 E2E 测试
bun test tests/e2e/pipeline.test.ts
```

**验证内容：**

1. **会话创建** → 数据库有记录
2. **观察插入** → 可被搜索到
3. **全文搜索** → 返回正确结果
4. **时间线获取** → 按时间排序
5. **详情获取** → 完整内容返回

### 3.2 手动验证脚本

```bash
#!/bin/bash
# 保存为: opencode-mem/tests/manual-verify.sh

set -e

echo "=== 1. 创建测试数据库 ==="
TEST_DB=$(mktemp)
echo "测试数据库: $TEST_DB"

echo "=== 2. 运行验证测试 ==="
cd opencode-mem

# 使用 Bun 运行内联测试
bun test --timeout 10000 <<'TESTEOF'
import { describe, test, expect, afterAll } from "bun:test";
import { Database } from "./src/db/database";
import { insertSession, insertObservation, getStats, getSessionList } from "./src/db/queries";
import { searchAll, getTimeline, getFullObservations } from "./src/db/search";
import { searchTool } from "./src/mcp/tools/search";
import { timelineTool } from "./src/mcp/tools/timeline";
import { getObservationsTool } from "./src/mcp/tools/get-observations";
import { saveMemoryTool } from "./src/mcp/tools/save-memory";

let db: Database;

describe("E2E 手动验证", () => {
  test("数据库初始化", () => {
    db = Database.create(":memory:");
    expect(db).toBeDefined();
    expect(db.raw).toBeDefined();
  });

  test("会话创建", () => {
    insertSession(db, {
      session_id: "verify-session",
      project: "verify-project",
      user_prompt: "验证测试",
      status: "active",
    });
    const sessions = getSessionList(db);
    expect(sessions.length).toBe(1);
    expect(sessions[0].session_id).toBe("verify-session");
  });

  test("观察插入", () => {
    const id = insertObservation(db, {
      session_id: "verify-session",
      project: "verify-project",
      raw_text: "Test tool output",
      type: "tool_use",
      title: "验证观察",
      narrative: "这是一个验证测试的观察记录",
    });
    expect(id).toBeGreaterThan(0);
  });

  test("全文搜索", () => {
    const results = searchAll(db, "验证");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain("验证");
  });

  test("时间线获取", () => {
    const timeline = getTimeline(db, "verify-session");
    expect(timeline.length).toBe(1);
  });

  test("MCP search 工具", () => {
    const result = searchTool(db, { query: "验证" });
    const parsed = JSON.parse(result);
    expect(parsed.total).toBeGreaterThan(0);
  });

  test("MCP timeline 工具", () => {
    const result = timelineTool(db, { sessionId: "verify-session" });
    const parsed = JSON.parse(result);
    expect(parsed.total).toBe(1);
  });

  test("MCP save_memory 工具", () => {
    const result = saveMemoryTool(db, { 
      text: "手动保存的测试记忆", 
      project: "verify-project" 
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });

  test("统计信息", () => {
    const stats = getStats(db);
    expect(stats.sessions).toBe(1);
    expect(stats.observations).toBeGreaterThanOrEqual(1);
  });

  afterAll(() => {
    if (db) db.close();
  });
});
TESTEOF

echo "=== 3. 验证完成 ==="
```

### 通过标准

- [ ] 会话可以创建和查询
- [ ] 观察可以插入和搜索
- [ ] FTS5 搜索返回正确结果
- [ ] 时间线按时间排序
- [ ] 所有 MCP 工具正常工作
- [ ] 手动保存记忆成功

---

## L4: 真实环境验证

### 4.1 准备工作

```bash
# 1. 构建插件
cd opencode-mem
bun run build

# 2. 添加到 OpenCode 配置
echo '{
  "plugins": ["/path/to/claude-mem/opencode-mem"]
}' > ~/.config/opencode/opencode.json
```

### 4.2 功能验证清单

#### A. 事件捕获验证

在 OpenCode 中执行一些操作，然后检查数据库：

```bash
# 检查是否有新的观察记录
sqlite3 ~/.local/share/opencode/opencode-mem/opencode-mem.db \
  "SELECT COUNT(*) FROM observations WHERE created_at > strftime('%s', 'now', '-5 minutes')"

# 查看最近的观察
sqlite3 ~/.local/share/opencode/opencode-mem/opencode-mem.db \
  "SELECT id, type, title FROM observations ORDER BY id DESC LIMIT 5"
```

**通过标准：**
- [ ] 执行工具后数据库有新记录
- [ ] 观察标题有意义（压缩生效）
- [ ] 文件路径被正确提取

#### B. 上下文注入验证

```bash
# 1. 先在一个会话中讨论某个主题（如 "JWT认证"）
# 2. 开始新会话，问同样的问题
# 3. 检查日志是否有上下文注入
```

查看 OpenCode 日志，应该看到类似：
```
[context] Injected 5 observations, 1234 tokens
```

**通过标准：**
- [ ] 新会话包含历史上下文
- [ ] 上下文与当前项目相关

#### C. MCP 工具验证

在 OpenCode 中使用 MCP 工具：

```
# 测试搜索
使用 search 工具搜索 "authentication"

# 测试时间线
使用 timeline 工具查看某个会话

# 测试保存记忆
使用 save_memory 保存一条测试记忆
```

**通过标准：**
- [ ] `search` 返回相关结果
- [ ] `timeline` 显示时间线
- [ ] `save_memory` 保存成功
- [ ] `get_observations` 返回完整内容

#### D. HTTP API 验证

```bash
# 健康检查
curl http://localhost:37778/api/health
# 期望: {"status":"ok","timestamp":...}

# 统计信息
curl http://localhost:37778/api/stats
# 期望: {"sessions":N,"observations":N,...}

# 搜索测试
curl "http://localhost:37778/api/search?q=test"
# 期望: {"query":"test","total":N,"results":[...]}
```

**通过标准：**
- [ ] `/api/health` 返回 200
- [ ] `/api/stats` 返回正确统计
- [ ] `/api/search` 搜索正常

#### E. Viewer UI 验证

```bash
# 打开浏览器
open http://localhost:37778
```

**检查项：**
- [ ] 页面加载无错误
- [ ] 显示会话列表
- [ ] 点击会话显示时间线
- [ ] 搜索功能正常

---

## 功能对比矩阵

与原始 claude-mem 的功能对比：

| 功能 | claude-mem | opencode-mem | 验证方法 |
|------|------------|--------------|----------|
| SQLite 存储 | ✅ | ✅ | L2 测试 |
| FTS5 搜索 | ✅ | ✅ | L2 测试 |
| AI 压缩 | ✅ | ✅ | L4 验证 |
| 上下文注入 | ✅ | ✅ | L4 验证 |
| MCP Server | ✅ (HTTP proxy) | ✅ (直接 SQLite) | L2/L4 验证 |
| HTTP API | ✅ (Express) | ✅ (Bun.serve) | L4 验证 |
| Viewer UI | ✅ (React) | ✅ (简化 HTML) | L4 验证 |
| Chroma 向量 | ✅ | ✅ (简化) | L2 测试 |
| 隐私标签 | ✅ | ✅ | L2 测试 |

---

## 快速验证脚本

将以下内容保存为 `opencode-mem/verify.sh`：

```bash
#!/bin/bash
set -e

echo "╔════════════════════════════════════════╗"
echo "║   OpenCode-Mem 验证脚本                ║"
echo "╚════════════════════════════════════════╝"

echo ""
echo "▶ L1: 构建验证"
echo "  ├── 依赖安装..."
bun install --silent
echo "  ├── 构建..."
bun run build > /dev/null 2>&1
echo "  └── 检查产物..."
[ -f "dist/plugin.js" ] && echo "      ✓ plugin.js" || echo "      ✗ plugin.js"
[ -f "dist/mcp/server.js" ] && echo "      ✓ mcp/server.js" || echo "      ✗ mcp/server.js"
[ -f "dist/ui/viewer.html" ] && echo "      ✓ ui/viewer.html" || echo "      ✗ ui/viewer.html"

echo ""
echo "▶ L2: 单元测试"
echo "  └── 运行测试..."
bun test 2>&1 | tail -3

echo ""
echo "▶ L3: E2E 测试"
bun test tests/e2e/ 2>&1 | tail -3

echo ""
echo "▶ L4: 真实环境检查"
DB_PATH="$HOME/.local/share/opencode/opencode-mem/opencode-mem.db"
if [ -f "$DB_PATH" ]; then
  echo "  ├── 数据库存在: ✓"
  SESSIONS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sessions" 2>/dev/null || echo "0")
  OBS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM observations" 2>/dev/null || echo "0")
  echo "  ├── 会话数: $SESSIONS"
  echo "  └── 观察数: $OBS"
else
  echo "  └── 数据库不存在 (尚未在 OpenCode 中使用)"
fi

echo ""
echo "══════════════════════════════════════════"
echo "验证完成！"
echo ""
echo "下一步："
echo "  1. 将插件添加到 OpenCode 配置"
echo "  2. 重启 OpenCode"
echo "  3. 执行一些操作后再次运行此脚本"
echo "══════════════════════════════════════════"
```

运行：

```bash
chmod +x opencode-mem/verify.sh
./opencode-mem/verify.sh
```

---

## 验证报告模板

完成验证后，填写以下报告：

```markdown
## OpenCode-Mem 验证报告

**日期**: YYYY-MM-DD
**验证人**: 
**版本**: 

### L1 构建
- [ ] 通过
- 错误信息（如有）:

### L2 单元测试
- [ ] 通过
- 测试结果: ___ pass, ___ fail
- 失败测试（如有）:

### L3 E2E 测试
- [ ] 通过
- 错误信息（如有）:

### L4 真实环境
- [ ] 事件捕获正常
- [ ] 上下文注入正常
- [ ] MCP 工具正常
- [ ] HTTP API 正常
- [ ] Viewer UI 正常

### 问题记录
1. 
2. 

### 总体结论
- [ ] 验证通过，可以使用
- [ ] 部分通过，需要修复
- [ ] 验证失败
```
