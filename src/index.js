#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// 从命令行参数获取用户名和密码
// arg1 = 用户名, arg2 = 密码
const username = process.argv[2] || process.env.MYSQL_USER || "root";
const password = process.argv[3] || process.env.MYSQL_PASSWORD || "qwer1234";

// 默认数据库配置
const DEFAULT_CONFIG = {
  host: process.env.MYSQL_HOST || "localhost",
  port: process.env.MYSQL_PORT || 3306,
  user: username,
  password: password,
  database: process.env.MYSQL_DATABASE || null,
};

// 创建 MySQL 连接池
let pool = null;

function createConnection(database = null) {
  const config = {
    ...DEFAULT_CONFIG,
  };
  // 只有当明确指定数据库时才设置 database，否则不设置（允许连接到服务器但不选择数据库）
  if (database !== null) {
    config.database = database;
  } else if (DEFAULT_CONFIG.database) {
    config.database = DEFAULT_CONFIG.database;
  }
  // 如果 database 为 null 且没有默认数据库，则不设置 database 字段
  return mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

// 获取或创建连接池
function getPool(database = null) {
  if (!pool) {
    pool = createConnection(database);
  }
  return pool;
}

// 执行 SQL 查询
async function executeQuery(sql, params = [], database = null) {
  const connectionPool = getPool(database);
  try {
    const [results] = await connectionPool.execute(sql, params);
    return results;
  } catch (error) {
    throw new Error(`SQL 执行错误: ${error.message}`);
  }
}

// 创建 MCP 服务器
const server = new Server(
  {
    name: "mysql-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 列出可用工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_databases",
        description: `列出 MySQL 服务器中的所有数据库。这是探索数据库的第一步，通常在开始查询前需要先了解有哪些数据库可用。
        
使用场景：
- 用户问"有哪些数据库"或"显示所有数据库"
- 需要选择要操作的数据库时
- 探索数据库结构的第一步

示例：调用此工具不需要参数，直接返回所有数据库名称的数组。`,
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "create_database",
        description: `创建新的 MySQL 数据库。用于创建新的数据库实例。

使用场景：
- 用户要求"创建一个名为 X 的数据库"
- 需要初始化新的项目数据库

参数说明：
- databaseName: 数据库名称（必填），例如 "myapp_db"、"test_db"
- charset: 字符集（可选），默认 "utf8mb4"，支持中文等字符
- collation: 排序规则（可选），默认 "utf8mb4_unicode_ci"

示例调用：
{"databaseName": "myapp_db"}
{"databaseName": "test_db", "charset": "utf8mb4", "collation": "utf8mb4_unicode_ci"}`,
        inputSchema: {
          type: "object",
          properties: {
            databaseName: {
              type: "string",
              description: "要创建的数据库名称，例如: 'myapp_db', 'test_db'",
            },
            charset: {
              type: "string",
              description: "字符集（默认: utf8mb4）",
              default: "utf8mb4",
            },
            collation: {
              type: "string",
              description: "排序规则（默认: utf8mb4_unicode_ci）",
              default: "utf8mb4_unicode_ci",
            },
          },
          required: ["databaseName"],
        },
      },
      {
        name: "drop_database",
        description: `删除指定的数据库及其所有表和数据。这是一个危险操作，删除后数据无法恢复。

使用场景：
- 用户要求"删除数据库 X"
- 清理测试数据库
- 重建数据库前删除旧数据库

参数说明：
- databaseName: 要删除的数据库名称（必填）

示例调用：
{"databaseName": "test_db"}
{"databaseName": "old_database"}

注意事项：
- 删除操作不可恢复，请谨慎使用
- 删除前建议先备份重要数据
- 确保没有其他连接正在使用该数据库`,
        inputSchema: {
          type: "object",
          properties: {
            databaseName: {
              type: "string",
              description: "要删除的数据库名称，例如: 'test_db'",
            },
          },
          required: ["databaseName"],
        },
      },
      {
        name: "use_database",
        description: `切换到指定的数据库。在查询表或执行 SQL 前，通常需要先选择要操作的数据库。

使用场景：
- 用户指定了数据库名称，如"查询 test1 数据库中的表"
- 需要在特定数据库中执行操作前
- 切换当前操作的数据库上下文

参数说明：
- databaseName: 要切换到的数据库名称（必填）

示例调用：
{"databaseName": "test1"}
{"databaseName": "myapp_db"}

注意：切换数据库后，后续操作将默认使用该数据库，除非在工具调用中明确指定 databaseName 参数。`,
        inputSchema: {
          type: "object",
          properties: {
            databaseName: {
              type: "string",
              description: "要使用的数据库名称，例如: 'test1', 'myapp_db'",
            },
          },
          required: ["databaseName"],
        },
      },
      {
        name: "list_tables",
        description: `列出指定数据库中的所有表名。这是了解数据库结构的重要步骤，通常在查询数据前需要知道有哪些表。

使用场景：
- 用户问"test1 数据库有哪些表"或"显示所有表"
- 需要了解数据库结构时
- 在生成 SQL 查询前需要确认表名

参数说明：
- databaseName: 数据库名称（可选），如果不提供则使用当前选中的数据库

示例调用：
{"databaseName": "test1"}  // 列出 test1 数据库的所有表
{}  // 列出当前数据库的所有表

典型工作流：先 list_databases -> use_database -> list_tables -> get_table_schema`,
        inputSchema: {
          type: "object",
          properties: {
            databaseName: {
              type: "string",
              description: "数据库名称（可选，如果不提供则使用默认数据库），例如: 'test1'",
            },
          },
        },
      },
      {
        name: "describe_table",
        description: `描述表的基本结构信息。这是 MySQL DESCRIBE 命令的封装，返回表的列信息。

使用场景：
- 快速查看表的基本结构
- 了解列的基本信息

注意：对于更详细的表结构信息（包括外键、索引等），建议使用 get_table_schema 工具。

示例调用：
{"tableName": "users", "databaseName": "test1"}
{"tableName": "orders"}`,
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "表名称，例如: 'users', 'orders'",
            },
            databaseName: {
              type: "string",
              description: "数据库名称（可选），例如: 'test1'",
            },
          },
          required: ["tableName"],
        },
      },
      {
        name: "execute_sql",
        description: `执行任意 SQL 查询或命令。这是最灵活的工具，可以执行 SELECT、INSERT、UPDATE、DELETE、CREATE、ALTER 等任何 SQL 语句。

使用场景：
- 执行复杂的 SQL 查询（多表 JOIN、子查询、聚合函数等）
- 执行 DDL 语句（CREATE TABLE、ALTER TABLE 等）
- 执行批量操作
- 执行自定义 SQL 逻辑

参数说明：
- sql: SQL 语句（必填），可以是任何有效的 MySQL SQL
- databaseName: 数据库名称（可选），如果不提供则使用当前数据库

示例调用：
{"sql": "SELECT * FROM users WHERE age > 25", "databaseName": "test1"}
{"sql": "SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id WHERE o.total > 1000"}
{"sql": "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')"}
{"sql": "UPDATE users SET age = 26 WHERE name = 'John'"}
{"sql": "SELECT COUNT(*) as total FROM users"}

注意事项：
- SQL 语句必须是有效的 MySQL 语法
- 对于查询，返回结果数组
- 对于修改操作，返回影响的行数
- 建议在复杂查询前先使用 get_table_schema 了解表结构`,
        inputSchema: {
          type: "object",
          properties: {
            sql: {
              type: "string",
              description: "要执行的 SQL 语句，例如: 'SELECT * FROM users WHERE age > 25'",
            },
            databaseName: {
              type: "string",
              description: "数据库名称（可选），例如: 'test1'",
            },
          },
          required: ["sql"],
        },
      },
      {
        name: "select",
        description: `执行简单的 SELECT 查询。这是一个便捷工具，用于快速查询单表数据，比 execute_sql 更简单易用。

使用场景：
- 用户问"查询 users 表的所有数据"或"显示年龄大于 25 的用户"
- 简单的单表查询
- 需要指定特定列和条件

参数说明：
- tableName: 表名称（必填）
- columns: 要查询的列数组（可选），如 ["name", "age"]，默认 ["*"] 表示所有列
- where: WHERE 条件字符串（可选），如 "age > 25", "name = 'John'"
- limit: 限制返回行数（可选）
- databaseName: 数据库名称（可选）

示例调用：
{"tableName": "users"}  // 查询所有列所有行
{"tableName": "users", "columns": ["name", "age"], "where": "age > 25"}
{"tableName": "users", "where": "name = 'John'", "limit": 10}
{"tableName": "orders", "databaseName": "test1", "where": "total > 1000"}

注意事项：
- WHERE 条件需要是有效的 SQL WHERE 子句（不含 WHERE 关键字）
- 对于复杂查询（JOIN、子查询等），使用 execute_sql 更合适
- 建议先使用 get_table_schema 确认列名和类型`,
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "表名称，例如: 'users', 'orders'",
            },
            columns: {
              type: "array",
              items: { type: "string" },
              description: "要查询的列数组（默认: *），例如: ['name', 'age', 'email']",
            },
            where: {
              type: "string",
              description: "WHERE 条件字符串（不含 WHERE 关键字），例如: 'age > 25', \"name = 'John'\"",
            },
            limit: {
              type: "number",
              description: "限制返回的行数（可选），例如: 10",
            },
            databaseName: {
              type: "string",
              description: "数据库名称（可选），例如: 'test1'",
            },
          },
          required: ["tableName"],
        },
      },
      {
        name: "insert",
        description: `向表中插入新数据。用于添加新记录。

使用场景：
- 用户要求"添加一个新用户"或"插入数据到 users 表"
- 需要创建新记录时

参数说明：
- tableName: 表名称（必填）
- data: 要插入的数据对象（必填），键为列名，值为要插入的值
- databaseName: 数据库名称（可选）

示例调用：
{"tableName": "users", "data": {"name": "John", "email": "john@example.com", "age": 25}}
{"tableName": "orders", "data": {"user_id": 1, "total": 100.50, "status": "pending"}, "databaseName": "test1"}

注意事项：
- data 对象中的键必须是表中存在的列名
- 建议先使用 get_table_schema 了解表的列和约束
- 主键如果是自增的，不需要在 data 中指定
- 返回插入的行数和自动生成的主键 ID（如果有）`,
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "表名称，例如: 'users', 'orders'",
            },
            data: {
              type: "object",
              description: "要插入的数据对象，键为列名，值为数据，例如: {'name': 'John', 'age': 25}",
            },
            databaseName: {
              type: "string",
              description: "数据库名称（可选），例如: 'test1'",
            },
          },
          required: ["tableName", "data"],
        },
      },
      {
        name: "update",
        description: `更新表中符合条件的数据。用于修改现有记录。

使用场景：
- 用户要求"更新用户信息"或"修改订单状态"
- 需要批量更新符合条件的数据

参数说明：
- tableName: 表名称（必填）
- data: 要更新的数据对象（必填），键为列名，值为新值
- where: WHERE 条件字符串（必填），用于指定要更新哪些行，不含 WHERE 关键字
- databaseName: 数据库名称（可选）

示例调用：
{"tableName": "users", "data": {"age": 26}, "where": "name = 'John'"}
{"tableName": "orders", "data": {"status": "completed"}, "where": "id = 1", "databaseName": "test1"}
{"tableName": "users", "data": {"email": "newemail@example.com", "age": 27}, "where": "id = 5"}

注意事项：
- WHERE 条件必须明确，避免误更新所有数据
- 建议先使用 select 查询确认要更新的数据
- 返回受影响的行数`,
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "表名称，例如: 'users', 'orders'",
            },
            data: {
              type: "object",
              description: "要更新的数据对象，例如: {'age': 26, 'email': 'new@example.com'}",
            },
            where: {
              type: "string",
              description: "WHERE 条件字符串（不含 WHERE 关键字），例如: \"name = 'John'\", 'id = 1'",
            },
            databaseName: {
              type: "string",
              description: "数据库名称（可选），例如: 'test1'",
            },
          },
          required: ["tableName", "data", "where"],
        },
      },
      {
        name: "delete",
        description: `从表中删除符合条件的数据。用于删除记录。

使用场景：
- 用户要求"删除用户"或"删除订单"
- 需要清理数据时

参数说明：
- tableName: 表名称（必填）
- where: WHERE 条件字符串（必填），用于指定要删除哪些行，不含 WHERE 关键字
- databaseName: 数据库名称（可选）

示例调用：
{"tableName": "users", "where": "id = 1"}
{"tableName": "orders", "where": "status = 'cancelled'", "databaseName": "test1"}
{"tableName": "users", "where": "age < 18"}  // 删除年龄小于 18 的用户

注意事项：
- WHERE 条件必须明确，避免误删除所有数据
- 删除操作不可恢复，建议先使用 select 查询确认要删除的数据
- 返回受影响的行数`,
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "表名称，例如: 'users', 'orders'",
            },
            where: {
              type: "string",
              description: "WHERE 条件字符串（不含 WHERE 关键字），例如: \"name = 'John'\", 'id = 1'",
            },
            databaseName: {
              type: "string",
              description: "数据库名称（可选），例如: 'test1'",
            },
          },
          required: ["tableName", "where"],
        },
      },
      {
        name: "create_table",
        description: `创建新的数据库表。用于定义表结构和列。

使用场景：
- 用户要求"创建一个 users 表"或"新建表"
- 需要定义新的数据表结构

参数说明：
- tableName: 表名称（必填）
- columns: 列定义数组（必填），每个列包含：
  - name: 列名（必填）
  - type: 数据类型（必填），如 "INT", "VARCHAR(100)", "TIMESTAMP"
  - constraints: 约束（可选），如 "PRIMARY KEY", "NOT NULL", "AUTO_INCREMENT", "UNIQUE"
- databaseName: 数据库名称（可选）

示例调用：
{"tableName": "users", "columns": [
  {"name": "id", "type": "INT", "constraints": "PRIMARY KEY AUTO_INCREMENT"},
  {"name": "name", "type": "VARCHAR(100)", "constraints": "NOT NULL"},
  {"name": "email", "type": "VARCHAR(100)", "constraints": "UNIQUE"},
  {"name": "age", "type": "INT", "constraints": "DEFAULT 0"},
  {"name": "created_at", "type": "TIMESTAMP", "constraints": "DEFAULT CURRENT_TIMESTAMP"}
], "databaseName": "test1"}

常见数据类型：
- INT, BIGINT, SMALLINT
- VARCHAR(n), CHAR(n), TEXT
- DECIMAL(p,s), FLOAT, DOUBLE
- DATE, DATETIME, TIMESTAMP
- BOOLEAN, TINYINT(1)`,
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "表名称，例如: 'users', 'orders'",
            },
            columns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "列名，例如: 'id', 'name'" },
                  type: { type: "string", description: "数据类型，例如: 'INT', 'VARCHAR(100)'" },
                  constraints: { type: "string", description: "约束，例如: 'PRIMARY KEY AUTO_INCREMENT', 'NOT NULL'" },
                },
                required: ["name", "type"],
              },
              description: "列定义数组，例如: [{'name': 'id', 'type': 'INT', 'constraints': 'PRIMARY KEY'}]",
            },
            databaseName: {
              type: "string",
              description: "数据库名称（可选），例如: 'test1'",
            },
          },
          required: ["tableName", "columns"],
        },
      },
      {
        name: "drop_table",
        description: `删除指定的表及其所有数据。这是一个危险操作，删除后数据无法恢复。

使用场景：
- 用户要求"删除表 X"或"删除 users 表"
- 清理不需要的表
- 重建表前删除旧表

参数说明：
- tableName: 要删除的表名称（必填）
- databaseName: 数据库名称（可选）

示例调用：
{"tableName": "old_users", "databaseName": "test1"}
{"tableName": "temp_table"}  // 删除当前数据库中的表

注意事项：
- 删除操作不可恢复，请谨慎使用
- 删除前建议先备份重要数据
- 如果表有外键约束，可能需要先删除依赖的表`,
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "要删除的表名称，例如: 'users', 'orders'",
            },
            databaseName: {
              type: "string",
              description: "数据库名称（可选），例如: 'test1'",
            },
          },
          required: ["tableName"],
        },
      },
      {
        name: "test_connection",
        description: `测试 MySQL 数据库连接是否正常。用于验证服务器配置和数据库可访问性。

使用场景：
- 首次使用或配置后验证连接
- 排查连接问题时
- 确认 MySQL 服务是否正常运行

示例：调用此工具不需要参数，如果连接成功返回"MySQL 连接成功！"，失败则返回错误信息。

注意：如果连接失败，检查：
1. MySQL 服务是否启动（Windows: net start mysql80）
2. 用户名和密码是否正确
3. 主机和端口配置是否正确`,
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_database_schema",
        description: `获取整个数据库的完整 schema 信息，包括所有表、列、数据类型、约束、主键、外键关系等。这是自然语言转 SQL 的关键工具，帮助理解完整的数据库结构。

使用场景：
- 用户问"test1 数据库的结构是什么"或"显示数据库 schema"
- 需要生成涉及多表 JOIN 的复杂 SQL 查询前
- 理解表之间的关联关系
- 自然语言转 SQL 的第一步：获取完整数据库结构

返回内容：
- 所有表的列表
- 每个表的所有列及其类型、是否可空、默认值、主键信息
- 外键关系（哪些表关联到哪些表）

示例调用：
{"databaseName": "test1"}  // 获取 test1 数据库的完整 schema
{}  // 获取当前数据库的完整 schema

典型工作流（自然语言转 SQL）：
1. get_database_schema 获取完整结构
2. 根据用户问题识别相关表
3. get_table_schema 获取特定表的详细信息（如需要）
4. get_sample_data 查看示例数据（如需要）
5. 生成 SQL 查询
6. execute_sql 执行查询`,
        inputSchema: {
          type: "object",
          properties: {
            databaseName: {
              type: "string",
              description: "数据库名称（可选，如果不提供则使用当前数据库），例如: 'test1'",
            },
          },
        },
      },
      {
        name: "get_table_schema",
        description: `获取指定表的完整 schema 信息，包括所有列名、数据类型、是否可空、默认值、主键、唯一约束、注释等。这是生成准确 SQL 查询的关键工具。

使用场景：
- 用户问"users 表的结构是什么"或"显示表结构"
- 需要知道表中有哪些列及其类型，以便生成正确的 SQL
- 确认列名拼写和数据类型（避免 SQL 错误）
- 在生成 WHERE、SELECT、INSERT 等语句前需要了解列信息

返回内容：
- 表的所有列及其详细信息
- 每列的数据类型（如 VARCHAR(100), INT, TIMESTAMP）
- 是否可空、默认值
- 主键、唯一键信息
- 列注释（如果有）

示例调用：
{"tableName": "users", "databaseName": "test1"}
{"tableName": "orders"}  // 使用当前数据库

典型工作流：
1. list_tables 找到表名
2. get_table_schema 获取表结构
3. 根据列信息生成 SQL（如 SELECT name, age FROM users WHERE age > 25）`,
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "表名称，例如: 'users', 'orders', 'products'",
            },
            databaseName: {
              type: "string",
              description: "数据库名称（可选），例如: 'test1'",
            },
          },
          required: ["tableName"],
        },
      },
      {
        name: "get_foreign_keys",
        description: `获取表的外键关系信息，包括外键列、引用的表和列。这对于理解表之间的关联关系、生成 JOIN 查询非常重要。

使用场景：
- 用户问"orders 表关联到哪些表"或"显示表的外键关系"
- 需要生成多表 JOIN 查询前，了解表之间的关联
- 理解数据库的实体关系（ER）模型

返回内容：
- 外键约束名称
- 当前表的外键列名
- 引用的表名和列名

示例调用：
{"tableName": "orders", "databaseName": "test1"}
{"tableName": "subscription"}  // 查看 subscription 表的外键关系

典型工作流（多表查询）：
1. get_database_schema 或 get_foreign_keys 了解表关联
2. 根据外键关系生成 JOIN 查询
3. execute_sql 执行多表查询`,
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "表名称，例如: 'orders', 'subscription'",
            },
            databaseName: {
              type: "string",
              description: "数据库名称（可选），例如: 'test1'",
            },
          },
          required: ["tableName"],
        },
      },
      {
        name: "get_indexes",
        description: `获取表的索引信息，包括索引名称、列名、索引类型（主键、唯一索引、普通索引等）。这对于理解表的性能优化和查询优化有帮助。

使用场景：
- 需要了解表的索引结构
- 分析查询性能时
- 确认主键和唯一约束

返回内容：
- 索引名称（如 PRIMARY、唯一索引名）
- 索引类型（BTREE、HASH 等）
- 是否唯一索引
- 索引包含的列

示例调用：
{"tableName": "users", "databaseName": "test1"}
{"tableName": "orders"}  // 获取 orders 表的索引信息`,
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "表名称，例如: 'users', 'orders'",
            },
            databaseName: {
              type: "string",
              description: "数据库名称（可选），例如: 'test1'",
            },
          },
          required: ["tableName"],
        },
      },
      {
        name: "get_table_info",
        description: `获取表的统计信息和元数据，包括行数、数据大小、索引大小、存储引擎类型、字符集、创建时间等。这对于了解表的规模和维护信息很有帮助。

使用场景：
- 用户问"users 表有多少条数据"或"表的大小是多少"
- 需要了解表的规模时
- 查看表的存储引擎和配置信息

返回内容：
- 表的行数（近似值）
- 数据大小和索引大小
- 存储引擎（InnoDB、MyISAM 等）
- 字符集和排序规则
- 创建和更新时间

示例调用：
{"tableName": "users", "databaseName": "test1"}
{"tableName": "orders"}  // 获取 orders 表的统计信息`,
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "表名称，例如: 'users', 'orders'",
            },
            databaseName: {
              type: "string",
              description: "数据库名称（可选），例如: 'test1'",
            },
          },
          required: ["tableName"],
        },
      },
      {
        name: "get_sample_data",
        description: `获取表的示例数据（前几行），帮助理解表的数据格式、内容和实际值。这对于生成准确的查询条件、理解数据含义非常重要。

使用场景：
- 用户问"users 表里有什么数据"或"显示一些示例数据"
- 需要了解数据的实际格式（日期格式、字符串格式等）
- 生成 WHERE 条件时需要知道数据的实际值范围
- 理解业务含义（如状态值、类型值等）

参数说明：
- tableName: 表名称（必填）
- limit: 返回的行数（可选，默认 5），建议 3-10 行
- databaseName: 数据库名称（可选）

示例调用：
{"tableName": "users", "limit": 5, "databaseName": "test1"}
{"tableName": "orders", "limit": 3}  // 获取 3 行示例数据

典型工作流：
1. get_table_schema 了解表结构
2. get_sample_data 查看实际数据格式
3. 根据数据格式生成准确的 SQL 查询条件`,
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "表名称，例如: 'users', 'orders'",
            },
            limit: {
              type: "number",
              description: "返回的行数（默认: 5），建议 3-10",
              default: 5,
            },
            databaseName: {
              type: "string",
              description: "数据库名称（可选），例如: 'test1'",
            },
          },
          required: ["tableName"],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "test_connection": {
        // 测试连接时不指定数据库，只测试服务器连接
        const testConfig = {
          host: DEFAULT_CONFIG.host,
          port: DEFAULT_CONFIG.port,
          user: DEFAULT_CONFIG.user,
          password: DEFAULT_CONFIG.password,
          // 不设置 database，只测试服务器连接
        };
        const testPool = mysql.createPool({
          ...testConfig,
          waitForConnections: true,
          connectionLimit: 1,
        });
        try {
          await testPool.execute("SELECT 1");
          await testPool.end();
          return {
            content: [
              {
                type: "text",
                text: "MySQL 连接成功！",
              },
            ],
          };
        } catch (error) {
          await testPool.end();
          throw error;
        }
      }

      case "list_databases": {
        const databases = await executeQuery("SHOW DATABASES");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                databases.map((db) => db.Database),
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_database": {
        const { databaseName, charset, collation } = args;
        const charsetStr = charset || "utf8mb4";
        const collationStr = collation || "utf8mb4_unicode_ci";
        await executeQuery(
          `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET ${charsetStr} COLLATE ${collationStr}`
        );
        return {
          content: [
            {
              type: "text",
              text: `数据库 "${databaseName}" 创建成功！`,
            },
          ],
        };
      }

      case "drop_database": {
        const { databaseName } = args;
        await executeQuery(`DROP DATABASE IF EXISTS \`${databaseName}\``);
        return {
          content: [
            {
              type: "text",
              text: `数据库 "${databaseName}" 已删除！`,
            },
          ],
        };
      }

      case "use_database": {
        const { databaseName } = args;
        pool = createConnection(databaseName);
        await pool.execute("SELECT 1");
        return {
          content: [
            {
              type: "text",
              text: `已切换到数据库 "${databaseName}"`,
            },
          ],
        };
      }

      case "list_tables": {
        const { databaseName } = args;
        const sql = databaseName
          ? `SHOW TABLES FROM \`${databaseName}\``
          : "SHOW TABLES";
        const tables = await executeQuery(sql, [], databaseName);
        const tableKey = databaseName
          ? `Tables_in_${databaseName}`
          : Object.keys(tables[0] || {})[0] || "Tables_in_database";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                tables.map((table) => table[tableKey]),
                null,
                2
              ),
            },
          ],
        };
      }

      case "describe_table": {
        const { tableName, databaseName } = args;
        const sql = databaseName
          ? `DESCRIBE \`${databaseName}\`.\`${tableName}\``
          : `DESCRIBE \`${tableName}\``;
        const structure = await executeQuery(sql, [], databaseName);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(structure, null, 2),
            },
          ],
        };
      }

      case "execute_sql": {
        const { sql, databaseName } = args;
        const results = await executeQuery(sql, [], databaseName);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case "select": {
        const { tableName, columns, where, limit, databaseName } = args;
        let sql = `SELECT ${columns ? columns.join(", ") : "*"} FROM \`${tableName}\``;
        if (where) {
          sql += ` WHERE ${where}`;
        }
        if (limit) {
          sql += ` LIMIT ${limit}`;
        }
        const results = await executeQuery(sql, [], databaseName);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case "insert": {
        const { tableName, data, databaseName } = args;
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map(() => "?").join(", ");
        const sql = `INSERT INTO \`${tableName}\` (\`${columns.join("`, `")}\`) VALUES (${placeholders})`;
        const result = await executeQuery(sql, values, databaseName);
        return {
          content: [
            {
              type: "text",
              text: `插入成功！影响行数: ${result.affectedRows}, 插入 ID: ${result.insertId || "N/A"}`,
            },
          ],
        };
      }

      case "update": {
        const { tableName, data, where, databaseName } = args;
        const setClause = Object.keys(data)
          .map((key) => `\`${key}\` = ?`)
          .join(", ");
        const values = Object.values(data);
        const sql = `UPDATE \`${tableName}\` SET ${setClause} WHERE ${where}`;
        const result = await executeQuery(sql, values, databaseName);
        return {
          content: [
            {
              type: "text",
              text: `更新成功！影响行数: ${result.affectedRows}`,
            },
          ],
        };
      }

      case "delete": {
        const { tableName, where, databaseName } = args;
        const sql = `DELETE FROM \`${tableName}\` WHERE ${where}`;
        const result = await executeQuery(sql, [], databaseName);
        return {
          content: [
            {
              type: "text",
              text: `删除成功！影响行数: ${result.affectedRows}`,
            },
          ],
        };
      }

      case "create_table": {
        const { tableName, columns, databaseName } = args;
        const columnDefs = columns
          .map((col) => {
            let def = `\`${col.name}\` ${col.type}`;
            if (col.constraints) {
              def += ` ${col.constraints}`;
            }
            return def;
          })
          .join(", ");
        const sql = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${columnDefs})`;
        await executeQuery(sql, [], databaseName);
        return {
          content: [
            {
              type: "text",
              text: `表 "${tableName}" 创建成功！`,
            },
          ],
        };
      }

      case "drop_table": {
        const { tableName, databaseName } = args;
        const sql = databaseName
          ? `DROP TABLE IF EXISTS \`${databaseName}\`.\`${tableName}\``
          : `DROP TABLE IF EXISTS \`${tableName}\``;
        await executeQuery(sql, [], databaseName);
        return {
          content: [
            {
              type: "text",
              text: `表 "${tableName}" 已删除！`,
            },
          ],
        };
      }

      case "get_database_schema": {
        const { databaseName } = args;
        const dbName = databaseName || DEFAULT_CONFIG.database;
        
        if (!dbName) {
          throw new Error("请指定数据库名称或先使用 use_database");
        }

        // 获取所有表
        const tables = await executeQuery(
          `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
          [dbName],
          null
        );

        const schema = {
          database: dbName,
          tables: [],
        };

        // 获取每个表的详细信息
        for (const table of tables) {
          const tableName = table.TABLE_NAME;
          
          // 获取列信息
          const columns = await executeQuery(
            `SELECT 
              COLUMN_NAME, 
              DATA_TYPE, 
              IS_NULLABLE, 
              COLUMN_DEFAULT, 
              COLUMN_TYPE,
              COLUMN_KEY,
              EXTRA
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION`,
            [dbName, tableName],
            null
          );

          // 获取外键信息
          const foreignKeys = await executeQuery(
            `SELECT 
              CONSTRAINT_NAME,
              COLUMN_NAME,
              REFERENCED_TABLE_NAME,
              REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = ? 
              AND TABLE_NAME = ?
              AND REFERENCED_TABLE_NAME IS NOT NULL`,
            [dbName, tableName],
            null
          );

          schema.tables.push({
            tableName,
            columns: columns.map((col) => ({
              name: col.COLUMN_NAME,
              type: col.DATA_TYPE,
              fullType: col.COLUMN_TYPE,
              nullable: col.IS_NULLABLE === "YES",
              default: col.COLUMN_DEFAULT,
              key: col.COLUMN_KEY,
              extra: col.EXTRA,
            })),
            foreignKeys: foreignKeys.map((fk) => ({
              constraintName: fk.CONSTRAINT_NAME,
              columnName: fk.COLUMN_NAME,
              referencedTable: fk.REFERENCED_TABLE_NAME,
              referencedColumn: fk.REFERENCED_COLUMN_NAME,
            })),
          });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(schema, null, 2),
            },
          ],
        };
      }

      case "get_table_schema": {
        const { tableName, databaseName } = args;
        const dbName = databaseName || DEFAULT_CONFIG.database;
        
        if (!dbName) {
          throw new Error("请指定数据库名称或先使用 use_database");
        }

        // 获取列信息
        const columns = await executeQuery(
          `SELECT 
            COLUMN_NAME, 
            DATA_TYPE, 
            IS_NULLABLE, 
            COLUMN_DEFAULT, 
            COLUMN_TYPE,
            COLUMN_KEY,
            EXTRA,
            COLUMN_COMMENT
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION`,
          [dbName, tableName],
          null
        );

        if (columns.length === 0) {
          throw new Error(`表 "${tableName}" 不存在`);
        }

        const schema = {
          database: dbName,
          tableName,
          columns: columns.map((col) => ({
            name: col.COLUMN_NAME,
            type: col.DATA_TYPE,
            fullType: col.COLUMN_TYPE,
            nullable: col.IS_NULLABLE === "YES",
            default: col.COLUMN_DEFAULT,
            key: col.COLUMN_KEY,
            extra: col.EXTRA,
            comment: col.COLUMN_COMMENT,
          })),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(schema, null, 2),
            },
          ],
        };
      }

      case "get_foreign_keys": {
        const { tableName, databaseName } = args;
        const dbName = databaseName || DEFAULT_CONFIG.database;
        
        if (!dbName) {
          throw new Error("请指定数据库名称或先使用 use_database");
        }

        const foreignKeys = await executeQuery(
          `SELECT 
            CONSTRAINT_NAME,
            COLUMN_NAME,
            REFERENCED_TABLE_NAME,
            REFERENCED_COLUMN_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = ?
            AND REFERENCED_TABLE_NAME IS NOT NULL`,
          [dbName, tableName],
          null
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                foreignKeys.map((fk) => ({
                  constraintName: fk.CONSTRAINT_NAME,
                  columnName: fk.COLUMN_NAME,
                  referencedTable: fk.REFERENCED_TABLE_NAME,
                  referencedColumn: fk.REFERENCED_COLUMN_NAME,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_indexes": {
        const { tableName, databaseName } = args;
        const dbName = databaseName || DEFAULT_CONFIG.database;
        
        if (!dbName) {
          throw new Error("请指定数据库名称或先使用 use_database");
        }

        const indexes = await executeQuery(
          `SELECT 
            INDEX_NAME,
            COLUMN_NAME,
            NON_UNIQUE,
            SEQ_IN_INDEX,
            INDEX_TYPE
          FROM INFORMATION_SCHEMA.STATISTICS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
          ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
          [dbName, tableName],
          null
        );

        // 按索引名称分组
        const indexMap = {};
        for (const idx of indexes) {
          if (!indexMap[idx.INDEX_NAME]) {
            indexMap[idx.INDEX_NAME] = {
              name: idx.INDEX_NAME,
              unique: idx.NON_UNIQUE === 0,
              type: idx.INDEX_TYPE,
              columns: [],
            };
          }
          indexMap[idx.INDEX_NAME].columns.push({
            name: idx.COLUMN_NAME,
            sequence: idx.SEQ_IN_INDEX,
          });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(Object.values(indexMap), null, 2),
            },
          ],
        };
      }

      case "get_table_info": {
        const { tableName, databaseName } = args;
        const dbName = databaseName || DEFAULT_CONFIG.database;
        
        if (!dbName) {
          throw new Error("请指定数据库名称或先使用 use_database");
        }

        const info = await executeQuery(
          `SELECT 
            TABLE_ROWS,
            DATA_LENGTH,
            INDEX_LENGTH,
            ENGINE,
            TABLE_COLLATION,
            CREATE_TIME,
            UPDATE_TIME
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
          [dbName, tableName],
          null
        );

        if (info.length === 0) {
          throw new Error(`表 "${tableName}" 不存在`);
        }

        const tableInfo = info[0];
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  tableName,
                  database: dbName,
                  rows: tableInfo.TABLE_ROWS,
                  dataLength: tableInfo.DATA_LENGTH,
                  indexLength: tableInfo.INDEX_LENGTH,
                  engine: tableInfo.ENGINE,
                  collation: tableInfo.TABLE_COLLATION,
                  createTime: tableInfo.CREATE_TIME,
                  updateTime: tableInfo.UPDATE_TIME,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_sample_data": {
        const { tableName, limit, databaseName } = args;
        const limitValue = limit || 5;
        const sql = `SELECT * FROM \`${tableName}\` LIMIT ${limitValue}`;
        const results = await executeQuery(sql, [], databaseName);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`未知工具: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `错误: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MySQL MCP 服务器已启动");
}

main().catch((error) => {
  console.error("服务器启动失败:", error);
  process.exit(1);
});

