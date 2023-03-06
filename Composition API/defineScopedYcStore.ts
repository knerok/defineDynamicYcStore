import {defineStore, Pinia, StoreDefinition, StoreGeneric, getActivePinia} from 'pinia'
import {provide, inject, getCurrentInstance, onUnmounted} from 'vue'

type ScopedStoresIds = {[id in string]: string}
const scopedStoresIdsByScope: {[scopeId in string]: ScopedStoresIds} = {}

const scopedStoresByPiniaId: {[piniaId in string]: ReturnType<typeof defineStore>} = {}

export const defineScopeYcStore: typeof defineStore = function(
  idOrOptions: any,
  setup?: any,
  setupOptions?: any,
): StoreDefinition {
  let id
  let options

  const isSetupStore = typeof setup === 'function'
  if (typeof idOrOptions === 'string') {
    id = idOrOptions
    options = isSetupStore ? setupOptions : setup
  } else {
    options = idOrOptions
    id = idOrOptions.id
  }

  function useStore(pinia?: Pinia | null | undefined, hot?: StoreGeneric): StoreGeneric {
    const currentInstance = getCurrentInstance()
    if (currentInstance === null) {
      throw new Error('Scoped stores can not be used outside of Vue component')
    }

    const scopeId = currentInstance.uid
    let piniaId: string | undefined

    if (scopedStoresIdsByScope?.[scopeId]?.[id]) {
      piniaId = scopedStoresIdsByScope[scopeId][id]
    } else {
      piniaId = inject<string>(id)
    }

    if (piniaId && scopedStoresByPiniaId[piniaId]) {
      return scopedStoresByPiniaId[piniaId](pinia, hot)
    }

    piniaId = `${id}/${scopeId}`

    if (isSetupStore) {
      scopedStoresByPiniaId[piniaId] = defineStore(piniaId, setup, options)
    } else {
      scopedStoresByPiniaId[piniaId] = defineStore(piniaId, options)
    }

    scopedStoresIdsByScope[scopeId] = scopedStoresIdsByScope[scopeId] ?? {}
    scopedStoresIdsByScope[scopeId][id] = piniaId

    provide(id, piniaId)

    onUnmounted(() => {
      const pinia = getActivePinia()

      if (!pinia || !piniaId) return

      delete pinia.state.value[piniaId]
      delete scopedStoresByPiniaId[piniaId]
      delete scopedStoresIdsByScope[scopeId]
    })

    return scopedStoresByPiniaId[piniaId](pinia, hot)
  }

  useStore.$id = String(Math.random())

  return useStore
}
