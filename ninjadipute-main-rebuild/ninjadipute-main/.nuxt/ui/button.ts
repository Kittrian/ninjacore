const color = [
  "primary",
  "secondary",
  "tertiary",
  "info",
  "success",
  "warning",
  "error",
  "gray",
  "amber",
  "sky",
  "emerald",
  "zinc",
  "red",
  "purple",
  "neutral"
] as const

const variant = [
  "solid",
  "outline",
  "soft",
  "subtle",
  "ghost",
  "link"
] as const

const size = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl"
] as const

export default {
  "slots": {
    "base": [
      "rounded-md font-medium inline-flex items-center disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:opacity-75",
      "transition-colors"
    ],
    "label": "truncate",
    "leadingIcon": "shrink-0",
    "leadingAvatar": "shrink-0",
    "leadingAvatarSize": "",
    "trailingIcon": "shrink-0"
  },
  "variants": {
    "fieldGroup": {
      "horizontal": "not-only:first:rounded-e-none not-only:last:rounded-s-none not-last:not-first:rounded-none focus-visible:z-[1]",
      "vertical": "not-only:first:rounded-b-none not-only:last:rounded-t-none not-last:not-first:rounded-none focus-visible:z-[1]"
    },
    "color": {
      "primary": "",
      "secondary": "",
      "tertiary": "",
      "info": "",
      "success": "",
      "warning": "",
      "error": "",
      "gray": "",
      "amber": "",
      "sky": "",
      "emerald": "",
      "zinc": "",
      "red": "",
      "purple": "",
      "neutral": ""
    },
    "variant": {
      "solid": "",
      "outline": "",
      "soft": "",
      "subtle": "",
      "ghost": "",
      "link": ""
    },
    "size": {
      "xs": {
        "base": "px-2 py-1 text-xs gap-1",
        "leadingIcon": "size-4",
        "leadingAvatarSize": "3xs",
        "trailingIcon": "size-4"
      },
      "sm": {
        "base": "px-2.5 py-1.5 text-xs gap-1.5",
        "leadingIcon": "size-4",
        "leadingAvatarSize": "3xs",
        "trailingIcon": "size-4"
      },
      "md": {
        "base": "px-2.5 py-1.5 text-sm gap-1.5",
        "leadingIcon": "size-5",
        "leadingAvatarSize": "2xs",
        "trailingIcon": "size-5"
      },
      "lg": {
        "base": "px-3 py-2 text-sm gap-2",
        "leadingIcon": "size-5",
        "leadingAvatarSize": "2xs",
        "trailingIcon": "size-5"
      },
      "xl": {
        "base": "px-3 py-2 text-base gap-2",
        "leadingIcon": "size-6",
        "leadingAvatarSize": "xs",
        "trailingIcon": "size-6"
      }
    },
    "block": {
      "true": {
        "base": "w-full justify-center",
        "trailingIcon": "ms-auto"
      }
    },
    "square": {
      "true": ""
    },
    "leading": {
      "true": ""
    },
    "trailing": {
      "true": ""
    },
    "loading": {
      "true": ""
    },
    "active": {
      "true": {
        "base": ""
      },
      "false": {
        "base": ""
      }
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-primary hover:bg-primary/75 active:bg-primary/75 disabled:bg-primary aria-disabled:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-secondary hover:bg-secondary/75 active:bg-secondary/75 disabled:bg-secondary aria-disabled:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-tertiary hover:bg-tertiary/75 active:bg-tertiary/75 disabled:bg-tertiary aria-disabled:bg-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tertiary"
    },
    {
      "color": "info" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-info hover:bg-info/75 active:bg-info/75 disabled:bg-info aria-disabled:bg-info focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
    },
    {
      "color": "success" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-success hover:bg-success/75 active:bg-success/75 disabled:bg-success aria-disabled:bg-success focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-warning hover:bg-warning/75 active:bg-warning/75 disabled:bg-warning aria-disabled:bg-warning focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning"
    },
    {
      "color": "error" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-error hover:bg-error/75 active:bg-error/75 disabled:bg-error aria-disabled:bg-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-gray hover:bg-gray/75 active:bg-gray/75 disabled:bg-gray aria-disabled:bg-gray focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-amber hover:bg-amber/75 active:bg-amber/75 disabled:bg-amber aria-disabled:bg-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-sky hover:bg-sky/75 active:bg-sky/75 disabled:bg-sky aria-disabled:bg-sky focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-emerald hover:bg-emerald/75 active:bg-emerald/75 disabled:bg-emerald aria-disabled:bg-emerald focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald"
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-zinc hover:bg-zinc/75 active:bg-zinc/75 disabled:bg-zinc aria-disabled:bg-zinc focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc"
    },
    {
      "color": "red" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-red hover:bg-red/75 active:bg-red/75 disabled:bg-red aria-disabled:bg-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-purple hover:bg-purple/75 active:bg-purple/75 disabled:bg-purple aria-disabled:bg-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-primary/50 text-primary hover:bg-primary/10 active:bg-primary/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-secondary/50 text-secondary hover:bg-secondary/10 active:bg-secondary/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-tertiary/50 text-tertiary hover:bg-tertiary/10 active:bg-tertiary/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-tertiary"
    },
    {
      "color": "info" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-info/50 text-info hover:bg-info/10 active:bg-info/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
    },
    {
      "color": "success" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-success/50 text-success hover:bg-success/10 active:bg-success/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-success"
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-warning/50 text-warning hover:bg-warning/10 active:bg-warning/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-warning"
    },
    {
      "color": "error" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-error/50 text-error hover:bg-error/10 active:bg-error/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-gray/50 text-gray hover:bg-gray/10 active:bg-gray/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-gray"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-amber/50 text-amber hover:bg-amber/10 active:bg-amber/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-sky/50 text-sky hover:bg-sky/10 active:bg-sky/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-sky"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-emerald/50 text-emerald hover:bg-emerald/10 active:bg-emerald/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald"
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-zinc/50 text-zinc hover:bg-zinc/10 active:bg-zinc/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc"
    },
    {
      "color": "red" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-red/50 text-red hover:bg-red/10 active:bg-red/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-red"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-purple/50 text-purple hover:bg-purple/10 active:bg-purple/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-purple"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-primary bg-primary/10 hover:bg-primary/15 active:bg-primary/15 focus:outline-none focus-visible:bg-primary/15 disabled:bg-primary/10 aria-disabled:bg-primary/10"
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-secondary bg-secondary/10 hover:bg-secondary/15 active:bg-secondary/15 focus:outline-none focus-visible:bg-secondary/15 disabled:bg-secondary/10 aria-disabled:bg-secondary/10"
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-tertiary bg-tertiary/10 hover:bg-tertiary/15 active:bg-tertiary/15 focus:outline-none focus-visible:bg-tertiary/15 disabled:bg-tertiary/10 aria-disabled:bg-tertiary/10"
    },
    {
      "color": "info" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-info bg-info/10 hover:bg-info/15 active:bg-info/15 focus:outline-none focus-visible:bg-info/15 disabled:bg-info/10 aria-disabled:bg-info/10"
    },
    {
      "color": "success" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-success bg-success/10 hover:bg-success/15 active:bg-success/15 focus:outline-none focus-visible:bg-success/15 disabled:bg-success/10 aria-disabled:bg-success/10"
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-warning bg-warning/10 hover:bg-warning/15 active:bg-warning/15 focus:outline-none focus-visible:bg-warning/15 disabled:bg-warning/10 aria-disabled:bg-warning/10"
    },
    {
      "color": "error" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-error bg-error/10 hover:bg-error/15 active:bg-error/15 focus:outline-none focus-visible:bg-error/15 disabled:bg-error/10 aria-disabled:bg-error/10"
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-gray bg-gray/10 hover:bg-gray/15 active:bg-gray/15 focus:outline-none focus-visible:bg-gray/15 disabled:bg-gray/10 aria-disabled:bg-gray/10"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-amber bg-amber/10 hover:bg-amber/15 active:bg-amber/15 focus:outline-none focus-visible:bg-amber/15 disabled:bg-amber/10 aria-disabled:bg-amber/10"
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-sky bg-sky/10 hover:bg-sky/15 active:bg-sky/15 focus:outline-none focus-visible:bg-sky/15 disabled:bg-sky/10 aria-disabled:bg-sky/10"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-emerald bg-emerald/10 hover:bg-emerald/15 active:bg-emerald/15 focus:outline-none focus-visible:bg-emerald/15 disabled:bg-emerald/10 aria-disabled:bg-emerald/10"
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-zinc bg-zinc/10 hover:bg-zinc/15 active:bg-zinc/15 focus:outline-none focus-visible:bg-zinc/15 disabled:bg-zinc/10 aria-disabled:bg-zinc/10"
    },
    {
      "color": "red" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-red bg-red/10 hover:bg-red/15 active:bg-red/15 focus:outline-none focus-visible:bg-red/15 disabled:bg-red/10 aria-disabled:bg-red/10"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-purple bg-purple/10 hover:bg-purple/15 active:bg-purple/15 focus:outline-none focus-visible:bg-purple/15 disabled:bg-purple/10 aria-disabled:bg-purple/10"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-primary ring ring-inset ring-primary/25 bg-primary/10 hover:bg-primary/15 active:bg-primary/15 disabled:bg-primary/10 aria-disabled:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-secondary ring ring-inset ring-secondary/25 bg-secondary/10 hover:bg-secondary/15 active:bg-secondary/15 disabled:bg-secondary/10 aria-disabled:bg-secondary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-tertiary ring ring-inset ring-tertiary/25 bg-tertiary/10 hover:bg-tertiary/15 active:bg-tertiary/15 disabled:bg-tertiary/10 aria-disabled:bg-tertiary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-tertiary"
    },
    {
      "color": "info" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-info ring ring-inset ring-info/25 bg-info/10 hover:bg-info/15 active:bg-info/15 disabled:bg-info/10 aria-disabled:bg-info/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
    },
    {
      "color": "success" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-success ring ring-inset ring-success/25 bg-success/10 hover:bg-success/15 active:bg-success/15 disabled:bg-success/10 aria-disabled:bg-success/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-success"
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-warning ring ring-inset ring-warning/25 bg-warning/10 hover:bg-warning/15 active:bg-warning/15 disabled:bg-warning/10 aria-disabled:bg-warning/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning"
    },
    {
      "color": "error" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-error ring ring-inset ring-error/25 bg-error/10 hover:bg-error/15 active:bg-error/15 disabled:bg-error/10 aria-disabled:bg-error/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-gray ring ring-inset ring-gray/25 bg-gray/10 hover:bg-gray/15 active:bg-gray/15 disabled:bg-gray/10 aria-disabled:bg-gray/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-amber ring ring-inset ring-amber/25 bg-amber/10 hover:bg-amber/15 active:bg-amber/15 disabled:bg-amber/10 aria-disabled:bg-amber/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-sky ring ring-inset ring-sky/25 bg-sky/10 hover:bg-sky/15 active:bg-sky/15 disabled:bg-sky/10 aria-disabled:bg-sky/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-emerald ring ring-inset ring-emerald/25 bg-emerald/10 hover:bg-emerald/15 active:bg-emerald/15 disabled:bg-emerald/10 aria-disabled:bg-emerald/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald"
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-zinc ring ring-inset ring-zinc/25 bg-zinc/10 hover:bg-zinc/15 active:bg-zinc/15 disabled:bg-zinc/10 aria-disabled:bg-zinc/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc"
    },
    {
      "color": "red" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-red ring ring-inset ring-red/25 bg-red/10 hover:bg-red/15 active:bg-red/15 disabled:bg-red/10 aria-disabled:bg-red/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-purple ring ring-inset ring-purple/25 bg-purple/10 hover:bg-purple/15 active:bg-purple/15 disabled:bg-purple/10 aria-disabled:bg-purple/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-primary hover:bg-primary/10 active:bg-primary/10 focus:outline-none focus-visible:bg-primary/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-secondary hover:bg-secondary/10 active:bg-secondary/10 focus:outline-none focus-visible:bg-secondary/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-tertiary hover:bg-tertiary/10 active:bg-tertiary/10 focus:outline-none focus-visible:bg-tertiary/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "info" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-info hover:bg-info/10 active:bg-info/10 focus:outline-none focus-visible:bg-info/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "success" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-success hover:bg-success/10 active:bg-success/10 focus:outline-none focus-visible:bg-success/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-warning hover:bg-warning/10 active:bg-warning/10 focus:outline-none focus-visible:bg-warning/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "error" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-error hover:bg-error/10 active:bg-error/10 focus:outline-none focus-visible:bg-error/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-gray hover:bg-gray/10 active:bg-gray/10 focus:outline-none focus-visible:bg-gray/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-amber hover:bg-amber/10 active:bg-amber/10 focus:outline-none focus-visible:bg-amber/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-sky hover:bg-sky/10 active:bg-sky/10 focus:outline-none focus-visible:bg-sky/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-emerald hover:bg-emerald/10 active:bg-emerald/10 focus:outline-none focus-visible:bg-emerald/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-zinc hover:bg-zinc/10 active:bg-zinc/10 focus:outline-none focus-visible:bg-zinc/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "red" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-red hover:bg-red/10 active:bg-red/10 focus:outline-none focus-visible:bg-red/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-purple hover:bg-purple/10 active:bg-purple/10 focus:outline-none focus-visible:bg-purple/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-primary hover:text-primary/75 active:text-primary/75 disabled:text-primary aria-disabled:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-secondary hover:text-secondary/75 active:text-secondary/75 disabled:text-secondary aria-disabled:text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary"
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-tertiary hover:text-tertiary/75 active:text-tertiary/75 disabled:text-tertiary aria-disabled:text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tertiary"
    },
    {
      "color": "info" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-info hover:text-info/75 active:text-info/75 disabled:text-info aria-disabled:text-info focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-info"
    },
    {
      "color": "success" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-success hover:text-success/75 active:text-success/75 disabled:text-success aria-disabled:text-success focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-success"
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-warning hover:text-warning/75 active:text-warning/75 disabled:text-warning aria-disabled:text-warning focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-warning"
    },
    {
      "color": "error" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-error hover:text-error/75 active:text-error/75 disabled:text-error aria-disabled:text-error focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-error"
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-gray hover:text-gray/75 active:text-gray/75 disabled:text-gray aria-disabled:text-gray focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-amber hover:text-amber/75 active:text-amber/75 disabled:text-amber aria-disabled:text-amber focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber"
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-sky hover:text-sky/75 active:text-sky/75 disabled:text-sky aria-disabled:text-sky focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-emerald hover:text-emerald/75 active:text-emerald/75 disabled:text-emerald aria-disabled:text-emerald focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald"
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-zinc hover:text-zinc/75 active:text-zinc/75 disabled:text-zinc aria-disabled:text-zinc focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc"
    },
    {
      "color": "red" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-red hover:text-red/75 active:text-red/75 disabled:text-red aria-disabled:text-red focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-purple hover:text-purple/75 active:text-purple/75 disabled:text-purple aria-disabled:text-purple focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-inverted hover:bg-inverted/90 active:bg-inverted/90 disabled:bg-inverted aria-disabled:bg-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverted"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-accented text-default bg-default hover:bg-elevated active:bg-elevated disabled:bg-default aria-disabled:bg-default focus:outline-none focus-visible:ring-2 focus-visible:ring-inverted"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-default bg-elevated hover:bg-accented/75 active:bg-accented/75 focus:outline-none focus-visible:bg-accented/75 disabled:bg-elevated aria-disabled:bg-elevated"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "ring ring-inset ring-accented text-default bg-elevated hover:bg-accented/75 active:bg-accented/75 disabled:bg-elevated aria-disabled:bg-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-inverted"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "ghost" as typeof variant[number],
      "class": "text-default hover:bg-elevated active:bg-elevated focus:outline-none focus-visible:bg-elevated hover:disabled:bg-transparent dark:hover:disabled:bg-transparent hover:aria-disabled:bg-transparent dark:hover:aria-disabled:bg-transparent"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "link" as typeof variant[number],
      "class": "text-muted hover:text-default active:text-default disabled:text-muted aria-disabled:text-muted focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-inverted"
    },
    {
      "size": "xs" as typeof size[number],
      "square": true,
      "class": "p-1"
    },
    {
      "size": "sm" as typeof size[number],
      "square": true,
      "class": "p-1.5"
    },
    {
      "size": "md" as typeof size[number],
      "square": true,
      "class": "p-1.5"
    },
    {
      "size": "lg" as typeof size[number],
      "square": true,
      "class": "p-2"
    },
    {
      "size": "xl" as typeof size[number],
      "square": true,
      "class": "p-2"
    },
    {
      "loading": true,
      "leading": true,
      "class": {
        "leadingIcon": "animate-spin"
      }
    },
    {
      "loading": true,
      "leading": false,
      "trailing": true,
      "class": {
        "trailingIcon": "animate-spin"
      }
    }
  ],
  "defaultVariants": {
    "color": "primary" as typeof color[number],
    "variant": "solid" as typeof variant[number],
    "size": "md" as typeof size[number]
  }
}