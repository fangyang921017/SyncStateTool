/* eslint-disable no-param-reassign */
import Vue, { ComputedOptions } from 'vue';
import { createDecorator, VueDecorator } from 'vue-class-component';
import { Module, Store } from 'vuex'

let store: Store<unknown>;

interface Idata {
  [key: string]: Idata | string;
}

const isNotBlankString = (value: unknown) => typeof value === 'string' && value !== '';

const isObject = (o: object): boolean => Object.prototype.toString.call(o).slice(8, -1) === 'Object';

const createMutationOrActionName = (keyArr: string[]) => `$$set_${keyArr.join('_')}`;

const changeValue = (obj: unknown, resourcePath: string, data: Idata | string) => {
  const keys = resourcePath.split('.');
  let cState: Idata = obj as Idata;
  for (let i = 0; i < keys.length; i++) {
    const cKey = keys[i];
    if (typeof cState[cKey] !== 'string') {
      if (i === keys.length - 1) {
        cState[cKey] = data;
      } else {
        cState = cState[cKey] as Idata;
      }
    } else {
      cState[cKey] = data;
      break;
    }
  }
}

function getRegisterModuleParams (resourcePath: string, moduleName?: string): [string, object, object]
function getRegisterModuleParams (resourcePath: string, moduleName?: string): [string[], object, object]
function getRegisterModuleParams (resourcePath: string, moduleName?: string): [string | string[], object, object] {
  const hasModleName = moduleName !== undefined;
  const key = hasModleName ? 'mutations' : 'actions';
  const moduleOption = {
    namespaced: true,
    [key]: {
      [createMutationOrActionName(resourcePath.split('.'))] (state: object, data: Idata | string) {
        let targetState;
        let commit: (a: string, b: string | Idata) => void = (a, b) => {}
        if (hasModleName) {
          targetState = state
        } else {
          targetState = (state as {rootState: object}).rootState
          commit = (state as {commit: (a: string) => void}).commit
        }
        changeValue(targetState, resourcePath, data);

        // 由于是通过触发action更新rootState中的数据，调试工具不会记录修改，因此触发一个空的commit让调试工具知道修改了什么
        commit(createMutationOrActionName(resourcePath.split('.')), data)
      }
    }
  }

  if (!hasModleName) {
    moduleOption.mutations = {
      [createMutationOrActionName(resourcePath.split('.'))] () {}
    }
  }

  return [
    hasModleName ? moduleName!.split('/') : '$$mutation_root',
    moduleOption,
    { preserveState: true }
  ]
}

const createMutationOrActionForResource = (resourcePath: string, moduleNamespace?: string) => {
  if (store === undefined) {
    console.error('未连接到store， 请先执行 connect 方法 连接到 store');
    return
  }
  store.registerModule(...getRegisterModuleParams(resourcePath, moduleNamespace))
}

const createComputedItem = (resourcePath: string, moduleNamespace?: string) => {
  createMutationOrActionForResource(resourcePath, moduleNamespace);
  const keysArr = resourcePath.split('.');
  return {
    get (this: Vue) {
      const moduleNamespaceArr = isNotBlankString(moduleNamespace) ? moduleNamespace!.split('/') : [];
      let cRes = this.$store.state;
      [...moduleNamespaceArr, ...keysArr].forEach((ckey) => {
        cRes = cRes[ckey];
      });
      return cRes;
    },
    set (this: Vue, value: unknown) {
      const fixModuleNamespace = isNotBlankString(moduleNamespace) ? `${moduleNamespace}/` : '';
      if (fixModuleNamespace === '') {
        this.$store.dispatch(fixModuleNamespace + createMutationOrActionName(keysArr), value)
      } else {
        this.$store.commit(fixModuleNamespace + createMutationOrActionName(keysArr), value);
      }
    }
  };
}

