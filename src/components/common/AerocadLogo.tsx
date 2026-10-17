import React from 'react'
import logoSrc from '@/assets/aerocadlogo2026-crm-4307b.png'

export { logoSrc }

export interface AerocadLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string
  alt?: string
}

/**
 * Componente oficial da Logo AEROCAD 2026.
 * Arte oficial em alta resolução com o símbolo ® posicionado à direita do D.
 * Usa object-contain para preservar rigorosamente a proporção natural (~4.94:1).
 */
export function AerocadLogo({
  className = 'h-8 w-auto object-contain',
  alt = 'AEROCAD',
  style,
  ...props
}: AerocadLogoProps) {
  return (
    <img
      src={logoSrc}
      alt={alt}
      className={className}
      style={{
        maxHeight: '44px',
        maxWidth: '220px',
        height: 'auto',
        width: 'auto',
        objectFit: 'contain',
        ...style,
      }}
      loading="eager"
      decoding="async"
      {...props}
    />
  )
}

export default AerocadLogo
