# System Configuration 统一网格与 Behavior 边界实施计划

> Status: Proposed; awaiting review  
> Scope: OdyJourney System Configuration 页面结构、三列 Execution 布局、Behavior 跨列边界与响应式降级  
> Authoritative design: Figma `OdyJourney — Behavior Coming Soon`  
> Authoritative engineering guideline: [`frontend-engineering-guidelines.md`](../../../frontend-engineering-guidelines.md)  
> Related: [`guardrail-single-agent-interaction-implementation-plan.md`](./guardrail-single-agent-interaction-implementation-plan.md)、[`hub-and-spoke-topology-layout-implementation-plan.md`](./hub-and-spoke-topology-layout-implementation-plan.md)

## 1. 目标

将当前依赖局部宽度、偏移与卡片内部定位的页面改为一个统一、可响应的布局系统，使视觉边界准确表达领域语义：

```text
Input Guardrail | Main Execution | Output Guardrail
----------------------------------------------------
             Execution Behavior
```

Behavior 是横切整个执行链的模块，不是 Main Execution 的子区域。因此：

- 左边界必须与 Input Guardrail 对齐；
- 右边界必须与 Output Guardrail 对齐；
- 第一行三块与第二行共享同一网格和间距来源；
- 页面尺寸变化时不能依赖手写宽度或按截图校准的绝对位置。

## 2. 范围与非目标

本计划包括：

- System Configuration 内容区的统一 grid；
- Input、Main Execution、Output 三列的宽度约束与对齐；
- Behavior 使用 `grid-column: 1 / -1` 跨越三列；
- 卡片高度、padding、gap、边框和 breakpoint 的一致化；
- loading、inactive、active、empty 等状态下不发生布局跳动；
- 与现有 design token 对齐。

本计划不包括：

- 修改 Journey 创建时的 Pattern 选择；
- 修改 Pattern 领域结构；
- 实现 Behavior 的具体配置能力；
- 将 Figma frame 映射成新的 route；
- 在页面组件中复制 Guardrail 或 Pattern 的业务规则。

## 3. 布局契约

### 3.1 桌面布局

外层只存在一个权威网格：

```css
grid-template-columns:
  minmax(var(--guardrail-min), var(--guardrail-max))
  minmax(0, 1fr)
  minmax(var(--guardrail-min), var(--guardrail-max));
```

- Guardrail 两列等宽且对称；
- Main Execution 获取剩余空间，并允许内部正确收缩；
- Behavior 跨越全部三列；
- 第一行卡片顶部、底部和列间 gap 来自共享 token；
- 不以 Pattern kind 决定外层页面宽度。

### 3.2 响应式降级

在空间不足以保持三列可用性时，冻结为顺序堆叠：

```text
Main Execution
Input Guardrail | Output Guardrail
Execution Behavior
```

更窄视口可继续降为单列。断点由内容最小可用宽度决定，而不是针对某台设备写特例。DOM 阅读顺序与键盘顺序必须保持合理，不能只使用 CSS 视觉重排制造语义错位。

### 3.3 状态稳定性

- Guardrail 从 inactive 切换 active 时外层列宽不变；
- Pattern 节点选中光环不能撑大 grid item；
- Context menu 使用 overlay/teleport，不参与文档流；
- loading skeleton 应保留最终卡片的基本尺寸；
- Behavior coming-soon 内容不能反向决定三列宽度。

## 4. 架构与组件边界

- 页面 container 只组合领域状态、session state 与 typed intents；
- `SystemConfigurationLayout`（或等价展示组件）只负责 grid，不读取 repository；
- Guardrail 和 Execution 作为独立 grid child，不互相读取 DOM 尺寸作为业务输入；
- 若 Pattern presentation 需要容器尺寸，使用明确的 presentation measurement adapter，并仅产生 UI layout 输入；
- measurement、selection、hover 与 breakpoint 都不得进入 Journey persistence payload。

## 5. 实施步骤

1. 盘点当前 System Configuration DOM、CSS width/position 来源及重复容器。
2. 建立单一 grid 容器和语义明确的 grid areas。
3. 将 Behavior 移入同一 grid，并跨越所有列。
4. 将视觉常量映射到已有 token；确有缺口时新增命名 token，禁止散布 raw magic number。
5. 定义桌面、紧凑桌面和窄屏的降级规则。
6. 删除被统一 grid 替代的绝对宽度、负 margin 和位置补丁。
7. 验证四种 Main Execution Pattern、Guardrail 四种启用组合和 Behavior 状态。

## 6. 测试计划

### 6.1 Component tests

- Behavior 始终跨越完整 grid；
- Input/Output 卡片占据对称列；
- inactive/active 切换不改变结构顺序；
- 页面只派发 intent，不直接修改 Journey aggregate。

### 6.2 Browser tests

- 常用桌面宽度、窄桌面和移动宽度无横向溢出；
- Input、Output、双侧 Guardrail active 时边界仍对齐；
- 四种 Pattern 切换测试数据时 Main Execution 不挤压两侧；
- context menu、focus ring 和键盘 Tab 顺序正确；
- Behavior 左右边界分别与两侧 Guardrail 外边界对齐。

## 7. 验收标准

- 页面由一个统一 grid 决定第一、二行几何关系；
- Behavior 覆盖 Input → Main Execution → Output 的完整宽度；
- 不存在为特定 Pattern 或 Slot 数量添加的页面级宽度特例；
- Guardrail 状态切换不会造成列宽跳变；
- lint、typecheck、相关 component test、browser test 与 production build 通过。

