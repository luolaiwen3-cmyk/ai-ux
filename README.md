Demo 演示流程建议

场景一：展示测试人员视角（2 分钟）

打开 http://localhost:5173/#/join/abc123

点击「我已了解，继续」→ 进入知情同意

点击「同意并开始」→ 设备检测（浏览器会请求摄像头权限，允许即可）

检测通过 → 点击「开始测试」

进入结算页，像真实用户一样操作：勾选商品、看订单摘要

3.5s 后优惠券弹窗自动出现

点击「立即使用」→ 弹窗关闭，摘要显示优惠抵扣

场景二：展示分析人员视角（3 分钟）

打开 http://localhost:5173/#/（仪表盘）

切到「Admin 全局视图」看趋势图表

进入 /#/tasks 展示任务管理

进入 /#/sessions 看会话列表

点进一个会话 /#/sessions/UX-0812-0037

点击播放 → 展示鼠标轨迹回放 + 点击涟漪 + 弹窗同步显隐

拖拽时间轴到 14.5s → 展示 Peak 峰值

点击「触发 Qwen3-VL 智能诊断」→ 等 2.4s → 完整报告出现

点击「查看报告」→ 进入报告导出页

📁 项目结构总览

ai-ux/

├── SYSTEM_ANALYSIS.md      ← 系统分析文档（给评委看）

├── package.json

├── vite.config.js

├── tailwind.config.js

├── index.html

└── src/

  ├── main.jsx         ← 入口（HashRouter）

  ├── App.jsx          ← 路由配置

  ├── index.css         ← 全局样式

  ├── data/

  │  └── sessionData.js    ← 模拟会话数据

  ├── pages/

  │  ├── participant/     ← 测试人员端页面

  │  │  ├── EntryPage.jsx   P1

  │  │  ├── CalibratePage.jsx P2

  │  │  └── TaskPage.jsx   P3

  │  └── analyst/       ← 分析人员端页面

  │    ├── DashboardPage.jsx  A5

  │    ├── TaskManagePage.jsx A1

  │    ├── SessionListPage.jsx A2

  │    ├── SessionDetailPage.jsx A3

  │    └── ReportPage.jsx   A4

  └── components/

​    ├── participant/     ← 测试人员 UI 组件

​    │  ├── CheckoutPage.jsx

​    │  ├── ProductList.jsx

​    │  ├── OrderSummary.jsx

​    │  └── CouponPopup.jsx

​    ├── researcher/      ← 分析回放组件

​    │  ├── ReplayViewport.jsx

​    │  ├── FaceMesh.jsx

​    │  ├── Timeline.jsx

​    │  ├── BehaviorCards.jsx

​    │  ├── StressChart.jsx

​    │  └── DiagnosisPanel.jsx

​    └── shared/

​      └── AnalystLayout.jsx  ← 分析端共享布局



master（生产环境，稳定版本）
  │
  └── develop（开发集成分支）
        │
        ├── feature/测试人员
        │     ├── feat/P1-入口页 git分支 feat/P1-pageOfindex
        │     ├── feat/P2-校准页
        │     └── feat/P3-测试任务页
        │
        └── feature/UX分析人员
              ├── feat/A1-任务管理
              ├── feat/A2-会话列表
              ├── feat/A3-单会话深度分析
              ├── feat/A4-报告导出
              └── feat/A5-仪表盘
