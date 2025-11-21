# MySQL MCP Server

一个功能完整的 MySQL Model Context Protocol (MCP) 服务器，提供数据库管理功能。

## 功能特性

- ✅ 数据库管理：创建、删除、列出数据库
- ✅ 表管理：创建、删除、列出、描述表结构
- ✅ CRUD 操作：查询、插入、更新、删除数据
- ✅ SQL 执行：执行任意 SQL 语句
- ✅ 连接管理：测试连接、切换数据库
- ✅ Schema 查询：获取完整的数据库结构信息（支持自然语言转 SQL）

## 安装

### 前置要求

- Node.js 18+ 
- MySQL 服务器（已安装并运行）

### 安装步骤

1. 克隆仓库：
```bash
git clone https://github.com/blackdesert5410/mysql-mcp-server.git
cd mysql-mcp-server
```

2. 安装依赖：
```bash
npm install
```

## 配置

### 方式一：命令行参数（推荐）

启动时通过命令行参数传递 MySQL 用户名和密码：

```bash
node src/index.js <用户名> <密码>
```

示例：
```bash
node src/index.js root your_password
```

### 方式二：环境变量

1. 复制示例配置文件：
```bash
cp config.example.env .env
```

2. 编辑 `.env` 文件，填入你的 MySQL 配置：
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_username
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=
```

3. 启动服务器（无需命令行参数）：
```bash
node src/index.js
```

**优先级：命令行参数 > 环境变量 > 默认值**

## 使用方法

### 启动服务器

```bash
# 使用命令行参数
node src/index.js <用户名> <密码>

# 或使用 npm start（需要先配置环境变量）
npm start
```

### 在 Cursor 中配置

1. 打开 Cursor 的 MCP 配置文件（通常在 `~/.cursor/mcp.json` 或 `%APPDATA%\Cursor\mcp.json`）

2. 添加以下配置：

**Windows 路径格式（推荐使用正斜杠）：**
```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": [
        "D:/AI/mcp-server/src/index.js",
        "your_username",
        "your_password"
      ]
    }
  }
}
```

**或者使用双反斜杠：**
```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": [
        "D:\\AI\\mcp-server\\src\\index.js",
        "your_username",
        "your_password"
      ]
    }
  }
}
```

**如果 Node.js 不在 PATH 中，使用完整路径：**
```json
{
  "mcpServers": {
    "mysql": {
      "command": "C:/Program Files/nodejs/node.exe",
      "args": [
        "D:/AI/mcp-server/src/index.js",
        "your_username",
        "your_password"
      ]
    }
  }
}
```

**注意**：
- 将路径替换为你的实际项目路径
- 将 `your_username` 和 `your_password` 替换为你的 MySQL 用户名和密码
- Windows 路径使用正斜杠 `/` 或双反斜杠 `\\`
- 修改配置后需要**重启 Cursor** 才能生效

### 在其他 MCP 客户端中使用

```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": [
        "/path/to/mysql-mcp-server/src/index.js",
        "your_username",
        "your_password"
      ]
    }
  }
}
```

## 可用工具

### 数据库管理
1. **test_connection** - 测试 MySQL 连接
2. **list_databases** - 列出所有数据库
3. **create_database** - 创建新数据库
4. **drop_database** - 删除数据库
5. **use_database** - 选择要使用的数据库

### 表管理
6. **list_tables** - 列出数据库中的所有表
7. **describe_table** - 描述表结构
8. **create_table** - 创建新表
9. **drop_table** - 删除表

### 数据操作（CRUD）
10. **select** - 执行 SELECT 查询
11. **insert** - 插入数据到表
12. **update** - 更新表中的数据
13. **delete** - 从表中删除数据

### SQL 执行
14. **execute_sql** - 执行 SQL 查询或命令

### Schema 查询（自然语言转 SQL 专用）⭐
15. **get_database_schema** - 获取整个数据库的完整 schema 信息（所有表、列、类型、约束、外键关系）
16. **get_table_schema** - 获取指定表的完整 schema 信息（列名、数据类型、约束、默认值、是否可空等）
17. **get_foreign_keys** - 获取表的外键关系信息（理解表之间的关联）
18. **get_indexes** - 获取表的索引信息
19. **get_table_info** - 获取表的统计信息（行数、引擎类型等）
20. **get_sample_data** - 获取表的示例数据（帮助理解数据结构和内容）

## 自然语言转 SQL 支持

该 MCP 服务**完全支持** agent 将自然语言转换为 SQL 查询。通过以下工具，agent 可以：

1. **理解数据库结构**：
   - 使用 `get_database_schema` 获取整个数据库的完整结构
   - 使用 `get_table_schema` 获取特定表的详细列信息
   - 使用 `get_foreign_keys` 理解表之间的关联关系

2. **理解数据内容**：
   - 使用 `get_sample_data` 查看示例数据，理解数据格式和内容
   - 使用 `get_table_info` 了解表的统计信息

3. **生成和执行 SQL**：
   - 基于 schema 信息生成准确的 SQL 查询
   - 使用 `execute_sql` 执行生成的 SQL
   - 或使用便捷的 `select`、`insert`、`update`、`delete` 工具

### 典型工作流程

当用户说："查询所有年龄大于 25 的用户"时，agent 可以：

1. 使用 `get_database_schema` 或 `list_tables` 找到用户表
2. 使用 `get_table_schema` 查看用户表的结构，确认年龄字段名称（如 `age`）
3. 使用 `get_sample_data` 查看示例数据，理解数据格式
4. 生成 SQL：`SELECT * FROM users WHERE age > 25`
5. 使用 `execute_sql` 执行查询并返回结果

## 故障排除

### 常见问题

1. **"Not connected" 错误**
   - 检查配置文件路径是否正确
   - 确保 Node.js 在系统 PATH 中，或使用完整路径
   - 重启 Cursor 应用
   - 验证 MySQL 服务正在运行（Windows: `net start mysql80`）

2. **连接失败**
   - 确保 MySQL 服务已启动
   - 检查用户名和密码是否正确
   - 验证 MySQL 端口（默认 3306）是否可访问

3. **路径问题**
   - Windows 路径建议使用正斜杠 `/` 或双反斜杠 `\\`
   - 确保路径中的文件确实存在

4. **依赖问题**
   - 运行 `npm install` 确保所有依赖已安装
   - 确保使用 Node.js 18+ 版本

更多故障排除信息，请参考 [TROUBLESHOOTING.md](./参考文档/TROUBLESHOOTING.md)

## 注意事项

- 确保 MySQL 服务已启动（Windows: `net start mysql80`）
- 用户名和密码通过命令行参数或环境变量传递
- 确保 Node.js 已安装并可在命令行中使用
- 对于自然语言转 SQL，建议先使用 schema 查询工具了解数据库结构
- **不要将包含真实密码的配置文件提交到 Git 仓库**

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
