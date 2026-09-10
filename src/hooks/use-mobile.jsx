import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

    const resolveViewportWidth = () => {
      const candidates = [
        window.innerWidth,
        document.documentElement?.clientWidth,
        window.screen?.width,
        window.visualViewport?.width,
      ].filter((value) => typeof value === "number" && value > 0)

      return candidates.length > 0 ? Math.min(...candidates) : window.innerWidth
    }

    const onChange = () => {
      setIsMobile(resolveViewportWidth() < MOBILE_BREAKPOINT)
    }

    // Safari iOS y algunos WebView antiguos no implementan addEventListener
    // sobre MediaQueryList; si asumimos ese API, la app puede romperse al montar.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange)
    } else if (typeof mql.addListener === "function") {
      mql.addListener(onChange)
    }

    window.addEventListener("orientationchange", onChange)
    window.addEventListener("resize", onChange)
    setIsMobile(resolveViewportWidth() < MOBILE_BREAKPOINT)

    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", onChange)
      } else if (typeof mql.removeListener === "function") {
        mql.removeListener(onChange)
      }

      window.removeEventListener("orientationchange", onChange)
      window.removeEventListener("resize", onChange)
    }
  }, [])

  return !!isMobile
}
