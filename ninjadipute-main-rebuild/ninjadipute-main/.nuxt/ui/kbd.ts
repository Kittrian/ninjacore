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
  "sm",
  "md",
  "lg"
] as const

export default {
  "base": "inline-flex items-center justify-center px-1 rounded-sm font-medium font-sans uppercase",
  "variants": {
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
      "sm": "h-4 min-w-[16px] text-[10px]",
      "md": "h-5 min-w-[20px] text-[11px]",
      "lg": "h-6 min-w-[24px] text-[12px]"
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-primary"
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-secondary"
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-tertiary"
    },
    {
      "color": "info" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-info"
    },
    {
      "color": "success" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-success"
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-warning"
    },
    {
      "color": "error" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-error"
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-gray"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-amber"
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-sky"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-emerald"
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-zinc"
    },
    {
      "color": "red" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-red"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-purple"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-primary/50 text-primary"
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-secondary/50 text-secondary"
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-tertiary/50 text-tertiary"
    },
    {
      "color": "info" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-info/50 text-info"
    },
    {
      "color": "success" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-success/50 text-success"
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-warning/50 text-warning"
    },
    {
      "color": "error" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-error/50 text-error"
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-gray/50 text-gray"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-amber/50 text-amber"
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-sky/50 text-sky"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-emerald/50 text-emerald"
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-zinc/50 text-zinc"
    },
    {
      "color": "red" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-red/50 text-red"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-purple/50 text-purple"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-primary bg-primary/10"
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-secondary bg-secondary/10"
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-tertiary bg-tertiary/10"
    },
    {
      "color": "info" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-info bg-info/10"
    },
    {
      "color": "success" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-success bg-success/10"
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-warning bg-warning/10"
    },
    {
      "color": "error" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-error bg-error/10"
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-gray bg-gray/10"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-amber bg-amber/10"
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-sky bg-sky/10"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-emerald bg-emerald/10"
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-zinc bg-zinc/10"
    },
    {
      "color": "red" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-red bg-red/10"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-purple bg-purple/10"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-primary ring ring-inset ring-primary/25 bg-primary/10"
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-secondary ring ring-inset ring-secondary/25 bg-secondary/10"
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-tertiary ring ring-inset ring-tertiary/25 bg-tertiary/10"
    },
    {
      "color": "info" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-info ring ring-inset ring-info/25 bg-info/10"
    },
    {
      "color": "success" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-success ring ring-inset ring-success/25 bg-success/10"
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-warning ring ring-inset ring-warning/25 bg-warning/10"
    },
    {
      "color": "error" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-error ring ring-inset ring-error/25 bg-error/10"
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-gray ring ring-inset ring-gray/25 bg-gray/10"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-amber ring ring-inset ring-amber/25 bg-amber/10"
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-sky ring ring-inset ring-sky/25 bg-sky/10"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-emerald ring ring-inset ring-emerald/25 bg-emerald/10"
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-zinc ring ring-inset ring-zinc/25 bg-zinc/10"
    },
    {
      "color": "red" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-red ring ring-inset ring-red/25 bg-red/10"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-purple ring ring-inset ring-purple/25 bg-purple/10"
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
    }
  ],
  "defaultVariants": {
    "variant": "outline" as typeof variant[number],
    "color": "neutral" as typeof color[number],
    "size": "md" as typeof size[number]
  }
}