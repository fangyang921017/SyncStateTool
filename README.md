# SyncStateTool
基于vuex，用于双向绑定state中的数据


使用方法：

- 在main.ts中
```typescript
import SyncStateTool from 'SyncStateTool/index.ts';
import store from './store';
SyncStateTool.connect(store)
```

- vue组件中

> 通过装饰器
```typescript
import { Component, Vue } from 'vue-property-decorator';
import { createSyncStateDecoratorWithNamespace, SyncState } from 'SyncStateTool/index.ts';

const namespace = 'namespace';
const NamespacedSyncState = createSyncStateDecoratorWithNamespace(moduleName);

@Component
export default class extends Vue {
  // 带命名空间的
  @NamespacedSyncState('pagination.currentPage') currentPage!: string
  @SyncState(namespace, 'pagination.currentPage') currentPage!: string
  
  // 不带命名空间
  @SyncState('pagination.currentPage') currentPage!: string
}

```


> 通过方法映射
```typescript
import Vue from 'vue'
import { createSyncStateMap } from 'SyncStateTool/index.ts';

const namespace = 'namespace';
const syncMapState = createSyncStateMap(namespace);
// 没有命名空间的时候，什么都不传 const syncMapState = createSyncStateMap();

export default Vue.extend({
  // 带命名空间的
  computed: {
  ...syncMapState({
      currentPage: 'pagination.currentPage',
      pageSize: 'pagination.pageSize',
    }),
  }
})

```
