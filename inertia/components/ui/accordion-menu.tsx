import * as React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AccordionMenuClassNames = {
  root?: string
  group?: string
  label?: string
  separator?: string
  item?: string
  sub?: string
  subTrigger?: string
  subContent?: string
  indicator?: string
}

type AccordionMenuContextValue = {
  selectedValue?: string
  matchPath?: (path: string) => boolean
  classNames?: AccordionMenuClassNames
}

const AccordionMenuContext = React.createContext<AccordionMenuContextValue>({})

interface AccordionMenuProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root> {
  selectedValue?: string
  matchPath?: (path: string) => boolean
  classNames?: AccordionMenuClassNames
}

const AccordionMenu = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Root>,
  AccordionMenuProps
>(({ selectedValue, matchPath, classNames, className, children, ...props }, ref) => {
  return (
    <AccordionMenuContext.Provider value={{ selectedValue, matchPath, classNames }}>
      <AccordionPrimitive.Root ref={ref} className={cn(classNames?.root, className)} {...props}>
        {children}
      </AccordionPrimitive.Root>
    </AccordionMenuContext.Provider>
  )
})
AccordionMenu.displayName = 'AccordionMenu'

const AccordionMenuGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { classNames } = React.useContext(AccordionMenuContext)
    return (
      <div ref={ref} className={cn('flex flex-col', classNames?.group, className)} {...props} />
    )
  }
)
AccordionMenuGroup.displayName = 'AccordionMenuGroup'

const AccordionMenuLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { classNames } = React.useContext(AccordionMenuContext)
    return (
      <div
        ref={ref}
        className={cn('px-3 py-2 text-xs font-semibold', classNames?.label, className)}
        {...props}
      />
    )
  }
)
AccordionMenuLabel.displayName = 'AccordionMenuLabel'

interface AccordionMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const AccordionMenuItem = React.forwardRef<HTMLDivElement, AccordionMenuItemProps>(
  ({ value, className, children, ...props }, ref) => {
    const { selectedValue, matchPath, classNames } = React.useContext(AccordionMenuContext)
    const isSelected = matchPath ? matchPath(value) : selectedValue === value

    return (
      <div
        ref={ref}
        data-selected={isSelected}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors',
          classNames?.item,
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
AccordionMenuItem.displayName = 'AccordionMenuItem'

interface AccordionMenuSubProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item> {}

const AccordionMenuSub = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  AccordionMenuSubProps
>(({ className, ...props }, ref) => {
  const { classNames } = React.useContext(AccordionMenuContext)
  return <AccordionPrimitive.Item ref={ref} className={cn(classNames?.sub, className)} {...props} />
})
AccordionMenuSub.displayName = 'AccordionMenuSub'

interface AccordionMenuSubTriggerProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> {}

const AccordionMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  AccordionMenuSubTriggerProps
>(({ className, children, ...props }, ref) => {
  const { classNames } = React.useContext(AccordionMenuContext)
  return (
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'flex w-full items-center justify-between gap-2 px-3 py-1.5 rounded-md text-sm transition-colors [&[data-state=open]>svg]:rotate-180',
        classNames?.subTrigger,
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 flex-1">{children}</div>
      <ChevronDown
        className={cn('h-4 w-4 shrink-0 transition-transform duration-200', classNames?.indicator)}
      />
    </AccordionPrimitive.Trigger>
  )
})
AccordionMenuSubTrigger.displayName = 'AccordionMenuSubTrigger'

interface AccordionMenuSubContentProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> {
  type?: 'single' | 'multiple'
  collapsible?: boolean
  parentValue?: string
}

const AccordionMenuSubContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  AccordionMenuSubContentProps
>(({ className, children, type, collapsible, parentValue, ...props }, ref) => {
  const { classNames } = React.useContext(AccordionMenuContext)

  // If nested accordion is needed
  if (type) {
    return (
      <AccordionPrimitive.Content
        ref={ref}
        className={cn(
          'overflow-hidden transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
          classNames?.subContent,
          className
        )}
        {...props}
      >
        <AccordionMenu type={type} collapsible={collapsible}>
          {children}
        </AccordionMenu>
      </AccordionPrimitive.Content>
    )
  }

  return (
    <AccordionPrimitive.Content
      ref={ref}
      className={cn(
        'overflow-hidden transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
        classNames?.subContent,
        className
      )}
      {...props}
    >
      {children}
    </AccordionPrimitive.Content>
  )
})
AccordionMenuSubContent.displayName = 'AccordionMenuSubContent'

export {
  AccordionMenu,
  AccordionMenuGroup,
  AccordionMenuLabel,
  AccordionMenuItem,
  AccordionMenuSub,
  AccordionMenuSubTrigger,
  AccordionMenuSubContent,
}
