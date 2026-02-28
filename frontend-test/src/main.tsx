import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import AppRouter from './AppRouter.tsx'
import { WalletProvider } from './context/WalletContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <AppRouter />
      </WalletProvider>
    </BrowserRouter>
  </StrictMode>,
)
