import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isMuted, playSound, primeAudio, toggleMute } from './audio'
import { gridForMode, key, levels, neighbors, shortestPath, type Point } from './game'
import { addCoins, characters, collectCoin as collectPersistentCoin, coinKey, coinSpawns, completeLevel, loadProfile, saveProfile, selectCharacter, unlockCharacter, type PlayerProfile } from './progression'

type Mode = 'escape' | 'hunt'
type Screen = 'menu' | 'game'

const PROGRESS_KEY = 'cat-and-mouse-progress-v1'

function loadLegacyProgress(): Record<Mode, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '') as Partial<Record<Mode, number>>
    return {
      escape: Math.max(0, Math.min(levels.length - 1, Number(parsed.escape) || 0)),
      hunt: Math.max(0, Math.min(levels.length - 1, Number(parsed.hunt) || 0)),
    }
  } catch {
    return { escape: 0, hunt: 0 }
  }
}

function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [mode, setMode] = useState<Mode>('escape')
  const [levelIndex, setLevelIndex] = useState(0)
  const level = levels[levelIndex]
  const grid = gridForMode(level, mode)
  const [mouse, setMouse] = useState<Point>(level.mouseStart)
  const [cat, setCat] = useState<Point>(level.catStart)
  const [previousMouse, setPreviousMouse] = useState<Point | null>(null)
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [activeGate, setActiveGate] = useState(0)
  const [riddleOpen, setRiddleOpen] = useState(false)
  const [riddleError, setRiddleError] = useState('')
  const [gameOver, setGameOver] = useState(false)
  const [victory, setVictory] = useState(false)
  const [rewardEarned, setRewardEarned] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [lastMover, setLastMover] = useState<Mode | null>(null)
  const [notice, setNotice] = useState('Reach the exit before the cat finds you.')
  const [moves, setMoves] = useState(0)
  const [profile, setProfile] = useState<PlayerProfile>(() => {
    const loaded = loadProfile()
    const legacy = loadLegacyProgress()
    if (legacy.escape > loaded.completed.escape || legacy.hunt > loaded.completed.hunt) {
      const migrated = { ...loaded, completed: { escape: Math.max(loaded.completed.escape, legacy.escape), hunt: Math.max(loaded.completed.hunt, legacy.hunt) } }
      saveProfile(migrated)
      return migrated
    }
    return loaded
  })
  const [muted, setMuted] = useState(() => isMuted())
  const turnTimer = useRef<number | null>(null)
  const lastFocusedElement = useRef<HTMLElement | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)
  const riddleFirstAnswer = useRef<HTMLButtonElement | null>(null)
  const resultFirstAction = useRef<HTMLButtonElement | null>(null)

  const coins = useMemo(() => coinSpawns(grid, level.id * 31 + (mode === 'hunt' ? 17 : 0), [level.mouseStart, level.catStart, level.exit, ...level.gates]), [grid, level, mode])
  const progress = profile.completed
  const selectedMouse = characters.find(character => character.id === profile.selected.mouse) ?? characters[0]
  const selectedCat = characters.find(character => character.id === profile.selected.cat) ?? characters.find(character => character.role === 'cat')!

  const clearTurnTimer = useCallback(() => {
    if (turnTimer.current !== null) {
      window.clearTimeout(turnTimer.current)
      turnTimer.current = null
    }
  }, [])

  useEffect(() => clearTurnTimer, [clearTurnTimer])

  const reset = useCallback((m: Mode = mode, index: number = levelIndex) => {
    clearTurnTimer()
    const l = levels[index]
    setMode(m)
    setLevelIndex(index)
    setMouse(l.mouseStart)
    setCat(l.catStart)
    setPreviousMouse(null)
    setUnlocked(new Set())
    setActiveGate(0)
    setRiddleOpen(false)
    setRiddleError('')
    setGameOver(false)
    setVictory(false)
    setRewardEarned(false)
    setThinking(false)
    setLastMover(null)
    setMoves(0)
    setNotice(m === 'escape' ? 'Reach the exit before the cat finds you.' : 'Catch the mouse before it reaches the exit.')
  }, [clearTurnTimer, levelIndex, mode])

  const start = (m: Mode) => {
    primeAudio()
    playSound('start')
    reset(m, 0)
    setScreen('game')
  }

  const chooseCharacter = (role: 'mouse' | 'cat', id: string) => {
    const character = characters.find(candidate => candidate.id === id && candidate.role === role)
    if (!character) return
    let next = profile
    if (!profile.unlocked.includes(id)) {
      next = unlockCharacter(profile, id)
      if (next === profile) {
        setNotice(`Not enough coins for ${character.name}. You need ${character.cost} coins.`)
        primeAudio(); playSound('error')
        return
      }
    }
    next = selectCharacter(next, role, id)
    if (next === profile) return
    setProfile(next)
    saveProfile(next)
    primeAudio()
    playSound('gate')
  }

  const markComplete = useCallback(() => {
    setProfile(previous => {
      const next = completeLevel(previous, mode, levelIndex)
      saveProfile(next)
      return next
    })
  }, [levelIndex, mode])

  const collectCoin = useCallback((point: Point) => {
    const coin = coinKey(level.id, mode, point)
    if (!coins.some(candidate => key(candidate) === key(point)) || profile.collectedCoins.includes(coin)) return
    setProfile(previous => {
      const next = collectPersistentCoin(previous, coin)
      saveProfile(next)
      return next
    })
    playSound('gate')
    setNotice('+1 COIN — KEEP GOING.')
  }, [coins, level.id, mode, profile.collectedCoins])

  const lose = useCallback((message = 'Caught. The shortest path wins.') => {
    clearTurnTimer()
    playSound('lose')
    setGameOver(true)
    setThinking(false)
    setNotice(message)
  }, [clearTurnTimer])

  const win = useCallback(() => {
    clearTurnTimer()
    playSound('win')
    setRewardEarned(profile.completed[mode] <= levelIndex)
    setVictory(true)
    setThinking(false)
    markComplete()
  }, [clearTurnTimer, levelIndex, mode, profile.completed, markComplete])

  const mouseTurn = useCallback((currentCat: Point, currentMouse: Point, currentUnlocked: Set<string>, lastMouse: Point | null) => {
    const options = neighbors(grid, currentMouse, currentUnlocked).filter(p => key(p) !== key(currentCat))
    if (!options.length) return null
    const catOptions = neighbors(grid, currentCat, currentUnlocked).filter(p => key(p) !== key(currentMouse))
    const previousKey = lastMouse ? key(lastMouse) : null
    let best = options[0]
    let bestScore = -Infinity
    for (const option of options) {
      const distance = shortestPath(grid, currentCat, option, currentUnlocked).length
      const exitPath = shortestPath(grid, option, level.exit, currentUnlocked)
      const exitDistance = exitPath.length ? exitPath.length - 1 : 999
      const mobility = neighbors(grid, option, currentUnlocked).filter(p => key(p) !== key(currentCat)).length
      const reversePenalty = previousKey === key(option) ? 7 : 0
      let worstCaseDistance = distance ? distance - 1 : 999
      if (catOptions.length) {
        worstCaseDistance = Math.min(...catOptions.map(catOption => {
          const path = shortestPath(grid, catOption, option, currentUnlocked)
          return path.length ? path.length - 1 : 999
        }))
      }
      const score = distance * 8 + worstCaseDistance * 5 - exitDistance * 2 + mobility * 2 - reversePenalty
      if (score > bestScore) { bestScore = score; best = option }
    }
    return best
  }, [grid, level.exit])

  const dangerDistance = useMemo(() => {
    if (mode !== 'escape' || gameOver || victory) return null
    const path = shortestPath(grid, cat, mouse, unlocked)
    return path.length ? path.length - 1 : null
  }, [mode, gameOver, victory, grid, cat, mouse, unlocked])

  const danger = dangerDistance !== null && dangerDistance > 0 && dangerDistance <= 3
  const dangerNotice = dangerDistance === 1 ? 'DANGER — THE CAT IS ONE STEP AWAY.' : `DANGER — THE CAT IS ${dangerDistance} STEPS AWAY.`

  const performMove = useCallback((delta: Point) => {
    if (screen !== 'game' || riddleOpen || gameOver || victory || thinking) return
    const actor = mode === 'escape' ? mouse : cat
    const target = { row: actor.row + delta.row, col: actor.col + delta.col }
    const cell = grid[target.row]?.[target.col]
    if (!cell || cell === '#') return
    const targetKey = key(target)
    if (cell === 'G' && !unlocked.has(targetKey)) {
      primeAudio()
      lastFocusedElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const gateIndex = level.gates.findIndex(g => key(g) === targetKey)
      setActiveGate(gateIndex < 0 ? 0 : gateIndex)
      setRiddleError('')
      setRiddleOpen(true)
      return
    }
    primeAudio()
    playSound('move')
    setMoves(value => value + 1)
    setLastMover(mode)
    if (mode === 'escape') {
      setMouse(target)
      collectCoin(target)
      if (targetKey === key(cat)) { lose('You stepped directly into the cat.'); return }
      if (targetKey === key(level.exit)) { win(); return }
      setThinking(true)
      turnTimer.current = window.setTimeout(() => {
        playSound('opponent')
        const path = shortestPath(grid, cat, target, unlocked)
        if (path.length > 1) {
          const nextCat = path[1]
          setCat(nextCat)
          if (key(nextCat) === targetKey) lose('The cat reached your tile.')
        } else setNotice('The cat has no valid route through the current maze.')
        setThinking(false)
        turnTimer.current = null
      }, 250)
    } else {
      setCat(target)
      collectCoin(target)
      if (targetKey === key(mouse)) { win(); return }
      setThinking(true)
      turnTimer.current = window.setTimeout(() => {
        playSound('opponent')
        const fleeing = mouseTurn(target, mouse, unlocked, previousMouse)
        if (!fleeing) { win(); return }
        setPreviousMouse(mouse)
        setMouse(fleeing)
        if (key(fleeing) === key(target)) win()
        else if (key(fleeing) === key(level.exit)) lose('The mouse reached the exit.')
        setThinking(false)
        turnTimer.current = null
      }, 250)
    }
  }, [screen, riddleOpen, gameOver, victory, thinking, mode, mouse, cat, grid, level, unlocked, previousMouse, lose, win, mouseTurn, collectCoin])

  const toggleSound = () => {
    const nextMuted = toggleMute()
    setMuted(nextMuted)
    if (!nextMuted) { primeAudio(); playSound('start') }
  }

  useEffect(() => {
    if (!riddleOpen) return
    const focusTimer = window.setTimeout(() => riddleFirstAnswer.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [riddleOpen, activeGate])

  useEffect(() => {
    if (!riddleOpen && !gameOver && !victory) return
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const modal = modalRef.current
      if (!modal) return
      const focusable = Array.from(modal.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
      if (!focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [riddleOpen, gameOver, victory])

  useEffect(() => {
    if (riddleOpen) return
    const element = lastFocusedElement.current
    if (element && document.contains(element)) { element.focus(); lastFocusedElement.current = null }
  }, [riddleOpen])

  useEffect(() => {
    if (!gameOver && !victory) return
    const focusTimer = window.setTimeout(() => resultFirstAction.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [gameOver, victory])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (riddleOpen) {
        if (event.key === 'Escape') { event.preventDefault(); setRiddleOpen(false); setRiddleError('') }
        return
      }
      if (gameOver || victory) {
        if (event.key === 'Escape') { event.preventDefault(); clearTurnTimer(); setGameOver(false); setVictory(false); setScreen('menu') }
        return
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return
      if (event.key.toLowerCase() === 'm') { event.preventDefault(); toggleSound(); return }
      const movesByKey: Record<string, Point> = {
        ArrowUp: { row: -1, col: 0 }, w: { row: -1, col: 0 }, W: { row: -1, col: 0 },
        ArrowRight: { row: 0, col: 1 }, d: { row: 0, col: 1 }, D: { row: 0, col: 1 },
        ArrowDown: { row: 1, col: 0 }, s: { row: 1, col: 0 }, S: { row: 1, col: 0 },
        ArrowLeft: { row: 0, col: -1 }, a: { row: 0, col: -1 }, A: { row: 0, col: -1 },
      }
      const move = movesByKey[event.key]
      if (move) { event.preventDefault(); performMove(move) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [performMove, riddleOpen, gameOver, victory, clearTurnTimer])

  const answer = (choice: number) => {
    const riddle = level.riddles[activeGate]
    if (!riddle) return
    if (choice === riddle.answer) {
      primeAudio(); playSound('gate')
      const next = new Set(unlocked)
      next.add(key(level.gates[activeGate]))
      setUnlocked(next); setRiddleOpen(false); setRiddleError('')
      setNotice(`Gate ${activeGate + 1} unlocked. ${riddle.explanation}`)
    } else { playSound('error'); setRiddleError('Not quite. The gate stays locked — try again.') }
  }

  const cells = useMemo(() => grid.flatMap((row, r) => [...row].map((cell, c) => ({ cell, p: { row: r, col: c } }))), [grid])
  const resultTitle = gameOver ? (mode === 'escape' ? 'CAUGHT.' : 'ESCAPED.') : (mode === 'escape' ? 'ESCAPED.' : 'CAUGHT.')
  const resultEyebrow = gameOver ? (mode === 'escape' ? 'The hunt is over' : 'The mouse got away') : (mode === 'escape' ? 'Maze cleared' : 'Hunt successful')
  const resultMessage = gameOver ? notice : (mode === 'escape' ? 'You reached the exit.' : 'You caught the mouse.')

  if (screen === 'menu') {
    return (
      <main className="shell menu">
        <div className="brand-mark"><span>{selectedMouse.emoji}</span><span>{selectedCat.emoji}</span></div>
        <p className="eyebrow">A turn-based puzzle chase</p>
        <h1>CAT <em>&</em> MOUSE</h1>
        <p className="lede">Solve the maze. Outsmart the hunter.<br />Every move changes the board.</p>
        <div className="mode-grid">
          <button className="mode-card" onClick={() => start('escape')}><span className="mode-icon">{selectedMouse.emoji}</span><strong>THE ESCAPE</strong><small>Play as the mouse</small><span className="play">ENTER MAZE →</span></button>
          <button className="mode-card dark" onClick={() => start('hunt')}><span className="mode-icon">{selectedCat.emoji}</span><strong>THE HUNT</strong><small>Play as the cat</small><span className="play">START HUNT →</span></button>
        </div>
        <section className="character-panel" aria-label="Character selection and shop">
          <div className="character-header"><span>CHARACTERS</span><strong>🪙 {profile.coins}</strong></div>
          <div className="character-group"><small>MOUSE</small><div className="character-row">{characters.filter(c => c.role === 'mouse').map(character => { const unlockedCharacter = profile.unlocked.includes(character.id); const selected = profile.selected.mouse === character.id; return <button key={character.id} className={`${selected ? 'character-card selected' : 'character-card'} ${!unlockedCharacter ? 'locked' : ''}`} onClick={() => chooseCharacter('mouse', character.id)} aria-pressed={selected} aria-label={`${character.name}, ${unlockedCharacter ? (selected ? 'selected' : 'unlocked') : `${character.cost} coins to unlock`}`}><span>{character.emoji}</span><b>{character.name}</b><small>{selected ? 'SELECTED' : unlockedCharacter ? 'USE' : `🪙 ${character.cost}`}</small></button> })}</div></div>
          <div className="character-group"><small>CAT</small><div className="character-row">{characters.filter(c => c.role === 'cat').map(character => { const unlockedCharacter = profile.unlocked.includes(character.id); const selected = profile.selected.cat === character.id; return <button key={character.id} className={`${selected ? 'character-card selected' : 'character-card'} ${!unlockedCharacter ? 'locked' : ''}`} onClick={() => chooseCharacter('cat', character.id)} aria-pressed={selected} aria-label={`${character.name}, ${unlockedCharacter ? (selected ? 'selected' : 'unlocked') : `${character.cost} coins to unlock`}`}><span>{character.emoji}</span><b>{character.name}</b><small>{selected ? 'SELECTED' : unlockedCharacter ? 'USE' : `🪙 ${character.cost}`}</small></button> })}</div></div>
        </section>
        <button className="sound-toggle" onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>{muted ? '◌ SOUND OFF' : '◉ SOUND ON'}</button>
        <p className="tip">Arrow keys / WASD · Touch controls · Solve riddles · Collect coins</p>
      </main>
    )
  }

  return (
    <main className="shell game-shell">
      <header className="topbar">
        <button className="back" onClick={() => { clearTurnTimer(); setScreen('menu') }}>← MENU</button>
        <div className="title"><span>CAT & MOUSE</span><small>LEVEL {level.id} · {mode === 'escape' ? 'THE ESCAPE' : 'THE HUNT'}</small></div>
        <div className="top-actions"><span className="coin-counter" aria-label={`${profile.coins} coins`}>🪙 {profile.coins}</span><button className="sound-toggle" onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>{muted ? '◌' : '◉'} SOUND</button><button className="reset" onClick={() => reset()}>↻ RESET</button></div>
      </header>
      <section className="game-layout">
        <aside className="side-panel">
          <p className="eyebrow">{mode === 'escape' ? 'Escape protocol' : 'Hunt protocol'}</p><h2>{level.name}</h2><p className="subtitle">{level.subtitle}</p>
          <div className={`status-card ${danger && !thinking ? 'danger' : ''}`} role={danger && !thinking ? 'alert' : undefined} aria-live="polite" aria-atomic="true"><span className={`status-dot ${thinking ? 'thinking' : ''} ${danger && !thinking ? 'danger' : ''} ${lastMover === mode && !thinking && !danger ? 'active' : ''}`} /><span>{thinking ? 'THE OTHER PLAYER IS MOVING…' : danger ? dangerNotice : notice}</span></div>
          <div className="stats"><span>TURN <b>{moves}</b></span><span>GATES <b>{unlocked.size}/{level.gates.length}</b></span><span>COINS <b>{profile.coins}</b></span></div>
          <div className="legend"><div><b>{selectedMouse.emoji}</b> MOUSE</div><div><b>{selectedCat.emoji}</b> CAT</div><div><b>🪙</b> COIN</div><div><b>▣</b> LOCKED GATE</div><div><b>✦</b> EXIT</div></div>
          <p className="rule">{mode === 'escape' ? 'The cat follows the shortest valid BFS route after every successful mouse step.' : 'You control the cat. After each cat move, the mouse takes one evasive turn.'}</p>
          <div className="level-strip" aria-label="Level selection">{levels.map((l, i) => <button key={l.id} className={i === levelIndex ? 'active' : ''} disabled={i > progress[mode]} onClick={() => reset(mode, i)} aria-label={`Level ${l.id}${i > progress[mode] ? ', locked' : ''}`}>0{l.id}</button>)}</div>
        </aside>
        <section className="board-wrap">
          <div className={`board ${danger && !thinking ? 'danger' : ''}`} style={{ gridTemplateColumns: `repeat(${grid[0].length}, 1fr)`, gridTemplateRows: `repeat(${grid.length}, 1fr)` }} aria-label={`${level.name} maze`}>
            {cells.map(({ cell, p }) => {
              const isMouse = key(p) === key(mouse), isCat = key(p) === key(cat), isExit = key(p) === key(level.exit), isGate = cell === 'G', openGate = isGate && unlocked.has(key(p))
              const coinId = coinKey(level.id, mode, p), hasCoin = coins.some(coin => key(coin) === key(p)) && !profile.collectedCoins.includes(coinId) && !isMouse && !isCat
              return <div key={key(p)} className={`tile ${cell === '#' ? 'wall' : 'floor'} ${isExit ? 'exit' : ''} ${isGate ? 'gate' : ''} ${openGate ? 'open-gate' : ''} ${isMouse ? 'has-mouse' : ''} ${isCat ? 'has-cat' : ''}`}>
                {isExit && !isMouse && <span aria-hidden="true">✦</span>}{isGate && !openGate && <span aria-hidden="true">▣</span>}{hasCoin && <span className="coin" aria-label="Coin">🪙</span>}
                {isMouse && <span className="actor mouse" aria-label="Mouse">{selectedMouse.emoji}</span>}{isCat && <span className={`actor cat ${thinking ? 'thinking' : ''} ${danger && !thinking ? 'danger' : ''}`} aria-label="Cat">{selectedCat.emoji}</span>}
              </div>
            })}
          </div>
          <div className="controls" aria-label="Movement controls"><button aria-label="Move up" onClick={() => performMove({ row: -1, col: 0 })}>↑</button><div><button aria-label="Move left" onClick={() => performMove({ row: 0, col: -1 })}>←</button><button aria-label="Move down" onClick={() => performMove({ row: 1, col: 0 })}>↓</button><button aria-label="Move right" onClick={() => performMove({ row: 0, col: 1 })}>→</button></div></div>
        </section>
      </section>
      {riddleOpen && level.riddles[activeGate] && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setRiddleOpen(false) }}><div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="riddle-title"><p className="eyebrow">Gate {activeGate + 1} · Riddle</p><h2 id="riddle-title">{level.riddles[activeGate].question}</h2><div className="choices">{level.riddles[activeGate].choices.map((choice, index) => <button key={choice} ref={index === 0 ? riddleFirstAnswer : undefined} onClick={() => answer(index)}>{choice}</button>)}</div>{riddleError && <p className="error" role="alert">{riddleError}</p>}<button className="modal-close" onClick={() => { setRiddleOpen(false); setRiddleError('') }}>CLOSE</button></div></div>}
      {gameOver && <div className="modal-backdrop" role="presentation"><div ref={modalRef} className="modal result" role="dialog" aria-modal="true" aria-labelledby="result-title"><p className="eyebrow">{resultEyebrow}</p><h2 id="result-title">{resultTitle}</h2><p>{resultMessage}</p><button ref={resultFirstAction} onClick={() => reset()}>TRY AGAIN</button><button className="modal-close" onClick={() => setScreen('menu')}>MENU</button></div></div>}
      {victory && <div className="modal-backdrop" role="presentation"><div ref={modalRef} className="modal result" role="dialog" aria-modal="true" aria-labelledby="victory-title"><p className="eyebrow">{resultEyebrow}</p><h2 id="victory-title">{resultTitle}</h2><p>{resultMessage}</p>{rewardEarned ? <p className="reward">🪙 +10 coins · Total: {profile.coins}</p> : <p className="reward">No first-time reward · Total: {profile.coins}</p>}<button ref={resultFirstAction} onClick={() => { if (levelIndex < levels.length - 1 && progress[mode] >= levelIndex + 1) reset(mode, levelIndex + 1); else reset() }}>CONTINUE</button><button className="modal-close" onClick={() => setScreen('menu')}>MENU</button></div></div>}
    </main>
  )
}

export default App
