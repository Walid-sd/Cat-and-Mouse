import { useCallback, useEffect, useMemo, useState } from 'react'
import { key, levels, neighbors, shortestPath, type Point } from './game'

type Mode = 'escape' | 'hunt'
type Screen = 'menu' | 'game'

function App() {
  const [screen,setScreen]=useState<Screen>('menu')
  const [mode,setMode]=useState<Mode>('escape')
  const [levelIndex,setLevelIndex]=useState(0)
  const level=levels[levelIndex]
  const [mouse,setMouse]=useState<Point>(level.mouseStart)
  const [cat,setCat]=useState<Point>(level.catStart)
  const [unlocked,setUnlocked]=useState<Set<string>>(new Set())
  const [activeGate,setActiveGate]=useState(0)
  const [riddleOpen,setRiddleOpen]=useState(false)
  const [gameOver,setGameOver]=useState(false)
  const [victory,setVictory]=useState(false)
  const [thinking,setThinking]=useState(false)
  const [notice,setNotice]=useState('Reach the exit before the cat finds you.')

  const reset=useCallback((m=mode,index=levelIndex)=>{
    const l=levels[index]
    setMode(m);setLevelIndex(index);setMouse(m==='escape'?l.mouseStart:l.exit);setCat(m==='escape'?l.catStart:l.mouseStart)
    setUnlocked(new Set());setActiveGate(0);setRiddleOpen(false);setGameOver(false);setVictory(false);setThinking(false)
    setNotice(m==='escape'?'Reach the exit before the cat finds you.':'Catch the mouse before it reaches the exit.')
  },[mode,levelIndex])
  const start=(m:Mode)=>{reset(m,0);setScreen('game')}
  const lose=useCallback(()=>{setGameOver(true);setThinking(false);setNotice('Caught. The shortest path wins.')},[])
  const win=useCallback(()=>{setVictory(true);setThinking(false)},[])

  // In Hunt mode the player is the cat. The mouse takes one evasive turn after each cat move.
  const mouseTurn=useCallback((currentCat:Point,currentMouse:Point,currentUnlocked:Set<string>)=>{
    const options=neighbors(level.grid,currentMouse,currentUnlocked).filter(p=>key(p)!==key(currentCat))
    if(!options.length)return currentMouse
    let best=options[0],bestScore=-Infinity
    for(const option of options){
      const distance=shortestPath(level.grid,currentCat,option,currentUnlocked).length
      const exitDistance=shortestPath(level.grid,option,level.exit,currentUnlocked).length
      const score=distance*4-exitDistance
      if(score>bestScore){bestScore=score;best=option}
    }
    return best
  },[level])

  const performMove=useCallback((delta:Point)=>{
    if(screen!=='game'||riddleOpen||gameOver||victory||thinking)return
    const actor=mode==='escape'?mouse:cat
    const target={row:actor.row+delta.row,col:actor.col+delta.col}
    const cell=level.grid[target.row]?.[target.col]
    if(!cell||cell==='#')return
    const targetKey=key(target)
    if(cell==='G'&&!unlocked.has(targetKey)){
      const gateIndex=level.gates.findIndex(g=>key(g)===targetKey)
      setActiveGate(gateIndex<0?0:gateIndex);setRiddleOpen(true);return
    }
    if(mode==='escape'){
      setMouse(target)
      if(targetKey===key(cat)){lose();return}
      if(targetKey===key(level.exit)){win();return}
      setThinking(true)
      window.setTimeout(()=>{
        const path=shortestPath(level.grid,cat,target,unlocked)
        if(path.length>1){const next=path[1];setCat(next);if(key(next)===targetKey)lose()}
        setThinking(false)
      },250)
    }else{
      setCat(target)
      if(targetKey===key(mouse)){win();return}
      if(targetKey===key(level.exit)){setNotice('The mouse has nowhere left to run.');return}
      setThinking(true)
      window.setTimeout(()=>{
        const fleeing=mouseTurn(target,mouse,unlocked);setMouse(fleeing)
        if(key(fleeing)===key(target))win()
        else if(key(fleeing)===key(level.exit))lose()
        setThinking(false)
      },250)
    }
  },[screen,riddleOpen,gameOver,victory,thinking,mode,mouse,cat,level,unlocked,lose,win,mouseTurn])

  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{const m:Record<string,Point>={ArrowUp:{row:-1,col:0},w:{row:-1,col:0},ArrowRight:{row:0,col:1},d:{row:0,col:1},ArrowDown:{row:1,col:0},s:{row:1,col:0},ArrowLeft:{row:0,col:-1},a:{row:0,col:-1}};if(m[e.key]){e.preventDefault();performMove(m[e.key])}}
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)
  },[performMove])

  const answer=(choice:number)=>{
    const r=level.riddles[activeGate]
    if(!r)return
    if(choice===r.answer){const next=new Set(unlocked);next.add(key(level.gates[activeGate]));setUnlocked(next);setRiddleOpen(false);setNotice('Gate unlocked. Make your next move.')}else setNotice('Incorrect. The gate remains locked.')
  }
  const cells=useMemo(()=>level.grid.flatMap((row,r)=>[...row].map((cell,c)=>({cell,p:{row:r,col:c}}))),[level])

  if(screen==='menu')return <main className="shell menu"><div className="brand-mark"><span>🐭</span><span>🐱</span></div><p className="eyebrow">A turn-based puzzle chase</p><h1>CAT <em>&</em> MOUSE</h1><p className="lede">Solve the maze. Outsmart the hunter.<br/>Every move changes the board.</p><div className="mode-grid"><button className="mode-card" onClick={()=>start('escape')}><span className="mode-icon">🐭</span><strong>THE ESCAPE</strong><small>Play as the mouse</small><span className="play">ENTER MAZE →</span></button><button className="mode-card dark" onClick={()=>start('hunt')}><span className="mode-icon">🐱</span><strong>THE HUNT</strong><small>Play as the cat</small><span className="play">START HUNT →</span></button></div><p className="tip">Arrow keys / WASD · Solve riddles · Outsmart the shortest path</p></main>

  return <main className="shell game-shell"><header className="topbar"><button className="back" onClick={()=>setScreen('menu')}>← MENU</button><div className="title"><span>CAT & MOUSE</span><small>LEVEL {level.id} · {mode==='escape'?'THE ESCAPE':'THE HUNT'}</small></div><button className="reset" onClick={()=>reset()}>↻ RESET</button></header><section className="game-layout"><aside className="side-panel"><p className="eyebrow">{mode==='escape'?'Escape protocol':'Hunt protocol'}</p><h2>{level.name}</h2><p className="subtitle">{level.subtitle}</p><div className="status-card"><span className="status-dot"/><span>{thinking?'THE OTHER PLAYER IS MOVING…':notice}</span></div><div className="legend"><div><b>🐭</b> MOUSE</div><div><b>🐱</b> CAT</div><div><b>▣</b> LOCKED GATE</div><div><b>✦</b> EXIT</div></div><p className="rule">{mode==='escape'?'The cat follows the shortest valid BFS route after every successful mouse step.':'You control the cat. After each cat move, the mouse chooses an evasive route.'}</p><div className="level-strip">{levels.map((l,i)=><button key={l.id} className={i===levelIndex?'active':''} onClick={()=>reset(mode,i)}>0{l.id}</button>)}</div></aside><section className="board-wrap"><div className="board" style={{gridTemplateColumns:`repeat(${level.grid[0].length},1fr)`}}>{cells.map(({cell,p})=>{const km=key(p)===key(mouse),kc=key(p)===key(cat),exit=key(p)===key(level.exit),gate=cell==='G',open=gate&&unlocked.has(key(p));return <div key={key(p)} className={`tile ${cell==='#'?'wall':'floor'} ${exit?'exit':''} ${gate?'gate':''} ${open?'open-gate':''}`}>{exit&&!km&&<span>✦</span>}{gate&&!open&&<span>▣</span>}{km&&<span className="actor mouse">🐭</span>}{kc&&<span className={`actor cat ${thinking?'thinking':''}`}>🐱</span>}</div>})}</div><div className="controls"><button onClick={()=>performMove({row:-1,col:0})}>↑</button><button onClick={()=>performMove({row:0,col:-1})}>←</button><button onClick={()=>performMove({row:1,col:0})}>↓</button><button onClick={()=>performMove({row:0,col:1})}>→</button></div></section></section>
  {(riddleOpen||gameOver||victory)&&<div className="overlay">{riddleOpen&&<div className="modal"><span className="modal-kicker">LOCKED GATE · RIDDLE {activeGate+1}</span><h2>One question stands<br/>between you and the next turn.</h2><p className="question">{level.riddles[activeGate]?.question}</p><div className="answers">{level.riddles[activeGate]?.choices.map((choice,i)=><button key={choice} onClick={()=>answer(i)}>{String.fromCharCode(65+i)} <span>{choice}</span></button>)}</div><small>The chase is paused while you think.</small></div>}{gameOver&&<div className="modal result"><span className="result-icon">{mode==='escape'?'🐱':'🐭'}</span><span className="modal-kicker">{mode==='escape'?'CAUGHT':'ESCAPED'}</span><h2>{mode==='escape'?'The chase is over.':'The mouse got away.'}</h2><p>{mode==='escape'?'The cat found the shortest route to you.':'You could not close the distance in time.'}</p><button className="primary" onClick={()=>reset()}>TRY AGAIN</button><button className="link" onClick={()=>setScreen('menu')}>BACK TO MENU</button></div>}{victory&&<div className="modal result"><span className="result-icon">{mode==='escape'?'🐭':'🐱'}</span><span className="modal-kicker">{mode==='escape'?'ESCAPED':'CAUGHT'}</span><h2>{mode==='escape'?'You made it out.':'Perfect hunt.'}</h2><p>{mode==='escape'?'The maze could not keep you.':'The mouse had nowhere left to run.'}</p>{levelIndex<levels.length-1&&<button className="primary" onClick={()=>reset(mode,levelIndex+1)}>NEXT LEVEL →</button>}<button className="link" onClick={()=>setScreen('menu')}>BACK TO MENU</button></div>}</div>}
  </main>
}
export default App
