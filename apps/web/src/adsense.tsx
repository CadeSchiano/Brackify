import { useEffect } from 'react'

declare global { interface Window { adsbygoogle?: unknown[] } }

const client = import.meta.env.VITE_ADSENSE_CLIENT

function loadAdSense() {
  if (!client || document.querySelector('script[data-brackify-adsense]')) return
  const script = document.createElement('script')
  script.async = true
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`
  script.crossOrigin = 'anonymous'
  script.dataset.brackifyAdsense = 'true'
  document.head.append(script)
}

/** Loads the AdSense site code in the document head when a publisher ID is configured. */
export function AdSenseLoader() {
  useEffect(() => { loadAdSense() }, [])
  return null
}

/** Renders only after the public AdSense client and a placement slot are configured. */
export function AdSlot({ slot, format = 'auto', className = '' }: { slot?: string; format?: 'auto' | 'horizontal'; className?: string }) {
  useEffect(() => {
    if (!client || !slot) return
    const showAd = () => {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch { /* Ad blockers can block AdSense. */ }
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-brackify-adsense]')
    if (existing) {
      showAd()
      return
    }
    loadAdSense()
    document.querySelector<HTMLScriptElement>('script[data-brackify-adsense]')?.addEventListener('load', showAd, { once: true })
  }, [slot])
  if (!client || !slot) return null
  return <div className={`adsense-slot ${className}`} aria-label="Advertisement">
    <ins className="adsbygoogle" style={{ display: 'block' }} data-ad-client={client} data-ad-slot={slot} data-ad-format={format} data-full-width-responsive="true" />
  </div>
}
