# Harbor Market · InsightUX SDK 测试站

这是一个独立的多页商店，用来验证 InsightUX **外部网页 URL** 任务和 Recorder SDK 握手。页面包含搜索、筛选、商品详情、购物车和结算表单，足以产生可回放的 rrweb 事件。

SDK 不会在普通浏览器标签页里启动录制。只有被 InsightUX 以 iframe 嵌入，并且 `data-task-id` / `data-parent-origin` 与当前任务一致时，才会发出 `READY` 并开始采集。

## 启动

先启动 InsightUX，再启动本 demo：

```bash
npm run dev
npm run demo:sdk
```

默认地址：

- 商店：<http://127.0.0.1:5174/>
- 健康检查：<http://127.0.0.1:5174/health>

可用 `PORT`、`HOST` 修改监听地址。若 InsightUX 不在 `localhost:5173` / `127.0.0.1:5173`，设置：

```bash
INSIGHTUX_ORIGINS=http://127.0.0.1:4173 npm run demo:sdk
```

## 接入 URL 任务

1. 打开 InsightUX 分析端，新建任务，测试网页选择 **外部网页 URL**。
2. 目标地址填写 `http://127.0.0.1:5174/`。请与浏览器地址栏使用同一主机名；`localhost` 和 `127.0.0.1` 不是同一个源。
3. 创建后进入「接入并验证」，复制生成的 `<script>` 标签。
4. 用普通标签页打开商店首页，把代码粘贴到顶部「InsightUX SDK 接入」面板并保存。
5. 回到 InsightUX 等待握手成功，然后发布或试跑。

也可以不保存配置，直接把任务 URL 写成：

```text
http://127.0.0.1:5174/?taskId=TASK_UUID
```

`parentOrigin`、`sdkSrc` 同样支持查询参数。查询参数优先于本地保存的配置。

## 被试操作建议

适合作为任务步骤的操作：

1. 搜索或筛选一件茶叶。
2. 打开商品详情并加入购物车。
3. 在结算页填写地址，决定是否使用优惠码 `HARBOR10`，然后提交订单。

站点里有几处有意为之的摩擦，方便观察犹豫和误操作：首页主按钮与「先看茶叶」筛选不一致、排序会丢掉分类、优惠码藏在「更多优惠」里。

## 作为 ZIP 任务

`public/` 是纯静态站点，可以打包后用「上传网站 ZIP」任务托管。ZIP 根目录必须包含 `index.html`。上传模式下 InsightUX 会自动注入 SDK，不要再把 recorder 脚本写进页面。

## 负例

`http://127.0.0.1:5174/no-sdk` 返回同一商店，但不注入 SDK，可用于确认未握手任务不能发布。
