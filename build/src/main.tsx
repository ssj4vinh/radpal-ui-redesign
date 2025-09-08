console.log('🔥 MAIN.TSX LOADING - Entry point reached!');
import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

console.log('🔥 MAIN.TSX IMPORTS COMPLETE - About to render App');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
