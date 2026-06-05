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
    "root": "",
    "header": "flex items-center justify-between",
    "body": "flex flex-col space-y-4 pt-4 sm:flex-row sm:space-x-4 sm:space-y-0",
    "heading": "text-center font-medium truncate mx-auto",
    "grid": "w-full border-collapse select-none space-y-1 focus:outline-none",
    "gridRow": "grid grid-cols-7 place-items-center",
    "gridWeekDaysRow": "mb-1 grid w-full grid-cols-7",
    "gridBody": "grid",
    "headCell": "rounded-md",
    "headCellWeek": "rounded-md text-muted",
    "cell": "relative text-center",
    "cellTrigger": [
      "m-0.5 relative flex items-center justify-center rounded-full whitespace-nowrap focus-visible:ring-2 focus:outline-none data-disabled:text-muted data-unavailable:line-through data-unavailable:text-muted data-unavailable:pointer-events-none data-today:font-semibold data-[outside-view]:text-muted",
      "transition"
    ],
    "cellWeek": "relative text-center text-muted"
  },
  "variants": {
    "color": {
      "primary": {
        "headCell": "text-primary",
        "cellTrigger": "focus-visible:ring-primary"
      },
      "secondary": {
        "headCell": "text-secondary",
        "cellTrigger": "focus-visible:ring-secondary"
      },
      "tertiary": {
        "headCell": "text-tertiary",
        "cellTrigger": "focus-visible:ring-tertiary"
      },
      "info": {
        "headCell": "text-info",
        "cellTrigger": "focus-visible:ring-info"
      },
      "success": {
        "headCell": "text-success",
        "cellTrigger": "focus-visible:ring-success"
      },
      "warning": {
        "headCell": "text-warning",
        "cellTrigger": "focus-visible:ring-warning"
      },
      "error": {
        "headCell": "text-error",
        "cellTrigger": "focus-visible:ring-error"
      },
      "gray": {
        "headCell": "text-gray",
        "cellTrigger": "focus-visible:ring-gray"
      },
      "amber": {
        "headCell": "text-amber",
        "cellTrigger": "focus-visible:ring-amber"
      },
      "sky": {
        "headCell": "text-sky",
        "cellTrigger": "focus-visible:ring-sky"
      },
      "emerald": {
        "headCell": "text-emerald",
        "cellTrigger": "focus-visible:ring-emerald"
      },
      "zinc": {
        "headCell": "text-zinc",
        "cellTrigger": "focus-visible:ring-zinc"
      },
      "red": {
        "headCell": "text-red",
        "cellTrigger": "focus-visible:ring-red"
      },
      "purple": {
        "headCell": "text-purple",
        "cellTrigger": "focus-visible:ring-purple"
      },
      "neutral": {
        "headCell": "text-highlighted",
        "cellTrigger": "focus-visible:ring-inverted"
      }
    },
    "variant": {
      "solid": "",
      "outline": "",
      "soft": "",
      "subtle": ""
    },
    "size": {
      "xs": {
        "heading": "text-xs",
        "cell": "text-xs",
        "cellWeek": "text-xs",
        "headCell": "text-[10px]",
        "headCellWeek": "text-[10px]",
        "cellTrigger": "size-7",
        "body": "space-y-2 pt-2"
      },
      "sm": {
        "heading": "text-xs",
        "headCell": "text-xs",
        "headCellWeek": "text-xs",
        "cellWeek": "text-xs",
        "cell": "text-xs",
        "cellTrigger": "size-7"
      },
      "md": {
        "heading": "text-sm",
        "headCell": "text-xs",
        "headCellWeek": "text-xs",
        "cellWeek": "text-xs",
        "cell": "text-sm",
        "cellTrigger": "size-8"
      },
      "lg": {
        "heading": "text-md",
        "headCell": "text-md",
        "headCellWeek": "text-md",
        "cellTrigger": "size-9 text-md"
      },
      "xl": {
        "heading": "text-lg",
        "headCell": "text-lg",
        "headCellWeek": "text-lg",
        "cellTrigger": "size-10 text-lg"
      }
    },
    "weekNumbers": {
      "true": {
        "gridRow": "grid-cols-8",
        "gridWeekDaysRow": "grid-cols-8 [&>*:first-child]:col-start-2"
      }
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-primary data-[selected]:text-inverted data-today:not-data-[selected]:text-primary data-[highlighted]:bg-primary/20 hover:not-data-[selected]:bg-primary/20"
      }
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-secondary data-[selected]:text-inverted data-today:not-data-[selected]:text-secondary data-[highlighted]:bg-secondary/20 hover:not-data-[selected]:bg-secondary/20"
      }
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-tertiary data-[selected]:text-inverted data-today:not-data-[selected]:text-tertiary data-[highlighted]:bg-tertiary/20 hover:not-data-[selected]:bg-tertiary/20"
      }
    },
    {
      "color": "info" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-info data-[selected]:text-inverted data-today:not-data-[selected]:text-info data-[highlighted]:bg-info/20 hover:not-data-[selected]:bg-info/20"
      }
    },
    {
      "color": "success" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-success data-[selected]:text-inverted data-today:not-data-[selected]:text-success data-[highlighted]:bg-success/20 hover:not-data-[selected]:bg-success/20"
      }
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-warning data-[selected]:text-inverted data-today:not-data-[selected]:text-warning data-[highlighted]:bg-warning/20 hover:not-data-[selected]:bg-warning/20"
      }
    },
    {
      "color": "error" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-error data-[selected]:text-inverted data-today:not-data-[selected]:text-error data-[highlighted]:bg-error/20 hover:not-data-[selected]:bg-error/20"
      }
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-gray data-[selected]:text-inverted data-today:not-data-[selected]:text-gray data-[highlighted]:bg-gray/20 hover:not-data-[selected]:bg-gray/20"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-amber data-[selected]:text-inverted data-today:not-data-[selected]:text-amber data-[highlighted]:bg-amber/20 hover:not-data-[selected]:bg-amber/20"
      }
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-sky data-[selected]:text-inverted data-today:not-data-[selected]:text-sky data-[highlighted]:bg-sky/20 hover:not-data-[selected]:bg-sky/20"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-emerald data-[selected]:text-inverted data-today:not-data-[selected]:text-emerald data-[highlighted]:bg-emerald/20 hover:not-data-[selected]:bg-emerald/20"
      }
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-zinc data-[selected]:text-inverted data-today:not-data-[selected]:text-zinc data-[highlighted]:bg-zinc/20 hover:not-data-[selected]:bg-zinc/20"
      }
    },
    {
      "color": "red" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-red data-[selected]:text-inverted data-today:not-data-[selected]:text-red data-[highlighted]:bg-red/20 hover:not-data-[selected]:bg-red/20"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-purple data-[selected]:text-inverted data-today:not-data-[selected]:text-purple data-[highlighted]:bg-purple/20 hover:not-data-[selected]:bg-purple/20"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-primary/50 data-[selected]:text-primary data-today:not-data-[selected]:text-primary data-[highlighted]:bg-primary/10 hover:not-data-[selected]:bg-primary/10"
      }
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-secondary/50 data-[selected]:text-secondary data-today:not-data-[selected]:text-secondary data-[highlighted]:bg-secondary/10 hover:not-data-[selected]:bg-secondary/10"
      }
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-tertiary/50 data-[selected]:text-tertiary data-today:not-data-[selected]:text-tertiary data-[highlighted]:bg-tertiary/10 hover:not-data-[selected]:bg-tertiary/10"
      }
    },
    {
      "color": "info" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-info/50 data-[selected]:text-info data-today:not-data-[selected]:text-info data-[highlighted]:bg-info/10 hover:not-data-[selected]:bg-info/10"
      }
    },
    {
      "color": "success" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-success/50 data-[selected]:text-success data-today:not-data-[selected]:text-success data-[highlighted]:bg-success/10 hover:not-data-[selected]:bg-success/10"
      }
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-warning/50 data-[selected]:text-warning data-today:not-data-[selected]:text-warning data-[highlighted]:bg-warning/10 hover:not-data-[selected]:bg-warning/10"
      }
    },
    {
      "color": "error" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-error/50 data-[selected]:text-error data-today:not-data-[selected]:text-error data-[highlighted]:bg-error/10 hover:not-data-[selected]:bg-error/10"
      }
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-gray/50 data-[selected]:text-gray data-today:not-data-[selected]:text-gray data-[highlighted]:bg-gray/10 hover:not-data-[selected]:bg-gray/10"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-amber/50 data-[selected]:text-amber data-today:not-data-[selected]:text-amber data-[highlighted]:bg-amber/10 hover:not-data-[selected]:bg-amber/10"
      }
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-sky/50 data-[selected]:text-sky data-today:not-data-[selected]:text-sky data-[highlighted]:bg-sky/10 hover:not-data-[selected]:bg-sky/10"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-emerald/50 data-[selected]:text-emerald data-today:not-data-[selected]:text-emerald data-[highlighted]:bg-emerald/10 hover:not-data-[selected]:bg-emerald/10"
      }
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-zinc/50 data-[selected]:text-zinc data-today:not-data-[selected]:text-zinc data-[highlighted]:bg-zinc/10 hover:not-data-[selected]:bg-zinc/10"
      }
    },
    {
      "color": "red" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-red/50 data-[selected]:text-red data-today:not-data-[selected]:text-red data-[highlighted]:bg-red/10 hover:not-data-[selected]:bg-red/10"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-purple/50 data-[selected]:text-purple data-today:not-data-[selected]:text-purple data-[highlighted]:bg-purple/10 hover:not-data-[selected]:bg-purple/10"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-primary/10 data-[selected]:text-primary data-today:not-data-[selected]:text-primary data-[highlighted]:bg-primary/20 hover:not-data-[selected]:bg-primary/20"
      }
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-secondary/10 data-[selected]:text-secondary data-today:not-data-[selected]:text-secondary data-[highlighted]:bg-secondary/20 hover:not-data-[selected]:bg-secondary/20"
      }
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-tertiary/10 data-[selected]:text-tertiary data-today:not-data-[selected]:text-tertiary data-[highlighted]:bg-tertiary/20 hover:not-data-[selected]:bg-tertiary/20"
      }
    },
    {
      "color": "info" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-info/10 data-[selected]:text-info data-today:not-data-[selected]:text-info data-[highlighted]:bg-info/20 hover:not-data-[selected]:bg-info/20"
      }
    },
    {
      "color": "success" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-success/10 data-[selected]:text-success data-today:not-data-[selected]:text-success data-[highlighted]:bg-success/20 hover:not-data-[selected]:bg-success/20"
      }
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-warning/10 data-[selected]:text-warning data-today:not-data-[selected]:text-warning data-[highlighted]:bg-warning/20 hover:not-data-[selected]:bg-warning/20"
      }
    },
    {
      "color": "error" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-error/10 data-[selected]:text-error data-today:not-data-[selected]:text-error data-[highlighted]:bg-error/20 hover:not-data-[selected]:bg-error/20"
      }
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-gray/10 data-[selected]:text-gray data-today:not-data-[selected]:text-gray data-[highlighted]:bg-gray/20 hover:not-data-[selected]:bg-gray/20"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-amber/10 data-[selected]:text-amber data-today:not-data-[selected]:text-amber data-[highlighted]:bg-amber/20 hover:not-data-[selected]:bg-amber/20"
      }
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-sky/10 data-[selected]:text-sky data-today:not-data-[selected]:text-sky data-[highlighted]:bg-sky/20 hover:not-data-[selected]:bg-sky/20"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-emerald/10 data-[selected]:text-emerald data-today:not-data-[selected]:text-emerald data-[highlighted]:bg-emerald/20 hover:not-data-[selected]:bg-emerald/20"
      }
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-zinc/10 data-[selected]:text-zinc data-today:not-data-[selected]:text-zinc data-[highlighted]:bg-zinc/20 hover:not-data-[selected]:bg-zinc/20"
      }
    },
    {
      "color": "red" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-red/10 data-[selected]:text-red data-today:not-data-[selected]:text-red data-[highlighted]:bg-red/20 hover:not-data-[selected]:bg-red/20"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-purple/10 data-[selected]:text-purple data-today:not-data-[selected]:text-purple data-[highlighted]:bg-purple/20 hover:not-data-[selected]:bg-purple/20"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-primary/10 data-[selected]:text-primary data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-primary/25 data-today:not-data-[selected]:text-primary data-[highlighted]:bg-primary/20 hover:not-data-[selected]:bg-primary/20"
      }
    },
    {
      "color": "secondary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-secondary/10 data-[selected]:text-secondary data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-secondary/25 data-today:not-data-[selected]:text-secondary data-[highlighted]:bg-secondary/20 hover:not-data-[selected]:bg-secondary/20"
      }
    },
    {
      "color": "tertiary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-tertiary/10 data-[selected]:text-tertiary data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-tertiary/25 data-today:not-data-[selected]:text-tertiary data-[highlighted]:bg-tertiary/20 hover:not-data-[selected]:bg-tertiary/20"
      }
    },
    {
      "color": "info" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-info/10 data-[selected]:text-info data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-info/25 data-today:not-data-[selected]:text-info data-[highlighted]:bg-info/20 hover:not-data-[selected]:bg-info/20"
      }
    },
    {
      "color": "success" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-success/10 data-[selected]:text-success data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-success/25 data-today:not-data-[selected]:text-success data-[highlighted]:bg-success/20 hover:not-data-[selected]:bg-success/20"
      }
    },
    {
      "color": "warning" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-warning/10 data-[selected]:text-warning data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-warning/25 data-today:not-data-[selected]:text-warning data-[highlighted]:bg-warning/20 hover:not-data-[selected]:bg-warning/20"
      }
    },
    {
      "color": "error" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-error/10 data-[selected]:text-error data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-error/25 data-today:not-data-[selected]:text-error data-[highlighted]:bg-error/20 hover:not-data-[selected]:bg-error/20"
      }
    },
    {
      "color": "gray" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-gray/10 data-[selected]:text-gray data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-gray/25 data-today:not-data-[selected]:text-gray data-[highlighted]:bg-gray/20 hover:not-data-[selected]:bg-gray/20"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-amber/10 data-[selected]:text-amber data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-amber/25 data-today:not-data-[selected]:text-amber data-[highlighted]:bg-amber/20 hover:not-data-[selected]:bg-amber/20"
      }
    },
    {
      "color": "sky" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-sky/10 data-[selected]:text-sky data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-sky/25 data-today:not-data-[selected]:text-sky data-[highlighted]:bg-sky/20 hover:not-data-[selected]:bg-sky/20"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-emerald/10 data-[selected]:text-emerald data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-emerald/25 data-today:not-data-[selected]:text-emerald data-[highlighted]:bg-emerald/20 hover:not-data-[selected]:bg-emerald/20"
      }
    },
    {
      "color": "zinc" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-zinc/10 data-[selected]:text-zinc data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-zinc/25 data-today:not-data-[selected]:text-zinc data-[highlighted]:bg-zinc/20 hover:not-data-[selected]:bg-zinc/20"
      }
    },
    {
      "color": "red" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-red/10 data-[selected]:text-red data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-red/25 data-today:not-data-[selected]:text-red data-[highlighted]:bg-red/20 hover:not-data-[selected]:bg-red/20"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-purple/10 data-[selected]:text-purple data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-purple/25 data-today:not-data-[selected]:text-purple data-[highlighted]:bg-purple/20 hover:not-data-[selected]:bg-purple/20"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-inverted data-[selected]:text-inverted data-today:not-data-[selected]:text-highlighted data-[highlighted]:bg-inverted/20 hover:not-data-[selected]:bg-inverted/10"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-accented data-[selected]:text-default data-[selected]:bg-default data-today:not-data-[selected]:text-highlighted data-[highlighted]:bg-inverted/10 hover:not-data-[selected]:bg-inverted/10"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-elevated data-[selected]:text-default data-today:not-data-[selected]:text-highlighted data-[highlighted]:bg-inverted/20 hover:not-data-[selected]:bg-inverted/10"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "cellTrigger": "data-[selected]:bg-elevated data-[selected]:text-default data-[selected]:ring data-[selected]:ring-inset data-[selected]:ring-accented data-today:not-data-[selected]:text-highlighted data-[highlighted]:bg-inverted/20 hover:not-data-[selected]:bg-inverted/10"
      }
    }
  ],
  "defaultVariants": {
    "size": "md" as typeof size[number],
    "color": "primary" as typeof color[number],
    "variant": "solid" as typeof variant[number]
  }
}