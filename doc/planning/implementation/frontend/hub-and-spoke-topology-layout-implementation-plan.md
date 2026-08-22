# Hub and Spoke 拓扑节点盒布局实施计划

> Status: Proposed; awaiting review  
> Scope: Hub and Spoke 的 Slot 单元、拓扑坐标、标签方向、连线端点与 1–8 Spoke 动态布局  
> Authoritative visual reference: Create OdyJourney 中的 Hub and Spoke Pattern preview  
> Authoritative engineering guideline: [`frontend-engineering-guidelines.md`](../../../frontend-engineering-guidelines.md)  
> Related: [`m2.4-pattern-presentation-dynamic-slot-remediation-plan.md`](./m2.4-pattern-presentation-dynamic-slot-remediation-plan.md)

## 1. 问题定义

当前混乱不是单个节点的像素偏移，而是布局模型错误：

- 圆点、名称、状态分别定位，没有共同占位盒；
- 算法只排列圆心，没有计算标签和选中光环；
- 上方 Spoke 与 Hub 共用垂直轴时文字进入中心区域；
- 连线以中心点或不稳定 DOM 位置为依据，可能穿过标签；
- CSS 逐状态修补无法覆盖动态 Spoke 数量。

本计划将布局改为由纯 presentation strategy 输出“拓扑节点盒”，组件只呈现结果。

## 2. 冻结的视觉规则

每个 Slot 是完整布局单元：

```text
TopologyNodeBox
├── circle bounds
├── selection halo bounds
├── label bounds
│   ├── name
│   └── status
└── labelPlacement
```

- Hub 始终居中，名称和状态位于圆点下方；
- 上方 Spoke 的标签位于圆点上方；
- 下方 Spoke 的标签位于圆点下方；
- 左右 Spoke 的标签位于外侧；若空间不足，可由明确规则上下错开，但不得进入中心安全区；
- 连线只连接圆形边缘，标签不参与路径；
- 箭头使用统一 marker 形状，并在目标圆边缘前结束；
- 最小安全距离必须包含圆半径、选中光环、箭头和标签预算。

## 3. Spoke 数量与方位

| Spoke 数量 | 冻结布局 |
| --- | --- |
| 1 | 右 |
| 2 | 左、右 |
| 3 | 上、左下、右下 |
| 4 | 上、右、下、左 |
| 5–8 | 单圈均匀分布，按象限决定标签方向 |
| > 8 | 本批不实现双圈；布局能力返回明确的 overflow/unsupported presentation 结果，后续单独设计 |

Slot identity、Hub role 与 topology route 继续来自 domain PatternConfig；坐标和 label placement 是派生 presentation，不持久化。

## 4. 建议类型与纯函数边界

类型名称可按现有代码调整，但职责必须保留：

```ts
type LabelPlacement = 'top' | 'right' | 'bottom' | 'left'

interface TopologyNodeLayout {
  slotId: string
  role: 'hub' | 'spoke'
  center: { x: number; y: number }
  circleRadius: number
  haloRadius: number
  labelPlacement: LabelPlacement
}

interface TopologyEdgeLayout {
  sourceSlotId: string
  targetSlotId: string
  start: { x: number; y: number }
  end: { x: number; y: number }
}

deriveHubAndSpokeLayout(input): Result<HubAndSpokeLayout, LayoutError>
```

约束：

- 函数不读取 DOM、Vue store、router 或 API；
- 相同 slots、bounds 和视觉 metrics 得到相同结果；
- 不使用数组 index 作为 identity；
- edge endpoint 由圆与中心连线的几何交点推导；
- `labelPlacement` 由方位/象限决定，不由组件猜测 class；
- layout 不修改 PatternConfig，不进入 repository payload。

## 5. 实施步骤

1. 盘点现有 Hub and Spoke strategy、presentation adapter 与 SVG/HTML 分层。
2. 提取稳定的视觉 metrics：circle、halo、label box、safe gap、arrow clearance。
3. 实现 1–4 Spoke 的离散方位表。
4. 实现 5–8 Spoke 的单圈角度分布与象限标签规则。
5. 实现圆边缘连线端点与 marker clearance。
6. 让 presentation adapter 输出 node/edge view model；Slot 组件只消费 position 和 placement。
7. 移除旧的 Hub-specific CSS 坐标特例。
8. 对齐 Create OdyJourney preview 的方向语言，同时允许编辑态采用更大的安全间距。

## 6. 测试计划

### 6.1 Pure layout tests

对 1–8 个 Spoke 分别验证：

- Hub 位于可用区域中心；
- slotId 完整、唯一且未改变；
- 方位符合冻结表；
- 所有圆及 halo 在 bounds 内；
- node boxes 不重叠；
- 标签不进入 Hub 中心安全区；
- edge 起终点位于对应圆周，而不是圆心；
- edge 不穿过任何 label box；
- 输入对象未被修改；
- 相同输入结果稳定。

### 6.2 Component/browser tests

- empty/configured/selected/drag-handle 状态不改变拓扑坐标；
- 选中光环不遮挡相邻节点或文字；
- 右键菜单锚点正确；
- 容器 resize 后重新派生 presentation，领域数据不变；
- 1–8 Spoke 在真实浏览器中无文字相撞、线穿文字和裁切。

## 7. 验收标准

- Hub and Spoke 不再依赖按 Slot 序号编写的组件 CSS 坐标；
- 每个 Slot 以完整节点盒参与布局；
- 1–8 个 Spoke 均遵守冻结方位和标签规则；
- 连线仅在圆边缘之间绘制，箭头方向清楚；
- selection、hover、configured 状态不造成布局跳动；
- domain/presentation 边界符合 Pattern strategy 规范；
- lint、typecheck、纯布局测试、component test、browser test 与 build 通过。

