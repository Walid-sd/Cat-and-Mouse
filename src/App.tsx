import { useCallback, useEffect, useMemo, useState } from 'react'
import { key, levels, shortestPath, type Level, type Point } from './game'

type Mode = 'escape' | 'hunt'
type Screen = 'menu' | 'game'

function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [mode, setMode] = useState<Mode>('escape')
  const [levelIndex, setLevelIndex] = useState(0)
  const [mouse, setMouse] = useState<Point>(levels[0].mouseStart)
  const [cat, setCat] = useState<Point>(levels[0].catStart)
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [riddleOpen, setRiddleOpen] = useState(false)
  const [riddleSolved, setRiddleSolved] = useState(false)
  const [notice, setNotice] = useState('Find the exit before the cat finds you.')
  const [gameOver, setGameOver] = useState(false)
  const [victory, setVictory] = useState(false)
  const [catThinking, setCatThinking] = useState(false)

  const level = levels[levelIndex]

  const resetLevel = useCallback((nextMode = mode, nextIndex = levelIndex) => {
    const next = levels[nextIndex]
    setMode(nextMode)
    setLevelIndex(nextIndex)
    setMouse(nextMode === 'escape' ? next.mouseStart : next.exit)
    setCat(nextMode === 'escape' ? next.catStart : next.mouseStart)
    setUnlocked(new Set())
    setRiddleOpen(false)
    setRiddleSolved(false)
    setNotice(nextMode === 'escape' ? 'Reach the lantern at the exit.' : 'Catch the mouse before it escapes.')
    setGameOver(false)
    setVictory(false)
    setCatThinking(false)
  }, [levelIndex, mode])

  const start = (selectedMode: Mode) => {
    resetLevel(selectedMode, 0)
    setScreen('game')
  }

  const finishLoss = useCallback(() => {
    setGameOver(true)
    setCatThinking(false)
    setNotice('The cat caught you. Every turn counts.')
  }, [])

  const finishWin = useCallback(() => {
    setVictory(true)
    setCatThinking(false)
    setNotice(mode === 'escape' ? 'You escaped the maze!' : 'The mouse is caught!')
  }, [mode])

  const moveCat = useCallback((mouseAfterMove: Point, currentCat: Point, currentUnlocked: Set<string>) => {
    setCatThinking(true)
    window.setTimeout(() => {
      const path = shortestPath(level.grid, currentCat, mouseAfterMove, currentUnlocked)
      if (path.length > 1) {
        const nextCat = path[1]
        setCat(nextCat)
        if (key(nextCat) === key(mouseAfterMove)) finishLoss()
      }
      setCatThinking(false)
    }, 250)
  }, [finishLoss, level.grid])

  const tryMove = useCallback((delta: Point) => {
    if (screen !== 'game' || riddleOpen || gameOver || victory || catThinking) return
    const target = { row: mouse.row + delta.row, col: mouse.col + delta.col }
    const cell = level.grid[target.row]?.[target.col]
    if (!cell || cell === '#') return
    const targetKey = key(target)

    if (cell === 'G' && !unlocked.has(targetKey)) {
      setRiddleOpen(true)
      return
    }

    setMouse(target)
    if (targetKey === key(cat)) {
      finishLoss()
      return
    }
    if (mode === 'escape' && targetKey === key(level.exit)) {
      finishWin()
      return
    }
    if (mode === 'hunt' && targetKey === key(level.exit)) {
      finishWin()
      return
    }
    moveCat(target, cat, unlocked)
  }, [screen, riddleOpen, gameOver, victory, catThinking, mouse, level, unlocked, cat, mode, finishLoss, finishWin, moveCat])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const moves: Record<string, Point> = {
        ArrowUp: { row: -1, col: 0 }, w: { row: -1, col: 0 },
        ArrowRight: { row: 0, col: 1 }, d: { row: 0, col: 1 },
        ArrowDown: { row: 1, col: 0 }, s: { row: 1, col: 0 },
        ArrowLeft: { row: 0, col: -1 }, a: { row: 0, col: -1 },
      }
      const move = moves[event.key]
      if (move) {
        event.preventDefault()
        tryMove(move)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tryMove])

  const answerRiddle = (answer: number) => {
    const riddle = level.riddles[0]
    if (answer === riddle.answer) {
      const next = new Set(unlocked)
      next.add(key(level.gates[0]))
      setUnlocked(next)
      setRiddleSolved(true)
      setNotice('Gate unlocked. The cat will move only after your next successful step.')
      window.setTimeout(() => setRiddleOpen(false), 700)
    } else {
      setNotice('Not quite. Think it through and try again.')
    }
  }

  const cells = useMemo(() => level.grid.flatMap((row, r) => [...row].map((cell, c) => ({ cell, p: { row: r, col: c } }))), [level])

  if (screen === 'menu') {
    return (
      <main className="shell menu">
        <div className="brand-mark"><span>🐭</span><span>🐱</span></div>
        <p className="eyebrow">A turn-based puzzle chase</p>
        <h1>CAT <em>&</em> MOUSE</h1>
        <p className="lede">Solve the maze. Outsmart the hunter.<br />Every move gives the cat a move.</p>
        <div className="mode-grid">
          <button className="mode-card" onClick={() => start('escape')}>
            <span className="mode-icon">🐭</span><strong>THE ESCAPE</strong><small>Play as the mouse</small><span className="play">ENTER MAZE →</span>
          </button>
          <button className="mode-card dark" onClick={() => start('hunt')}>
            <span className="mode-icon">🐱</span><strong>THE HUNT</strong><small>Play as the cat</small><span className="play">START HUNT →</span>
          </button>
        </div>
        <p className="tip">Arrow keys / WASD to move · Solve riddles to unlock gates</p>
      </main>
    )
  }

  return (
    <main className="shell game-shell">
      <header className="topbar">
        <button className="back" onClick={() => setScreen('menu')}>← MENU</button>
        <div className="title"><span>CAT & MOUSE</span><small>LEVEL {level.id} · {mode === 'escape' ? 'THE ESCAPE' : 'THE HUNT'}</small></div>
        <button className="reset" onClick={() => resetLevel()}>↻ RESET</button>
      </header>

      <section className="game-layout">
        <aside className="side-panel">
          <p className="eyebrow">{mode === 'escape' ? 'Escape protocol' : 'Hunt protocol'}</p>
          <h2>{level.name}</h2>
          <p className="subtitle">{level.subtitle}</p>
          <div className="status-card">
            <span className="status-dot" />
            <span>{catThinking ? 'CAT IS THINKING…' : notice}</span>
          </div>
          <div className="legend">
            <div><b>🐭</b> YOU</div><div><b>🐱</b> CAT</div><div><b>▣</b> LOCKED GATE</div><div><b>✦</b> EXIT</div>
          </div>
          <p className="rule">The cat uses the shortest available route through the maze. Walls and unsolved gates block its path.</p>
        </aside>

        <section className="board-wrap">
          <div className="board" style={{ gridTemplateColumns: `repeat(${level.grid[0].length}, 1fr)` }}>
            {cells.map(({ cell, p }) => {
              const isMouse = key(p) === key(mouse)
              const isCat = key(p) === key(cat)
              const isExit = key(p) === key(level.exit)
              const isGate = cell === 'G'
              const openGate = isGate && unlocked.has(key(p))
              return <div key={key(p)} className={`tile ${cell === '#' ? 'wall' : 'floor'} ${isExit ? 'exit' : ''} ${isGate ? 'gate' : ''} ${openGate ? 'open-gate' : ''}`}>
                {isExit && !isMouse && <span>✦</span>}
                {isGate && !openGate && <span>▣</span>}
                {isMouse && <span className="actor mouse">🐭</span>}
                {isCat && <span className={`actor cat ${catThinking ? 'thinking' : ''}`}>🐱</span>}
              </div>
            })}
          </div>
          <div className="controls"><button onClick={() => tryMove({row:-1,col:0})}>↑</button><button onClick={() => tryMove({row:0,col:-1})}>←</button><button onClick={() => tryMove({row:1,col:0})}>↓</button><button onClick={() => tryMove({row:0,col:1})}>→</button></div>
        </section>
      </section>

      {(riddleOpen || gameOver || victory) && <div className="overlay">
        {riddleOpen && !riddleSolved && <div className="modal">
          <span className="modal-kicker">LOCKED GATE · RIDDLE</span>
          <h2>One question stands<br />between you and freedom.</h2>
          <p className="question">{level.riddles[0].question}</p>
          <div className="answers">{level.riddles[0].choices.map((choice, i) => <button key={choice} onClick={() => answerRiddle(i)}>{String.fromCharCode(65+i)} <span>{choice}</span></button>)}</div>
          <small>The chase is paused while you think.</small>
        </div>}
        {gameOver && <div className="modal result"><span className="result-icon">🐱</span><span className="modal-kicker">CAUGHT</span><h2>The chase is over.</h2><p>The cat found the shortest route to you.</p><button className="primary" onClick={() => resetLevel()}>TRY AGAIN</button><button className="link" onClick={() => setScreen('menu')}>BACK TO MENU</button></div>}
        {victory && <div className="modal result"><span className="result-icon">{mode === 'escape' ? '🐭' : '🐱'}</span><span className="modal-kicker">{mode === 'escape' ? 'ESCAPED' : 'CAUGHT'}</span><h2>{mode === 'escape' ? 'You made it out.' : 'Perfect hunt.'}</h2><p>{mode === 'escape' ? 'The maze could not keep you.' : 'The mouse had nowhere left to run.'}</p><button className="primary" onClick={() => resetLevel()}>PLAY AGAIN</button><button className="link" onClick={() => setScreen('menu')}>BACK TO MENU</button></div>}
      </div>}
    </main>
  )
}

export default App
