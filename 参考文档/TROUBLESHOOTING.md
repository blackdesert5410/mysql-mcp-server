# MCP 服务器故障排除指南

## "Not connected" 错误解决方案

### 1. 检查配置文件路径

确保 `mcp.json` 中的路径正确：

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

### 2. 验证文件存在

运行以下命令检查文件是否存在：
```powershell
Test-Path "D:\AI\mcp-server\src\index.js"
```

### 3. 重启 Cursor

修改配置后，**必须重启 Cursor** 才能加载新的 MCP 配置。

### 4. 检查 Node.js 路径

确保 `node` 命令在系统 PATH 中：
```powershell
where node
```

如果不在 PATH 中，可以使用完整路径：
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

### 5. 检查依赖

确保已安装所有依赖：
```bash
cd D:\AI\mcp-server
npm install
```

### 6. 手动测试服务器

运行测试脚本验证服务器是否正常工作：
```bash
node test-connection.js
```

如果测试成功，说明服务器本身没问题，问题在于 Cursor 的连接。

### 7. 查看 Cursor 日志

检查 Cursor 的输出面板或日志，查看是否有错误信息。

### 8. 常见问题

- **路径问题**：Windows 路径建议使用正斜杠 `/` 或双反斜杠 `\\`
- **权限问题**：确保 Cursor 有权限访问该路径
- **Node.js 版本**：确保使用 Node.js 18+ 版本
- **端口冲突**：确保 MySQL 服务正在运行（`net start mysql80`）

## 快速修复步骤

1. ✅ 验证文件路径正确
2. ✅ 重启 Cursor 完全关闭并重新打开
3. ✅ 检查 Node.js 是否在 PATH 中
4. ✅ 验证 MySQL 服务正在运行
5. ✅ 检查 `mcp.json` 格式是否正确（JSON 格式）

