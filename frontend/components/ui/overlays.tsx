"use client";

import { Check } from "lucide-react";
import { DropdownMenu as DM, Popover as P, Tooltip as T } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/* ---------- Tooltip ---------- */
export function Tooltip({
  content,
  children,
  side = "top",
  disabled,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  disabled?: boolean;
}) {
  if (disabled) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-[60] max-w-xs rounded-sm bg-text px-2.5 py-1.5 text-xs text-white shadow-md data-[state=delayed-open]:animate-fade-in"
        >
          {content}
          <T.Arrow className="fill-text" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

/* ---------- DropdownMenu ---------- */
export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;

export function DropdownMenuContent({
  className,
  align = "end",
  ...props
}: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-50 min-w-48 overflow-hidden rounded-md border border-border bg-surface p-1 shadow-md data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({
  className,
  danger,
  ...props
}: React.ComponentProps<typeof DM.Item> & { danger?: boolean }) {
  return (
    <DM.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2.5 py-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-muted data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-text-muted",
        danger && "text-danger data-[highlighted]:bg-danger-bg [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DM.CheckboxItem>) {
  return (
    <DM.CheckboxItem
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-2 pe-2.5 ps-8 text-sm outline-none data-[highlighted]:bg-surface-muted",
        className,
      )}
      {...props}
    >
      <DM.ItemIndicator className="absolute start-2.5">
        <Check className="size-4 text-primary-600" aria-hidden />
      </DM.ItemIndicator>
      {children}
    </DM.CheckboxItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn("px-2.5 py-2 text-xs text-text-muted", className)} {...props} />;
}

export function DropdownMenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-border" />;
}

/* ---------- Popover ---------- */
export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;

export function PopoverContent({ className, align = "start", ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-50 w-72 rounded-md border border-border bg-surface p-3 shadow-md outline-none data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      />
    </P.Portal>
  );
}
