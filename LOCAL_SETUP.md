# 本地部署指南 — 邮件卫士垃圾分类系统

## 目录结构

```
项目根目录/
├── artifacts/
│   ├── api-server/        # Node.js 后端 API (Express)
│   └── spam-guard/        # React 前端界面
├── classifier-service/    # Python ML 分类服务 ← 你的 ML 代码在这里
│   ├── app.py             # Flask 分类服务主程序
│   ├── train.py           # 模型训练脚本（整合你的 SVM + 朴素贝叶斯）
│   ├── requirements.txt   # Python 依赖
│   └── start.sh           # 快速启动脚本
├── lib/
│   ├── api-spec/          # OpenAPI 接口定义
│   ├── db/                # 数据库 Schema (PostgreSQL + Drizzle)
│   └── api-client-react/  # 生成的 React Query 钩子
└── LOCAL_SETUP.md         # 本文件
```

---

## 系统要求

| 软件 | 版本 | 说明 |
|------|------|------|
| Node.js | 18+ | 推荐 20 LTS |
| pnpm | 8+ | `npm install -g pnpm` |
| Python | 3.9+ | 推荐 3.11 |
| PostgreSQL | 14+ | 或使用 Docker |

---

## 第一步：下载代码

从 Replit 下载项目（点击左上角菜单 → Download as zip），或者 git clone。

---

## 第二步：安装 Node.js 依赖

```bash
# 在项目根目录执行
pnpm install
```

---

## 第三步：配置 PostgreSQL 数据库

### 方式 A：本地安装 PostgreSQL

```bash
# 创建数据库
psql -U postgres -c "CREATE DATABASE spamguard;"
psql -U postgres -c "CREATE USER spamguard_user WITH PASSWORD 'yourpassword';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE spamguard TO spamguard_user;"
```

### 方式 B：使用 Docker（推荐）

```bash
docker run -d \
  --name spamguard-db \
  -e POSTGRES_USER=spamguard_user \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=spamguard \
  -p 5432:5432 \
  postgres:16
```

---

## 第四步：配置环境变量

在项目根目录创建 `.env` 文件：

```env
# 数据库连接（根据你的配置修改）
DATABASE_URL=postgresql://spamguard_user:yourpassword@localhost:5432/spamguard

# Session 密钥（随机字符串，务必修改！）
SESSION_SECRET=your-very-long-random-secret-key-change-this

# Python 分类服务地址（如果不在默认端口 5001 运行需要修改）
CLASSIFIER_SERVICE_URL=http://localhost:5001
```

---

## 第五步：初始化数据库

```bash
# 同步数据库 Schema（创建表结构）
pnpm --filter @workspace/db run push

# 创建管理员账号
node -e "
import('./artifacts/api-server/node_modules/bcryptjs/dist/bcrypt.js')
  .then(m => m.hash('admin123456', 10))
  .then(hash => {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return pool.query(
      \`INSERT INTO users (username, email, password_hash, role) 
       VALUES ('admin', 'admin@local.com', '\${hash}', 'admin') 
       ON CONFLICT DO NOTHING\`
    );
  })
  .then(() => { console.log('管理员账号创建成功'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
"
```

> 或者直接用 psql 插入（密码 admin123456 的 bcrypt 哈希）:
> ```sql
> INSERT INTO users (username, email, password_hash, role, is_locked, login_attempts)
> VALUES ('admin', 'admin@local.com', '$2b$10$koj3EHpYahXYrma582fReubouboNhY6OoSYv3FOqbWFIeJtA4QiwO', 'admin', false, 0);
> ```

---

## 第六步：训练你的 ML 模型（关键步骤！）

```bash
cd classifier-service

# 安装 Python 依赖
pip install -r requirements.txt

# 将你的数据文件复制到此目录
cp /你的数据路径/output_label_0.csv .    # 正常邮件（列名：邮件，标签）
cp /你的数据路径/output_label_1.csv .    # 垃圾邮件（列名：邮件，标签）

# 训练模型（会生成 .pkl 文件）
python train.py
```

训练完成后会生成：
- `svm_model.pkl` — SVM 模型
- `tfidf_vectorizer.pkl` — TF-IDF 向量化器
- `naive_bayes_model.pkl` — 朴素贝叶斯模型
- `vectorizer.pkl` — 词袋向量化器
- `training_report.txt` — 训练指标报告

---

## 第七步：启动服务

需要开启 **3 个终端**：

### 终端 1：Python 分类服务

```bash
cd classifier-service
python app.py
# 服务运行在 http://localhost:5001
```

### 终端 2：Node.js API 后端

```bash
# 需要设置端口
PORT=8080 BASE_PATH=/api pnpm --filter @workspace/api-server run dev
```

### 终端 3：React 前端

```bash
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/spam-guard run dev
# 打开浏览器访问 http://localhost:3000
```

---

## 验证是否正常运行

```bash
# 测试 Python 分类服务
curl http://localhost:5001/healthz

# 测试 Node.js API
curl http://localhost:8080/api/healthz

# 测试分类功能（ML 模型）
curl -X POST http://localhost:5001/classify \
  -H "Content-Type: application/json" \
  -d '{"text":"恭喜您中奖了，点击领取奖励","subject":"您有一封重要通知"}'

# 测试通过 Node.js API 分类
curl -X POST http://localhost:8080/api/email/classify \
  -H "Content-Type: application/json" \
  -d '{"text":"恭喜您中奖了","subject":"中奖通知"}'
```

---

## 分类服务工作机制

```
用户操作 → React 前端 → Node.js API
                              ↓
                    尝试调用 Python 服务 (localhost:5001)
                         ↙          ↘
                   成功                失败/未启动
                     ↓                    ↓
              SVM + 朴素贝叶斯        规则匹配 (备用)
              (你的 ML 模型)         (关键词检测)
```

即使 Python 服务没有启动，系统也会自动使用规则匹配确保功能正常。

---

## 常见问题

**Q: 邮件服务商连接失败？**
- QQ邮箱/163邮箱需要在邮箱设置中**开启 IMAP** 并获取**授权码**（不是登录密码）
- Gmail 需要开启"两步验证"后生成"应用专用密码"

**Q: 训练数据格式要求？**
- CSV 文件，UTF-8 编码
- 必须有 `邮件` 列（邮件内容）和 `标签` 列（0=正常，1=垃圾）

**Q: 管理员账号默认密码？**
- 用户名：`admin`，密码：`admin123456`（请及时修改！）

**Q: 如何在 Windows 上运行？**
- 推荐使用 WSL2 + Ubuntu，或者 PowerShell 分别运行各个服务
- 将 `start.sh` 的命令手动在 cmd/PowerShell 中执行
