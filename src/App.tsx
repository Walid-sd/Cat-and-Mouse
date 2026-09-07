import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isMuted, playSound, primeAudio, toggleMute } from './audio'
import { key, levels, neighbors, shortestPath, type Point } from './game'

type Mode = 'escape' | 'hunt'
type Screen = 'menu' | 'game'
type Progress = Record<Mode, number>

const PROGRESS_KEY = 'cat-and-mouse-progress-v1'
const DEFAULT_PROGRESS: Progress = { escape: 0, hunt: 0 }

function loadProgress(): Progress {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '') as Partial<Progress>
    return {
      escape: Math.max(0, Math.min(levels.length - 1, Number(parsed.escape) || 0)),
      hunt: Math.max(0, Math.min(levels.length - 1, Number(parsed.hunt) || 0)),
    }
  } catch {
    return DEFAULT_PROGRESS
  }
}

function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [mode, setMode] = useState<Mode>('escape')
  const [levelIndex, setLevelIndex] = useState(0)
  const level = levels[levelIndex]
  const [mouse, setMouse] = useState<Point>(level.mouseStart)
  const [cat, setCat] = useState<Point>(level.catStart)
  const [previousMouse, setPreviousMouse] = useState<Point | null>(null)
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [activeGate, setActiveGate] = useState(0)
  const [riddleOpen, setRiddleOpen] = useState(false)
  const [riddleError, setRiddleError] = useState('')
  const [gameOver, setGameOver] = useState(false)
  const [victory, setVictory] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [lastMover, setLastMover] = useState<Mode | null>(null)
  const [notice, setNotice] = useState('Reach the exit before the cat finds you.')
  const [moves, setMoves] = useState(0)
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [muted, setMuted] = useState(() => isMuted())
  const turnTimer = useRef<number | null>(null)
  const lastFocusedElement = useRef<HTMLElement | null>(null)
  const riddleFirstAnswer = useRef<HTMLButtonElement | null>(null)
  const resultFirstAction = useRef<HTMLButtonElement | null>(null)

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

  const markComplete = useCallback(() => {
    setProgress(previous => {
      const unlockedThrough = Math.min(levels.length - 1, levelIndex + 1)
      const next = { ...previous, [mode]: Math.max(previous[mode], unlockedThrough) }
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)) } catch { /* persistence is optional */ }
      return next
    })
  }, [levelIndex, mode])

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
    setVictory(true)
    setThinking(false)
    markComplete()
  }, [clearTurnTimer, markComplete])

  const mouseTurn = useCallback((currentCat: Point, currentMouse: Point, currentUnlocked: Set<string>, lastMouse: Point | null) => {
    const options = neighbors(level.grid, currentMouse, currentUnlocked).filter(p => key(p) !== key(currentCat))
    if (!options.length) return null

    const catOptions = neighbors(level.grid, currentCat, currentUnlocked).filter(p => key(p) !== key(currentMouse))
    const previousKey = lastMouse ? key(lastMouse) : null

    let best = options[0]
    let bestScore = -Infinity
    for (const option of options) {
      const distance = shortestPath(level.grid, currentCat, option, currentUnlocked).length
      const exitPath = shortestPath(level.grid, option, level.exit, currentUnlocked)
      const exitDistance = exitPath.length ? exitPath.length - 1 : 999
      const mobility = neighbors(level.grid, option, currentUnlocked).filter(p => key(p) !== key(currentCat)).length
      const reversePenalty = previousKey === key(option) ? 7 : 0

      // Look one turn ahead: assume the cat chooses its best immediate approach
      // to this candidate. This makes the mouse prefer positions that remain
      // difficult to reach, rather than simply maximizing today's distance.
      let worstCaseDistance = distance ? distance - 1 : 999
      if (catOptions.length) {
        worstCaseDistance = Math.min(...catOptions.map(catOption => {
          const path = shortestPath(level.grid, catOption, option, currentUnlocked)
          return path.length ? path.length - 1 : 999
        }))
      }

      // Distance from the current cat is still the primary survival signal.
      // Exit progress and available escape branches break common corridor ties.
      const score = distance * 8 + worstCaseDistance * 5 - exitDistance * 2 + mobility * 2 - reversePenalty
      if (score > bestScore) {
        bestScore = score
        best = option
      }
    }
    return best
  }, [level])

  const dangerDistance = useMemo(() => {
    if (mode !== 'escape' || gameOver || victory) return null
    const path = shortestPath(level.grid, cat, mouse, unlocked)
    return path.length ? path.length - 1 : null
  }, [mode, gameOver, victory, level, cat, mouse, unlocked])

  const danger = dangerDistance !== null && dangerDistance > 0 && dangerDistance <= 3
  const dangerNotice = dangerDistance === 1
    ? 'DANGER — THE CAT IS ONE STEP AWAY.'
    : `DANGER — THE CAT IS ${dangerDistance} STEPS AWAY.`

  const performMove = useCallback((delta: Point) => {
    if (screen !== 'game' || riddleOpen || gameOver || victory || thinking) return

    const actor = mode === 'escape' ? mouse : cat
    const target = { row: actor.row + delta.row, col: actor.col + delta.col }
    const cell = level.grid[target.row]?.[target.col]
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
      if (targetKey === key(cat)) {
        lose('You stepped directly into the cat.')
        return
      }
      if (targetKey === key(level.exit)) {
        win()
        return
      }

      setThinking(true)
      turnTimer.current = window.setTimeout(() => {
        playSound('opponent')
        const path = shortestPath(level.grid, cat, target, unlocked)
        if (path.length > 1) {
          const nextCat = path[1]
          setCat(nextCat)
          if (key(nextCat) === targetKey) lose('The cat reached your tile.')
        } else {
          setNotice('The cat has no valid route through the current maze.')
        }
        setThinking(false)
        turnTimer.current = null
      }, 250)
    } else {
      setCat(target)
      if (targetKey === key(mouse)) {
        win()
        return
      }

      setThinking(true)
      turnTimer.current = window.setTimeout(() => {
        playSound('opponent')
        const fleeing = mouseTurn(target, mouse, unlocked, previousMouse)
        if (!fleeing) {
          win()
          return
        }
        setPreviousMouse(mouse)
        setMouse(fleeing)
        if (key(fleeing) === key(target)) {
          win()
        } else if (key(fleeing) === key(level.exit)) {
          lose('The mouse reached the exit.')
        }
        setThinking(false)
        turnTimer.current = null
      }, 250)
    }
  }, [screen, riddleOpen, gameOver, victory, thinking, mode, mouse, cat, level, unlocked, previousMouse, lose, win, mouseTurn])

  const toggleSound = () => {
    const nextMuted = toggleMute()
    setMuted(nextMuted)
    if (!nextMuted) {
      primeAudio()
      playSound('start')
    }
  }

  useEffect(() => {
    if (!riddleOpen) return
    const focusTimer = window.setTimeout(() => riddleFirstAnswer.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [riddleOpen, activeGate])

  useEffect(() => {
    if (riddleOpen) return
    const element = lastFocusedElement.current
    if (element && document.contains(element)) {
      element.focus()
      lastFocusedElement.current = null
    }
  }, [riddleOpen])

  useEffect(() => {
    if (!gameOver && !victory) return
    const focusTimer = window.setTimeout(() => resultFirstAction.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [gameOver, victory])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (riddleOpen) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setRiddleOpen(false)
          setRiddleError('')
        }
        return
      }
      if (gameOver || victory) {
        if (event.key === 'Escape') {
          event.preventDefault()
          clearTurnTimer()
          setGameOver(false)
          setVictory(false)
          setScreen('menu')
        }
        return
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return

      if (event.key.toLowerCase() === 'm') {
        event.preventDefault()
        toggleSound()
        return
      }

      const movesByKey: Record<string, Point> = {
        ArrowUp: { row: -1, col: 0 }, w: { row: -1, col: 0 }, W: { row: -1, col: 0 },
        ArrowRight: { row: 0, col: 1 }, d: { row: 0, col: 1 }, D: { row: 0, col: 1 },
        ArrowDown: { row: 1, col: 0 }, s: { row: 1, col: 0 }, S: { row: 1, col: 0 },
        ArrowLeft: { row: 0, col: -1 }, a: { row: 0, col: -1 }, A: { row: 0, col: -1 },
      }
      const move = movesByKey[event.key]
      if (move) {
        event.preventDefault()
        performMove(move)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [performMove, riddleOpen, gameOver, victory, clearTurnTimer])

  const answer = (choice: number) => {
    const riddle = level.riddles[activeGate]
    if (!riddle) return
    if (choice === riddle.answer) {
      primeAudio()
      playSound('gate')
      const next = new Set(unlocked)
      next.add(key(level.gates[activeGate]))
      setUnlocked(next)
      setRiddleOpen(false)
      setRiddleError('')
      setNotice(`Gate ${activeGate + 1} unlocked. ${riddle.explanation}`)
    } else {
      playSound('error')
      setRiddleError('Not quite. The gate stays locked — try again.')
    }
  }

  const cells = useMemo(
    () => level.grid.flatMap((row, r) => [...row].map((cell, c) => ({ cell, p: { row: r, col: c } }))),
    [level],
  )

  if (screen === 'menu') {
    return (
      <main className="shell menu">
        <div className="brand-mark"><span>🐭</span><span>🐱</span></div>
        <p className="eyebrow">A turn-based puzzle chase</p>
        <h1>CAT <em>&</em> MOUSE</h1>
        <p className="lede">Solve the maze. Outsmart the hunter.<br />Every move changes the board.</p>
        <div className="mode-grid">
          <button className="mode-card" onClick={() => start('escape')}>
            <span className="mode-icon">🐭</span><strong>THE ESCAPE</strong><small>Play as the mouse</small><span className="play">ENTER MAZE →</span>
          </button>
          <button className="mode-card dark" onClick={() => start('hunt')}>
            <span className="mode-icon">🐱</span><strong>THE HUNT</strong><small>Play as the cat</small><span className="play">START HUNT →</span>
          </button>
        </div>
        <button className="sound-toggle" onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>{muted ? '◌ SOUND OFF' : '◉ SOUND ON'}</button>
        <p className="tip">Arrow keys / WASD · Solve riddles · M toggles sound</p>
      </main>
    )
  }

  return (
    <main className="shell game-shell">
      <header className="topbar">
        <button className="back" onClick={() => { clearTurnTimer(); setScreen('menu') }}>← MENU</button>
        <div className="title"><span>CAT & MOUSE</span><small>LEVEL {level.id} · {mode === 'escape' ? 'THE ESCAPE' : 'THE HUNT'}</small></div>
        <div className="top-actions">
          <button className="sound-toggle" onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>{muted ? '◌' : '◉'} SOUND</button>
          <button className="reset" onClick={() => reset()}>↻ RESET</button>
        </div>
      </header>

      <section className="game-layout">
        <aside className="side-panel">
          <p className="eyebrow">{mode === 'escape' ? 'Escape protocol' : 'Hunt protocol'}</p>
          <h2>{level.name}</h2>
          <p className="subtitle">{level.subtitle}</p>
          <div className={`status-card ${danger && !thinking ? 'danger' : ''}`} role={danger && !thinking ? 'alert' : undefined}>
            <span className={`status-dot ${thinking ? 'thinking' : ''} ${danger && !thinking ? 'danger' : ''} ${lastMover === mode && !thinking && !danger ? 'active' : ''}`} />
            <span>{thinking ? 'THE OTHER PLAYER IS MOVING…' : danger ? dangerNotice : notice}</span>
          </div>
          <div className="stats"><span>TURN <b>{moves}</b></span><span>GATES <b>{unlocked.size}/{level.gates.length}</b></span></div>
          <div className="legend"><div><b>🐭</b> MOUSE</div><div><b>🐱</b> CAT</div><div><b>▣</b> LOCKED GATE</div><div><b>✦</b> EXIT</div></div>
          <p className="rule">{mode === 'escape' ? 'The cat follows the shortest valid BFS route after every successful mouse step.' : 'You control the cat. After each cat move, the mouse takes one evasive turn.'}</p>
          <div className="level-strip" aria-label="Level selection">
            {levels.map((l, i) => <button key={l.id} className={i === levelIndex ? 'active' : ''} disabled={i > progress[mode]} onClick={() => reset(mode, i)} aria-label={`Level ${l.id}${i > progress[mode] ? ', locked' : ''}`}>0{l.id}</button>)}
          </div>
        </aside>

        <section className="board-wrap">
          <div className={`board ${danger && !thinking ? 'danger' : ''}`} style={{ gridTemplateColumns: `repeat(${level.grid[0].length}, 1fr)` }} aria-label={`${level.name} maze`}>
            {cells.map(({ cell, p }) => {
              const isMouse = key(p) === key(mouse)
              const isCat = key(p) === key(cat)
              const isExit = key(p) === key(level.exit)
              const isGate = cell === 'G'
              const openGate = isGate && unlocked.has(key(p))
              return <div key={key(p)} className={`tile ${cell === '#' ? 'wall' : 'floor'} ${isExit ? 'exit' : ''} ${isGate ? 'gate' : ''} ${openGate ? 'open-gate' : ''} ${isMouse ? 'has-mouse' : ''} ${isCat ? 'has-cat' : ''}`}>
                {isExit && !isMouse && <span aria-hidden="true">✦</span>}
                {isGate && !openGate && <span aria-hidden="true">▣</span>}
                {isMouse && <span className={`actor mouse ${lastMover === 'escape' && !thinking ? 'moved' : ''}`} aria-label="Mouse">🐭</span>}
                {isCat && <span className={`actor cat ${thinking ? 'thinking' : ''} ${lastMover === 'hunt' && !thinking ? 'moved' : ''} ${danger && !thinking ? 'danger' : ''}`} aria-label="Cat">🐱</span>}
              </div>
            })}
          </div>

          <div className="controls" aria-label="Movement controls">
            <button aria-label="Move up" onClick={() => performMove({ row: -1, col: 0 })}>↑</button>
            <div><button aria-label="Move left" onClick={() => performMove({ row: 0, col: -1 })}>←</button><button aria-label="Move down" onClick={() => performMove({ row: 1, col: 0 })}>↓</button><button aria-label="Move right" onClick={() => performMove({ row: 0, col: 1 })}>→</button></div>
          </div>
        </section>
      </section>

      {riddleOpen && level.riddles[activeGate] && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setRiddleOpen(false) }}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="riddle-title">
          <p className="eyebrow">Gate {activeGate + 1} · Riddle</p>
          <h2 id="riddle-title">{level.riddles[activeGate].question}</h2>
          <div className="choices">
            {level.riddles[activeGate].choices.map((choice, index) => <button key={choice} ref={index === 0 ? riddleFirstAnswer : undefined} onClick={() => answer(index)}>{choice}</button>)}
          </div>
          {riddleError && <p className="error" role="alert">{riddleError}</p>}
          <button className="modal-close" onClick={() => { setRiddleOpen(false); setRiddleError('') }}>CLOSE</button>
        </div>
      </div>}

      {gameOver && <div className="modal-backdrop" role="presentation"><div className="modal result" role="dialog" aria-modal="true" aria-labelledby="result-title"><p className="eyebrow">The hunt is over</p><h2 id="result-title">CAUGHT.</h2><p>{notice}</p><button ref={resultFirstAction} onClick={() => reset()}>TRY AGAIN</button><button className="modal-close" onClick={() => setScreen('menu')}>MENU</button></div></div>}
      {victory && <div className="modal-backdrop" role="presentation"><div className="modal result" role="dialog" aria-modal="true" aria-labelledby="victory-title"><p className="eyebrow">Maze cleared</p><h2 id="victory-title">ESCAPED.</h2><p>{mode === 'escape' ? 'You reached the exit.' : 'You caught the mouse.'}</p><button ref={resultFirstAction} onClick={() => { if (levelIndex < levels.length - 1 && progress[mode] >= levelIndex + 1) reset(mode, levelIndex + 1); else reset() }}>CONTINUE</button><button className="modal-close" onClick={() => setScreen('menu')}>MENU</button></div></div>}
    </main>
  )
}

export default App
