import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { installAudioBridge } from './audio-bridge'

installAudioBridge()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
