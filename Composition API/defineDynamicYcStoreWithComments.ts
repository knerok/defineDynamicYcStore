import {defineStore, Pinia, StoreDefinition, StoreGeneric, getActivePinia} from 'pinia'
import {provide, inject, getCurrentInstance, onUnmounted} from 'vue'

// id и piniaId.
// id - это первый аргумент функции defineScopeYcStore. К примеру, RecordAcquiringPaymentRedesign.
// piniaId - id стора в pinia, содержит в себе идентификтор скоупа. К примеру, RecordAcquiringPaymentRedesign/123124123123123, где 123124123123123 - идентификатор скоупа(в качестве идентификатора скоупа используется uid первого компонента иерархии, в котором использовался стор)
//
// scopedStoresIdsByScope содержит информацию о том, в каких скоупах(scopeId) и какие именно сторы(id и piniaId) создавались.
// Позволяет для данного скоупа(scopeId) получить id и piniaId всех созданных в данном скоупе сторов. Используется для предотвращения повторного создания сторов с одниковым скоупом
type ScopedStoresIds = {[id in string]: string} // {RecordAcquiringPaymentRedesign: 'RecordAcquiringPaymentRedesign/123124123123123', ...}
const scopedStoresIdsByScope: {[scopeId in string]: ScopedStoresIds} = {} // {123123: {RecordAcquiringPaymentRedesign: 'RecordAcquiringPaymentRedesign/123124123123123', ...}}

//  Содержит ссылки на созданные ранее scoped сторы. Ключом является piniaId, значением - стор
const scopedStoresByPiniaId: {[piniaId in string]: ReturnType<typeof defineStore>} = {}

export const defineScopeYcStore: typeof defineStore = function( // Сигнатуру функции скопировал из сорсов defineStore (https://github.com/vuejs/pinia/blob/v2/packages/pinia/src/store.ts#L852)
  idOrOptions: any,
  setup?: any,
  setupOptions?: any,
): StoreDefinition {
  let id
  let options
  // На основе входящи параметров выделяем id и options. Скопировал из сорсов defineStore
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

    const scopeId = currentInstance.uid // Если опасаетесь использовать uid компонента в качестве идентификатора скоупа - можно самостоятельно проставлять всем компонентам уникальный id с помощью простенького плагина(https://github.com/vuejs/vue/issues/5886#issuecomment-308647738) и опираться на него
    let piniaId: string | undefined // Id нужного нам scoped стора в pinia

    // Проверяем, создавался ли ранее нужный нам стор в текущем компоненте или компонентах-предках. Пытаемся получить piniaId scoped стора
    if (scopedStoresIdsByScope?.[scopeId]?.[id]) {
      piniaId = scopedStoresIdsByScope[scopeId][id]
    } else {
      piniaId = inject<string>(id)
    }

    // Если scoped стор уже создан(удалось получить piniaId) - возвращаем его
    if (piniaId && scopedStoresByPiniaId[piniaId]) {
      return scopedStoresByPiniaId[piniaId](pinia, hot)
    }

    // Если выяснилось, что scoped стор еще не создавался(не удалось получить piniaId) - создаем его
    // piniaId = id стора + идентификатор скоупа
    piniaId = `${id}/${scopeId}`

    // Создаем стор и сохраняем на него ссылку в scopedStoresByPiniaId
    if (isSetupStore) {
      scopedStoresByPiniaId[piniaId] = defineStore(piniaId, setup, options)
    } else {
      scopedStoresByPiniaId[piniaId] = defineStore(piniaId, options)
    }

    // Сохраняем piniaId и id стора в scopedStoresIdsByScopeId
    scopedStoresIdsByScope[scopeId] = scopedStoresIdsByScope[scopeId] ?? {}
    scopedStoresIdsByScope[scopeId][id] = piniaId

    // После создания стора провайдим его piniaId всем потомкам. Так они смогут получить к нему доступ
    provide(id, piniaId)

    // Удаляем стор при удалении скоупа. Нет скоупа - нет scoped стора
    onUnmounted(() => {
      const pinia = getActivePinia()

      if (!pinia || !piniaId) return

      delete pinia.state.value[piniaId] // Взял из api документации pinia (https://pinia.vuejs.org/api/interfaces/pinia._StoreWithState.html#Methods-$dispose)
      delete scopedStoresByPiniaId[piniaId]
      delete scopedStoresIdsByScope[scopeId]
    })

    // Возвращаем созданный стор
    return scopedStoresByPiniaId[piniaId](pinia, hot)
  }

  useStore.$id = String(Math.random()) // В scoped сторах id присвается позже, в момент использования стора. Нужно лишь для того чтобы типизация не ругалась

  return useStore
}
