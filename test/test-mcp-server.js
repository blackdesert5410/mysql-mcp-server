#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 启动 MCP 服务器进程
const serverPath = join(__dirname, "..", "src", "index.js");
const serverProcess = spawn("node", [serverPath, "root", "qwer1234"], {
  stdio: ["pipe", "pipe", "pipe"],
});

// 创建客户端传输
const transport = new StdioClientTransport({
  command: "node",
  args: [serverPath, "root", "qwer1234"],
});

// 创建客户端
const client = new Client(
  {
    name: "test-client",
    version: "1.0.0",
  },
  {
    capabilities: {},
  }
);

// 测试函数
async function testTool(name, args = {}) {
  try {
    console.log(`\n🔧 测试工具: ${name}`);
    console.log(`   参数: ${JSON.stringify(args, null, 2)}`);
    
    const result = await client.callTool({
      name,
      arguments: args,
    });

    if (result.isError) {
      console.log(`   ❌ 错误: ${result.content[0].text}`);
    } else {
      console.log(`   ✅ 成功`);
      const content = result.content[0].text;
      // 如果内容太长，只显示前 500 个字符
      if (content.length > 500) {
        console.log(`   结果: ${content.substring(0, 500)}...`);
      } else {
        console.log(`   结果: ${content}`);
      }
    }
    return result;
  } catch (error) {
    console.log(`   ❌ 异常: ${error.message}`);
    throw error;
  }
}

// 主测试函数
async function runTests() {
  try {
    console.log("🚀 开始连接 MCP 服务器...");
    await client.connect(transport);
    console.log("✅ 连接成功！\n");

    // 测试 1: 测试连接
    console.log("=".repeat(60));
    console.log("测试 1: 测试 MySQL 连接");
    console.log("=".repeat(60));
    await testTool("test_connection");

    // 测试 2: 列出数据库
    console.log("\n" + "=".repeat(60));
    console.log("测试 2: 列出所有数据库");
    console.log("=".repeat(60));
    await testTool("list_databases");

    // 测试 3: 创建测试数据库
    console.log("\n" + "=".repeat(60));
    console.log("测试 3: 创建测试数据库");
    console.log("=".repeat(60));
    await testTool("create_database", {
      databaseName: "test_mcp_db",
    });

    // 测试 4: 使用数据库
    console.log("\n" + "=".repeat(60));
    console.log("测试 4: 切换到测试数据库");
    console.log("=".repeat(60));
    await testTool("use_database", {
      databaseName: "test_mcp_db",
    });

    // 测试 5: 创建表
    console.log("\n" + "=".repeat(60));
    console.log("测试 5: 创建测试表");
    console.log("=".repeat(60));
    await testTool("create_table", {
      tableName: "users",
      columns: [
        { name: "id", type: "INT", constraints: "PRIMARY KEY AUTO_INCREMENT" },
        { name: "name", type: "VARCHAR(100)", constraints: "NOT NULL" },
        { name: "email", type: "VARCHAR(100)", constraints: "UNIQUE" },
        { name: "age", type: "INT", constraints: "DEFAULT 0" },
        { name: "created_at", type: "TIMESTAMP", constraints: "DEFAULT CURRENT_TIMESTAMP" },
      ],
      databaseName: "test_mcp_db",
    });

    // 测试 6: 列出表
    console.log("\n" + "=".repeat(60));
    console.log("测试 6: 列出数据库中的表");
    console.log("=".repeat(60));
    await testTool("list_tables", {
      databaseName: "test_mcp_db",
    });

    // 测试 7: 获取表结构
    console.log("\n" + "=".repeat(60));
    console.log("测试 7: 获取表结构（Schema）");
    console.log("=".repeat(60));
    await testTool("get_table_schema", {
      tableName: "users",
      databaseName: "test_mcp_db",
    });

    // 测试 8: 插入数据
    console.log("\n" + "=".repeat(60));
    console.log("测试 8: 插入测试数据");
    console.log("=".repeat(60));
    await testTool("insert", {
      tableName: "users",
      data: {
        name: "张三",
        email: "zhangsan@example.com",
        age: 25,
      },
      databaseName: "test_mcp_db",
    });
    await testTool("insert", {
      tableName: "users",
      data: {
        name: "李四",
        email: "lisi@example.com",
        age: 30,
      },
      databaseName: "test_mcp_db",
    });
    await testTool("insert", {
      tableName: "users",
      data: {
        name: "王五",
        email: "wangwu@example.com",
        age: 28,
      },
      databaseName: "test_mcp_db",
    });

    // 测试 9: 查询数据
    console.log("\n" + "=".repeat(60));
    console.log("测试 9: 查询数据（SELECT）");
    console.log("=".repeat(60));
    await testTool("select", {
      tableName: "users",
      databaseName: "test_mcp_db",
    });

    // 测试 10: 条件查询
    console.log("\n" + "=".repeat(60));
    console.log("测试 10: 条件查询（年龄大于 25）");
    console.log("=".repeat(60));
    await testTool("select", {
      tableName: "users",
      where: "age > 25",
      databaseName: "test_mcp_db",
    });

    // 测试 11: 获取示例数据
    console.log("\n" + "=".repeat(60));
    console.log("测试 11: 获取示例数据");
    console.log("=".repeat(60));
    await testTool("get_sample_data", {
      tableName: "users",
      limit: 3,
      databaseName: "test_mcp_db",
    });

    // 测试 12: 更新数据
    console.log("\n" + "=".repeat(60));
    console.log("测试 12: 更新数据（UPDATE）");
    console.log("=".repeat(60));
    await testTool("update", {
      tableName: "users",
      data: {
        age: 26,
      },
      where: "name = '张三'",
      databaseName: "test_mcp_db",
    });

    // 测试 13: 获取数据库完整 Schema
    console.log("\n" + "=".repeat(60));
    console.log("测试 13: 获取数据库完整 Schema");
    console.log("=".repeat(60));
    await testTool("get_database_schema", {
      databaseName: "test_mcp_db",
    });

    // 测试 14: 执行自定义 SQL
    console.log("\n" + "=".repeat(60));
    console.log("测试 14: 执行自定义 SQL");
    console.log("=".repeat(60));
    await testTool("execute_sql", {
      sql: "SELECT COUNT(*) as total FROM users",
      databaseName: "test_mcp_db",
    });

    // 测试 15: 获取表信息
    console.log("\n" + "=".repeat(60));
    console.log("测试 15: 获取表统计信息");
    console.log("=".repeat(60));
    await testTool("get_table_info", {
      tableName: "users",
      databaseName: "test_mcp_db",
    });

    // 测试 16: 获取索引信息
    console.log("\n" + "=".repeat(60));
    console.log("测试 16: 获取索引信息");
    console.log("=".repeat(60));
    await testTool("get_indexes", {
      tableName: "users",
      databaseName: "test_mcp_db",
    });

    // 清理测试数据（可选）
    console.log("\n" + "=".repeat(60));
    console.log("清理: 删除测试数据库");
    console.log("=".repeat(60));
    await testTool("drop_database", {
      databaseName: "test_mcp_db",
    });

    console.log("\n" + "=".repeat(60));
    console.log("✅ 所有测试完成！");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("\n❌ 测试失败:", error);
    process.exit(1);
  } finally {
    await client.close();
    process.exit(0);
  }
}

// 运行测试
runTests().catch((error) => {
  console.error("未处理的错误:", error);
  process.exit(1);
});

