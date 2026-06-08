import type { ComputedRef, MaybeRef } from 'vue'

type ComponentProps<T> = T extends new(...args: any) => { $props: infer P } ? NonNullable<P>
  : T extends (props: infer P, ...args: any) => any ? P
  : {}

declare module 'nuxt/app' {
  interface NuxtLayouts {
    dashboard: ComponentProps<typeof import("/Users/drewdrew/NinjaTools/ninjadipute-main-rebuild/ninjadipute-main/app/layouts/dashboard.vue").default>,
    default: ComponentProps<typeof import("/Users/drewdrew/NinjaTools/ninjadipute-main-rebuild/ninjadipute-main/app/layouts/default.vue").default>,
    none: ComponentProps<typeof import("/Users/drewdrew/NinjaTools/ninjadipute-main-rebuild/ninjadipute-main/app/layouts/none.vue").default>,
}
  export type LayoutKey = keyof NuxtLayouts extends never ? string : keyof NuxtLayouts
  interface PageMeta {
    layout?: MaybeRef<LayoutKey | false> | ComputedRef<LayoutKey | false>
  }
}