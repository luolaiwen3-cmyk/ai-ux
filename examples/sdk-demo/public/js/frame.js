(() => {
  const framed = window.parent !== window
  document.documentElement.classList.add(framed ? 'in-frame' : 'standalone')

  const params = new URLSearchParams(window.location.search)
  const keep = ['taskId', 'parentOrigin', 'sdkSrc']
    .filter((key) => params.get(key))
    .map((key) => [key, params.get(key)])
  if (keep.length === 0) return

  const withQuery = (href) => {
    const url = new URL(href, window.location.origin)
    if (url.origin !== window.location.origin) return href
    keep.forEach(([key, value]) => {
      if (!url.searchParams.get(key)) url.searchParams.set(key, value)
    })
    return `${url.pathname}${url.search}${url.hash}`
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]')
    if (!link) return
    const next = withQuery(link.getAttribute('href'))
    if (next !== link.getAttribute('href')) link.setAttribute('href', next)
  })

  document.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() !== 'get') return
    keep.forEach(([key, value]) => {
      if ([...form.elements].some((el) => el.name === key)) return
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = key
      input.value = value
      form.append(input)
    })
  })
})()
