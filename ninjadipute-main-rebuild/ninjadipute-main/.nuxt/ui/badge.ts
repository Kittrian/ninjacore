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
  "subtle"
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
    "base": "font-medium inline-flex items-center",
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
      "subtle": ""
    },
    "size": {
      "xs": {
        "base": "text-[8px]/3 px-1 py-0.5 gap-1 rounded-sm",
        "leadingIcon": "size-3",
        "leadingAvatarSize": "3xs",
        "trailingIcon": "size-3"
      },
      "sm": {
        "base": "text-[10px]/3 px-1.5 py-1 gap-1 rounded-sm",
        "leadingIcon": "size-3",
        "leadingAvatarSize": "3xs",
        "trailingIcon": "size-3"
      },
      "md": {
        "base": "text-xs px-2 py-1 gap-1 rounded-md",
        "leadingIcon": "size-4",
        "leadingAvatarSize": "3xs",
        "trailingIcon": "size-4"
      },
      "lg": {
        "base": "text-sm px-2 py-1 gap-1.5 rounded-md",
        "leadingIcon": "size-5",
        "leadingAvatarSize": "2xs",
        "trailingIcon": "size-5"
      },
      "xl": {
        "base": "text-base px-2.5 py-1 gap-1.5 rounded-md",
        "leadingIcon": "size-6",
        "leadingAvatarSize": "2xs",
        "trailingIcon": "size-6"
      }
    },
    "square": {
      "true": ""
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "bg-primary text-inverted"
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "bg-secondary text-inverted"
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "bg-tertiary text-inverted"
    },
    {
      "color": "info" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "bg-info text-inverted"
    },
    {
      "color": "success" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "bg-success text-inverted"
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "bg-warning text-inverted"
    },
    {
      "color": "error" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "bg-error text-inverted"
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "bg-gray text-inverted"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "bg-amber text-inverted"
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "bg-sky text-inverted"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "bg-emerald text-inverted"
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "bg-zinc text-inverted"
    },
    {
      "color": "red" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "bg-red text-inverted"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "bg-purple text-inverted"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "text-primary ring ring-inset ring-primary/50"
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "text-secondary ring ring-inset ring-secondary/50"
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "text-tertiary ring ring-inset ring-tertiary/50"
    },
    {
      "color": "info" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "text-info ring ring-inset ring-info/50"
    },
    {
      "color": "success" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "text-success ring ring-inset ring-success/50"
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "text-warning ring ring-inset ring-warning/50"
    },
    {
      "color": "error" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "text-error ring ring-inset ring-error/50"
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "text-gray ring ring-inset ring-gray/50"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "text-amber ring ring-inset ring-amber/50"
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "text-sky ring ring-inset ring-sky/50"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "text-emerald ring ring-inset ring-emerald/50"
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "text-zinc ring ring-inset ring-zinc/50"
    },
    {
      "color": "red" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "text-red ring ring-inset ring-red/50"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "text-purple ring ring-inset ring-purple/50"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "bg-primary/10 text-primary"
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "bg-secondary/10 text-secondary"
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "bg-tertiary/10 text-tertiary"
    },
    {
      "color": "info" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "bg-info/10 text-info"
    },
    {
      "color": "success" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "bg-success/10 text-success"
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "bg-warning/10 text-warning"
    },
    {
      "color": "error" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "bg-error/10 text-error"
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "bg-gray/10 text-gray"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "bg-amber/10 text-amber"
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "bg-sky/10 text-sky"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "bg-emerald/10 text-emerald"
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "bg-zinc/10 text-zinc"
    },
    {
      "color": "red" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "bg-red/10 text-red"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "bg-purple/10 text-purple"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "bg-primary/10 text-primary ring ring-inset ring-primary/25"
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "bg-secondary/10 text-secondary ring ring-inset ring-secondary/25"
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "bg-tertiary/10 text-tertiary ring ring-inset ring-tertiary/25"
    },
    {
      "color": "info" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "bg-info/10 text-info ring ring-inset ring-info/25"
    },
    {
      "color": "success" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "bg-success/10 text-success ring ring-inset ring-success/25"
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "bg-warning/10 text-warning ring ring-inset ring-warning/25"
    },
    {
      "color": "error" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "bg-error/10 text-error ring ring-inset ring-error/25"
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "bg-gray/10 text-gray ring ring-inset ring-gray/25"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "bg-amber/10 text-amber ring ring-inset ring-amber/25"
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "bg-sky/10 text-sky ring ring-inset ring-sky/25"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "bg-emerald/10 text-emerald ring ring-inset ring-emerald/25"
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "bg-zinc/10 text-zinc ring ring-inset ring-zinc/25"
    },
    {
      "color": "red" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "bg-red/10 text-red ring ring-inset ring-red/25"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "bg-purple/10 text-purple ring ring-inset ring-purple/25"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-inverted"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-accented text-default bg-default"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-default bg-elevated"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "ring ring-inset ring-accented text-default bg-elevated"
    },
    {
      "size": "xs" as typeof size[number],
      "square": true,
      "class": "p-0.5"
    },
    {
      "size": "sm" as typeof size[number],
      "square": true,
      "class": "p-1"
    },
    {
      "size": "md" as typeof size[number],
      "square": true,
      "class": "p-1"
    },
    {
      "size": "lg" as typeof size[number],
      "square": true,
      "class": "p-1"
    },
    {
      "size": "xl" as typeof size[number],
      "square": true,
      "class": "p-1"
    }
  ],
  "defaultVariants": {
    "color": "primary" as typeof color[number],
    "variant": "solid" as typeof variant[number],
    "size": "md" as typeof size[number]
  }
}