/**
 * @description 创建 可同步的 mapState，即 state里的数据是双向绑定的
 * @param {string | undefined} 模块化的store的命名空间，不传意味着全局空间
 */
export function createSyncStateMap (storeMudleNamespace?: string) {
  type resType= {
    [prop: string]: ComputedOptions<unknown>;
  }

  return function syncMapState (stateMap: {[prop: string]: string} | string[], moduleNamespace = storeMudleNamespace): resType {
    const map = Array.isArray(stateMap)
      ? stateMap.map(key => ({ key, val: key }))
      : Object.keys(stateMap).map(key => ({ key, val: stateMap[key] }));

    const res: resType = {};

    map.forEach(({ key, val }) => {
      res[key] = createComputedItem(val, moduleNamespace);
    });
    return res;
  }
}

/**
 * @description 为state里的每一个数据自动创建mutation，会遍历对象里面的每一个key来创建，创建的mutation格式为 `set_key1_key2_key3`
 * @param { object ?} 定义store的配置对象
 */
export const createMutations = <T extends Record<string, object>>(opt: Module<T, unknown>) => {
  const cState = opt.state;
  if (cState === undefined || typeof cState === 'function') return;
  const addMutation = (o: T, prefixKeys?: string[]) => {
    prefixKeys = prefixKeys === undefined ? [] : prefixKeys;
    Object.keys(o).forEach((key) => {
      if (opt.mutations !== undefined) {
        opt.mutations[createMutationOrActionName([...prefixKeys, key]) as string] = (state, newValue) => {
          let cO: Record<string, object> = state;
          prefixKeys!.forEach((prefixKey) => {
            cO = cO[prefixKey] as Record<string, object>;
          });
          cO[key] = newValue;
        };
        if (isObject(o[key])) {
          addMutation(o[key] as T, [...prefixKeys, key]);
        }
      }
    });
  };
  addMutation(cState);
};

const _isVue = <V extends Vue>(a: V | string): a is V => (a instanceof Vue)

const _createDecoratorHelper = (namespace: string, sourcePath?: string) => createDecorator((options, key) => {
  const computed = options.computed === undefined ? options.computed = {} : options.computed
  computed[key] = createComputedItem(sourcePath === undefined ? key : sourcePath, namespace)
})

/**
 * @description 提供可以双向绑定state里数据的装饰器
 * @example // @SyncState('a.b') a  ||  @SyncState a
 * @param {(V extends Vue | string)} a
 * @param {string} [b]
 */
export function SyncState<V extends Vue>(vm: V, key: string): void;
export function SyncState(sourcePath: string): VueDecorator;
export function SyncState(namespace: string, sourcePath: string): VueDecorator;
export function SyncState <V extends Vue> (a: V | string, b?: string) {
  if (_isVue(a)) { // 没括号
    return _createDecoratorHelper('', undefined)(a, b as string)
  } else if (b === undefined) { // 有括号 一个参数
    return _createDecoratorHelper('', a);
  } else { // 有括号多（两）个参数
    return _createDecoratorHelper(a, b)
  }
}

/**
 * @description 为特定store模块创建可以双向绑定state里数据的装饰器
 * @export
 * @param {string} namespace
 */
export function createSyncStateDecoratorWithNamespace (namespace: string) {
  function SyncStateWithModule<V extends Vue>(vm: V, key: string): void;
  function SyncStateWithModule(sourcePath: string): VueDecorator;
  function SyncStateWithModule <V extends Vue> (a: V | string, b?: string) {
    if (_isVue(a)) { // 没括号
      return _createDecoratorHelper(namespace, undefined)(a, b as string)
    } else if (b === undefined) { // 有括号 一个参数
      return _createDecoratorHelper(namespace, a);
    }
  }

  if (namespace === '') throw new Error('命名空间不能为空')

  return SyncStateWithModule
}

export function connect (s: Store<any>) {
  store = s;
}

const SyncStateTool = {
  connect
}

export default SyncStateTool
