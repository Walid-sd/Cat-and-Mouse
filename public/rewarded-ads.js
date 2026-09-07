(() => {
  const panel = document.querySelector('#rewarded-ads-panel')
  const button = document.querySelector('#rewarded-ad-button')
  const status = document.querySelector('#rewarded-ad-status')
  if (!panel || !button || !status) return

  const config = window.CAT_MOUSE_ADS ?? { publisherId: '', testMode: true, rewardCoins: 15 }
  const rewardCoins = Number.isFinite(config.rewardCoins) && config.rewardCoins > 0 ? Math.floor(config.rewardCoins) : 15
  let adReady = false
  let rewarding = false

  const setStatus = message => { status.textContent = message }
  const setButton = (disabled, label) => {
    button.disabled = disabled
    button.textContent = label
  }

  const readProfile = () => {
    try {
      const raw = localStorage.getItem('cat-and-mouse-profile-v2')
      const profile = raw ? JSON.parse(raw) : null
      return profile && typeof profile === 'object' ? profile : null
    } catch {
      return null
    }
  }

  const grantReward = () => {
    if (rewarding) return
    rewarding = true
    const profile = readProfile()
    if (!profile) {
      setStatus('Your game profile could not be read. No coins were added.')
      setButton(false, `WATCH AD · +${rewardCoins} 🪙`)
      rewarding = false
      return
    }
    const currentCoins = Number.isFinite(profile.coins) ? Math.max(0, Math.floor(profile.coins)) : 0
    profile.coins = currentCoins + rewardCoins
    try {
      localStorage.setItem('cat-and-mouse-profile-v2', JSON.stringify(profile))
      setStatus(`Reward earned: +${rewardCoins} coins. Updating your balance…`)
      window.setTimeout(() => window.location.reload(), 250)
    } catch {
      setStatus('The reward could not be saved. No coins were added.')
      setButton(false, `WATCH AD · +${rewardCoins} 🪙`)
      rewarding = false
    }
  }

  const configureApi = () => {
    if (!window.adsbygoogle) window.adsbygoogle = []
    window.adBreak = window.adBreak || (options => window.adsbygoogle.push(options))
    window.adConfig = window.adConfig || (options => window.adsbygoogle.push(options))
    window.adConfig({ preloadAdBreaks: 'on' })
    adReady = true
    setButton(false, `WATCH AD · +${rewardCoins} 🪙`)
    setStatus(`Optional rewarded ad · complete the ad to earn +${rewardCoins} coins.`)
  }

  const loadAdsense = () => {
    if (!config.publisherId) {
      setStatus('Rewarded ads are ready but not enabled yet. Add the AdSense Publisher ID in public/ads-config.js after H5 Games Ads approval.')
      setButton(true, `WATCH AD · +${rewardCoins} 🪙`)
      return
    }

    const existing = document.querySelector('script[data-cat-mouse-adsense]')
    if (existing) { configureApi(); return }

    const script = document.createElement('script')
    script.async = true
    script.crossOrigin = 'anonymous'
    script.dataset.catMouseAdsense = 'true'
    script.dataset.adClient = config.publisherId
    if (config.testMode) script.dataset.adbreakTest = 'on'
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(config.publisherId)}`
    script.addEventListener('load', configureApi, { once: true })
    script.addEventListener('error', () => {
      setStatus('Rewarded ads could not load. You can keep playing normally.')
      setButton(false, `WATCH AD · +${rewardCoins} 🪙`)
    }, { once: true })
    document.head.appendChild(script)
  }

  const updateVisibility = () => {
    const menu = document.querySelector('.menu')
    panel.hidden = !menu
  }

  const primeAudioIfAvailable = () => {
    // The ad placement API handles its own playback; this hook intentionally avoids
    // coupling the static monetization layer to the React audio module.
  }

  button.addEventListener('click', () => {
    if (!adReady || rewarding || !window.adBreak) return
    primeAudioIfAvailable()
    setButton(true, 'LOADING REWARDED AD…')
    setStatus(`Watch the full rewarded ad to receive +${rewardCoins} coins.`)
    let earned = false
    window.adBreak({
      type: 'reward',
      name: 'cat-and-mouse-coins',
      beforeReward: showAd => {
        setStatus(`The ad is ready. Continue to earn +${rewardCoins} coins.`)
        showAd()
      },
      adViewed: () => {
        earned = true
        grantReward()
      },
      adDismissed: () => {
        if (!earned) {
          setStatus('Ad closed before completion. No coins were awarded.')
          setButton(false, `WATCH AD · +${rewardCoins} 🪙`)
        }
      },
      adBreakDone: info => {
        if (earned) return
        const statusText = info?.breakStatus && info.breakStatus !== 'viewed'
          ? 'No rewarded ad was available right now. You were not charged and no coins were added.'
          : 'Rewarded ad finished without a verified completion. No coins were added.'
        setStatus(statusText)
        setButton(false, `WATCH AD · +${rewardCoins} 🪙`)
      },
    })
  })

  loadAdsense()
  updateVisibility()
  new MutationObserver(updateVisibility).observe(document.querySelector('#root'), { childList: true, subtree: true })
})()
