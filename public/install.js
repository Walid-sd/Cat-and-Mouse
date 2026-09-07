(() => {
  let installPrompt = null
  const button = document.querySelector('#install-app')
  if (!button) return

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  const hide = () => {
    installPrompt = null
    button.hidden = true
  }

  if (isStandalone()) return

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    installPrompt = event
    button.hidden = false
  })

  button.addEventListener('click', async () => {
    if (!installPrompt) return
    const prompt = installPrompt
    hide()
    try {
      await prompt.prompt()
      await prompt.userChoice
    } catch {
      // Installation can be cancelled or become unavailable; the browser remains usable.
    }
  })

  window.addEventListener('appinstalled', hide)
})()
