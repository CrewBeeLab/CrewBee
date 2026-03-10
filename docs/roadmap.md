# 路线图

## 里程碑 1：框架基础完成

- [x] 建立 `core / agent-teams / adapters / manager` 四个基础模块
- [x] 定义首版 Team-first 合同模型
- [x] 定义 V1 所需的 manifest / policy / capabilities / profile 类型结构
- [x] 建立 `AgentTeamTemplate` 模板目录
- [x] 建立 `AgentTeams` 已定义 Team 目录
- [ ] 为 adapter 层补充契约级测试

## 里程碑 2：OpenCode Adapter 落地

- [ ] 将 Team 核心模型映射到 OpenCode 宿主运行时
- [ ] 接入运行事件流或等价日志
- [ ] 支持 Team 选择与 Mode 路由

## 里程碑 3：Manager 能力增强

- [ ] 增加 Team 安装 / 列表 / 校验入口
- [ ] 增加运行回放与差异对比能力
- [ ] 增加预算与提示组装分析能力

## 里程碑 4：V1 Team 体系完善

- [x] 定义 Coding Team
- [x] 定义 General Team
- [x] 定义 Wukong Team
- [x] 落实 Coding Team 以主执行 owner 为中心的 Leader 行为规则
- [x] 暴露基础运行状态：Team、Mode、active executor、stage、recent actions
- [x] 将 `src/agent-teams` 拆分为 parser / filesystem / validation / embedded / library 等内聚模块
- [ ] 完善从 `AgentTeams/` 静态文件加载公开 Team 的 loader / validator / source merge 规则
