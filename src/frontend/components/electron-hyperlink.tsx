

import React from "react"
import { cn } from "@/lib/utils"

interface ElectronLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
}

export function ElectronLink({ href, onClick, className, ...props }: ElectronLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()

    if (new URL(href)) {
      if (window.electronAPI) {
        window.electronAPI.shell.openExternal(href)
      } else {
        window.open(href, "_blank")
      }
    }

    if (onClick) onClick(e)
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className={cn(className)}
      {...props}
    />
  )
}
